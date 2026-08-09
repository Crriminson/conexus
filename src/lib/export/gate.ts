import type { IssuerFacts } from '@/types/facts'
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
export function checkExportGate(facts: IssuerFacts): ExportGateResult {
  const missingFieldPaths = assembleSections(facts).flatMap((section) => section.missingFieldPaths)
  return { allowed: missingFieldPaths.length === 0, missingFieldPaths }
}
