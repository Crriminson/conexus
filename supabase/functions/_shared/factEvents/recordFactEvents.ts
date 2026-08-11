import type { FactEventInput } from './types.ts'

export interface FactEventRow {
  project_id: string
  fact_id: string
  event_type: FactEventInput['eventType']
  old_value: unknown
  new_value: unknown
  source: FactEventInput['source']
}

// Duck-typed rather than importing SupabaseClient from either runtime's
// import specifier (npm: on the Deno side, a bare package on the browser
// side) — both real clients' `.from(table).insert(rows)` already satisfy
// this, and it keeps this file importable from Vitest with a plain mock.
export interface FactEventsClient {
  from(table: 'fact_events'): {
    insert(rows: FactEventRow[]): PromiseLike<{ error: { message: string } | null }>
  }
}

export function buildFactEventRows(events: FactEventInput[]): FactEventRow[] {
  return events.map((event) => ({
    project_id: event.projectId,
    fact_id: event.factId,
    event_type: event.eventType,
    old_value: event.oldValue ?? null,
    new_value: event.newValue ?? null,
    source: event.source,
  }))
}

/**
 * The one place every call site that changes a fact's state writes its
 * fact_events row(s) through — extraction merge, useUpdateFacts,
 * useResolveConflict. Same "one shared function, not duplicated at each
 * call site" shape as callLLM()/LLMProvider (docs/DECISIONS.md).
 *
 * Best-effort by design: the audit trail must never roll back or block the
 * facts write it's describing, which has already succeeded (CAS'd) by the
 * time every caller reaches this. A logging failure is surfaced loudly via
 * console.error, never thrown — the alternative (throwing here) would mean
 * a `fact_events` outage could start blocking every fact edit/confirm in
 * the app, which is a worse failure mode than a gap in the audit trail.
 */
export async function recordFactEvents(client: FactEventsClient, events: FactEventInput[]): Promise<void> {
  if (events.length === 0) return

  const { error } = await client.from('fact_events').insert(buildFactEventRows(events))
  if (error) {
    console.error(`fact_events: failed to record ${events.length} event(s): ${error.message}`)
  }
}
