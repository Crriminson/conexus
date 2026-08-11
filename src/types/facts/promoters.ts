import type { Field } from './envelope'

export interface PromoterRecord {
  id: string
  name: Field<string>
  panOrId: Field<string>
  din: Field<string | null>
  shareholdingPercent: Field<number>
  category: Field<string>
}

export type PromoterFacts = PromoterRecord[]
