// Canonical implementation lives in supabase/functions/_shared/llm/ (the
// Deno-side extract Edge Function, and later generate-section, are the real
// callers). Re-exported here so this project's Vitest suite can test the
// provider abstraction with the same tooling as everything else in src/,
// without needing a Deno runtime — none of these files touch Deno.env
// directly except config.ts, which takes an injected reader instead.
export type { LLMFile, LLMProvider, LLMRequest } from '../../../supabase/functions/_shared/llm/types.ts'

export { createGeminiProvider } from '../../../supabase/functions/_shared/llm/geminiProvider.ts'
export type { GeminiProviderConfig } from '../../../supabase/functions/_shared/llm/geminiProvider.ts'

export { createMockProvider } from '../../../supabase/functions/_shared/llm/mockProvider.ts'
export type { MockLLMProvider, MockProviderConfig } from '../../../supabase/functions/_shared/llm/mockProvider.ts'

export { createLLMProvider } from '../../../supabase/functions/_shared/llm/config.ts'
export type { EnvReader } from '../../../supabase/functions/_shared/llm/config.ts'
