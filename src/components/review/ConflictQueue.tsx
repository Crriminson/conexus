import type { FactConflict } from '@/lib/merge/types'
import type { DocumentRow } from '@/hooks/useDocuments'
import type { FactFieldEntry } from '@/lib/facts/factList'
import { VerificationStamp } from '@/components/ui/verification-stamp'
import { ConflictCard } from './ConflictCard'

export interface ConflictQueueProps {
  /** Already filtered to `resolution === 'pending'` by the caller. */
  conflicts: FactConflict[]
  entries: FactFieldEntry[]
  documents: DocumentRow[]
  isBusy: boolean
  onResolve: (conflictId: string, resolution: 'kept_current' | 'accepted_proposed') => void
  onOpenSource: (storagePath: string, page: number | null) => void
}

/**
 * Every pending conflict across the whole project, as its own section at
 * the top of the screen (docs/UI_ARCHITECTURE.md, "Conflict resolution as
 * first-class flow") — not nested three levels deep inside a field row.
 * `ConflictCard` is unchanged; this is the only place that now instantiates
 * it.
 *
 * No conflicts is the normal case, not an empty state needing explanation —
 * renders nothing rather than an empty-queue callout.
 */
export function ConflictQueue({ conflicts, entries, documents, isBusy, onResolve, onOpenSource }: ConflictQueueProps) {
  if (conflicts.length === 0) return null

  return (
    <section id="conflict-queue" className="scroll-mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <VerificationStamp status="conflict" />
        <h2 className="font-display text-xl text-ink">Needs your review</h2>
      </div>

      <div className="flex flex-col gap-3">
        {conflicts.map((conflict) => {
          const entry = entries.find((e) => e.path === conflict.fieldPath)
          if (!entry) return null
          return (
            <div key={conflict.id} className="rounded-lg border border-signature/30 bg-signature-tint p-3">
              <p className="mb-2 text-xs font-semibold text-ink">
                {entry.domainTitle}
                {entry.recordHeading ? ` · ${entry.recordHeading}` : ''} · {entry.label}
              </p>
              <ConflictCard
                conflict={conflict}
                field={entry.field}
                documents={documents}
                isBusy={isBusy}
                onResolve={onResolve}
                onOpenSource={onOpenSource}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
