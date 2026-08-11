import { describe, expect, it } from 'vitest'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { fixtureIssuerFacts } from '@/lib/templates/fixtures'
import { countFactsByStatus, groupEntriesByDomain, groupEntriesByRecord, listFactFields } from './factList'

describe('listFactFields', () => {
  it('flattens every flat-domain field with its dotted path', () => {
    const entries = listFactFields(emptyIssuerFacts())
    const path = entries.find((e) => e.label === 'Legal name')
    expect(path?.path).toBe('company.legalName')
    expect(path?.domainKey).toBe('company')
  })

  it('flattens array-domain fields with a record-indexed path and a heading', () => {
    const entries = listFactFields(fixtureIssuerFacts())
    const promoterName = entries.find((e) => e.path === 'promoters[promoter-1].name')
    expect(promoterName).toBeDefined()
    expect(promoterName?.recordId).toBe('promoter-1')
    expect(promoterName?.recordHeading).toBe('Asha Rao')
  })

  it('falls back to a positional heading when the label field itself has no value', () => {
    const facts = emptyIssuerFacts()
    facts.litigation = [
      {
        id: 'lit-1',
        caseNumber: { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' },
        forum: { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' },
        partiesInvolved: { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' },
        natureOfProceeding: { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' },
        amountInvolved: { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' },
        status: { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' },
      },
    ]
    const entries = listFactFields(facts)
    const forum = entries.find((e) => e.path === 'litigation[lit-1].forum')
    expect(forum?.recordHeading).toBe('Litigation 1')
  })

  it('produces exactly 18 flat-domain entries and 0 array entries against empty facts', () => {
    const entries = listFactFields(emptyIssuerFacts())
    expect(entries).toHaveLength(18)
  })

  it('produces 18 flat + 5 promoter + 6 litigation entries against the fixture (2 promoters, 1 litigation record)', () => {
    const entries = listFactFields(fixtureIssuerFacts())
    expect(entries).toHaveLength(18 + 2 * 5 + 1 * 6)
  })
})

describe('countFactsByStatus', () => {
  it('counts every field as empty against a freshly-empty IssuerFacts', () => {
    const counts = countFactsByStatus(listFactFields(emptyIssuerFacts()))
    expect(counts).toEqual({ empty: 18, ai: 0, confirmed: 0, edited: 0 })
  })

  it('counts every field as confirmed against the fully-confirmed fixture', () => {
    const entries = listFactFields(fixtureIssuerFacts())
    const counts = countFactsByStatus(entries)
    expect(counts.confirmed).toBe(entries.length)
    expect(counts.empty).toBe(0)
  })

  it('mixes statuses correctly', () => {
    const facts = emptyIssuerFacts()
    facts.company.legalName = { value: 'X', confidence: 0.9, sourceDocId: 'd', sourcePage: 1, status: 'ai', updatedAt: '2026-01-01T00:00:00.000Z' }
    facts.company.cin = { value: 'Y', confidence: null, sourceDocId: 'd', sourcePage: 1, status: 'confirmed', updatedAt: '2026-01-01T00:00:00.000Z' }
    facts.company.industry = { value: 'Z', confidence: null, sourceDocId: 'd', sourcePage: 1, status: 'edited', updatedAt: '2026-01-01T00:00:00.000Z' }
    const counts = countFactsByStatus(listFactFields(facts))
    expect(counts).toEqual({ empty: 15, ai: 1, confirmed: 1, edited: 1 })
  })
})

describe('groupEntriesByDomain', () => {
  it('returns a bucket for all 6 domains, even ones with zero entries after filtering', () => {
    const groups = groupEntriesByDomain(listFactFields(fixtureIssuerFacts()).filter((e) => e.domainKey === 'company'))
    expect([...groups.keys()]).toEqual([
      'company',
      'financials',
      'capitalStructure',
      'promoters',
      'litigation',
      'relatedParties',
    ])
    expect(groups.get('company')).toHaveLength(6)
    expect(groups.get('financials')).toHaveLength(0)
    expect(groups.get('relatedParties')).toHaveLength(0)
  })
})

describe('groupEntriesByRecord', () => {
  it('groups array-domain entries by their record id, preserving record order', () => {
    const entries = listFactFields(fixtureIssuerFacts()).filter((e) => e.domainKey === 'promoters')
    const groups = groupEntriesByRecord(entries)
    expect([...groups.keys()]).toEqual(['promoter-1', 'promoter-2'])
    expect(groups.get('promoter-1')).toHaveLength(5)
  })

  it('ignores flat-domain entries (no recordId)', () => {
    const entries = listFactFields(fixtureIssuerFacts()).filter((e) => e.domainKey === 'company')
    expect(groupEntriesByRecord(entries).size).toBe(0)
  })
})
