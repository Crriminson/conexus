import { useEffect, useRef, useState } from 'react'
import type { Field } from '@/types/facts'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'
import { ConflictCard } from './ConflictCard'
import { DiffTrail } from './DiffTrail'

// Section 4: "Confidence below 0.5 still writes the field but flags it amber
// in review." The threshold lives here because this is the only place it
// means anything — merge() deliberately doesn't branch on it.
const LOW_CONFIDENCE = 0.5

const STATUS_STYLES: Record<string, string> = {
  empty: 'bg-muted text-muted-foreground',
  ai: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  edited: 'bg-amber-100 text-amber-800',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return String(value)
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
  onResolve: (conflictId: string, resolution: 'kept_current' | 'accepted_proposed') => void
  onOpenSource: (storagePath: string, page: number | null) => void
}

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
  onResolve,
  onOpenSource,
}: FieldRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const pendingConflicts = conflicts.filter((c) => c.resolution === 'pending')
  const isLowConfidence =
    field.confidence !== null && field.confidence < LOW_CONFIDENCE && field.value !== null
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

  return (
    <div className="flex flex-col gap-1.5 border-b py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <span className="w-48 shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</span>

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
              className="w-full rounded-md border px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          ) : (
            <button
              type="button"
              onClick={startEdit}
              title="Click to edit"
              className={`w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${
                isLowConfidence ? 'bg-amber-100 text-amber-800' : ''
              } ${field.value === null ? 'text-muted-foreground' : ''}`}
            >
              {formatValue(field.value)}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2 px-2 text-xs text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[field.status]}`}>
              {field.status}
            </span>

            {field.confidence !== null && (
              <span className={isLowConfidence ? 'font-medium text-amber-800' : ''}>
                {Math.round(field.confidence * 100)}% confident
              </span>
            )}

            {sourceDoc && (
              <button
                type="button"
                onClick={() => onOpenSource(sourceDoc.storage_path, field.sourcePage)}
                className="text-primary underline-offset-2 hover:underline"
              >
                {sourceDoc.filename}
                {field.sourcePage ? ` p.${field.sourcePage}` : ''}
              </button>
            )}

            {pendingConflicts.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">
                {pendingConflicts.length} conflict{pendingConflicts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <DiffTrail path={path} field={field} events={events} conflicts={conflicts} documents={documents} />
        </div>

        {field.status !== 'confirmed' && field.value !== null && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirm(path)}
            className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Confirm
          </button>
        )}
      </div>

      {pendingConflicts.map((conflict) => (
        <ConflictCard
          key={conflict.id}
          conflict={conflict}
          field={field}
          documents={documents}
          isBusy={isBusy}
          onResolve={onResolve}
          onOpenSource={onOpenSource}
        />
      ))}
    </div>
  )
}
