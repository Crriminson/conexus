import { describe, expect, it } from 'vitest'
import type { Field, IssuerFacts } from '@/types/facts'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { applyHumanEdit, getFieldAtPath, setFieldAtPath } from './fieldPath'

function aiField<T>(value: T, page = 1): Field<T> {
  return {
    value,
    confidence: 0.9,
    sourceDocId: 'doc-1',
    sourcePage: page,
    status: 'ai',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function factsWithPromoter(): IssuerFacts {
  const facts = emptyIssuerFacts()
  facts.company.legalName = aiField('Acme Industries Ltd', 3)
  facts.promoters = [
    {
      id: 'promoter-a',
      name: aiField('Asha Rao', 12),
      panOrId: aiField('ABCDE1234F', 12),
      din: aiField('0123456', 12),
      shareholdingPercent: aiField(41.5, 13),
      category: aiField('Individual', 12),
    },
    {
      id: 'promoter-b',
      name: aiField('Bhavin Shah', 14),
      panOrId: aiField('ZYXWV9876K', 14),
      din: aiField('0654321', 14),
      shareholdingPercent: aiField(18.25, 14),
      category: aiField('Individual', 14),
    },
  ]
  return facts
}

describe('getFieldAtPath', () => {
  it('reads a flat domain leaf', () => {
    expect(getFieldAtPath(factsWithPromoter(), 'company.legalName')?.value).toBe('Acme Industries Ltd')
  })

  it('reads a repeating-group leaf by record id, not position', () => {
    expect(getFieldAtPath(factsWithPromoter(), 'promoters[promoter-b].name')?.value).toBe('Bhavin Shah')
  })

  it('returns null for an unknown path rather than throwing', () => {
    expect(getFieldAtPath(factsWithPromoter(), 'company.notAField')).toBeNull()
    expect(getFieldAtPath(factsWithPromoter(), 'promoters[nope].name')).toBeNull()
  })

  it('returns null when the path stops short of a leaf', () => {
    expect(getFieldAtPath(factsWithPromoter(), 'company')).toBeNull()
  })
})

describe('setFieldAtPath', () => {
  it('replaces only the targeted leaf', () => {
    const facts = factsWithPromoter()
    const next = setFieldAtPath(facts, 'company.legalName', aiField('Renamed Ltd'))

    expect(getFieldAtPath(next, 'company.legalName')?.value).toBe('Renamed Ltd')
    expect(getFieldAtPath(next, 'company.cin')).toEqual(getFieldAtPath(facts, 'company.cin'))
  })

  it('does not mutate the input', () => {
    const facts = factsWithPromoter()
    setFieldAtPath(facts, 'company.legalName', aiField('Renamed Ltd'))
    expect(facts.company.legalName.value).toBe('Acme Industries Ltd')
  })

  it('targets the right record when array order changed since read', () => {
    const facts = factsWithPromoter()
    // Simulate a background extraction having reordered/prepended records.
    const reordered: IssuerFacts = { ...facts, promoters: [facts.promoters[1], facts.promoters[0]] }

    const next = setFieldAtPath(reordered, 'promoters[promoter-a].shareholdingPercent', aiField(52))

    expect(getFieldAtPath(next, 'promoters[promoter-a].shareholdingPercent')?.value).toBe(52)
    expect(getFieldAtPath(next, 'promoters[promoter-b].shareholdingPercent')?.value).toBe(18.25)
  })

  it('leaves sibling records untouched', () => {
    const facts = factsWithPromoter()
    const next = setFieldAtPath(facts, 'promoters[promoter-a].name', aiField('Asha R.'))
    expect(getFieldAtPath(next, 'promoters[promoter-b].name')?.value).toBe('Bhavin Shah')
  })

  it('throws on a stale record id instead of silently dropping the write', () => {
    const facts = factsWithPromoter()
    expect(() => setFieldAtPath(facts, 'promoters[deleted-id].name', aiField('X'))).toThrow(
      /No record with id "deleted-id"/,
    )
  })

  it('throws on an unknown field name', () => {
    const facts = factsWithPromoter()
    expect(() => setFieldAtPath(facts, 'company.notAField', aiField('X'))).toThrow(/Unknown field/)
  })
})

// merge() emits paths into MergeEvent.fieldsWritten and FactConflict.fieldPath,
// and useResolveConflict feeds conflict.fieldPath straight back through
// getFieldAtPath/setFieldAtPath. If the two grammars drift, array-field
// conflicts silently stop resolving — so pin the format merge() actually
// produces (`domain[recordId].field`, see the `path` helpers in merge.ts).
describe('path grammar agrees with merge()', () => {
  it('resolves the bracketed record syntax merge() emits', () => {
    const facts = factsWithPromoter()
    const emitted = 'promoters[promoter-a].shareholdingPercent'

    expect(getFieldAtPath(facts, emitted)?.value).toBe(41.5)
    expect(getFieldAtPath(setFieldAtPath(facts, emitted, aiField(60)), emitted)?.value).toBe(60)
  })

  it('does not accept dot-separated record ids, which merge() never emits', () => {
    expect(getFieldAtPath(factsWithPromoter(), 'promoters.promoter-a.name')).toBeNull()
  })
})

describe('applyHumanEdit', () => {
  const now = '2026-08-08T12:00:00.000Z'

  it('confirming keeps value, confidence and provenance, changing only status', () => {
    const field = aiField('Acme Industries Ltd', 3)
    const result = applyHumanEdit(field, { status: 'confirmed' }, now)

    expect(result).toEqual({
      value: 'Acme Industries Ltd',
      confidence: 0.9,
      sourceDocId: 'doc-1',
      sourcePage: 3,
      status: 'confirmed',
      updatedAt: now,
    })
  })

  it('editing replaces the value and nulls confidence, since it is human-set', () => {
    const result = applyHumanEdit(aiField('Acme Industries Ltd', 3), { status: 'edited', value: 'Acme Ltd' }, now)

    expect(result.value).toBe('Acme Ltd')
    expect(result.confidence).toBeNull()
    expect(result.status).toBe('edited')
  })

  it('editing keeps source provenance so the diff trail can cite the superseded origin', () => {
    const result = applyHumanEdit(aiField('4.2', 14), { status: 'edited', value: '4.7' }, now)

    expect(result.sourceDocId).toBe('doc-1')
    expect(result.sourcePage).toBe(14)
  })
})
