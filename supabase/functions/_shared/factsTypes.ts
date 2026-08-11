// Structural mirror of src/types/facts/* for the Deno runtime, which can't
// resolve the Vite side's `@/` alias or extensionless relative imports.
// Only the *type declarations* are duplicated here — TypeScript's structural
// typing keeps this interchangeable with src/types/facts's IssuerFacts, so
// values pass between the two runtimes without casting. The merge() LOGIC
// itself is NOT duplicated — this file exists so that logic can be single-
// sourced in ./merge/merge.ts. If Task 2's fact shape ever changes, this
// file must be updated to match.

export type FieldStatus = 'empty' | 'ai' | 'confirmed' | 'edited'

export interface Field<T> {
  value: T | null
  confidence: number | null
  sourceDocId: string | null
  sourcePage: number | null
  status: FieldStatus
  updatedAt: string
}

export interface CompanyFacts {
  legalName: Field<string>
  cin: Field<string>
  incorporationDate: Field<string>
  registeredOfficeAddress: Field<string>
  industry: Field<string>
  businessDescription: Field<string>
}

export interface FinancialsFacts {
  fiscalYearEnd: Field<string>
  revenue: Field<number>
  ebitda: Field<number>
  netProfit: Field<number>
  totalAssets: Field<number>
  totalLiabilities: Field<number>
  netWorth: Field<number>
}

export interface CapitalStructureFacts {
  authorizedCapital: Field<number>
  issuedCapital: Field<number>
  paidUpCapital: Field<number>
  faceValuePerShare: Field<number>
  totalSharesOutstanding: Field<number>
}

export interface PromoterRecord {
  id: string
  name: Field<string>
  panOrId: Field<string>
  din: Field<string | null>
  shareholdingPercent: Field<number>
  category: Field<string>
}

export interface LitigationRecord {
  id: string
  caseNumber: Field<string | null>
  forum: Field<string>
  partiesInvolved: Field<string>
  natureOfProceeding: Field<string>
  amountInvolved: Field<number | null>
  status: Field<string>
}

export interface RelatedPartyRecord {
  id: string
  partyName: Field<string>
  relationship: Field<string>
  natureOfTransaction: Field<string>
  amount: Field<number>
  transactionDate: Field<string>
}

export interface IssuerFacts {
  company: CompanyFacts
  financials: FinancialsFacts
  promoters: PromoterRecord[]
  capitalStructure: CapitalStructureFacts
  litigation: LitigationRecord[]
  relatedParties: RelatedPartyRecord[]
}
