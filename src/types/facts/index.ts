import type { CompanyFacts } from './company'
import type { FinancialsFacts } from './financials'
import type { PromoterFacts } from './promoters'
import type { CapitalStructureFacts } from './capitalStructure'
import type { LitigationFacts } from './litigation'
import type { RelatedPartyFacts } from './relatedParties'

export interface IssuerFacts {
  company: CompanyFacts
  financials: FinancialsFacts
  promoters: PromoterFacts
  capitalStructure: CapitalStructureFacts
  litigation: LitigationFacts
  relatedParties: RelatedPartyFacts
}

export type { FieldStatus, Field } from './envelope'
export type { CompanyFacts } from './company'
export type { FinancialsFacts } from './financials'
export type { PromoterRecord, PromoterFacts } from './promoters'
export type { CapitalStructureFacts } from './capitalStructure'
export type { LitigationRecord, LitigationFacts } from './litigation'
export type { RelatedPartyRecord, RelatedPartyFacts } from './relatedParties'
