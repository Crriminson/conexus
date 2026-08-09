import type { IssuerFacts } from '@/types/facts'
import { buildCapitalStructureSection } from './capitalStructure'
import { buildFinancialSummarySection } from './financials'
import { buildShareholdingSection } from './shareholding'
import { STATIC_SECTIONS } from './staticSections'

export type { Section, SectionCell, SectionKind } from './types'
export { STATIC_SECTIONS } from './staticSections'
export { buildCapitalStructureSection } from './capitalStructure'
export { buildFinancialSummarySection } from './financials'
export { buildShareholdingSection } from './shareholding'

// Fixed order for Task 13's document view: boilerplate first, then the
// computed sections in the same order the architecture doc lists them.
export function assembleSections(facts: IssuerFacts) {
  return [
    ...STATIC_SECTIONS,
    buildCapitalStructureSection(facts),
    buildShareholdingSection(facts),
    buildFinancialSummarySection(facts),
  ]
}
