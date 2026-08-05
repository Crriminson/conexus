import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssuerFacts } from '@/types/facts'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'

export interface ProjectRow {
  id: string
  name: string
  facts: IssuerFacts
  conflicts: FactConflict[]
  merge_events: MergeEvent[]
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
        .select('id, name, facts, conflicts, merge_events')
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data as ProjectRow
    },
    enabled: Boolean(projectId),
  })
}
