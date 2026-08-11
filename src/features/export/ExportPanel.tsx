import { useState } from 'react'
import type { IssuerFacts } from '@/types/facts'
import type { DocumentRow } from '@/hooks/useDocuments'
import type { GeneratedSections } from '@/lib/generatedSections'
import { checkExportGate, buildExportMarkdown, exportFilename, downloadMarkdownFile } from '@/lib/export'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'

/**
 * Reworked from a button + one-line caption into a full section with a real
 * blocked-by-gate state (docs/UI_ARCHITECTURE.md, "Export gets real screen
 * real estate") — the literal unmet field paths, in `.font-data`, never
 * summarized as "N fields missing" (docs/DESIGN_SYSTEM.md's blocked-by-gate
 * rule). `checkExportGate` already returns the full path list; this only
 * renders it.
 */
export function ExportPanel({
  facts,
  documents,
  generatedSections,
}: {
  facts: IssuerFacts
  documents: DocumentRow[]
  generatedSections: GeneratedSections
}) {
  const [error, setError] = useState<string | null>(null)
  const gate = checkExportGate(facts, generatedSections)

  function handleExport() {
    setError(null)
    try {
      const markdown = buildExportMarkdown(facts, documents, generatedSections)
      downloadMarkdownFile(exportFilename(facts), markdown)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Export</h2>
        <Badge tone={gate.allowed ? 'confirmed' : 'caution'}>{gate.allowed ? 'Ready' : 'Blocked'}</Badge>
      </div>

      {!gate.allowed && (
        <Callout tone="signature" title="Export is blocked" items={gate.missingFieldPaths}>
          Every section must be confirmed and cited before export — resolve these in Facts Review, then generate the
          narrative sections.
        </Callout>
      )}

      {error && (
        <Callout tone="signature" title="Export failed">
          {error}
        </Callout>
      )}

      <Button type="button" disabled={!gate.allowed} onClick={handleExport} className="self-start">
        Export to Markdown
      </Button>
    </section>
  )
}
