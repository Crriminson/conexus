import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssuerFacts } from '@/types/facts'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'
import { documentsQueryKey, type DocumentRow } from './useDocuments'

export interface ProjectRow {
  id: string
  name: string
  facts: IssuerFacts
  conflicts: FactConflict[]
  merge_events: MergeEvent[]
  version: number
}

export function projectQueryKey(projectId: string) {
  return ['project', projectId] as const
}

export function useProject(projectId: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: projectQueryKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, facts, conflicts, merge_events, version')
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data as ProjectRow
    },
    enabled: Boolean(projectId),
    // Extraction now persists facts from a background task, not the request
    // that kicked it off — poll while a document is processing so merged
    // facts actually show up once it finishes. Reads useDocuments' cache
    // directly rather than duplicating extraction-status tracking here.
    refetchInterval: () => {
      const documents = queryClient.getQueryData<DocumentRow[]>(documentsQueryKey(projectId))
      const hasProcessing = documents?.some((doc) => doc.extraction_status === 'processing')
      return hasProcessing ? 3000 : false
    },
  })
}
