import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssuerFacts } from '@/types/facts'
import { projectQueryKey, type ProjectRow } from './useProject'

export function useUpdateFacts(projectId: string) {
  const queryClient = useQueryClient()
  const queryKey = projectQueryKey(projectId)

  return useMutation({
    mutationFn: async (facts: IssuerFacts) => {
      const { data, error } = await supabase
        .from('projects')
        .update({ facts })
        .eq('id', projectId)
        .select('id, name, facts, conflicts, merge_events, version')
        .single()

      if (error) throw error
      return data as ProjectRow
    },
    onMutate: async (facts) => {
      await queryClient.cancelQueries({ queryKey })
      const previousProject = queryClient.getQueryData<ProjectRow>(queryKey)

      if (previousProject) {
        queryClient.setQueryData<ProjectRow>(queryKey, {
          ...previousProject,
          facts,
        })
      }

      return { previousProject }
    },
    onError: (_error, _facts, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKey, context.previousProject)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
