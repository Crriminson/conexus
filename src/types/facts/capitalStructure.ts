import type { Field } from './envelope'

export interface CapitalStructureFacts {
  authorizedCapital: Field<number>
  issuedCapital: Field<number>
  paidUpCapital: Field<number>
  faceValuePerShare: Field<number>
  totalSharesOutstanding: Field<number>
}
