// Canonical implementation lives in supabase/functions/_shared/demoMode/
// (generate-section, the one Deno-side caller, reads DEMO_MODE via
// Deno.env). Re-exported here, same pattern as src/lib/llm/ and
// src/lib/factEvents/, so this project's Vitest suite can test the parse
// logic without a Deno runtime.
export { parseDemoMode } from '../../../supabase/functions/_shared/demoMode/parseDemoMode.ts'
export { isMissingSchemaError } from '../../../supabase/functions/_shared/demoMode/isMissingSchemaError.ts'

import { parseDemoMode } from '../../../supabase/functions/_shared/demoMode/parseDemoMode.ts'

// Client-side convenience wrapper: Vite only exposes VITE_-prefixed vars to
// browser code (import.meta.env), so this reads VITE_DEMO_MODE rather than
// DEMO_MODE — same flag, same parse rule, different env var name per
// runtime (see _shared/demoMode/config.ts's `key` param). Accepts an
// optional override so it's testable without stubbing import.meta.env.
export function isDemoMode(env: Pick<ImportMetaEnv, 'VITE_DEMO_MODE'> = import.meta.env): boolean {
  return parseDemoMode(env.VITE_DEMO_MODE)
}
