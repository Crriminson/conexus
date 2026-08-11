// Backward-compat entry point — supabase/functions/extract/index.ts imports
// `callLLM` from here and nothing about that call site had to change.
// Provider selection and implementations now live in ./llm/ (see config.ts
// for how LLM_PROVIDER/GEMINI_* env vars pick and configure a provider).
import { createLLMProvider } from './llm/config.ts'
import type { LLMFile, LLMRequest } from './llm/types.ts'

export type CallLLMFile = LLMFile
export type CallLLMInput = LLMRequest

export async function callLLM(input: CallLLMInput): Promise<string> {
  const provider = createLLMProvider(Deno.env)
  return provider.generate(input)
}
