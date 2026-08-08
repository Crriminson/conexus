import type { Field } from '@/types/facts'
import type { FactConflict } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'

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
export function ConflictCard({
  conflict,
  field,
  documents,
  isBusy,
  onResolve,
  onOpenSource,
}: ConflictCardProps) {
  const currentDoc = documents.find((d) => d.id === field.sourceDocId)
  const proposedDoc = documents.find((d) => d.id === conflict.proposedSourceDocId)

  return (
    <div className="ml-48 flex flex-col gap-2 rounded-md border border-red-100 bg-red-100/30 p-3">
      <p className="text-xs font-medium text-red-800">
        A later extraction proposed a different value for a field you already set.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1 rounded-md border bg-background p-2">
          <p className="text-xs font-medium text-muted-foreground">
            Current ({conflict.currentStatus})
          </p>
          <p className="py-1 text-sm">{formatValue(conflict.currentValue)}</p>
          {currentDoc && (
            <button
              type="button"
              onClick={() => onOpenSource(currentDoc.storage_path, field.sourcePage)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {currentDoc.filename}
              {field.sourcePage ? ` p.${field.sourcePage}` : ''}
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onResolve(conflict.id, 'kept_current')}
            className="mt-2 w-full rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Keep current
          </button>
        </div>

        <div className="flex-1 rounded-md border bg-background p-2">
          <p className="text-xs font-medium text-muted-foreground">
            Proposed ({Math.round(conflict.proposedConfidence * 100)}% confident)
          </p>
          <p className="py-1 text-sm">{formatValue(conflict.proposedValue)}</p>
          {proposedDoc && (
            <button
              type="button"
              onClick={() => onOpenSource(proposedDoc.storage_path, conflict.proposedSourcePage)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {proposedDoc.filename}
              {conflict.proposedSourcePage ? ` p.${conflict.proposedSourcePage}` : ''}
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onResolve(conflict.id, 'accepted_proposed')}
            className="mt-2 w-full rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Accept proposed
          </button>
        </div>
      </div>
    </div>
  )
}
