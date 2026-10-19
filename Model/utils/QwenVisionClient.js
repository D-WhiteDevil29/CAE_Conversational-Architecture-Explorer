import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class QwenVisionClient {
  constructor() {
    this.modelPath = path.join(__dirname, '..', 'qwen2.5-model', 'Qwen2.5-VL-7B-Instruct-Q8_0.gguf');
    this.mmprojPath = path.join(__dirname, '..', 'qwen2.5-model', 'mmproj-F16.gguf');
    this.llamaCppDir = path.join(__dirname, '..', 'llama.cpp');
  }

  /**
   * Find the best available llama.cpp vision binary.
   *
   * Search order:
   *  1. cmake build output:  llama.cpp/build/bin/
   *  2. Makefile build output: llama.cpp/  (make puts binaries in the root)
   *  3. System PATH (llama-cli installed via brew or elsewhere)
   */
  async findBinary() {
    const binaryNames = [
      'llama-mtmd-cli',      // current multimodal binary (replaces qwen2vl-cli)
      'llama-llava-cli',     // older fallback
      'llama-cli',           // text-only last resort
    ];

    const searchDirs = [
      path.join(this.llamaCppDir, 'build', 'bin'),
      this.llamaCppDir,
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ];

    for (const dir of searchDirs) {
      for (const name of binaryNames) {
        const fullPath = path.join(dir, name);
        try {
          await fs.access(fullPath);
          console.log(`[QwenVision] Found binary: ${fullPath}`);
          return { path: fullPath, name };
        } catch {
          // not found in this location, keep searching
        }
      }
    }

    throw new Error(
      `No llama.cpp vision binary found.\n\n` +
      `Run the setup script:\n` +
      `  bash Model/scripts/setup-vision.sh\n\n` +
      `Searched in:\n` +
      searchDirs.map(d => `  ${d}`).join('\n')
    );
  }

  /**
   * Analyze an image buffer with a given prompt.
   * Writes a temp file, runs the vision binary, returns the text output.
   */
  async analyzeImage(imageBuffer, prompt, options = {}) {
    const { path: binary, name: binaryName } = await this.findBinary();

    const tmpImagePath = path.join(os.tmpdir(), `cae-vision-${uuidv4()}.jpg`);
    await fs.writeFile(tmpImagePath, imageBuffer);

    try {
      const args = [
        '--model', this.modelPath,
        '--mmproj', this.mmprojPath,
        '--image', tmpImagePath,
        '--prompt', prompt,
        '-n', String(options.maxTokens || 1500),
        '--temp', String(options.temperature || 0.1),
      ];

      console.log(`[QwenVision] Using binary: ${binaryName}`);
      return await this._runBinary(binary, args, options.timeoutMs || 180000);
    } finally {
      await fs.unlink(tmpImagePath).catch(() => {});
    }
  }

  /**
   * Extract structured architecture data from a diagram image.
   * Returns { components, relationships, layers, description }.
   */
  async extractArchitectureStructure(imageBuffer) {
    const prompt =
      'You are an architecture diagram parser. Analyze this diagram and extract all visible components and relationships. ' +
      'Return ONLY a JSON object in this exact format, no other text:\n' +
      '{\n' +
      '  "components": [\n' +
      '    {"name": "ComponentName", "type": "service|database|api|gateway|frontend|external|module|queue", "layer": "layer name or null"}\n' +
      '  ],\n' +
      '  "relationships": [\n' +
      '    {"from": "ComponentA", "to": "ComponentB", "type": "calls|uses|stores|publishes|subscribes|depends_on", "label": "description or null"}\n' +
      '  ],\n' +
      '  "layers": ["layer names here"],\n' +
      '  "description": "one sentence summary of what this architecture shows"\n' +
      '}';

    const raw = await this.analyzeImage(imageBuffer, prompt, {
      maxTokens: 3000,
      temperature: 0.05,
      timeoutMs: 240000,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        'Model did not return parseable JSON from the image.\n' +
        'Raw output (first 400 chars): ' + raw.slice(0, 400)
      );
    }

    // First try parsing as-is
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {
      // JSON may be truncated at token limit — attempt repair
      const repaired = this._repairTruncatedJSON(jsonMatch[0]);
      try {
        return JSON.parse(repaired);
      } catch (parseError) {
        throw new Error('Failed to parse JSON from model output: ' + parseError.message);
      }
    }
  }

  /**
   * Attempt to close a truncated JSON string so it can be parsed.
   * Handles unclosed strings, arrays, and objects.
   */
  _repairTruncatedJSON(str) {
    // Remove trailing partial token (e.g. cut mid-string or mid-key)
    let s = str.trimEnd();

    // Remove trailing comma before closing
    s = s.replace(/,\s*$/, '');

    // Track open brackets/braces
    const stack = [];
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escape) { escape = false; continue; }
      if (c === '\\' && inString) { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }

    // Close any unclosed string
    if (inString) s += '"';

    // Close any trailing comma after repair
    s = s.replace(/,\s*$/, '');

    // Close open brackets/braces in reverse order
    while (stack.length > 0) {
      s += stack.pop();
    }

    return s;
  }

  _runBinary(binary, args, timeoutMs) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errOutput = '';

      const proc = spawn(binary, args);

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Vision inference timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errOutput += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        // Strip Metal init lines, WARNING lines, and any blank lines before
        // the real model output. These come on stdout for llama-mtmd-cli.
        const cleaned = output
          .split('\n')
          .filter(line => {
            const l = line.trim();
            return l.length > 0 &&
              !l.startsWith('ggml_metal') &&
              !l.startsWith('ggml_') &&
              !l.startsWith('WARNING:') &&
              !l.startsWith('llm_') &&
              !l.startsWith('llama_') &&
              !l.startsWith('load_') &&
              !l.startsWith('main:') &&
              !l.startsWith('system_info:') &&
              !l.startsWith('sampler') &&
              !l.startsWith('generate:') &&
              !l.startsWith('prompt eval') &&
              !l.startsWith('eval count');
          })
          .join('\n')
          .trim();
        if (code !== 0 && cleaned.length === 0) {
          reject(new Error(`Vision binary exited ${code}.\nstderr: ${errOutput.slice(0, 400)}`));
        } else {
          resolve(cleaned);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to launch vision binary: ${err.message}`));
      });
    });
  }
}

export default QwenVisionClient;
