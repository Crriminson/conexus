// Env -> LLMProvider factory. This is the only file in ./llm that touches
// environment resolution, kept deliberately thin: everything it can get
// wrong is "read the right keys, throw a clear error if one's missing" — no
// business logic to test. Takes an explicit reader instead of calling
// `Deno.env` directly so it's constructible with a plain object in tests
// (Vitest has no Deno global) without any Deno-specific shimming.

import type { LLMProvider } from './types.ts'
import { createGeminiProvider } from './geminiProvider.ts'
import { createMockProvider } from './mockProvider.ts'

export interface EnvReader {
  get(key: string): string | undefined
}

// Provider choice, model, endpoint, and API key are all config, never
// hardcoded — swapping Gemini for another provider (or a paid tier) is a
// matter of setting LLM_PROVIDER (+ that provider's own env vars), not a
// code change. Gemini stays the default so unset LLM_PROVIDER behaves
// exactly as before this refactor.
export function createLLMProvider(env: EnvReader): LLMProvider {
  const providerName = env.get('LLM_PROVIDER') || 'gemini'

  switch (providerName) {
    case 'gemini': {
      const apiKey = env.get('GEMINI_API_KEY')
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set')
      }
      return createGeminiProvider({
        apiKey,
        model: env.get('GEMINI_MODEL') || undefined,
        baseUrl: env.get('GEMINI_BASE_URL') || undefined,
      })
    }
    case 'mock':
      return createMockProvider()
    default:
      throw new Error(`Unknown LLM_PROVIDER "${providerName}" — expected "gemini" or "mock"`)
  }
}
