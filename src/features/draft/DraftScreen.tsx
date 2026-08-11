import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { DocumentValidationPanel } from '@/components/document/DocumentValidationPanel'

/**
 * Draft screen: eligibility (detail view), narrative generation,
 * assembled sections (static/computed/generated, dispatched by SectionCard),
 * and export — the last of Phase 3's three screens
 * (docs/UI_ARCHITECTURE.md, Screen 3). Named "Draft" rather than
 * "Document" so it reads distinctly from the Documents (uploads) screen —
 * one letter apart was reading as a duplicate. `Section`/`generated_sections`
 * and the rest of the document data model keep their existing names; this
 * is a screen-naming change only.
 */
export function DraftScreen({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error } = useProject(projectId)
  const { data: documents } = useDocuments(projectId)
  return (
    <DocumentValidationPanel
      title="Draft"
      projectId={projectId}
      project={project}
      documents={documents}
      isLoading={isLoading}
      isError={isError}
      error={error}
    />
  )
}
