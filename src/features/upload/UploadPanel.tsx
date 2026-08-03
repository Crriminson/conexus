import { useRef, useState } from 'react'
import { useDocuments } from '@/hooks/useDocuments'
import { useUploadDocument } from '@/hooks/useUploadDocument'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  complete: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function UploadPanel({ projectId }: { projectId: string }) {
  const { data: documents, isLoading } = useDocuments(projectId)
  const upload = useUploadDocument(projectId)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      upload.mutate(file)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragOver(false)
          handleFiles(event.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragOver ? 'border-primary bg-muted' : 'border-muted-foreground/30'
        }`}
      >
        <p className="text-sm text-muted-foreground">
          Drag and drop documents here, or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {upload.isError && (
        <p className="text-sm text-destructive">
          Upload failed: {(upload.error as Error).message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading documents…</p>}
        {documents?.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
        {documents?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <span className="truncate text-sm">{doc.filename}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[doc.extraction_status] ?? 'bg-muted text-muted-foreground'
              }`}
            >
              {doc.extraction_status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
