import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { projectQueryKey } from './useProject'
import { describeFunctionError } from './describeFunctionError'

// Unlike useRunExtraction, generate-section responds synchronously (see
// supabase/functions/generate-section/index.ts — one Gemini call over a
// short confirmed-facts list, well inside the wall-clock ceiling that
// forced extraction into async+polling), so this hook just awaits the
// call and invalidates the project query — no polling loop needed.
export function useGenerateSections(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('generate-section', { body: { projectId } })
      if (error) throw new Error(await describeFunctionError(error, 'Failed to generate narrative sections'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) })
    },
  })
}
