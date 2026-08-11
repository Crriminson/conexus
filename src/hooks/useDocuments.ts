import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DocumentRow {
  id: string
  project_id: string
  filename: string
  storage_path: string
  extraction_status: string
  extraction_error: string | null
  extraction_total_chunks: number | null
  extraction_completed_chunks: number
}

export function documentsQueryKey(projectId: string) {
  return ['documents', projectId] as const
}

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: documentsQueryKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select(
          'id, project_id, filename, storage_path, extraction_status, extraction_error, extraction_total_chunks, extraction_completed_chunks',
        )
        .eq('project_id', projectId)
        .order('filename', { ascending: true })

      if (error) throw error
      return data as DocumentRow[]
    },
    enabled: Boolean(projectId),
    // Extraction is now async (returns 202, finishes in the background) —
    // poll while anything is processing so the status list actually updates.
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some((doc) => doc.extraction_status === 'processing')
      return hasProcessing ? 3000 : false
    },
  })
}
