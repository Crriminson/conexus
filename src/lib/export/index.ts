import type { IssuerFacts } from '@/types/facts'
import type { DocumentRow } from '@/hooks/useDocuments'
import { checkExportGate } from './gate'
import { buildExportMarkdown } from './markdown'

export { LIABILITY_DISCLAIMER } from './disclaimer'
export { checkExportGate } from './gate'
export type { ExportGateResult } from './gate'
export { buildExportMarkdown, exportFilename } from './markdown'
export { downloadMarkdownFile } from './download'

export class ExportNotAllowedError extends Error {
  missingFieldPaths: string[]

  constructor(missingFieldPaths: string[]) {
    super(`Cannot export: ${missingFieldPaths.length} field(s) not confirmed yet.`)
    this.name = 'ExportNotAllowedError'
    this.missingFieldPaths = missingFieldPaths
  }
}

// Gate + render in one call — the entry point UI code should use. Throws
// ExportNotAllowedError rather than returning partial Markdown, per
// architecture §9 task 14: "Gate on all-facts-confirmed."
export function exportProjectMarkdown(facts: IssuerFacts, documents: DocumentRow[]): string {
  const gate = checkExportGate(facts)
  if (!gate.allowed) throw new ExportNotAllowedError(gate.missingFieldPaths)
  return buildExportMarkdown(facts, documents)
}
