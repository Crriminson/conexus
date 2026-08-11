// fact_events (migration 20260811000000): a write-once audit trail of every
// state change to a fact. `event_type`/`source` mirror the DB's `check`
// constraints exactly (see the migration's header comment for why those are
// plain `text` + `check`, not Postgres `enum`s).

export type FactEventType = 'extracted' | 'edited' | 'confirmed' | 'conflict_raised' | 'conflict_resolved'

// What produced the event, not who resolved it. 'extraction' — merge()
// wrote or flagged something from a document's proposed facts. 'manual' —
// a human typed a value directly (edit/confirm). 'merge' — a human chose
// between two already-proposed values (resolving a conflict), distinct from
// 'manual' because the value itself came from extraction, not typing.
export type FactEventSource = 'extraction' | 'manual' | 'merge'

export interface FactEventInput {
  projectId: string
  /** fieldPath, e.g. "company.legalName" or "promoters[<uuid>].name" — see src/lib/facts/fieldPath.ts. */
  factId: string
  eventType: FactEventType
  oldValue: unknown
  newValue: unknown
  source: FactEventSource
}
