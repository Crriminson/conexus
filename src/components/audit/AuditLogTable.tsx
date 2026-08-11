import type { FactEventLogRow } from '@/lib/factEvents'
import { Badge } from '@/components/ui/badge'

const EVENT_TYPE_TONE: Record<FactEventLogRow['event_type'], 'neutral' | 'confirmed' | 'caution' | 'signature'> = {
  extracted: 'neutral',
  confirmed: 'confirmed',
  edited: 'caution',
  conflict_raised: 'signature',
  conflict_resolved: 'confirmed',
}

const EVENT_TYPE_LABEL: Record<FactEventLogRow['event_type'], string> = {
  extracted: 'Extracted',
  confirmed: 'Confirmed',
  edited: 'Edited',
  conflict_raised: 'Conflict raised',
  conflict_resolved: 'Conflict resolved',
}

const SOURCE_LABEL: Record<FactEventLogRow['source'], string> = {
  extraction: 'Extraction',
  manual: 'Manual',
  merge: 'Merge',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export function AuditLogTable({ rows }: { rows: FactEventLogRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-paper-raised">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink-muted">
            <th className="py-2 pl-3 pr-3 font-medium">Timestamp</th>
            <th className="py-2 pr-3 font-medium">Field</th>
            <th className="py-2 pr-3 font-medium">Event</th>
            <th className="py-2 pr-3 font-medium">Source</th>
            <th className="py-2 pr-3 font-medium">Old value</th>
            <th className="py-2 pr-3 font-medium">New value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-hairline last:border-b-0">
              <td className="py-2 pl-3 pr-3 whitespace-nowrap font-data text-xs text-ink-muted">
                {formatTimestamp(row.created_at)}
              </td>
              <td className="py-2 pr-3 font-data text-xs text-ink">{row.fact_id}</td>
              <td className="py-2 pr-3">
                <Badge tone={EVENT_TYPE_TONE[row.event_type]}>{EVENT_TYPE_LABEL[row.event_type]}</Badge>
              </td>
              <td className="py-2 pr-3 text-xs text-ink-muted">{SOURCE_LABEL[row.source]}</td>
              <td className="py-2 pr-3 font-data text-xs text-ink-muted">{formatValue(row.old_value)}</td>
              <td className="py-2 pr-3 font-data text-xs text-ink">{formatValue(row.new_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
