import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { documentsQueryKey } from './useDocuments'

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!BUCKET) {
        throw new Error('VITE_SUPABASE_STORAGE_BUCKET is not set yet')
      }

      const storagePath = `${projectId}/${crypto.randomUUID()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      const { data, error: insertError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          filename: file.name,
          storage_path: storagePath,
          extraction_status: 'pending',
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
