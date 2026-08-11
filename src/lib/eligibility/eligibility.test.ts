import { describe, expect, it } from 'vitest'
import type { Field, IssuerFacts } from '@/types/facts'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { fixtureIssuerFacts } from '@/lib/templates/fixtures'
import { evaluateEligibility } from './evaluate'

function confirmed<T>(value: T): Field<T> {
  return { value, confidence: null, sourceDocId: 'doc-1', sourcePage: 1, status: 'confirmed', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function ai<T>(value: T): Field<T> {
  return { value, confidence: 0.8, sourceDocId: 'doc-1', sourcePage: 1, status: 'ai', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function missing<T>(): Field<T> {
  return { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function resultFor(facts: IssuerFacts, id: string) {
  return evaluateEligibility(facts).results.find((r) => r.id === id)
}

describe('evaluateEligibility — empty facts', () => {
  it('every rule is unknown, overall is unknown', () => {
    const report = evaluateEligibility(emptyIssuerFacts())
    expect(report.overall).toBe('unknown')
    expect(report.results.every((r) => r.status === 'unknown')).toBe(true)
    expect(report.results.every((r) => r.basis === 'missing')).toBe(true)
  })
})

describe('evaluateEligibility — fully-confirmed fixture', () => {
  it('has no fail or unknown results', () => {
    const report = evaluateEligibility(fixtureIssuerFacts())
    expect(report.results.filter((r) => r.status === 'fail')).toEqual([])
    expect(report.results.filter((r) => r.status === 'unknown')).toEqual([])
  })
})

describe('net-worth-positive', () => {
  it('fails on non-positive net worth', () => {
    const facts = emptyIssuerFacts()
    facts.financials.netWorth = confirmed(-500)
    expect(resultFor(facts, 'net-worth-positive')?.status).toBe('fail')
  })

  it('passes on positive net worth and reports confirmed basis', () => {
    const facts = emptyIssuerFacts()
    facts.financials.netWorth = confirmed(19123)
    const result = resultFor(facts, 'net-worth-positive')
    expect(result?.status).toBe('pass')
    expect(result?.basis).toBe('confirmed')
  })

  it('reports unconfirmed basis for an ai-only value', () => {
    const facts = emptyIssuerFacts()
    facts.financials.netWorth = ai(19123)
    expect(resultFor(facts, 'net-worth-positive')?.basis).toBe('unconfirmed')
  })
})

describe('profitable', () => {
  it('warns, not fails, on a loss — a bad year is not disqualifying on its own', () => {
    const facts = emptyIssuerFacts()
    facts.financials.netProfit = confirmed(-100)
    expect(resultFor(facts, 'profitable')?.status).toBe('warning')
  })
})

describe('minimum-promoter-contribution', () => {
  it('is unknown with zero promoter records', () => {
    expect(resultFor(emptyIssuerFacts(), 'minimum-promoter-contribution')?.status).toBe('unknown')
  })

  it('fails when known holdings are below 20% and nothing is missing', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      { id: 'p1', name: confirmed('A'), panOrId: confirmed('x'), din: confirmed('y'), shareholdingPercent: confirmed(10), category: confirmed('Promoter') },
    ]
    const result = resultFor(facts, 'minimum-promoter-contribution')
    expect(result?.status).toBe('fail')
  })

  it('is unknown (not fail) when known holdings are below 20% but some promoters are missing a figure', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      { id: 'p1', name: confirmed('A'), panOrId: confirmed('x'), din: confirmed('y'), shareholdingPercent: confirmed(5), category: confirmed('Promoter') },
      { id: 'p2', name: confirmed('B'), panOrId: confirmed('x'), din: confirmed('y'), shareholdingPercent: missing<number>(), category: confirmed('Promoter') },
    ]
    // p2's shareholding left as an empty field (value: null) on purpose.
    const result = resultFor(facts, 'minimum-promoter-contribution')
    expect(result?.status).toBe('unknown')
    expect(result?.detail).toContain('missing a shareholding figure')
  })

  it('passes once known holdings alone already clear 20%, even if a promoter is still missing a figure', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      { id: 'p1', name: confirmed('A'), panOrId: confirmed('x'), din: confirmed('y'), shareholdingPercent: confirmed(61.15), category: confirmed('Promoter') },
      { id: 'p2', name: confirmed('B'), panOrId: confirmed('x'), din: confirmed('y'), shareholdingPercent: missing<number>(), category: confirmed('Promoter') },
    ]
    expect(resultFor(facts, 'minimum-promoter-contribution')?.status).toBe('pass')
  })
})

