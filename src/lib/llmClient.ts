/**
 * Conexus LLM Client
 *
 * Unified interface for AI text generation.
 * - Primary: Google Gemini (supports text + multimodal)
 * - Fallback: Groq / Llama (text-only, used on Gemini 429/5xx)
 *
 * Usage:
 *   import { generate } from '@/lib/llmClient';
 *   const result = await generate('Summarize this document');
 *   const result = await generate('Describe this image', {
 *     media: [{ mimeType: 'image/png', data: base64String }],
 *   });
 */

import { GoogleGenAI, type Content } from '@google/genai';
import Groq from 'groq-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaInput {
  /** MIME type, e.g. 'image/png', 'application/pdf' */
  mimeType: string;
  /** Base64-encoded file data */
  data: string;
}

export interface GenerateOptions {
  /** Gemini model to use (default: gemini-2.0-flash) */
  geminiModel?: string;
  /** Groq model to use (default: llama-3.3-70b-versatile) */
  groqModel?: string;
  /** OpenRouter model to use (default: google/gemma-2-9b-it:free) */
  openRouterModel?: string;
  /** Multimodal attachments — images, PDFs. Gemini-only. */
  media?: MediaInput[];
  /** System instruction prepended to the conversation */
  systemPrompt?: string;
  /** Sampling temperature (0–2) */
  temperature?: number;
  /** Max output tokens */
  maxTokens?: number;
  /** If true, skip fallback and only use Gemini */
  geminiOnly?: boolean;
}

export interface GenerateResult {
  /** The generated text */
  text: string;
  /** Which provider produced the result */
  provider: 'gemini' | 'groq' | 'openrouter';
  /** The model ID that was used */
  model: string;
}

// ─── Clients (lazy singletons) ────────────────────────────────────────────────

let _gemini: GoogleGenAI | null = null;
let _groq: Groq | null = null;

function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Missing GROQ_API_KEY environment variable');
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRetryable(error: any): boolean {
  const status = error?.status ?? error?.statusCode ?? error?.code;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  // Google GenAI SDK sometimes wraps errors differently
  const message = String(error?.message ?? '');
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) return true;
  if (message.includes('500') || message.includes('503') || message.includes('INTERNAL')) return true;
  return false;
}

function hasMedia(opts?: GenerateOptions): boolean {
  return !!opts?.media && opts.media.length > 0;
}

// ─── Gemini Call ──────────────────────────────────────────────────────────────

async function callGemini(prompt: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const gemini = getGemini();
  const model = opts.geminiModel ?? 'gemini-2.0-flash';

  // Build parts array
  const parts: any[] = [];

  // Add media attachments
  if (opts.media) {
    for (const m of opts.media) {
      parts.push({
        inlineData: {
          mimeType: m.mimeType,
          data: m.data,
        },
      });
    }
  }

  // Add text prompt
  parts.push({ text: prompt });

  const config: any = {};
  if (opts.temperature !== undefined) config.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) config.maxOutputTokens = opts.maxTokens;
  if (opts.systemPrompt) config.systemInstruction = opts.systemPrompt;

  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config,
  });

  const text = response.text ?? '';

  return { text, provider: 'gemini', model };
}

// ─── Groq Call ────────────────────────────────────────────────────────────────

async function callGroq(prompt: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const groq = getGroq();
  const model = opts.groqModel ?? 'llama-3.3-70b-versatile';

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [];

  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
  });

  const text = completion.choices[0]?.message?.content ?? '';

  return { text, provider: 'groq', model };
}

// ─── OpenRouter Call (Third Fallback) ─────────────────────────────────────────

async function callOpenRouter(prompt: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY environment variable');

  const isMultimodal = hasMedia(opts);

  // We use the auto-routing free endpoint which dynamically picks available free models with vision support
  const model = opts.openRouterModel ?? 'openrouter/free';

  const messages: any[] = [];
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }

  // Format content for OpenAI-compatible vision if media exists
  let userContent: any = prompt;
  if (isMultimodal && opts.media) {
    userContent = [{ type: 'text', text: prompt }];
    for (const m of opts.media) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${m.mimeType};base64,${m.data}`
        }
      });
    }
  }

  messages.push({ role: 'user', content: userContent });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://conexus.app',
      'X-Title': 'Conexus IPO Documentation',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  return { text, provider: 'openrouter', model };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generate text using Gemini (primary) with Groq fallback and OpenRouter 3rd layer.
 *
 * - Text-only: tries Gemini first -> Groq (on 429/5xx) -> OpenRouter (on 429/5xx).
 * - Multimodal (media attached): Gemini first -> skips Groq -> OpenRouter (on 429/5xx).
 */
export async function generate(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  const isMultimodal = hasMedia(opts);

  try {
    return await callGemini(prompt, opts);
  } catch (geminiError: any) {
    // If explicitly Gemini-only, don't fallback
    if (opts.geminiOnly) {
      throw geminiError;
    }

    // Only fallback on rate-limit or server errors
    if (!isRetryable(geminiError)) {
      throw geminiError;
    }

    // If multimodal was requested, Groq (text-only) cannot handle it.
    // Skip Groq entirely and go straight to OpenRouter.
    if (isMultimodal) {
      console.warn(
        `[llmClient] Gemini failed on multimodal request (${geminiError?.message ?? 'unknown'}), skipping Groq and falling back to OpenRouter.`
      );
      return await callOpenRouter(prompt, opts);
    }

    console.warn(
      `[llmClient] Gemini failed (${geminiError?.message ?? 'unknown'}), falling back to Groq`
    );

    try {
      return await callGroq(prompt, opts);
    } catch (groqError: any) {
      if (!isRetryable(groqError)) {
        throw groqError;
      }
      console.warn(
        `[llmClient] Groq failed (${groqError?.message ?? 'unknown'}), falling back to OpenRouter (Free Models)`
      );
      return await callOpenRouter(prompt, opts);
    }
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * Quick connectivity test for all providers.
 * Returns status for each — does NOT throw on individual failures.
 */
export async function healthCheck(): Promise<{
  gemini: { ok: boolean; message: string };
  groq: { ok: boolean; message: string };
  openrouter: { ok: boolean; message: string };
}> {
  const testPrompt = 'Reply with exactly: OK';

  let geminiResult = { ok: false, message: '' };
  let groqResult = { ok: false, message: '' };
  let openRouterResult = { ok: false, message: '' };

  try {
    const g = await callGemini(testPrompt, { maxTokens: 10 });
    geminiResult = { ok: true, message: `Model: ${g.model}, Response: ${g.text.slice(0, 50)}` };
  } catch (e: any) {
    geminiResult = { ok: false, message: e?.message ?? String(e) };
  }

  try {
    const q = await callGroq(testPrompt, { maxTokens: 10 });
    groqResult = { ok: true, message: `Model: ${q.model}, Response: ${q.text.slice(0, 50)}` };
  } catch (e: any) {
    groqResult = { ok: false, message: e?.message ?? String(e) };
  }

  try {
    const o = await callOpenRouter(testPrompt, { maxTokens: 10 });
    openRouterResult = { ok: true, message: `Model: ${o.model}, Response: ${o.text.slice(0, 50)}` };
  } catch (e: any) {
    openRouterResult = { ok: false, message: e?.message ?? String(e) };
  }

  return { gemini: geminiResult, groq: groqResult, openrouter: openRouterResult };
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

/**
 * Generates a 768-dimensional embedding for the given text using Gemini's text-embedding-004.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const gemini = getGemini();
  const response = await gemini.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });

  if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
    throw new Error('Failed to generate embedding: empty response from Gemini');
  }

  return response.embeddings[0].values;
}
