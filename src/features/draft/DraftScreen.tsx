import { useMemo } from 'react'
import { Link } from 'wouter'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { useOpenSource } from '@/hooks/useOpenSource'
import { assembleSections } from '@/lib/templates'
import { checkExportGate } from '@/lib/export'
import { describeMissingExport } from '@/lib/progress/computeProgressSteps'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { SectionCard } from '@/components/document/SectionCard'
import { EligibilityCard } from '@/features/eligibility/EligibilityCard'
import { GenerateSectionsButton } from '@/features/generate/GenerateSectionsButton'
import { ExportPanel } from '@/features/export/ExportPanel'

function DraftSkeleton() {
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
  const openSource = useOpenSource()

  const sections = useMemo(
    () => (project ? assembleSections(project.facts, project.generated_sections) : []),
    [project],
  )

  if (isLoading) return <DraftSkeleton />
  if (isError || !project) {
    return (
      <Callout tone="signature" title="Failed to load draft">
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
        The document assembles from confirmed, cited facts once a document has been uploaded and extracted.
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
        <h1 className="font-display text-2xl text-ink">Draft</h1>
        <Badge tone={gate.allowed ? 'confirmed' : 'caution'}>
          {gate.allowed ? 'Ready to export' : describeMissingExport(gate.missingFieldPaths)}
        </Badge>
      </div>

      {project.generatedSectionsIsDemo && (
        <Callout tone="neutral" title="Demo data">
          The narrative sections below are fixture content, not real output — the live{' '}
          <span className="font-data">generated_sections</span> column hasn't been deployed yet. Real generated
          sections will appear automatically once it lands, with no further changes needed here.
        </Callout>
      )}

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
