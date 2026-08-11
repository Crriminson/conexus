// Pure string -> boolean parse, shared by both the Deno-side env reader
// (config.ts) and the client-side Vite reader (src/lib/demoMode/index.ts) —
// one place deciding what counts as "on" so the two runtimes can't drift.
export function parseDemoMode(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}
