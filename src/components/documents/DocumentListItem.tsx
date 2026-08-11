import type { DocumentRow } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExtractionProgress } from './ExtractionProgress'

// docs/UI_ARCHITECTURE.md's status-vocabulary table: pending/processing →
// caution, complete → confirmed, failed → signature (pinned rule, case 3 —
// a terminal failure needing a human's retry).
const STATUS_STYLES: Record<string, string> = {
  pending: 'border-caution/40 bg-caution-tint text-caution',
  processing: 'border-caution/40 bg-caution-tint text-caution',
  complete: 'border-confirmed/40 bg-confirmed-tint text-confirmed',
  failed: 'border-signature/40 bg-signature-tint text-signature',
}

const RETRYABLE_STATUSES = new Set(['pending', 'failed'])

export interface DocumentListItemProps {
  document: DocumentRow
  isExtracting: boolean
  onExtract: (documentId: string) => void
}

export function DocumentListItem({ document, isExtracting, onExtract }: DocumentListItemProps) {
  const isChunked = document.extraction_status === 'processing' && Boolean(document.extraction_total_chunks)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-paper-raised px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-ink">{document.filename}</span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-sm border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide',
              STATUS_STYLES[document.extraction_status] ?? 'border-hairline bg-paper-recessed text-ink-muted',
            )}
          >
            {document.extraction_status}
          </span>
          {RETRYABLE_STATUSES.has(document.extraction_status) && (
            <Button type="button" variant="ghost" size="xs" disabled={isExtracting} onClick={() => onExtract(document.id)}>
              {document.extraction_status === 'failed' ? 'Retry' : 'Extract'}
            </Button>
          )}
        </div>
      </div>

      {isChunked && (
        <ExtractionProgress completed={document.extraction_completed_chunks} total={document.extraction_total_chunks!} />
      )}

      {document.extraction_status === 'failed' && document.extraction_error && (
        <p className="text-xs text-signature">{document.extraction_error}</p>
      )}
    </div>
  )
}