describe('capital-structure-consistency', () => {
  it('fails when paid-up capital exceeds issued capital', () => {
    const facts = emptyIssuerFacts()
    facts.capitalStructure.paidUpCapital = confirmed(1000)
    facts.capitalStructure.issuedCapital = confirmed(500)
    facts.capitalStructure.authorizedCapital = confirmed(2000)
    expect(resultFor(facts, 'capital-structure-consistency')?.status).toBe('fail')
  })

  it('passes when paid-up <= issued <= authorized', () => {
    const facts = emptyIssuerFacts()
    facts.capitalStructure.paidUpCapital = confirmed(500)
    facts.capitalStructure.issuedCapital = confirmed(500)
    facts.capitalStructure.authorizedCapital = confirmed(2000)
    expect(resultFor(facts, 'capital-structure-consistency')?.status).toBe('pass')
  })
})

describe('no-pending-litigation', () => {
  it('is unknown with zero litigation records', () => {
    expect(resultFor(emptyIssuerFacts(), 'no-pending-litigation')?.status).toBe('unknown')
  })

  it('warns when a record status mentions pending', () => {
    const facts = emptyIssuerFacts()
    facts.litigation = [
      {
        id: 'l1',
        caseNumber: confirmed('123/2024'),
        forum: confirmed('High Court'),
        partiesInvolved: confirmed('X vs Y'),
        natureOfProceeding: confirmed('Civil'),
        amountInvolved: confirmed(1000),
        status: confirmed('Pending before the High Court'),
      },
    ]
    expect(resultFor(facts, 'no-pending-litigation')?.status).toBe('warning')
  })

  it('passes when every record status is resolved', () => {
    const facts = emptyIssuerFacts()
    facts.litigation = [
      {
        id: 'l1',
        caseNumber: confirmed('123/2024'),
        forum: confirmed('High Court'),
        partiesInvolved: confirmed('X vs Y'),
        natureOfProceeding: confirmed('Civil'),
        amountInvolved: confirmed(1000),
        status: confirmed('Disposed'),
      },
    ]
    expect(resultFor(facts, 'no-pending-litigation')?.status).toBe('pass')
  })
})

describe('cin-format', () => {
  it('passes a well-formed CIN', () => {
    const facts = emptyIssuerFacts()
    facts.company.cin = confirmed('U65923TN2015PLC100328')
    expect(resultFor(facts, 'cin-format')?.status).toBe('pass')
  })

  it('fails a malformed CIN', () => {
    const facts = emptyIssuerFacts()
    facts.company.cin = confirmed('not-a-cin')
    expect(resultFor(facts, 'cin-format')?.status).toBe('fail')
  })
})

describe('overall status aggregation', () => {
  it('is fail if any rule fails, even with other passes', () => {
    const facts = fixtureIssuerFacts()
    facts.company.cin = confirmed('not-a-cin')
    expect(evaluateEligibility(facts).overall).toBe('fail')
  })

  it('is warning (not fail) when the worst rule is a warning', () => {
    const facts = fixtureIssuerFacts()
    facts.financials.netProfit = confirmed(-1)
    const report = evaluateEligibility(facts)
    expect(report.overall).toBe('warning')
    expect(report.results.some((r) => r.status === 'fail')).toBe(false)
  })
})
