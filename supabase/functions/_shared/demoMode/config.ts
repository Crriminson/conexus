// Env -> boolean factory, same shape as ../llm/config.ts's createLLMProvider:
// takes an injected reader instead of calling Deno.env directly, so it's
// constructible with a plain object in tests (Vitest has no Deno global).
// `key` defaults to the Deno-side var name (DEMO_MODE); the client-side
// wrapper in src/lib/demoMode/index.ts passes VITE_DEMO_MODE instead, since
// Vite only exposes VITE_-prefixed vars to browser code — same env var,
// different name per runtime, same parse logic either way.
import { parseDemoMode } from './parseDemoMode.ts'

export interface EnvReader {
  get(key: string): string | undefined
}

export function isDemoMode(env: EnvReader, key = 'DEMO_MODE'): boolean {
  return parseDemoMode(env.get(key))
}
