import { useMemo } from 'react'
import { Link } from 'wouter'
import type { DocumentRow } from '@/hooks/useDocuments'
import type { ProjectRow } from '@/hooks/useProject'
import { useOpenSource } from '@/hooks/useOpenSource'
import { assembleSections } from '@/lib/templates'
import { checkExportGate } from '@/lib/export'
import { describeMissingExport } from '@/lib/progress/computeProgressSteps'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { SectionCard } from './SectionCard'
import { EligibilityCard } from '@/features/eligibility/EligibilityCard'
import { GenerateSectionsButton } from '@/features/generate/GenerateSectionsButton'
import { ExportPanel } from '@/features/export/ExportPanel'

export interface DocumentValidationPanelProps {
  title: string
  projectId: string
  project?: ProjectRow | null
  documents?: DocumentRow[]
  isLoading: boolean
  isError: boolean
  error: unknown
}

function DocumentValidationSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-24 flex-1" />
        <Skeleton className="h-9 w-48" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Shared document-validation composition: eligibility, narrative generation,
 * assembled sections, and export. DocumentsScreen mounts this as the new
 * main-page preview, while the Draft tab reuses the same panel so the two
 * screens cannot drift apart.
 */
export function DocumentValidationPanel({
  title,
  projectId,
  project,
  documents,
  isLoading,
  isError,
  error,
}: DocumentValidationPanelProps) {
  const openSource = useOpenSource()

  const sections = useMemo(
    () => (project ? assembleSections(project.facts, project.generated_sections) : []),
    [project],
  )

  if (isLoading) return <DocumentValidationSkeleton />
  if (isError || !project) {
    return (
      <Callout tone="signature" title={`Failed to load ${title.toLowerCase()}`}>
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
        The document validation view appears here once a document has been uploaded and extracted.
      </Callout>
    )
  }

  const onOpenSource = (storagePath: string, page: number | null) => {
    openSource(storagePath, page).catch(() => {})
  }

  // Same message Progress rail's own step 5 produces, from the same
  // checkExportGate call — reused, not recomputed, so the two can't drift.
  const gate = checkExportGate(project.facts, project.generated_sections)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        <Badge tone={gate.allowed ? 'confirmed' : 'caution'}>
          {gate.allowed ? 'Ready to export' : describeMissingExport(gate.missingFieldPaths)}
        </Badge>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <EligibilityCard facts={project.facts} />
        </div>
        <GenerateSectionsButton
          projectId={projectId}
          facts={project.facts}
          generatedSections={project.generated_sections}
        />
      </div>

      {sections.map((section) => (
        <SectionCard key={section.id} section={section} documents={docs} onOpenSource={onOpenSource} />
      ))}

      <ExportPanel facts={project.facts} documents={docs} generatedSections={project.generated_sections} />
    </div>
  )
}