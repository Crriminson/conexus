import type { FieldStatus, IssuerFacts } from '@/types/facts'

// What the extract Edge Function (Task 6) produces. Deliberately not the
// same shape as IssuerFacts leaves: no `status`/`updatedAt` (merge-time
// concerns) and no per-leaf `sourceDocId` (the whole extraction comes from
// one document, carried once at the top level instead).
export interface ExtractedLeaf<T> {
  value: T | null
  confidence: number | null
  sourcePage: number | null
}

export interface ExtractedCompanyFacts {
  legalName: ExtractedLeaf<string>
  cin: ExtractedLeaf<string>
  incorporationDate: ExtractedLeaf<string>
  registeredOfficeAddress: ExtractedLeaf<string>
  industry: ExtractedLeaf<string>
  businessDescription: ExtractedLeaf<string>
}

export interface ExtractedFinancialsFacts {
  fiscalYearEnd: ExtractedLeaf<string>
  revenue: ExtractedLeaf<number>
  ebitda: ExtractedLeaf<number>
  netProfit: ExtractedLeaf<number>
  totalAssets: ExtractedLeaf<number>
  totalLiabilities: ExtractedLeaf<number>
  netWorth: ExtractedLeaf<number>
}

export interface ExtractedCapitalStructureFacts {
  authorizedCapital: ExtractedLeaf<number>
  issuedCapital: ExtractedLeaf<number>
  paidUpCapital: ExtractedLeaf<number>
  faceValuePerShare: ExtractedLeaf<number>
  totalSharesOutstanding: ExtractedLeaf<number>
}

export interface ExtractedPromoterRecord {
  name: ExtractedLeaf<string>
  panOrId: ExtractedLeaf<string>
  din: ExtractedLeaf<string | null>
  shareholdingPercent: ExtractedLeaf<number>
  category: ExtractedLeaf<string>
}

export interface ExtractedLitigationRecord {
  caseNumber: ExtractedLeaf<string | null>
  forum: ExtractedLeaf<string>
  partiesInvolved: ExtractedLeaf<string>
  natureOfProceeding: ExtractedLeaf<string>
  amountInvolved: ExtractedLeaf<number | null>
  status: ExtractedLeaf<string>
}

export interface ExtractedRelatedPartyRecord {
  partyName: ExtractedLeaf<string>
  relationship: ExtractedLeaf<string>
  natureOfTransaction: ExtractedLeaf<string>
  amount: ExtractedLeaf<number>
  transactionDate: ExtractedLeaf<string>
}

export interface ExtractedFacts {
  documentId: string
  company: ExtractedCompanyFacts
  financials: ExtractedFinancialsFacts
  capitalStructure: ExtractedCapitalStructureFacts
  promoters: ExtractedPromoterRecord[]
  litigation: ExtractedLitigationRecord[]
  relatedParties: ExtractedRelatedPartyRecord[]
}

export interface FactConflict {
  id: string
  fieldPath: string
  currentValue: unknown
  currentStatus: FieldStatus
  proposedValue: unknown
  proposedConfidence: number
  proposedSourceDocId: string
  proposedSourcePage: number
  raisedAt: string
  resolution: 'pending' | 'kept_current' | 'accepted_proposed'
  resolvedAt?: string
}

export interface MergeEvent {
  id: string
  documentId: string
  ranAt: string
  fieldsWritten: string[]
  fieldsSkipped: string[]
  conflictsRaised: string[]
}

export interface MergeResult {
  facts: IssuerFacts
  conflicts: FactConflict[]
  event: MergeEvent
}
