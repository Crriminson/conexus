import type { IssuerFacts } from '@/types/facts'
import type { GeneratedSections } from '@/lib/generatedSections'
import { buildCapitalStructureSection } from './capitalStructure'
import { buildFinancialSummarySection } from './financials'
import { buildShareholdingSection } from './shareholding'
import { buildGeneratedSections } from './generated'
import { STATIC_SECTIONS } from './staticSections'

export type { Section, SectionCell, SectionCitation, SectionKind } from './types'
export { STATIC_SECTIONS } from './staticSections'
export { buildCapitalStructureSection } from './capitalStructure'
export { buildFinancialSummarySection } from './financials'
export { buildShareholdingSection } from './shareholding'
export { buildGeneratedSections } from './generated'
export { isTable } from './shared'

// Fixed order for Task 13's document view: boilerplate, then the computed
// sections in the same order the architecture doc lists them, then the 3
// generated narrative sections (architecture §2/§6) last — data tables
// before the narrative discussion built on top of them.
export function assembleSections(facts: IssuerFacts, generatedSections: GeneratedSections = {}) {
  return [
    ...STATIC_SECTIONS,
    buildCapitalStructureSection(facts),
    buildShareholdingSection(facts),
    buildFinancialSummarySection(facts),
    ...buildGeneratedSections(generatedSections),
  ]
}
