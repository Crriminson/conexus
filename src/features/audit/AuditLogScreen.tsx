import { useFactEvents } from '@/hooks/useFactEvents'
import { Skeleton } from '@/components/ui/skeleton'
import { Callout } from '@/components/ui/callout'
import { AuditLogTable } from '@/components/audit/AuditLogTable'

/**
 * Project-level, chronological (newest first) log of every fact_events row —
 * extraction writes, human edits/confirms, conflicts raised and resolved.
 * Wired through useFactEvents' DEMO_MODE fallback (src/hooks/useFactEvents.ts):
 * fixture rows now, since the fact_events migration hasn't been applied to
 * the live project yet (docs/STATE.md), real rows automatically once it has.
 */
export function AuditLogScreen({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error } = useFactEvents(projectId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <Callout tone="signature" title="Couldn't load the audit log">
        {(error as Error)?.message}
      </Callout>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-ink">Audit Log</h1>

      {data.isDemo && (
        <Callout tone="neutral" title="Demo data">
          These events are fixture content, not real activity — the live{' '}
          <span className="font-data">fact_events</span> table hasn't been deployed yet. Real events will appear
          automatically once it lands, with no further changes needed here.
        </Callout>
      )}

      {data.rows.length === 0 ? (
        <Callout tone="neutral" title="No activity yet">
          Events appear here as facts are extracted, edited, confirmed, or have conflicts raised and resolved.
        </Callout>
      ) : (
        <AuditLogTable rows={data.rows} />
      )}
    </div>
  )
}
