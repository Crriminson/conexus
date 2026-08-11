import { useDocuments } from '@/hooks/useDocuments'
import { useProject } from '@/hooks/useProject'
import { useUploadDocument } from '@/hooks/useUploadDocument'
import { useRunExtraction } from '@/hooks/useRunExtraction'
import { describeExtractionProgress } from '@/lib/documents/describeExtractionProgress'
import { Skeleton } from '@/components/ui/skeleton'
import { Callout } from '@/components/ui/callout'
import { Badge } from '@/components/ui/badge'
import { Dropzone } from '@/components/documents/Dropzone'
import { DocumentListItem } from '@/components/documents/DocumentListItem'
import { DocumentValidationPanel } from '@/components/document/DocumentValidationPanel'

export function DocumentsScreen({ projectId }: { projectId: string }) {
  const { data: documents, isLoading, isError, error } = useDocuments(projectId)
  const projectQuery = useProject(projectId)
  const upload = useUploadDocument(projectId)
  const runExtraction = useRunExtraction(projectId)
  const progress = describeExtractionProgress(documents ?? [])

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      try {
        const document = await upload.mutateAsync(file)
        runExtraction.mutate(document.id)
      } catch {
        // upload.isError already surfaces this below
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">Documents</h1>
        {isLoading ? <Skeleton className="h-5 w-40" /> : !isError && <Badge tone={progress.tone}>{progress.text}</Badge>}
      </div>

      <Dropzone onFiles={handleFiles} />

      {upload.isError && (
        <Callout tone="signature" title="Upload failed">
          {(upload.error as Error).message}
        </Callout>
      )}
      {runExtraction.isError && (
        <Callout tone="signature" title="Extraction failed to start">
          {(runExtraction.error as Error).message}
        </Callout>
      )}

      <div className="flex flex-col gap-2">
        {isLoading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}

        {isError && (
          <Callout tone="signature" title="Couldn't load documents">
            {(error as Error)?.message}
          </Callout>
        )}

        {!isLoading && !isError && documents?.length === 0 && (
          <Callout tone="neutral" title="No documents uploaded yet">
            Drag a DRHP or abridged prospectus above to begin extraction.
          </Callout>
        )}

        {documents?.map((document) => (
          <DocumentListItem
            key={document.id}
            document={document}
            isExtracting={runExtraction.isPending}
            onExtract={(documentId) => runExtraction.mutate(documentId)}
          />
        ))}
      </div>

      {documents?.length ? (
        <DocumentValidationPanel
          title="Document validation"
          projectId={projectId}
          project={projectQuery.data}
          documents={documents}
          isLoading={projectQuery.isLoading}
          isError={projectQuery.isError}
          error={projectQuery.error}
        />
      ) : null}
    </div>
  )
}
