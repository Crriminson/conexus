import { useMemo } from 'react'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { useOpenSource } from '@/hooks/useOpenSource'
import { assembleSections } from '@/lib/templates'
import type { Section, SectionCell } from '@/lib/templates'

const STATUS_STYLES: Record<Section['status'], string> = {
  ready: 'bg-green-100 text-green-800',
  incomplete: 'bg-amber-100 text-amber-800',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

// Every row in a computed section has the same shape (one cell per column),
// so the first row's cell labels double as the table's column headers.
function isTable(section: Section): boolean {
  return (section.rows ?? []).some((row) => row.length > 1)
}

export function DocumentView({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error } = useProject(projectId)
  const { data: documents } = useDocuments(projectId)
  const openSource = useOpenSource()

  const sections = useMemo(() => (project ? assembleSections(project.facts) : []), [project])
  const docs = documents ?? []

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading document…</p>
  if (isError || !project) {
    return <p className="text-sm text-destructive">Failed to load document: {(error as Error)?.message}</p>
  }

  const sourceLink = (cell: SectionCell) => {
    const doc = docs.find((d) => d.id === cell.sourceDocId)
    if (!doc) return null
    return (
      <button
        type="button"
        onClick={() => openSource(doc.storage_path, cell.sourcePage).catch(() => {})}
        className="text-primary underline-offset-2 hover:underline"
      >
        {doc.filename}
        {cell.sourcePage ? ` p.${cell.sourcePage}` : ''}
      </button>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[section.status]}`}>
              {section.status === 'ready'
                ? 'Ready'
                : `Incomplete${
                    section.missingFieldPaths.length > 0 ? ` — ${section.missingFieldPaths.length} pending` : ''
                  }`}
            </span>
          </div>

          <div className="rounded-lg border px-3 py-2">
            {section.kind === 'static' && <p className="text-sm text-muted-foreground">{section.body}</p>}

            {section.kind === 'computed' && (section.rows?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No records.</p>
            )}

            {section.kind === 'computed' && !isTable(section) && (
              <dl className="flex flex-col gap-1.5">
                {section.rows?.map((row) => {
                  const [cell] = row
                  return (
                    <div key={cell.label} className="flex items-center justify-between gap-3 border-b py-1 last:border-b-0">
                      <dt className="text-xs text-muted-foreground">{cell.label}</dt>
                      <dd className="flex items-center gap-2 text-sm">
                        <span className={cell.value === null ? 'text-muted-foreground' : ''}>
                          {formatValue(cell.value)}
                        </span>
                        {sourceLink(cell)}
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
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      {section.rows?.[0]?.map((cell) => (
                        <th key={cell.label} className="py-1 pr-3 font-medium">
                          {cell.label}
                        </th>
                      ))}
                      <th className="py-1 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows?.map((row, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        {row.map((cell) => (
                          <td key={cell.label} className={`py-1 pr-3 ${cell.value === null ? 'text-muted-foreground' : ''}`}>
                            {formatValue(cell.value)}
                          </td>
                        ))}
                        <td className="py-1">{sourceLink(row[0])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
