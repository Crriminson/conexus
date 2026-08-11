import type { IssuerFacts } from '@/types/facts'
import type { GeneratedSections } from '@/lib/generatedSections'
import { assembleSections } from '@/lib/templates'

export interface ExportGateResult {
  allowed: boolean
  missingFieldPaths: string[]
}

// Export reads the same assembled sections Task 13 renders (architecture
// §9 task 14: "takes the same confirmed-facts dataset Task 11 assembles
// from"), so "all-facts-confirmed" here means every computed section is
// 'ready' — the same bar the Document view already shows via its status
// badges. Static sections are always 'ready' and don't affect the gate.
// Generic over every section's missingFieldPaths (not hardcoded to
// "computed"), so Task 12's generated sections tighten the gate
// automatically — export is blocked until narrative generation has run too,
// with no separate list to keep in sync (see docs/DECISIONS.md).
export function checkExportGate(facts: IssuerFacts, generatedSections: GeneratedSections = {}): ExportGateResult {
  const missingFieldPaths = assembleSections(facts, generatedSections).flatMap((section) => section.missingFieldPaths)
  return { allowed: missingFieldPaths.length === 0, missingFieldPaths }
}
