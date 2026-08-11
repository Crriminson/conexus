import { useMemo } from 'react'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { useOpenSource } from '@/hooks/useOpenSource'
import { assembleSections, isTable } from '@/lib/templates'
import type { Section } from '@/lib/templates'
import { EligibilityCard } from '@/features/eligibility/EligibilityCard'
import { ExportButton } from '@/features/export/ExportButton'
import { GenerateSectionsButton } from '@/features/generate/GenerateSectionsButton'

const STATUS_STYLES: Record<Section['status'], string> = {
  ready: 'bg-green-100 text-green-800',
  incomplete: 'bg-amber-100 text-amber-800',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

export function DocumentView({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error } = useProject(projectId)
  const { data: documents } = useDocuments(projectId)
  const openSource = useOpenSource()

  const sections = useMemo(
    () => (project ? assembleSections(project.facts, project.generated_sections) : []),
    [project],
  )
  const docs = documents ?? []

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading document…</p>
  if (isError || !project) {
    return <p className="text-sm text-destructive">Failed to load document: {(error as Error)?.message}</p>
  }

  // Shared by computed-section cells and generated-section citations — both
  // are just a { sourceDocId, sourcePage } pair pointing at a document.
  const sourceLink = (source: { sourceDocId: string | null; sourcePage: number | null }) => {
    const doc = docs.find((d) => d.id === source.sourceDocId)
    if (!doc) return null
    return (
      <button
        type="button"
        onClick={() => openSource(doc.storage_path, source.sourcePage).catch(() => {})}
        className="text-primary underline-offset-2 hover:underline"
      >
        {doc.filename}
        {source.sourcePage ? ` p.${source.sourcePage}` : ''}
      </button>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <EligibilityCard facts={project.facts} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <GenerateSectionsButton
            projectId={projectId}
            facts={project.facts}
            generatedSections={project.generated_sections}
          />
          <ExportButton facts={project.facts} documents={docs} generatedSections={project.generated_sections} />
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[section.status]}`}>
              {section.status === 'ready'
                ? 'Ready'
                : section.kind === 'generated'
                  ? 'Not yet generated'
                  : `Incomplete${
                      section.missingFieldPaths.length > 0 ? ` — ${section.missingFieldPaths.length} pending` : ''
                    }`}
            </span>
          </div>

          <div className="rounded-lg border px-3 py-2">
            {section.kind === 'static' && <p className="text-sm text-muted-foreground">{section.body}</p>}

            {section.kind === 'generated' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm whitespace-pre-wrap">{section.body ?? 'Not yet generated.'}</p>
                {(section.citations?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-x-1 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                    <span>Sources:</span>
                    {section.citations!.map((citation, index) => (
                      <span key={citation.fieldPath}>
                        {citation.label} ({sourceLink(citation)})
                        {index < section.citations!.length - 1 ? ';' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

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
