import type { IssuerFacts } from '@/types/facts'
import { cellFromField } from './shared'
import type { Section } from './types'

const FIELDS: Array<[key: keyof IssuerFacts['capitalStructure'], label: string]> = [
  ['authorizedCapital', 'Authorized Capital'],
  ['issuedCapital', 'Issued Capital'],
  ['paidUpCapital', 'Paid-up Capital'],
  ['faceValuePerShare', 'Face Value per Share'],
  ['totalSharesOutstanding', 'Total Shares Outstanding'],
]

export function buildCapitalStructureSection(facts: IssuerFacts): Section {
  const missingFieldPaths = FIELDS.filter(
    ([key]) => facts.capitalStructure[key].status !== 'confirmed',
  ).map(([key]) => `capitalStructure.${key}`)

  return {
    id: 'capital-structure',
    title: 'Capital Structure',
    kind: 'computed',
    status: missingFieldPaths.length === 0 ? 'ready' : 'incomplete',
    rows: FIELDS.map(([key, label]) => [cellFromField(label, facts.capitalStructure[key])]),
    missingFieldPaths,
  }
}
