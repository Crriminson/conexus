import { describe, expect, it, vi } from 'vitest'
import type { Field, IssuerFacts } from '@/types/facts'
import { merge } from '@/lib/merge/merge'
import type { ExtractedFacts, ExtractedLeaf } from '@/lib/merge/types'
import { buildFactEventRows, getFactValue, recordFactEvents, type FactEventInput, type FactEventsClient } from './index'

function event(overrides: Partial<FactEventInput> = {}): FactEventInput {
  return {
    projectId: 'project-1',
    factId: 'company.legalName',
    eventType: 'extracted',
    oldValue: null,
    newValue: 'Sundfin Industries Limited',
    source: 'extraction',
    ...overrides,
  }
}

describe('buildFactEventRows', () => {
  it('maps camelCase input to the snake_case DB row shape', () => {
    expect(buildFactEventRows([event()])).toEqual([
      {
        project_id: 'project-1',
        fact_id: 'company.legalName',
        event_type: 'extracted',
        old_value: null,
        new_value: 'Sundfin Industries Limited',
        source: 'extraction',
      },
    ])
  })

  it('coalesces undefined old/new values to null (jsonb-nullable columns)', () => {
    const rows = buildFactEventRows([event({ oldValue: undefined, newValue: undefined })])
    expect(rows[0].old_value).toBeNull()
    expect(rows[0].new_value).toBeNull()
  })

  it('preserves an explicit null distinctly from a real value, per event', () => {
    const rows = buildFactEventRows([
      event({ factId: 'a', oldValue: null, newValue: 42 }),
      event({ factId: 'b', oldValue: 'x', newValue: null }),
    ])
    expect(rows).toEqual([
      expect.objectContaining({ fact_id: 'a', old_value: null, new_value: 42 }),
      expect.objectContaining({ fact_id: 'b', old_value: 'x', new_value: null }),
    ])
  })
})

describe('recordFactEvents', () => {
  it('inserts exactly the rows buildFactEventRows would produce', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client: FactEventsClient = { from: () => ({ insert }) }

    const events = [event(), event({ factId: 'company.industry', eventType: 'edited', source: 'manual' })]
    await recordFactEvents(client, events)

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith(buildFactEventRows(events))
  })

  it('does not call insert at all for an empty event list', async () => {
    const insert = vi.fn()
    const client: FactEventsClient = { from: () => ({ insert }) }

    await recordFactEvents(client, [])

    expect(insert).not.toHaveBeenCalled()
  })

  it('swallows an insert error rather than throwing — never blocks the facts write it describes', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'relation "fact_events" does not exist' } })
    const client: FactEventsClient = { from: () => ({ insert }) }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(recordFactEvents(client, [event()])).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0][0]).toContain('fact_events')

    consoleError.mockRestore()
  })
})

describe('getFactValue', () => {
  function field<T>(value: T | null) {
    return { value, confidence: 0.9, sourceDocId: 'doc-1', sourcePage: 1, status: 'confirmed', updatedAt: '2026-01-01T00:00:00.000Z' }
  }

  it('reads a flat domain field by dotted path', () => {
    const facts = { company: { legalName: field('Sundfin Industries Limited') } }
    expect(getFactValue(facts, 'company.legalName')).toBe('Sundfin Industries Limited')
  })

  it('reads a repeating-group record field by id, not array position', () => {
    const facts = {
      promoters: [
        { id: 'p-1', name: field('First') },
        { id: 'p-2', name: field('Second') },
      ],
    }
    expect(getFactValue(facts, 'promoters[p-2].name')).toBe('Second')
  })

  it('returns null for a path whose record id is not present', () => {
    const facts = { promoters: [{ id: 'p-1', name: field('First') }] }
    expect(getFactValue(facts, 'promoters[missing].name')).toBeNull()
  })

  it('returns null for a path that does not resolve to a Field leaf', () => {
    const facts = { company: { legalName: field('x') } }
    expect(getFactValue(facts, 'company.doesNotExist')).toBeNull()
    expect(getFactValue(facts, 'doesNotExist.legalName')).toBeNull()
  })

  it('agrees with src/lib/facts/fieldPath.ts getFieldAtPath on the same fixture', async () => {
    const { emptyIssuerFacts } = await import('@/types/facts/empty')
    const { getFieldAtPath } = await import('@/lib/facts/fieldPath')

    const facts = emptyIssuerFacts()
    facts.company.legalName = field('Agreement Test Co') as typeof facts.company.legalName

    expect(getFactValue(facts, 'company.legalName')).toEqual(getFieldAtPath(facts, 'company.legalName')?.value)
  })
})

