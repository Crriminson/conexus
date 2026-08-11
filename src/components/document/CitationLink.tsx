import type { DocumentRow } from '@/hooks/useDocuments'

export interface CitationSource {
  sourceDocId: string | null
  sourcePage: number | null
}

export interface CitationLinkProps {
  source: CitationSource
  documents: DocumentRow[]
  onOpenSource: (storagePath: string, page: number | null) => void
}

/**
 * One citation: filename + page, opens the signed source URL on click.
 * Shared by computed-section cells and generated-section citations — both
 * are just a `{ sourceDocId, sourcePage }` pair pointing at a document, so
 * this is the one place that pairing renders (was a `sourceLink()` closure
 * re-created per component before this).
 */
export function CitationLink({ source, documents, onOpenSource }: CitationLinkProps) {
  const doc = documents.find((d) => d.id === source.sourceDocId)
  if (!doc) return null

  return (
    <button
      type="button"
      onClick={() => onOpenSource(doc.storage_path, source.sourcePage)}
      className="interactive rounded-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
    >
      {doc.filename}
      {source.sourcePage ? ` p.${source.sourcePage}` : ''}
    </button>
  )
}
