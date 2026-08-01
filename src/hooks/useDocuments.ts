import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DocumentRow {
  id: string
  project_id: string
  filename: string
  storage_path: string
  extraction_status: string
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
        .select('id, project_id, filename, storage_path, extraction_status')
        .eq('project_id', projectId)
        .order('filename', { ascending: true })

      if (error) throw error
      return data as DocumentRow[]
    },
    enabled: Boolean(projectId),
  })
}
