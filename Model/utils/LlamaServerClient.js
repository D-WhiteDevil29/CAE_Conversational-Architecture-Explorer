import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Manages the llama.cpp server binary as a child process and exposes
 * an OpenAI-compatible HTTP client for text generation.
 *
 * The server binary is already compiled at llama.cpp/build/bin/llama-server.
 * It keeps the model loaded in memory, serving requests over HTTP — the same
 * pattern used by QwenVisionClient for image inference.
 */
class LlamaServerClient {
  constructor() {
    this.serverProcess = null;
    this.serverPort = parseInt(process.env.LLAMA_SERVER_PORT) || 8081;
    this.serverReady = false;
    this._startPromise = null;

    // Resolve model path relative to the Model/ directory
    const modelRoot = path.join(__dirname, '..');
    this.modelPath = process.env.GGUF_MODEL_PATH
      ? path.resolve(modelRoot, process.env.GGUF_MODEL_PATH)
      : path.join(modelRoot, 'llama-3.1-8b.gguf');

    this.serverBinary = path.join(
      __dirname, '..', 'llama.cpp', 'build', 'bin', 'llama-server'
    );
    this.baseUrl = `http://127.0.0.1:${this.serverPort}`;
  }

  // ─── Health check ────────────────────────────────────────────────────────

  async isServerRunning() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Server lifecycle ─────────────────────────────────────────────────────

  async start() {
    // De-duplicate concurrent start calls
    if (this._startPromise) return this._startPromise;
    if (this.serverReady && (await this.isServerRunning())) return;

    this._startPromise = this._doStart().finally(() => {
      this._startPromise = null;
    });
    return this._startPromise;
  }

  async _doStart() {
    // If another process already holds the port (e.g. a previous run), reuse it
    if (await this.isServerRunning()) {
      console.log(`[LlamaServer] Found existing server on port ${this.serverPort} — reusing`);
      this.serverReady = true;
      return;
    }

    // Guard: binary must exist
    try {
      await fs.access(this.serverBinary);
    } catch {
      throw new Error(`llama-server binary not found at: ${this.serverBinary}`);
    }

    // Guard: model must exist
    try {
      await fs.access(this.modelPath);
    } catch {
      throw new Error(
        `Model file not found at: ${this.modelPath}\n` +
        `Set GGUF_MODEL_PATH in .env to the correct path.`
      );
    }

    console.log(`[LlamaServer] Starting on port ${this.serverPort} with model: ${path.basename(this.modelPath)}`);

    this.serverProcess = spawn(
      this.serverBinary,
      [
        '-m', this.modelPath,
        '--port', String(this.serverPort),
        '--host', '127.0.0.1',
        '--ctx-size', String(parseInt(process.env.LLAMA_CTX_SIZE) || 8192),
        '--parallel', '1',     // one request at a time (single-user)
        '--log-disable',        // suppress verbose llama logs
      ],
      { detached: false, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    // Forward server logs at debug level
    this.serverProcess.stdout.on('data', (d) => process.stdout.write(`[llama-server] ${d}`));
    this.serverProcess.stderr.on('data', (d) => process.stdout.write(`[llama-server] ${d}`));

    this.serverProcess.on('exit', (code) => {
      console.log(`[LlamaServer] Process exited (code ${code})`);
      this.serverReady = false;
      this.serverProcess = null;
    });

    // Ensure child is cleaned up when the parent Node process exits
    const cleanup = () => this.stop();
    process.once('exit', cleanup);
    process.once('SIGINT', () => { cleanup(); process.exit(0); });
    process.once('SIGTERM', () => { cleanup(); process.exit(0); });

    await this._waitForReady(120_000);
  }

  async _waitForReady(timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isServerRunning()) {
        this.serverReady = true;
        console.log('[LlamaServer] Server is ready ✓');
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('llama-server failed to become ready within the timeout');
  }

  stop() {
    if (this.serverProcess) {
      console.log('[LlamaServer] Stopping server...');
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
      this.serverReady = false;
    }
  }

  // ─── Inference ────────────────────────────────────────────────────────────

  /**
   * Send a chat request to the llama-server OpenAI-compatible endpoint.
   *
   * @param {string}                  systemPrompt
   * @param {Array<{role,content}>}   messageHistory  Previous turns (may be empty)
   * @param {string}                  userMessage     Current user message
   * @param {object}                  options
   * @param {number}  [options.maxTokens=800]
   * @param {number}  [options.temperature=0.7]
   * @param {number}  [options.topP=0.9]
   * @param {number}  [options.repeatPenalty=1.1]
   * @param {string[]}[options.stop=[]]
   * @returns {Promise<string>}
   */
  async chat(systemPrompt, messageHistory, userMessage, options = {}) {
    if (!this.serverReady) {
      await this.start();
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...messageHistory,
      { role: 'user', content: userMessage },
    ];

    const body = {
      messages,
      max_tokens:     options.maxTokens    ?? 800,
      temperature:    options.temperature  ?? 0.7,
      top_p:          options.topP         ?? 0.9,
      repeat_penalty: options.repeatPenalty ?? 1.1,
      stop:           options.stop         ?? [],
      stream:         false,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout((options.timeoutMs ?? 180_000)),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`llama-server HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content ?? '';
  }
}

export default LlamaServerClient;
