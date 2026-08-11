import type { FactEventLogRow } from './auditLog'

// A plausible chronological trail for the same fixture story
// src/lib/templates/fixtures.ts tells (Acme Industries Limited) — not
// imported from there since the two fixtures don't need to share a runtime
// dependency, just a consistent narrative. Covers all 5 event types so the
// Audit Log screen's DEMO_MODE fallback actually demonstrates every column
// combination (event_type/source/old->new), not just the happy path.
export function fixtureFactEvents(): FactEventLogRow[] {
  const projectId = 'fixture-project'

  return [
    {
      id: 'fixture-event-1',
      project_id: projectId,
      fact_id: 'company.legalName',
      event_type: 'extracted',
      old_value: null,
      new_value: 'Acme Industries Limited',
      source: 'extraction',
      created_at: '2026-08-09T00:00:00.000Z',
    },
    {
      id: 'fixture-event-2',
      project_id: projectId,
      fact_id: 'company.industry',
      event_type: 'extracted',
      old_value: null,
      new_value: 'Non-Banking Financial Company',
      source: 'extraction',
      created_at: '2026-08-09T00:00:05.000Z',
    },
    {
      id: 'fixture-event-3',
      project_id: projectId,
      fact_id: 'capitalStructure.paidUpCapital',
      event_type: 'conflict_raised',
      old_value: 303884790,
      new_value: 298000000,
      source: 'extraction',
      created_at: '2026-08-09T00:05:00.000Z',
    },
    {
      id: 'fixture-event-4',
      project_id: projectId,
      fact_id: 'capitalStructure.paidUpCapital',
      event_type: 'conflict_resolved',
      old_value: 303884790,
      new_value: 303884790,
      source: 'merge',
      created_at: '2026-08-09T00:10:00.000Z',
    },
    {
      id: 'fixture-event-5',
      project_id: projectId,
      fact_id: 'company.businessDescription',
      event_type: 'edited',
      old_value: 'A financial services company.',
      new_value: 'A financial services company serving retail borrowers.',
      source: 'manual',
      created_at: '2026-08-09T00:15:00.000Z',
    },
    {
      id: 'fixture-event-6',
      project_id: projectId,
      fact_id: 'financials.netProfit',
      event_type: 'confirmed',
      old_value: 4367,
      new_value: 4367,
      source: 'manual',
      created_at: '2026-08-09T00:20:00.000Z',
    },
  ]
}
