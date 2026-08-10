import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { documentsQueryKey } from './useDocuments'
import { describeFunctionError } from './describeFunctionError'

// The pipeline itself (Gemini call, merge(), persist) now runs server-side
// in the extract Edge Function's background task — see docs/PROGRESS.md,
// Task 6 async work. This hook only kicks it off; `useDocuments`/`useProject`
// poll for the eventual result since there's no synchronous response to wait on.
export function useRunExtraction(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.functions.invoke('extract', { body: { documentId } })
      if (error) throw new Error(await describeFunctionError(error, 'Failed to start extraction'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(projectId) })
    },
  })
}
