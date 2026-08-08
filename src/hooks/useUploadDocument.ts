import { PDFDocument } from 'pdf-lib'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { documentsQueryKey } from './useDocuments'

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET

// Fixed page-count chunking (human call, 2026-08-08), split here rather
// than in the extract Edge Function: that first attempt died to a ~2s
// CPU-time budget — separate from, and far stricter than, the ~150s
// wall-clock ceiling — just from parsing an 8MB/several-hundred-page PDF
// before a single Gemini call was made. The browser has no such budget.
// Must match the edge function's expectations for chunk_plan, but nothing
// enforces that — it's a plain constant on both sides.
const CHUNK_SIZE_PAGES = 20

interface ChunkPlanEntry {
  index: number
  startPage: number
  endPage: number
  storagePath: string
}

async function uploadBytes(storagePath: string, bytes: Uint8Array) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'application/pdf',
  })
  if (error) throw error
}

// Builds the chunk plan and uploads whatever extra chunk files are needed.
// A document that already fits in one chunk reuses the original upload —
// no need to re-split and re-upload a copy of a 10-page file.
async function buildChunkPlan(storagePath: string, fileBytes: Uint8Array): Promise<ChunkPlanEntry[]> {
  const srcDoc = await PDFDocument.load(fileBytes)
  const pageCount = srcDoc.getPageCount()

  if (pageCount <= CHUNK_SIZE_PAGES) {
    return [{ index: 0, startPage: 1, endPage: pageCount, storagePath }]
  }

  const totalChunks = Math.ceil(pageCount / CHUNK_SIZE_PAGES)
  const plan: ChunkPlanEntry[] = []

  for (let i = 0; i < totalChunks; i++) {
    const startPage = i * CHUNK_SIZE_PAGES + 1
    const endPage = Math.min(startPage + CHUNK_SIZE_PAGES - 1, pageCount)

    const chunkDoc = await PDFDocument.create()
    const pageIndices = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage - 1 + idx)
    const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices)
    for (const page of copiedPages) chunkDoc.addPage(page)
    const chunkBytes = await chunkDoc.save()

    const chunkPath = `${storagePath}.chunk${i}.pdf`
    await uploadBytes(chunkPath, chunkBytes)

    plan.push({ index: i, startPage, endPage, storagePath: chunkPath })
  }

  return plan
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!BUCKET) {
        throw new Error('VITE_SUPABASE_STORAGE_BUCKET is not set yet')
      }

      const storagePath = `${projectId}/${crypto.randomUUID()}-${file.name}`
      const fileBytes = new Uint8Array(await file.arrayBuffer())

      await uploadBytes(storagePath, fileBytes)

      const chunkPlan = await buildChunkPlan(storagePath, fileBytes)

      const { data, error: insertError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          filename: file.name,
          storage_path: storagePath,
          extraction_status: 'pending',
          extraction_total_chunks: chunkPlan.length,
          chunk_plan: chunkPlan,
        })
        .select('id, project_id, filename, storage_path, extraction_status')
        .single()

      if (insertError) throw insertError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(projectId) })
    },
  })
}
