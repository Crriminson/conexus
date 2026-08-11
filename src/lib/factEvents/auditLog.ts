// Read-side of fact_events — the write side (recordFactEvents/FactEventRow)
// is canonical in supabase/functions/_shared/factEvents/ since extraction's
// Deno background task writes there too, but nothing on the Deno side ever
// reads this table back, so the read row shape and its one helper live here,
// client-only, rather than being mirrored into _shared/ for no caller.
import type { FactEventSource, FactEventType } from '../../../supabase/functions/_shared/factEvents/types'

export interface FactEventLogRow {
  id: string
  project_id: string
  fact_id: string
  event_type: FactEventType
  old_value: unknown
  new_value: unknown
  source: FactEventSource
  created_at: string
}

// Newest first — the useful default for an audit log (recent activity at
// the top). Shared by both the real query (which asks Postgres to order the
// same way) and the DEMO_MODE fixture path (which doesn't go through
// Postgres at all), so the two can never show events in a different order.
export function sortFactEventsDescending(rows: FactEventLogRow[]): FactEventLogRow[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
}
