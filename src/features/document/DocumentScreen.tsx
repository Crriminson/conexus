import { useMemo } from 'react'
import { Link } from 'wouter'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { useOpenSource } from '@/hooks/useOpenSource'
import { assembleSections } from '@/lib/templates'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { SectionCard } from '@/components/document/SectionCard'
import { EligibilityCard } from '@/features/eligibility/EligibilityCard'
import { GenerateSectionsButton } from '@/features/generate/GenerateSectionsButton'
import { ExportPanel } from '@/features/export/ExportPanel'

function DocumentSkeleton() {
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
 * Document screen: eligibility (detail view), narrative generation,
 * assembled sections (static/computed/generated, dispatched by SectionCard),
 * and export — the last of Phase 3's three screens
 * (docs/UI_ARCHITECTURE.md, Screen 3).
 */
export function DocumentScreen({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error } = useProject(projectId)
  const { data: documents } = useDocuments(projectId)
  const openSource = useOpenSource()

  const sections = useMemo(
    () => (project ? assembleSections(project.facts, project.generated_sections) : []),
    [project],
  )

  if (isLoading) return <DocumentSkeleton />
  if (isError || !project) {
    return (
      <Callout tone="signature" title="Failed to load document">
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
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
