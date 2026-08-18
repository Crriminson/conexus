import { useEffect, useRef, useState } from 'react'
import type { Field } from '@/types/facts'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'
import { VerificationStamp } from '@/components/ui/verification-stamp'
import { Button } from '@/components/ui/button'
import { DiffTrail } from './DiffTrail'

// Section 4: "Confidence below 0.5 still writes the field but flags it amber
// in review." The threshold lives here because this is the only place it
// means anything — merge() deliberately doesn't branch on it.
const LOW_CONFIDENCE = 0.5

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

export interface FieldRowProps {
  path: string
  label: string
  field: Field<unknown>
  conflicts: FactConflict[]
  events: MergeEvent[]
  documents: DocumentRow[]
  isBusy: boolean
  onConfirm: (path: string) => void
  onEdit: (path: string, value: unknown) => void
  onOpenSource: (storagePath: string, page: number | null) => void
}

/**
 * One field: label, value (click to edit inline), status stamp, confidence,
 * source link, and — if it has a pending conflict — a link up to
 * `ConflictQueue` rather than the conflict resolution UI itself. Conflicts
 * get first-class real estate at the top of the screen now
 * (docs/UI_ARCHITECTURE.md); this row only ever points at them.
 */
export function FieldRow({
  path,
  label,
  field,
  conflicts,
  events,
  documents,
  isBusy,
  onConfirm,
  onEdit,
  onOpenSource,
}: FieldRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const pendingConflicts = conflicts.filter((c) => c.resolution === 'pending')
  const isLowConfidence = field.confidence !== null && field.confidence < LOW_CONFIDENCE && field.value !== null
  const sourceDoc = documents.find((d) => d.id === field.sourceDocId)

  function startEdit() {
    setDraft(field.value === null || field.value === undefined ? '' : String(field.value))
    setIsEditing(true)
  }

  function commitEdit() {
    setIsEditing(false)
    const trimmed = draft.trim()
    const current = field.value === null || field.value === undefined ? '' : String(field.value)
    if (trimmed === current) return

    // Numeric fields must stay numeric — section 4 forbids coercion during
    // merge, but this is a human typing into a text box, so the parse has to
    // happen somewhere. Only coerce when the existing value was a number and
    // the input actually parses; otherwise send the string through untouched
    // and let it be visibly wrong rather than silently zero.
    const shouldBeNumber = typeof field.value === 'number'
    const parsed = shouldBeNumber ? Number(trimmed) : NaN
    const next = trimmed === '' ? null : shouldBeNumber && !Number.isNaN(parsed) ? parsed : trimmed

    onEdit(path, next)
  }

  function jumpToConflictQueue() {
    document.getElementById('conflict-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <span className="w-44 shrink-0 pt-1.5 text-xs text-ink-muted">{label}</span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitEdit()
                if (event.key === 'Escape') setIsEditing(false)
              }}
              className="w-full rounded-md border border-hairline-strong bg-paper-raised px-2 py-1 text-sm text-ink outline-none focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/20"
            />
          ) : (
            <button
              type="button"
              onClick={startEdit}
              title="Click to edit"
              className={`interactive w-full rounded-md px-2 py-1 text-left text-sm break-words ${
                isLowConfidence ? 'bg-caution-tint text-ink' : ''
              } ${field.value === null ? 'text-ink-muted' : 'text-ink'}`}
            >
              {formatValue(field.value)}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2 px-2 text-xs text-ink-muted">
            {field.status !== 'empty' && (
              <VerificationStamp
                status={field.status === 'confirmed' || field.status === 'edited' ? 'confirmed' : 'pending'}
                label={field.status === 'edited' ? 'Edited' : undefined}
              />
            )}

            {field.confidence !== null && (
              <span className={`font-data font-medium tabular-nums ${isLowConfidence ? 'text-caution' : 'text-ink-muted'}`}>
                {Math.round(field.confidence * 100)}% confident
              </span>
            )}

            {sourceDoc && (
              <button
                type="button"
                onClick={() => onOpenSource(sourceDoc.storage_path, field.sourcePage)}
                className="interactive rounded-sm text-ink-muted underline decoration-hairline-strong underline-offset-2 hover:text-ink hover:decoration-ink"
              >
                {sourceDoc.filename}
                {field.sourcePage ? ` p.${field.sourcePage}` : ''}
              </button>
            )}

            {pendingConflicts.length > 0 && (
              <button
                type="button"
                onClick={jumpToConflictQueue}
                className="interactive rounded-sm font-medium text-signature underline-offset-2 hover:underline"
              >
                {pendingConflicts.length} conflict{pendingConflicts.length > 1 ? 's' : ''} — resolve above
              </button>
            )}
          </div>

          <DiffTrail path={path} field={field} events={events} conflicts={conflicts} documents={documents} />
        </div>

        {field.status !== 'confirmed' && field.value !== null && (
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => onConfirm(path)} className="mt-1 shrink-0">
            Confirm
          </Button>
        )}
      </div>
    </div>
  )
}
