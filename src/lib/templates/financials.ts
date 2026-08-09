import type { IssuerFacts } from '@/types/facts'
import { cellFromField } from './shared'
import type { Section } from './types'

const FIELDS: Array<[key: keyof IssuerFacts['financials'], label: string]> = [
  ['fiscalYearEnd', 'Fiscal Year End'],
  ['revenue', 'Revenue'],
  ['ebitda', 'EBITDA'],
  ['netProfit', 'Net Profit'],
  ['totalAssets', 'Total Assets'],
  ['totalLiabilities', 'Total Liabilities'],
  ['netWorth', 'Net Worth'],
]

export function buildFinancialSummarySection(facts: IssuerFacts): Section {
  const missingFieldPaths = FIELDS.filter(
    ([key]) => facts.financials[key].status !== 'confirmed',
  ).map(([key]) => `financials.${key}`)

  return {
    id: 'financial-summary',
    title: 'Financial Summary',
    kind: 'computed',
    status: missingFieldPaths.length === 0 ? 'ready' : 'incomplete',
    rows: FIELDS.map(([key, label]) => [cellFromField(label, facts.financials[key])]),
    missingFieldPaths,
  }
}
