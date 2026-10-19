import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GeminiParaphraser
 *
 * Takes the raw draft answer produced by the local Llama model and re-writes
 * it into a polished, well-structured Markdown response using Gemini 2.5 Flash.
 *
 * Role in the pipeline
 * ─────────────────────
 *   1. RAG retrieval         (TF-IDF + MemoryVectorStore)
 *   2. Local Llama draft     (llama-server via LlamaServerClient)
 *   3. Gemini polish  ←  THIS CLASS                             ← here
 *   4. Return to user
 *
 * Fallback chain when Gemini is unavailable:
 *   gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash → localFormatMarkdown()
 */

// ─── Local markdown formatter (no API required) ───────────────────────────────
function localFormatMarkdown(rawText) {
  let text = rawText.trim();

  // Bold known Singtel system / technical names if not already bolded
  const SYSTEM_NAMES = [
    'ECOM', 'ESOM', 'Kenan', 'Paragon', 'Dapr', 'Redis', 'Spring',
    'Oracle', 'PostgreSQL', 'MongoDB', 'NPP', 'DDI', 'Bamboo', 'Jira',
    'Confluence', 'REST API', 'REST', 'API', 'microservice', 'Microservice',
    'billing', 'Billing', 'provisioning', 'Provisioning', 'GGUF',
  ];

  SYSTEM_NAMES.forEach(name => {
    // Only bold if not already wrapped in **
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(?<!\\*\\*)\\b(${safe})\\b(?!\\*\\*)`, 'g'), '**$1**');
  });

  // Normalise bullet variants (•, ·, * list items) to `- `
  text = text.replace(/^[•·]\s+/gm, '- ');
  text = text.replace(/^\*\s+(?!\*)/gm, '- ');

  // Trim excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}
// ─────────────────────────────────────────────────────────────────────────────

// Model preference order (tried in sequence on transient errors)
const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];

// HTTP status codes that are worth retrying
const RETRYABLE_CODES = [429, 500, 502, 503, 504];

class GeminiParaphraser {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GeminiParaphraser] GEMINI_API_KEY not set — paraphraser disabled, localFormatMarkdown will be used');
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.genAI   = new GoogleGenerativeAI(apiKey);
    // Pre-create model instances for each tier
    this._models = MODEL_CHAIN.map(name => ({
      name,
      model: this.genAI.getGenerativeModel({ model: name }),
    }));
    console.log(`[GeminiParaphraser] Initialised — model chain: ${MODEL_CHAIN.join(' → ')} → localFormatMarkdown ✓`);
  }

  // ─── Internal: call one model with up to `maxRetries` attempts ─────────────
  async _callModel(modelEntry, prompt, maxRetries = 2) {
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await modelEntry.model.generateContent(prompt);
        const text   = result.response.text().trim();
        if (text) return text;
      } catch (err) {
        lastErr = err;
        const msg = err.message || '';

        // ── Non-retryable: skip to next model immediately ──────────────────
        // Daily/hard quota exhausted (free-tier limit: 0  OR  PerDay violation)
        const isQuotaExhausted = msg.includes('429') &&
          (msg.includes('PerDay') || msg.includes('limit: 0'));
        // Model deprecated / not found
        const isNotFound = msg.includes('404');

        if (isQuotaExhausted || isNotFound) {
          console.warn(`[GeminiParaphraser] ${modelEntry.name} — non-retryable (${isNotFound ? '404 not found' : 'daily quota exhausted'}), skipping`);
          throw err;
        }
        // ── Retryable: 503 demand spike, 500/502/504 server errors ──────────
        const isRetryable = RETRYABLE_CODES.some(code => msg.includes(String(code)));
        if (!isRetryable) throw err;

        const delay = attempt * 1500;
        console.warn(`[GeminiParaphraser] ${modelEntry.name} error (attempt ${attempt}/${maxRetries}) — retrying in ${delay}ms: ${msg.slice(0, 120)}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  // ─── Internal: try all models in chain, then localFormatMarkdown ───────────
  // useLocalFallback=false → returns null instead of localFormatMarkdown (for SQL path)
  async _generateWithFallback(prompt, rawFallback, useLocalFallback = true) {
    if (!this.enabled) {
      return useLocalFallback ? localFormatMarkdown(rawFallback) : null;
    }

    for (const modelEntry of this._models) {
      try {
        const text = await this._callModel(modelEntry, prompt, 2);
        console.log(`[GeminiParaphraser] Success with ${modelEntry.name}`);
        return text;
      } catch (err) {
        console.warn(`[GeminiParaphraser] ${modelEntry.name} unavailable: ${(err.message || '').slice(0, 100)}`);
      }
    }

    if (useLocalFallback) {
      console.warn('[GeminiParaphraser] All Gemini models failed — using localFormatMarkdown');
      return localFormatMarkdown(rawFallback);
    }
    return null; // caller (SQLGenerator) will fall back to llama-server
  }

  // ─── SQL helper ─────────────────────────────────────────────────────────────
  /**
   * Generate raw SQL text via Gemini (1 attempt per model, no local fallback).
   * Returns null if all models fail — caller falls back to llama-server.
   */
  async generateRawSQL(systemPrompt, userPrompt) {
    if (!this.enabled) return null;
    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    for (const modelEntry of this._models) {
      try {
        const text = await this._callModel(modelEntry, prompt, 1); // 1 attempt — SQL is fast
        if (text) {
          console.log(`[GeminiParaphraser] SQL generated via ${modelEntry.name}`);
          return text;
        }
      } catch (err) {
        console.warn(`[GeminiParaphraser] ${modelEntry.name} SQL skip: ${(err.message || '').slice(0, 80)}`);
      }
    }
    return null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Polish a raw draft answer into clean Markdown.
   *
   * @param {string}   rawAnswer       Draft from local model
   * @param {string}   originalQuestion The user's original question
   * @param {Array}    sources          Source documents array (for context hints)
   * @returns {Promise<string>}         Polished Markdown
   */
  async paraphrase(rawAnswer, originalQuestion, sources = []) {
    if (!rawAnswer?.trim()) return rawAnswer;

    const sourceList = sources
      .map((s) => s.title)
      .filter(Boolean)
      .slice(0, 6)
      .join(', ');

    const prompt = `You are a senior technical documentation expert for Singtel's enterprise systems.

ORIGINAL QUESTION:
${originalQuestion}

RAW DRAFT ANSWER (from internal knowledge base — may be rough or have formatting issues):
${rawAnswer}
${sourceList ? `\nSOURCE DOCUMENTS: ${sourceList}` : ''}

TASK: Rewrite the draft into a polished, well-structured Markdown response.

STRICT RULES:
1. Preserve ALL factual content exactly — do NOT add, invent, change, or remove any facts
2. Use ## for main section headers and ### for sub-headers where appropriate
3. Bold ALL system/product names with **double asterisks**: **ECOM**, **ESOM**, **Kenan**, **Paragon**, **Dapr**, **Redis**, **Spring**, **Oracle**, **PostgreSQL**, **MongoDB**, etc.
4. Bold key technical terms: **REST API**, **microservice**, **billing**, **provisioning**, etc.
5. Use bullet points (- ) for unordered information, numbered lists (1.) for steps/processes
6. Remove any prompt echoes, instruction fragments, or repeated headers from the draft
7. Keep the response concise yet thorough — no padding or filler sentences
8. If the draft is already a short greeting or simple one-liner, return it unchanged

Respond with ONLY the polished Markdown — no preamble like "Here's the rewritten version:".`;

    return this._generateWithFallback(prompt, rawAnswer);
  }

  /**
   * Generate a response directly from Gemini when the local model is unavailable.
   * Used as a fallback if llama-server fails to start.
   *
   * @param {string} systemPrompt
   * @param {string} userMessage   (may include injected RAG context)
   * @returns {Promise<string>}
   */
  async generateDirectly(systemPrompt, userMessage) {
    if (!this.enabled) {
      throw new Error('GeminiParaphraser not enabled — set GEMINI_API_KEY in .env');
    }

    const prompt = `${systemPrompt}\n\n${userMessage}`;
    return this._generateWithFallback(prompt, userMessage);
  }
}

export default GeminiParaphraser;
