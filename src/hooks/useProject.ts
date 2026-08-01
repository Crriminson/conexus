import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssuerFacts } from '@/types/facts'

export interface ProjectRow {
  id: string
  name: string
  facts: IssuerFacts
  conflicts: unknown[]
}

export function projectQueryKey(projectId: string) {
  return ['project', projectId] as const
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectQueryKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, facts, conflicts')
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data as ProjectRow
    },
    enabled: Boolean(projectId),
  })
}
