import type { Field } from './envelope'
import type { IssuerFacts } from './index'

function emptyField<T>(): Field<T> {
  return {
    value: null,
    confidence: null,
    sourceDocId: null,
    sourcePage: null,
    status: 'empty',
    updatedAt: new Date().toISOString(),
  }
}

export function emptyIssuerFacts(): IssuerFacts {
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
