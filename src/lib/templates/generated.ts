import type { GeneratedSectionKey, GeneratedSections } from '@/lib/generatedSections'
import type { Section } from './types'

const GENERATED_SECTIONS: Array<[key: GeneratedSectionKey, id: string, title: string]> = [
  ['riskFactors', 'risk-factors', 'Risk Factors'],
  ['mdAndA', 'mdna', "Management Discussion & Analysis"],
  ['businessOverview', 'business-overview', 'Business Overview'],
]

// Unlike computed sections (missing = a specific field never got confirmed),
// a generated section is simply "not generated yet" — its one
// missingFieldPath entry is a marker for the export gate, not a real fact
// path, so `checkExportGate()` (which just checks every section's
// missingFieldPaths is empty) blocks export the same way it already does
// for an incomplete computed section, with no separate gate logic needed.
export function buildGeneratedSections(generatedSections: GeneratedSections): Section[] {
  return GENERATED_SECTIONS.map(([key, id, title]) => {
    const content = generatedSections[key]
    return {
      id,
      title,
      kind: 'generated',
      status: content ? 'ready' : 'incomplete',
      body: content?.body,
      citations: content?.citations ?? [],
      missingFieldPaths: content ? [] : [`generated.${key}`],
    }
  })
}
