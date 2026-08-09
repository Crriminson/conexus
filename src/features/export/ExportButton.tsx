import { useState } from 'react'
import type { IssuerFacts } from '@/types/facts'
import type { DocumentRow } from '@/hooks/useDocuments'
import { checkExportGate, buildExportMarkdown, exportFilename, downloadMarkdownFile } from '@/lib/export'

export function ExportButton({ facts, documents }: { facts: IssuerFacts; documents: DocumentRow[] }) {
  const [error, setError] = useState<string | null>(null)
  const gate = checkExportGate(facts)

  const handleExport = () => {
    setError(null)
    try {
      const markdown = buildExportMarkdown(facts, documents)
      downloadMarkdownFile(exportFilename(facts), markdown)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={!gate.allowed}
        title={gate.allowed ? undefined : `${gate.missingFieldPaths.length} field(s) not confirmed yet`}
        className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export to Markdown
      </button>
      {!gate.allowed && (
        <span className="text-xs text-muted-foreground">
          {gate.missingFieldPaths.length} field(s) not confirmed yet
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
