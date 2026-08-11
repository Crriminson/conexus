import { describe, expect, it } from 'vitest'
import { sortFactEventsDescending } from './auditLog'
import { fixtureFactEvents } from './fixtures'
import type { FactEventLogRow } from './auditLog'

function row(overrides: Partial<FactEventLogRow>): FactEventLogRow {
  return {
    id: 'x',
    project_id: 'p',
    fact_id: 'company.legalName',
    event_type: 'extracted',
    old_value: null,
    new_value: 'x',
    source: 'extraction',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('sortFactEventsDescending', () => {
  it('orders newest first', () => {
    const rows = [
      row({ id: 'a', created_at: '2026-01-01T00:00:00.000Z' }),
      row({ id: 'b', created_at: '2026-01-03T00:00:00.000Z' }),
      row({ id: 'c', created_at: '2026-01-02T00:00:00.000Z' }),
    ]

    expect(sortFactEventsDescending(rows).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'a', created_at: '2026-01-01T00:00:00.000Z' }), row({ id: 'b', created_at: '2026-01-02T00:00:00.000Z' })]
    const original = [...rows]

    sortFactEventsDescending(rows)

    expect(rows).toEqual(original)
  })
})

describe('fixtureFactEvents', () => {
  it('covers all 5 event types', () => {
    const types = new Set(fixtureFactEvents().map((e) => e.event_type))
    expect(types).toEqual(new Set(['extracted', 'edited', 'confirmed', 'conflict_raised', 'conflict_resolved']))
  })

  it('is internally chronological (ascending by created_at) before sorting', () => {
    const rows = fixtureFactEvents()
    const timestamps = rows.map((r) => r.created_at)
    expect(timestamps).toEqual([...timestamps].sort())
  })

  it('sorted descending puts the most recent event first', () => {
    const sorted = sortFactEventsDescending(fixtureFactEvents())
    expect(sorted[0].id).toBe('fixture-event-6')
    expect(sorted.at(-1)!.id).toBe('fixture-event-1')
  })
})
