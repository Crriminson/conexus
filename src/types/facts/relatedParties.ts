import type { Field } from './envelope'

export interface RelatedPartyRecord {
  id: string
  partyName: Field<string>
  relationship: Field<string>
  natureOfTransaction: Field<string>
  amount: Field<number>
  transactionDate: Field<string>
}

export type RelatedPartyFacts = RelatedPartyRecord[]
