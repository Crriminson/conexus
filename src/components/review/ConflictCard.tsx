import type { Field } from '@/types/facts'
import type { FactConflict } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/button'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

export interface ConflictCardProps {
  conflict: FactConflict
  field: Field<unknown>
  documents: DocumentRow[]
  isBusy: boolean
  onResolve: (conflictId: string, resolution: 'kept_current' | 'accepted_proposed') => void
  onOpenSource: (storagePath: string, page: number | null) => void
}

/**
 * Side-by-side resolution UI for one pending conflict.
 *
 * Both sides show their source, because that's the entire basis for choosing
 * between them — a conflict is only ever raised against a `confirmed` or
 * `edited` field, so the question being asked is "a later document disagrees
 * with what you already decided; which document is right?" Answering that
 * without seeing where each value came from isn't possible.
 */
export function ConflictCard({ conflict, field, documents, isBusy, onResolve, onOpenSource }: ConflictCardProps) {
  const currentDoc = documents.find((d) => d.id === field.sourceDocId)
  const proposedDoc = documents.find((d) => d.id === conflict.proposedSourceDocId)

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-paper-raised p-2.5">
        <p className="text-xs font-medium text-ink-muted">Current ({conflict.currentStatus})</p>
        <p className="text-sm break-words text-ink">{formatValue(conflict.currentValue)}</p>
        {currentDoc && (
          <button
            type="button"
            onClick={() => onOpenSource(currentDoc.storage_path, field.sourcePage)}
            className="interactive self-start rounded-sm text-left text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {currentDoc.filename}
            {field.sourcePage ? ` p.${field.sourcePage}` : ''}
          </button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => onResolve(conflict.id, 'kept_current')}
          className="mt-1"
        >
          Keep current
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-paper-raised p-2.5">
        <p className="text-xs font-medium text-ink-muted">
          Proposed (<span className="font-data tabular-nums">{Math.round(conflict.proposedConfidence * 100)}%</span>{' '}
          confident)
        </p>
        <p className="text-sm break-words text-ink">{formatValue(conflict.proposedValue)}</p>
        {proposedDoc && (
          <button
            type="button"
            onClick={() => onOpenSource(proposedDoc.storage_path, conflict.proposedSourcePage)}
            className="interactive self-start rounded-sm text-left text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {proposedDoc.filename}
            {conflict.proposedSourcePage ? ` p.${conflict.proposedSourcePage}` : ''}
          </button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => onResolve(conflict.id, 'accepted_proposed')}
          className="mt-1"
        >
          Accept proposed
        </Button>
      </div>
    </div>
  )
}
