// Canonical implementation lives in supabase/functions/_shared/factEvents/
// (the Deno-side extract Edge Function is a real caller too, alongside
// useUpdateFacts/useResolveConflict here in the client). Re-exported so this
// project's Vitest suite can test the row-building/lookup logic without a
// Deno runtime — same pattern as src/lib/merge/ and src/lib/generatedSections/.
export { buildFactEventRows, recordFactEvents } from '../../../supabase/functions/_shared/factEvents/recordFactEvents.ts'
export type { FactEventRow, FactEventsClient } from '../../../supabase/functions/_shared/factEvents/recordFactEvents.ts'
export { getFactValue } from '../../../supabase/functions/_shared/factEvents/getFactValue.ts'
export type { FactEventInput, FactEventSource, FactEventType } from '../../../supabase/functions/_shared/factEvents/types.ts'
