import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'
import type { DomainKey } from '@/lib/facts/domains'
import { groupEntriesByRecord, type FactFieldEntry } from '@/lib/facts/factList'
import { cn } from '@/lib/utils'
import { FieldRow } from './FieldRow'

export interface DomainSectionRowProps {
  events: MergeEvent[]
  documents: DocumentRow[]
  isBusy: boolean
  onConfirm: (path: string) => void
  onEdit: (path: string, value: unknown) => void
  onOpenSource: (storagePath: string, page: number | null) => void
  conflictsForPath: (path: string) => FactConflict[]
}

export interface DomainSectionProps extends DomainSectionRowProps {
  domainKey: DomainKey
  title: string
  isArray: boolean
  /** Unfiltered, this domain only — distinguishes "no records exist" from "filtered out." */
  allEntries: FactFieldEntry[]
  /** Filtered by the active status filter, this domain only. */
  filteredEntries: FactFieldEntry[]
}

function FieldRowList({ entries, rowProps }: { entries: FactFieldEntry[]; rowProps: DomainSectionRowProps }) {
  return (
    <div className="rounded-lg border border-hairline bg-paper-raised px-3">
      {entries.map((entry) => (
        <FieldRow
          key={entry.path}
          path={entry.path}
          label={entry.label}
          field={entry.field}
          conflicts={rowProps.conflictsForPath(entry.path)}
          events={rowProps.events}
          documents={rowProps.documents}
          isBusy={rowProps.isBusy}
          onConfirm={rowProps.onConfirm}
          onEdit={rowProps.onEdit}
          onOpenSource={rowProps.onOpenSource}
        />
      ))}
    </div>
  )
}

/**
 * One domain's fields — extracted out of the old FactsReview.tsx's inline
 * per-domain render loop so that file could stay under ~200 lines with 37
 * fields' worth of iteration (docs/UI_ARCHITECTURE.md). Handles both flat
 * domains (one field list) and array/repeating-group domains (one field
 * list per record) with the same component, driven by whether entries carry
 * a `recordId` — not two parallel implementations.
 *
 * Collapsible per-domain so working through one domain doesn't force
 * scrolling past another's already-confirmed fields.
 */
export function DomainSection({
  domainKey,
  title,
  isArray,
  allEntries,
  filteredEntries,
  ...rowProps
}: DomainSectionProps) {
  const [isOpen, setIsOpen] = useState(true)
  const recordGroups = isArray ? groupEntriesByRecord(filteredEntries) : null

  return (
    <section id={`domain-${domainKey}`} className="scroll-mt-4 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="interactive flex items-center gap-1.5 rounded-sm text-left"
        aria-expanded={isOpen}
      >
        <ChevronDown className={cn('size-3.5 text-ink-muted transition-transform duration-150 ease-out', !isOpen && '-rotate-90')} />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="font-data tabular-nums text-xs text-ink-muted">
          ({isArray ? new Set(allEntries.map((e) => e.recordId)).size : filteredEntries.length})
        </span>
      </button>

      {isOpen &&
        (isArray ? (
          allEntries.length === 0 ? (
            <p className="rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-sm text-ink-muted">
              None extracted.
            </p>
          ) : recordGroups!.size === 0 ? (
            <p className="rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-sm text-ink-muted">
              No fields match this filter.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...recordGroups!.entries()].map(([recordId, entries]) => (
                <div key={recordId}>
                  <p className="mb-1 text-xs font-medium text-ink-muted">{entries[0].recordHeading}</p>
                  <FieldRowList entries={entries} rowProps={rowProps} />
                </div>
              ))}
            </div>
          )
        ) : filteredEntries.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-sm text-ink-muted">
            No fields match this filter.
          </p>
        ) : (
          <FieldRowList entries={filteredEntries} rowProps={rowProps} />
        ))}
    </section>
  )
}