// Mirrors the event-building logic in supabase/functions/extract/index.ts's
// persistChunkFacts — not testable directly since it's Deno-only glue with
// no re-export (same reason the rest of that function's HTTP/retry
// orchestration isn't unit tested either), but the mapping from a real
// merge() result to fact_events rows is small enough, and important enough,
// to pin here against real merge() output rather than only against
// hand-built FactEventInput fixtures.
describe('extraction merge -> fact event mapping (mirrors persistChunkFacts)', () => {
  function emptyLeaf<T>(): ExtractedLeaf<T> {
    return { value: null, confidence: null, sourcePage: null }
  }

  function emptyIssuerFacts(): IssuerFacts {
    const emptyField = <T>(): Field<T> => ({
      value: null,
      confidence: null,
      sourceDocId: null,
      sourcePage: null,
      status: 'empty',
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    return {
      company: {
        legalName: emptyField(),
        cin: emptyField(),
        incorporationDate: emptyField(),
        registeredOfficeAddress: emptyField(),
        industry: emptyField(),
        businessDescription: emptyField(),
      },
      financials: {
        fiscalYearEnd: emptyField(),
        revenue: emptyField(),
        ebitda: emptyField(),
        netProfit: emptyField(),
        totalAssets: emptyField(),
        totalLiabilities: emptyField(),
        netWorth: emptyField(),
      },
      capitalStructure: {
        authorizedCapital: emptyField(),
        issuedCapital: emptyField(),
        paidUpCapital: emptyField(),
        faceValuePerShare: emptyField(),
        totalSharesOutstanding: emptyField(),
      },
      promoters: [],
      litigation: [],
      relatedParties: [],
    }
  }

  function emptyExtractedFacts(documentId = 'doc-new'): ExtractedFacts {
    return {
      documentId,
      company: {
        legalName: emptyLeaf(),
        cin: emptyLeaf(),
        incorporationDate: emptyLeaf(),
        registeredOfficeAddress: emptyLeaf(),
        industry: emptyLeaf(),
        businessDescription: emptyLeaf(),
      },
      financials: {
        fiscalYearEnd: emptyLeaf(),
        revenue: emptyLeaf(),
        ebitda: emptyLeaf(),
        netProfit: emptyLeaf(),
        totalAssets: emptyLeaf(),
        totalLiabilities: emptyLeaf(),
        netWorth: emptyLeaf(),
      },
      capitalStructure: {
        authorizedCapital: emptyLeaf(),
        issuedCapital: emptyLeaf(),
        paidUpCapital: emptyLeaf(),
        faceValuePerShare: emptyLeaf(),
        totalSharesOutstanding: emptyLeaf(),
      },
      promoters: [],
      litigation: [],
      relatedParties: [],
    }
  }

  // The exact two .map() calls persistChunkFacts runs over a merge() result.
  function eventsFromMergeResult(projectId: string, before: IssuerFacts, result: ReturnType<typeof merge>): FactEventInput[] {
    return [
      ...result.event.fieldsWritten.map(
        (fieldPath): FactEventInput => ({
          projectId,
          factId: fieldPath,
          eventType: 'extracted',
          oldValue: getFactValue(before, fieldPath),
          newValue: getFactValue(result.facts, fieldPath),
          source: 'extraction',
        }),
      ),
      ...result.conflicts.map(
        (conflict): FactEventInput => ({
          projectId,
          factId: conflict.fieldPath,
          eventType: 'conflict_raised',
          oldValue: conflict.currentValue,
          newValue: conflict.proposedValue,
          source: 'extraction',
        }),
      ),
    ]
  }

  it('logs one "extracted" event per newly-written field, with correct old/new values', () => {
    const before = emptyIssuerFacts()
    const extracted = emptyExtractedFacts('doc-1')
    extracted.company.legalName = { value: 'Sundfin Industries Limited', confidence: 0.95, sourcePage: 1 }

    const result = merge(before, extracted, { now: () => '2026-08-11T00:00:00.000Z', generateId: () => 'id-1' })
    const events = eventsFromMergeResult('project-1', before, result)

    expect(events).toEqual([
      {
        projectId: 'project-1',
        factId: 'company.legalName',
        eventType: 'extracted',
        oldValue: null,
        newValue: 'Sundfin Industries Limited',
        source: 'extraction',
      },
    ])
  })

  it('logs a "conflict_raised" event (not "extracted") when extraction disagrees with a confirmed field', () => {
    const before = emptyIssuerFacts()
    before.company.legalName = {
      value: 'Original Confirmed Name',
      confidence: null,
      sourceDocId: 'doc-0',
      sourcePage: 1,
      status: 'confirmed',
      updatedAt: '2020-01-01T00:00:00.000Z',
    }
    const extracted = emptyExtractedFacts('doc-2')
    extracted.company.legalName = { value: 'Disagreeing Name', confidence: 0.8, sourcePage: 2 }

    const result = merge(before, extracted, { now: () => '2026-08-11T00:00:00.000Z', generateId: () => 'conflict-1' })
    const events = eventsFromMergeResult('project-1', before, result)

    expect(events).toEqual([
      {
        projectId: 'project-1',
        factId: 'company.legalName',
        eventType: 'conflict_raised',
        oldValue: 'Original Confirmed Name',
        newValue: 'Disagreeing Name',
        source: 'extraction',
      },
    ])
  })

  it('logs no events when extraction proposes nothing new (an all-skip merge)', () => {
    const before = emptyIssuerFacts()
    before.company.legalName = {
      value: 'Same Value',
      confidence: 0.5,
      sourceDocId: 'doc-0',
      sourcePage: 1,
      status: 'ai',
      updatedAt: '2020-01-01T00:00:00.000Z',
    }
    const extracted = emptyExtractedFacts('doc-2')
    extracted.company.legalName = { value: 'Same Value', confidence: 0.3, sourcePage: 1 }

    const result = merge(before, extracted)
    const events = eventsFromMergeResult('project-1', before, result)

    expect(events).toEqual([])
  })

  it('feeds recordFactEvents correctly end-to-end from a real merge() result', async () => {
    const before = emptyIssuerFacts()
    const extracted = emptyExtractedFacts('doc-3')
    extracted.financials.netWorth = { value: 500_000, confidence: 0.9, sourcePage: 12 }

    const result = merge(before, extracted, { now: () => '2026-08-11T00:00:00.000Z', generateId: () => 'id-1' })
    const events = eventsFromMergeResult('project-9', before, result)

    const insert = vi.fn().mockResolvedValue({ error: null })
    const client: FactEventsClient = { from: () => ({ insert }) }
    await recordFactEvents(client, events)

    expect(insert).toHaveBeenCalledWith([
      {
        project_id: 'project-9',
        fact_id: 'financials.netWorth',
        event_type: 'extracted',
        old_value: null,
        new_value: 500_000,
        source: 'extraction',
      },
    ])
  })
})
