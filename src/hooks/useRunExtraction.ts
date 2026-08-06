import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { documentsQueryKey } from './useDocuments'

async function describeFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json()
        if (body?.error) return String(body.error)
      } catch {
        // fall through to generic message below
      }
    }
  }
  return error instanceof Error ? error.message : 'Failed to start extraction'
}

// The pipeline itself (Gemini call, merge(), persist) now runs server-side
// in the extract Edge Function's background task — see docs/PROGRESS.md,
// Task 6 async work. This hook only kicks it off; `useDocuments`/`useProject`
// poll for the eventual result since there's no synchronous response to wait on.
export function useRunExtraction(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.functions.invoke('extract', { body: { documentId } })
      if (error) throw new Error(await describeFunctionError(error))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(projectId) })
    },
  })
}
