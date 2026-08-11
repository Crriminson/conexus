import type { DocumentRow } from '@/hooks/useDocuments'

export interface ExtractionProgressSummary {
  text: string
  tone: 'neutral' | 'confirmed' | 'caution'
}

/**
 * The Documents screen header's chip — reuses the exact same fields
 * `ExtractionProgress`/`DocumentListItem` already read per row
 * (`extraction_completed_chunks`/`extraction_total_chunks`/
 * `extraction_status`), just summarized once at header level.
 *
 * While a document is actively chunking, that document's own live chunk
 * count is the most concrete, truthful thing to show (same "chunk N of M"
 * language as its per-row progress bar). Once nothing is actively
 * processing, chunk counts stop being meaningful (per-row progress bars
 * only render for `processing` rows in the first place — see
 * `DocumentListItem.tsx`), so the chip falls back to a document-level
 * summary instead, using the same `extraction_status` vocabulary the
 * per-row status pills already show.
 */
export function describeExtractionProgress(documents: DocumentRow[]): ExtractionProgressSummary {
  if (documents.length === 0) return { text: 'No documents yet', tone: 'neutral' }

  const processing = documents.find((d) => d.extraction_status === 'processing' && d.extraction_total_chunks)
  if (processing) {
    return {
      text: `chunk ${processing.extraction_completed_chunks} of ${processing.extraction_total_chunks} processed`,
      tone: 'caution',
    }
  }

  const complete = documents.filter((d) => d.extraction_status === 'complete').length
  return {
    text: `${complete} of ${documents.length} document(s) processed`,
    tone: complete === documents.length ? 'confirmed' : 'caution',
  }
}
