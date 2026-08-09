import { describe, expect, it } from 'vitest'
import type { Field, IssuerFacts } from '@/types/facts'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { fixtureIssuerFacts } from './fixtures'
import { assembleSections, buildCapitalStructureSection, buildFinancialSummarySection, buildShareholdingSection } from './index'

function confirmedField<T>(value: T, page = 1): Field<T> {
  return {
    value,
    confidence: null,
    sourceDocId: 'doc-1',
    sourcePage: page,
    status: 'confirmed',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

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

function editedField<T>(value: T, page = 1): Field<T> {
  return {
    value,
    confidence: null,
    sourceDocId: 'doc-1',
    sourcePage: page,
    status: 'edited',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('buildCapitalStructureSection', () => {
  it('is incomplete on empty facts, with every field missing and no values shown', () => {
    const section = buildCapitalStructureSection(emptyIssuerFacts())
    expect(section.status).toBe('incomplete')
    expect(section.missingFieldPaths).toEqual([
      'capitalStructure.authorizedCapital',
      'capitalStructure.issuedCapital',
      'capitalStructure.paidUpCapital',
      'capitalStructure.faceValuePerShare',
      'capitalStructure.totalSharesOutstanding',
    ])
    for (const row of section.rows ?? []) {
      expect(row[0].confirmed).toBe(false)
      expect(row[0].value).toBeNull()
    }
  })

  it('is ready only once every field is confirmed, and surfaces provenance', () => {
    const facts = emptyIssuerFacts()
    facts.capitalStructure.authorizedCapital = confirmedField(450000000)
    facts.capitalStructure.issuedCapital = confirmedField(303884790)
    facts.capitalStructure.paidUpCapital = confirmedField(303884790)
    facts.capitalStructure.faceValuePerShare = confirmedField(10)
    // One field still ai — section must stay incomplete.
    facts.capitalStructure.totalSharesOutstanding = aiField(202589860)

    const partial = buildCapitalStructureSection(facts)
    expect(partial.status).toBe('incomplete')
    expect(partial.missingFieldPaths).toEqual(['capitalStructure.totalSharesOutstanding'])

    facts.capitalStructure.totalSharesOutstanding = confirmedField(202589860, 42)
    const complete = buildCapitalStructureSection(facts)
    expect(complete.status).toBe('ready')
    expect(complete.missingFieldPaths).toEqual([])
    const sharesRow = complete.rows?.find((r) => r[0].label === 'Total Shares Outstanding')
    expect(sharesRow?.[0]).toEqual({
      label: 'Total Shares Outstanding',
      value: 202589860,
      confirmed: true,
      sourceDocId: 'doc-1',
      sourcePage: 42,
    })
  })

  it('does not treat an edited-but-unconfirmed field as usable', () => {
    const facts = emptyIssuerFacts()
    facts.capitalStructure.authorizedCapital = editedField(999)
    const section = buildCapitalStructureSection(facts)
    expect(section.status).toBe('incomplete')
    expect(section.missingFieldPaths).toContain('capitalStructure.authorizedCapital')
    const row = section.rows?.find((r) => r[0].label === 'Authorized Capital')
    expect(row?.[0].value).toBeNull()
    expect(row?.[0].confirmed).toBe(false)
  })
})

describe('buildFinancialSummarySection', () => {
  it('is ready once all seven fields are confirmed', () => {
    const facts = emptyIssuerFacts()
    const keys: Array<keyof IssuerFacts['financials']> = [
      'fiscalYearEnd',
      'revenue',
      'ebitda',
      'netProfit',
      'totalAssets',
      'totalLiabilities',
      'netWorth',
    ]
    for (const key of keys) {
      facts.financials[key] = confirmedField('x') as never
    }
    const section = buildFinancialSummarySection(facts)
    expect(section.status).toBe('ready')
    expect(section.rows).toHaveLength(7)
  })
})

describe('buildShareholdingSection', () => {
  it('is incomplete with zero promoter records', () => {
    const section = buildShareholdingSection(emptyIssuerFacts())
    expect(section.status).toBe('incomplete')
    expect(section.rows).toEqual([])
  })

  it('flags a promoter row missing per-field, not per-record', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      {
        id: 'promoter-a',
        name: confirmedField('Asha Rao'),
        panOrId: aiField('ABCDE1234F'),
        din: aiField('0123456'),
        shareholdingPercent: aiField(41.5),
        category: confirmedField('Individual'),
      },
    ]
    const section = buildShareholdingSection(facts)
    expect(section.status).toBe('incomplete')
    expect(section.missingFieldPaths).toEqual(['promoters[promoter-a].shareholdingPercent'])
    const [row] = section.rows ?? []
    expect(row[0]).toMatchObject({ label: 'Name', value: 'Asha Rao', confirmed: true })
    expect(row[2]).toMatchObject({ label: 'Shareholding %', value: null, confirmed: false })
  })

  it('is ready once every promoter record is fully confirmed', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      {
        id: 'promoter-a',
        name: confirmedField('Asha Rao'),
        panOrId: confirmedField('ABCDE1234F'),
        din: confirmedField('0123456'),
        shareholdingPercent: confirmedField(41.5),
        category: confirmedField('Individual'),
      },
    ]
    const section = buildShareholdingSection(facts)
    expect(section.status).toBe('ready')
    expect(section.missingFieldPaths).toEqual([])
  })
})

describe('assembleSections', () => {
  it('returns static sections first, then computed sections, in a stable order', () => {
    const sections = assembleSections(emptyIssuerFacts())
    expect(sections.map((s) => s.id)).toEqual([
      'definitions',
      'general-info',
      'capital-structure',
      'shareholding',
      'financial-summary',
    ])
    expect(sections.filter((s) => s.kind === 'static')).toHaveLength(2)
    expect(sections.filter((s) => s.kind === 'computed')).toHaveLength(3)
  })

  // Pending the Gemini quota decision (2026-08-09), there's no live
  // confirmed dataset — this fixture stands in for one, matching the real
  // schema exactly, so Task 13's document view has something real to
  // render and this suite catches a schema drift immediately.
  it('renders every computed section as ready against the fully-confirmed fixture', () => {
    const sections = assembleSections(fixtureIssuerFacts())
    const computed = sections.filter((s) => s.kind === 'computed')
    expect(computed.every((s) => s.status === 'ready')).toBe(true)
    expect(computed.every((s) => s.missingFieldPaths.length === 0)).toBe(true)
    const shareholding = computed.find((s) => s.id === 'shareholding')
    expect(shareholding?.rows).toHaveLength(2)
  })
})
