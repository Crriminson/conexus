import { describe, expect, it } from 'vitest'
import type { Field, IssuerFacts } from '@/types/facts'
import { merge } from './merge'
import type { ExtractedFacts, ExtractedLeaf } from './types'

function emptyField<T>(): Field<T> {
  return { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: '2020-01-01T00:00:00.000Z' }
}

function aiField<T>(value: T, confidence: number): Field<T> {
  return { value, confidence, sourceDocId: 'doc-old', sourcePage: 1, status: 'ai', updatedAt: '2020-01-01T00:00:00.000Z' }
}

function confirmedField<T>(value: T): Field<T> {
  return { value, confidence: null, sourceDocId: 'doc-old', sourcePage: 1, status: 'confirmed', updatedAt: '2020-01-01T00:00:00.000Z' }
}

function editedField<T>(value: T): Field<T> {
  return { value, confidence: null, sourceDocId: null, sourcePage: null, status: 'edited', updatedAt: '2020-01-01T00:00:00.000Z' }
}

function nullLeaf<T>(): ExtractedLeaf<T> {
  return { value: null, confidence: null, sourcePage: null }
}

function leaf<T>(value: T, confidence = 0.9, sourcePage = 3): ExtractedLeaf<T> {
  return { value, confidence, sourcePage }
}

function emptyIssuerFacts(): IssuerFacts {
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
      legalName: nullLeaf(),
      cin: nullLeaf(),
      incorporationDate: nullLeaf(),
      registeredOfficeAddress: nullLeaf(),
      industry: nullLeaf(),
      businessDescription: nullLeaf(),
    },
    financials: {
      fiscalYearEnd: nullLeaf(),
      revenue: nullLeaf(),
      ebitda: nullLeaf(),
      netProfit: nullLeaf(),
      totalAssets: nullLeaf(),
      totalLiabilities: nullLeaf(),
      netWorth: nullLeaf(),
    },
    capitalStructure: {
      authorizedCapital: nullLeaf(),
      issuedCapital: nullLeaf(),
      paidUpCapital: nullLeaf(),
      faceValuePerShare: nullLeaf(),
      totalSharesOutstanding: nullLeaf(),
    },
    promoters: [],
    litigation: [],
    relatedParties: [],
  }
}

function makeDeps(startId = 0) {
  let counter = startId
  return {
    now: () => '2025-01-01T00:00:00.000Z',
    generateId: () => `id-${++counter}`,
  }
}

describe('merge — status precedence (section 4)', () => {
  it('overwrites an empty field with the extracted value, status becomes ai', () => {
    const existing = emptyIssuerFacts()
    const extracted = emptyExtractedFacts()
    extracted.company.legalName = leaf('Acme Ltd', 0.95, 2)

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.legalName).toEqual({
      value: 'Acme Ltd',
      confidence: 0.95,
      sourceDocId: 'doc-new',
      sourcePage: 2,
      status: 'ai',
      updatedAt: '2025-01-01T00:00:00.000Z',
    })
    expect(result.event.fieldsWritten).toContain('company.legalName')
    expect(result.conflicts).toHaveLength(0)
  })

  it('overwrites an ai field when the new extraction has higher confidence', () => {
    const existing = emptyIssuerFacts()
    existing.company.legalName = aiField('Acme Ltd', 0.5)
    const extracted = emptyExtractedFacts()
    extracted.company.legalName = leaf('Acme Limited', 0.9)

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.legalName.value).toBe('Acme Limited')
    expect(result.facts.company.legalName.confidence).toBe(0.9)
    expect(result.event.fieldsWritten).toContain('company.legalName')
  })

  it('discards an equal-or-lower-confidence extraction against an existing ai field', () => {
    const existing = emptyIssuerFacts()
    existing.company.legalName = aiField('Acme Ltd', 0.9)
    const extracted = emptyExtractedFacts()
    extracted.company.legalName = leaf('Acme Limited', 0.9)

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.legalName.value).toBe('Acme Ltd')
    expect(result.event.fieldsSkipped).toContain('company.legalName')
    expect(result.event.fieldsWritten).not.toContain('company.legalName')
  })

  it('keeps a confirmed field unchanged when the extraction agrees', () => {
    const existing = emptyIssuerFacts()
    existing.company.legalName = confirmedField('Acme Ltd')
    const extracted = emptyExtractedFacts()
    extracted.company.legalName = leaf('Acme Ltd')

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.legalName).toEqual(existing.company.legalName)
    expect(result.conflicts).toHaveLength(0)
    expect(result.event.fieldsSkipped).toContain('company.legalName')
  })

  it('raises a conflict instead of overwriting a confirmed field with a different value', () => {
    const existing = emptyIssuerFacts()
    existing.company.legalName = confirmedField('Acme Ltd')
    const extracted = emptyExtractedFacts('doc-new')
    extracted.company.legalName = leaf('Acme Global Ltd', 0.99, 5)

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.legalName.value).toBe('Acme Ltd')
    expect(result.facts.company.legalName.status).toBe('confirmed')
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]).toMatchObject({
      fieldPath: 'company.legalName',
      currentValue: 'Acme Ltd',
      currentStatus: 'confirmed',
      proposedValue: 'Acme Global Ltd',
      proposedConfidence: 0.99,
      proposedSourceDocId: 'doc-new',
      proposedSourcePage: 5,
      resolution: 'pending',
    })
    expect(result.event.conflictsRaised).toEqual([result.conflicts[0].id])
  })

  it('keeps an edited field unchanged when the extraction agrees', () => {
    const existing = emptyIssuerFacts()
    existing.company.industry = editedField('NBFC')
    const extracted = emptyExtractedFacts()
    extracted.company.industry = leaf('NBFC')

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.industry.value).toBe('NBFC')
    expect(result.facts.company.industry.status).toBe('edited')
    expect(result.conflicts).toHaveLength(0)
  })

  it('raises a conflict instead of overwriting an edited field with a different value', () => {
    const existing = emptyIssuerFacts()
    existing.company.industry = editedField('Fintech')
    const extracted = emptyExtractedFacts()
    extracted.company.industry = leaf('NBFC')

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.industry.value).toBe('Fintech')
    expect(result.conflicts).toHaveLength(1)
  })

  it('leaves a field untouched and unlogged when extraction found nothing (never guesses)', () => {
    const existing = emptyIssuerFacts()
    existing.company.legalName = confirmedField('Acme Ltd')
    const extracted = emptyExtractedFacts()

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.company.legalName).toEqual(existing.company.legalName)
    expect(result.event.fieldsWritten).toHaveLength(0)
    expect(result.event.fieldsSkipped).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })
})

