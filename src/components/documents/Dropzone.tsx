import { useRef, useState } from 'react'

export interface DropzoneProps {
  onFiles: (files: FileList | null) => void
}

export function Dropzone({ onFiles }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragOver(false)
        onFiles(event.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        isDragOver ? 'border-focus bg-paper-recessed' : 'border-hairline-strong hover:border-ink-muted/60'
      }`}
    >
      <p className="text-sm text-ink">Drag and drop documents here, or click to browse</p>
      <p className="text-xs text-ink-muted">PDF only — large filings are chunked automatically</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf"
        className="hidden"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
