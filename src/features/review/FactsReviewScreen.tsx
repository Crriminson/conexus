import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { useUpdateFacts } from '@/hooks/useUpdateFacts'
import { useResolveConflict } from '@/hooks/useResolveConflict'
import { useOpenSource } from '@/hooks/useOpenSource'
import { DOMAIN_ORDER } from '@/lib/facts/domains'
import { countFactsByStatus, groupEntriesByDomain, listFactFields } from '@/lib/facts/factList'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { VerificationStamp } from '@/components/ui/verification-stamp'
import { buttonVariants } from '@/components/ui/button'
import { ConflictQueue } from '@/components/review/ConflictQueue'
import { FilterBar, type StatusFilter } from '@/components/review/FilterBar'
import { BulkConfirmBar } from '@/components/review/BulkConfirmBar'
import { DomainSection } from '@/components/review/DomainSection'

function FactsReviewSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-8 w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-paper-raised p-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Facts Review screen: status summary, conflict queue (first-class, top of
 * screen), filter bar, bulk confirm, and the 6 domains — all reading one
 * shared, memoized field list (src/lib/facts/factList.ts) rather than each
 * re-walking `IssuerFacts`. See docs/UI_ARCHITECTURE.md, Screen 2.
 */
export function FactsReviewScreen({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error } = useProject(projectId)
  const { data: documents } = useDocuments(projectId)
  const updateFacts = useUpdateFacts(projectId)
  const resolveConflict = useResolveConflict(projectId)
  const openSource = useOpenSource()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const facts = project?.facts
  const entries = useMemo(() => (facts ? listFactFields(facts) : []), [facts])
  const counts = useMemo(() => countFactsByStatus(entries), [entries])
  const entriesByDomain = useMemo(() => groupEntriesByDomain(entries), [entries])
  const filteredEntries = useMemo(
    () => (statusFilter === 'all' ? entries : entries.filter((e) => e.field.status === statusFilter)),
    [entries, statusFilter],
  )
  const filteredByDomain = useMemo(() => groupEntriesByDomain(filteredEntries), [filteredEntries])
  const bulkConfirmPaths = useMemo(
    () => filteredEntries.filter((e) => e.field.status === 'ai').map((e) => e.path),
    [filteredEntries],
  )
  const pendingConflicts = useMemo(
    () => project?.conflicts.filter((c) => c.resolution === 'pending') ?? [],
    [project],
  )

  if (isLoading) return <FactsReviewSkeleton />
  if (isError || !project) {
    return (
      <Callout tone="signature" title="Failed to load facts">
        {(error as Error)?.message}
      </Callout>
    )
  }

  const docs = documents ?? []
  if (docs.length === 0) {
    return (
      <Callout
        tone="neutral"
        title="No documents uploaded yet"
        action={
          <Link href="/project/documents" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Go to Documents
          </Link>
        }
      >
        Facts appear here once a document has been uploaded and extracted.
      </Callout>
    )
  }

  const isBusy = updateFacts.isPending || resolveConflict.isPending
  const conflictsForPath = (path: string) => project.conflicts.filter((c) => c.fieldPath === path)
  const onOpenSource = (storagePath: string, page: number | null) => {
    openSource(storagePath, page).catch(() => {})
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">Facts Review</h1>
        <VerificationStamp status="confirmed" label={`${counts.confirmed + counts.edited} confirmed`} />
        {pendingConflicts.length > 0 && (
          <VerificationStamp status="conflict" label={`${pendingConflicts.length} need review`} />
        )}
      </div>

      {(updateFacts.isError || resolveConflict.isError) && (
        <Callout tone="signature" title="Couldn't save that change">
          {((updateFacts.error ?? resolveConflict.error) as Error)?.message}
        </Callout>
      )}

      <ConflictQueue
        conflicts={pendingConflicts}
        entries={entries}
        documents={docs}
        isBusy={isBusy}
        onResolve={(conflictId, resolution) => resolveConflict.mutate({ conflictId, resolution })}
        onOpenSource={onOpenSource}
      />

      <FilterBar counts={counts} activeFilter={statusFilter} onFilterChange={setStatusFilter} domains={DOMAIN_ORDER} />

      <BulkConfirmBar
        paths={bulkConfirmPaths}
        isBusy={isBusy}
        onConfirmField={(path) => updateFacts.mutateAsync({ path, status: 'confirmed' })}
      />

      <div className="flex flex-col gap-5">
        {DOMAIN_ORDER.map((domain) => (
          <DomainSection
            key={domain.key}
            domainKey={domain.key}
            title={domain.title}
            isArray={domain.isArray}
            allEntries={entriesByDomain.get(domain.key) ?? []}
            filteredEntries={filteredByDomain.get(domain.key) ?? []}
            events={project.merge_events}
            documents={docs}
            isBusy={isBusy}
            onConfirm={(path) => updateFacts.mutate({ path, status: 'confirmed' })}
            onEdit={(path, value) => updateFacts.mutate({ path, status: 'edited', value })}
            onOpenSource={onOpenSource}
            conflictsForPath={conflictsForPath}
          />
        ))}
      </div>
    </div>
  )
}
