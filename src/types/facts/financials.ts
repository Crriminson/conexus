import type { Field } from './envelope'

export interface FinancialsFacts {
  fiscalYearEnd: Field<string>
  revenue: Field<number>
  ebitda: Field<number>
  netProfit: Field<number>
  totalAssets: Field<number>
  totalLiabilities: Field<number>
  netWorth: Field<number>
}
