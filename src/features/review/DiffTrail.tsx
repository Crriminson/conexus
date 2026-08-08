import { useState } from 'react'
import type { Field } from '@/types/facts'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export interface DiffTrailProps {
  path: string
  field: Field<unknown>
  events: MergeEvent[]
  conflicts: FactConflict[]
  documents: DocumentRow[]
}

/**
 * Per-field provenance history, assembled from the append-only merge log.
 *
 * Section 4 calls this "the cheapest genuine differentiator in the build" —
 * it exists because merge() already records, for every run, which fields it
 * wrote, which it skipped, and which conflicts it raised. Nothing here
 * queries anything new; it's a filter over `merge_events` and `conflicts`
 * for one field path.
 *
 * A skip is as interesting as a write: "this document also mentioned this
 * field, and we kept what we had" is exactly the reassurance a reviewer
 * wants before signing off.
 */
export function DiffTrail({ path, field, events, conflicts, documents }: DiffTrailProps) {
  const [isOpen, setIsOpen] = useState(false)

  const entries = events
    .filter((event) => event.fieldsWritten.includes(path) || event.fieldsSkipped.includes(path))
    .map((event) => ({
      kind: event.fieldsWritten.includes(path) ? ('written' as const) : ('skipped' as const),
      documentId: event.documentId,
      ranAt: event.ranAt,
    }))

  const resolved = conflicts.filter((conflict) => conflict.resolution !== 'pending')
  const total = entries.length + resolved.length
  if (total === 0) return null

  const docName = (id: string) => documents.find((d) => d.id === id)?.filename ?? 'unknown document'

  return (
    <div className="px-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {isOpen ? 'Hide' : 'Show'} history ({total})
      </button>

      {isOpen && (
        <ul className="mt-1 flex flex-col gap-1 border-l pl-3 text-xs text-muted-foreground">
          {entries.map((entry, index) => (
            <li key={`${entry.ranAt}-${index}`}>
              <span className={entry.kind === 'written' ? 'text-foreground' : ''}>
                {entry.kind === 'written' ? 'Extracted from' : 'Also seen in'} {docName(entry.documentId)}
              </span>
              {entry.kind === 'skipped' && ' — kept existing value'}
              <span className="opacity-60"> · {formatWhen(entry.ranAt)}</span>
            </li>
          ))}

          {resolved.map((conflict) => (
            <li key={conflict.id}>
              {conflict.resolution === 'accepted_proposed' ? (
                <>
                  Conflict resolved: accepted <strong>{formatValue(conflict.proposedValue)}</strong> over{' '}
                  {formatValue(conflict.currentValue)}
                </>
              ) : (
                <>
                  Conflict resolved: kept <strong>{formatValue(conflict.currentValue)}</strong>, rejected{' '}
                  {formatValue(conflict.proposedValue)}
                </>
              )}
              {conflict.resolvedAt && <span className="opacity-60"> · {formatWhen(conflict.resolvedAt)}</span>}
            </li>
          ))}

          {field.status === 'edited' && (
            <li className="text-foreground">
              Corrected by hand to <strong>{formatValue(field.value)}</strong>
              <span className="opacity-60"> · {formatWhen(field.updatedAt)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