describe('merge — non-negotiables (section 4)', () => {
  it('does not coerce or round numeric values', () => {
    const existing = emptyIssuerFacts()
    const extracted = emptyExtractedFacts()
    extracted.financials.revenue = leaf(1234567.891234)

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.financials.revenue.value).toBe(1234567.891234)
  })

  it('never mutates the existing facts object', () => {
    const existing = emptyIssuerFacts()
    existing.company.legalName = confirmedField('Acme Ltd')
    const snapshot = JSON.parse(JSON.stringify(existing))
    const extracted = emptyExtractedFacts()
    extracted.company.legalName = leaf('Different Name')
    extracted.promoters = [
      { name: leaf('New Promoter'), panOrId: nullLeaf(), din: nullLeaf(), shareholdingPercent: nullLeaf(), category: nullLeaf() },
    ]

    merge(existing, extracted, makeDeps())

    expect(existing).toEqual(snapshot)
  })
})

describe('merge — repeating groups (promoters, litigation, related parties)', () => {
  it('appends a new promoter not matched by name, generating a fresh id, status ai', () => {
    const existing = emptyIssuerFacts()
    const extracted = emptyExtractedFacts()
    extracted.promoters = [
      { name: leaf('Jane Doe'), panOrId: leaf('ABCDE1234F'), din: nullLeaf(), shareholdingPercent: leaf(12.5), category: leaf('Individual') },
    ]

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.promoters).toHaveLength(1)
    expect(result.facts.promoters[0].id).toBe('id-1')
    expect(result.facts.promoters[0].name).toMatchObject({ value: 'Jane Doe', status: 'ai' })
    expect(result.event.fieldsWritten).toContain('promoters[id-1].name')
  })

  it('matches an existing promoter by name and merges per-field, not by array position', () => {
    const existing = emptyIssuerFacts()
    existing.promoters = [
      {
        id: 'p1',
        name: confirmedField('Jane Doe'),
        panOrId: emptyField(),
        din: emptyField(),
        shareholdingPercent: aiField(10, 0.6),
        category: emptyField(),
      },
    ]
    const extracted = emptyExtractedFacts()
    extracted.promoters = [
      { name: leaf('Jane Doe'), panOrId: leaf('ABCDE1234F'), din: nullLeaf(), shareholdingPercent: leaf(12.5, 0.8), category: nullLeaf() },
    ]

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.promoters).toHaveLength(1)
    const merged = result.facts.promoters[0]
    expect(merged.id).toBe('p1')
    expect(merged.name).toMatchObject({ value: 'Jane Doe', status: 'confirmed' })
    expect(merged.panOrId).toMatchObject({ value: 'ABCDE1234F', status: 'ai' })
    expect(merged.shareholdingPercent).toMatchObject({ value: 12.5, status: 'ai' })
  })

  it('matches promoters by normalized name regardless of case or whitespace', () => {
    const existing = emptyIssuerFacts()
    existing.promoters = [
      { id: 'p1', name: aiField('Jane Doe', 0.5), panOrId: emptyField(), din: emptyField(), shareholdingPercent: emptyField(), category: emptyField() },
    ]
    const extracted = emptyExtractedFacts()
    extracted.promoters = [
      { name: leaf('  JANE DOE  ', 0.9), panOrId: nullLeaf(), din: nullLeaf(), shareholdingPercent: nullLeaf(), category: nullLeaf() },
    ]

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.promoters).toHaveLength(1)
    expect(result.facts.promoters[0].id).toBe('p1')
  })

  it('keeps an existing promoter the new extraction does not mention — never deletes', () => {
    const existing = emptyIssuerFacts()
    existing.promoters = [
      { id: 'p1', name: confirmedField('Jane Doe'), panOrId: emptyField(), din: emptyField(), shareholdingPercent: emptyField(), category: emptyField() },
    ]
    const extracted = emptyExtractedFacts()

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.promoters).toHaveLength(1)
    expect(result.facts.promoters[0].id).toBe('p1')
  })

  it('matches litigation records by case number when present', () => {
    const existing = emptyIssuerFacts()
    existing.litigation = [
      {
        id: 'l1',
        caseNumber: confirmedField('CIV/2024/001'),
        forum: emptyField(),
        partiesInvolved: emptyField(),
        natureOfProceeding: emptyField(),
        amountInvolved: emptyField(),
        status: emptyField(),
      },
    ]
    const extracted = emptyExtractedFacts()
    extracted.litigation = [
      {
        caseNumber: leaf('civ/2024/001'),
        forum: leaf('High Court'),
        partiesInvolved: nullLeaf(),
        natureOfProceeding: nullLeaf(),
        amountInvolved: nullLeaf(),
        status: nullLeaf(),
      },
    ]

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.litigation).toHaveLength(1)
    expect(result.facts.litigation[0].id).toBe('l1')
    expect(result.facts.litigation[0].forum.value).toBe('High Court')
  })

  it('falls back to parties+nature when litigation records have no case number', () => {
    const existing = emptyIssuerFacts()
    existing.litigation = [
      {
        id: 'l1',
        caseNumber: emptyField(),
        forum: emptyField(),
        partiesInvolved: confirmedField('Acme Ltd vs. Regulator'),
        natureOfProceeding: confirmedField('Tax dispute'),
        amountInvolved: emptyField(),
        status: emptyField(),
      },
    ]
    const extracted = emptyExtractedFacts()
    extracted.litigation = [
      {
        caseNumber: nullLeaf(),
        forum: leaf('Tribunal'),
        partiesInvolved: leaf('Acme Ltd vs. Regulator'),
        natureOfProceeding: leaf('Tax dispute'),
        amountInvolved: nullLeaf(),
        status: nullLeaf(),
      },
    ]

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.litigation).toHaveLength(1)
    expect(result.facts.litigation[0].id).toBe('l1')
    expect(result.facts.litigation[0].forum.value).toBe('Tribunal')
  })

  it('matches related-party records by party name and nature of transaction', () => {
    const existing = emptyIssuerFacts()
    existing.relatedParties = [
      {
        id: 'rp1',
        partyName: confirmedField('Promoter Holdco'),
        relationship: emptyField(),
        natureOfTransaction: confirmedField('Loan'),
        amount: emptyField(),
        transactionDate: emptyField(),
      },
    ]
    const extracted = emptyExtractedFacts()
    extracted.relatedParties = [
      { partyName: leaf('Promoter Holdco'), relationship: leaf('Group company'), natureOfTransaction: leaf('Loan'), amount: leaf(500000), transactionDate: nullLeaf() },
    ]

    const result = merge(existing, extracted, makeDeps())

    expect(result.facts.relatedParties).toHaveLength(1)
    expect(result.facts.relatedParties[0].id).toBe('rp1')
    expect(result.facts.relatedParties[0].amount.value).toBe(500000)
  })
})

describe('merge — event shape', () => {
  it('produces a merge event carrying documentId, timestamp, and provenance lists', () => {
    const existing = emptyIssuerFacts()
    const extracted = emptyExtractedFacts('doc-42')
    extracted.company.legalName = leaf('Acme Ltd')

    const result = merge(existing, extracted, makeDeps())

    expect(result.event.documentId).toBe('doc-42')
    expect(result.event.ranAt).toBe('2025-01-01T00:00:00.000Z')
    expect(result.event.fieldsWritten).toContain('company.legalName')
    expect(typeof result.event.id).toBe('string')
  })
})
