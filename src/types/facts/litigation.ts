import type { Field } from './envelope'

export interface LitigationRecord {
  id: string
  caseNumber: Field<string | null>
  forum: Field<string>
  partiesInvolved: Field<string>
  natureOfProceeding: Field<string>
  amountInvolved: Field<number | null>
  status: Field<string>
}

export type LitigationFacts = LitigationRecord[]
