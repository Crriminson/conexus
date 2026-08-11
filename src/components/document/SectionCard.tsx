import type { Section } from '@/lib/templates'
import { isTable } from '@/lib/templates'
import type { DocumentRow } from '@/hooks/useDocuments'
import { Badge } from '@/components/ui/badge'
import { CitationLink } from './CitationLink'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

function valueClassName(value: unknown): string {
  const numeric = typeof value === 'number' ? 'font-data tabular-nums' : ''
  const empty = value === null || value === undefined ? 'text-ink-muted' : 'text-ink'
  return `${numeric} ${empty}`.trim()
}

/** A column is numeric if any row has a number in it — optical alignment
 * (docs/DESIGN_SYSTEM.md's Premium execution rules) needs the header and
 * every cell in that column right-aligned together, not just the value. */
function numericColumns(rows: Section['rows']): boolean[] {
  const width = rows?.[0]?.length ?? 0
  return Array.from({ length: width }, (_, i) => (rows ?? []).some((row) => typeof row[i]?.value === 'number'))
}

function SectionStatusBadge({ section }: { section: Section }) {
  if (section.status === 'ready') return <Badge tone="confirmed">Ready</Badge>
  if (section.kind === 'generated') return <Badge tone="caution">Not yet generated</Badge>
  return (
    <Badge tone="caution">
      Incomplete{section.missingFieldPaths.length > 0 ? ` — ${section.missingFieldPaths.length} pending` : ''}
    </Badge>
  )
}

export interface SectionCardProps {
  section: Section
  documents: DocumentRow[]
  onOpenSource: (storagePath: string, page: number | null) => void
}

/**
 * One assembled section, dispatching on `Section.kind` — the single place
 * each kind renders (static prose / generated prose+citations / computed
 * key-value list / computed table), closing off the risk of the table-vs-
 * list check drifting between renderers (docs/DECISIONS.md's `isTable()`
 * regression) since this is now the only place that reads it.
 */
export function SectionCard({ section, documents, onOpenSource }: SectionCardProps) {
  const numericCols = section.kind === 'computed' ? numericColumns(section.rows) : []

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
        <SectionStatusBadge section={section} />
      </div>

      <div className="rounded-lg border border-hairline bg-paper-raised px-3 py-2">
        {section.kind === 'static' && <p className="text-sm text-ink">{section.body}</p>}

        {section.kind === 'generated' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm whitespace-pre-wrap text-ink">{section.body ?? 'Not yet generated.'}</p>
            {(section.citations?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-x-1 gap-y-1 border-t border-hairline pt-2 text-xs text-ink-muted">
                <span>Sources:</span>
                {section.citations!.map((citation, index) => (
                  <span key={citation.fieldPath}>
                    {citation.label} (<CitationLink source={citation} documents={documents} onOpenSource={onOpenSource} />)
                    {index < section.citations!.length - 1 ? ';' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {section.kind === 'computed' && (section.rows?.length ?? 0) === 0 && (
          <p className="text-sm text-ink-muted">No records.</p>
        )}

        {section.kind === 'computed' && !isTable(section) && (section.rows?.length ?? 0) > 0 && (
          <dl className="flex flex-col">
            {section.rows?.map((row) => {
              const [cell] = row
              return (
                <div key={cell.label} className="flex items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0">
                  <dt className="w-44 shrink-0 text-xs text-ink-muted">{cell.label}</dt>
                  <dd className="flex flex-1 items-center justify-end gap-2 text-sm">
                    <span className={valueClassName(cell.value)}>{formatValue(cell.value)}</span>
                    <CitationLink source={cell} documents={documents} onOpenSource={onOpenSource} />
                  </dd>
                </div>
              )
            })}
          </dl>
        )}

        {section.kind === 'computed' && isTable(section) && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-ink-muted">
                  {section.rows?.[0]?.map((cell, i) => (
                    <th key={cell.label} className={`py-1.5 pr-3 font-medium ${numericCols[i] ? 'text-right' : ''}`}>
                      {cell.label}
                    </th>
                  ))}
                  <th className="py-1.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {section.rows?.map((row, index) => (
                  <tr key={index} className="border-b border-hairline last:border-b-0">
                    {row.map((cell, i) => (
                      <td key={cell.label} className={`py-1.5 pr-3 ${valueClassName(cell.value)} ${numericCols[i] ? 'text-right' : ''}`}>
                        {formatValue(cell.value)}
                      </td>
                    ))}
                    <td className="py-1.5">
                      <CitationLink source={row[0]} documents={documents} onOpenSource={onOpenSource} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
