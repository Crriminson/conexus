import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssuerFacts } from '@/types/facts'
import type { FactConflict, MergeEvent } from '@/lib/merge/types'
import type { GeneratedSections } from '@/lib/generatedSections'
import { isDemoMode, isMissingSchemaError } from '@/lib/demoMode'
import { fixtureGeneratedSections } from '@/lib/templates/fixtures'
import { documentsQueryKey, type DocumentRow } from './useDocuments'

export interface ProjectRow {
  id: string
  name: string
  facts: IssuerFacts
  conflicts: FactConflict[]
  merge_events: MergeEvent[]
  generated_sections: GeneratedSections
  version: number
  /**
   * True when `generated_sections` came from DEMO_MODE's fixture fallback
   * rather than a real read — the live `generated_sections` column doesn't
   * exist until its migration is applied (still pending as of this writing,
   * see docs/STATE.md), so a plain select 42703s. DEMO_MODE re-reads
   * without that column and splices in fixture content instead of
   * surfacing the error; this flag lets the UI say so instead of silently
   * passing fixture prose off as real. Always false with DEMO_MODE off, and
   * — the "real path takes over automatically" part — always false again
   * the moment the migration lands, with no code change needed here.
   */
  generatedSectionsIsDemo: boolean
}

const LIVE_COLUMNS = 'id, name, facts, conflicts, merge_events, generated_sections, version'
const PRE_MIGRATION_COLUMNS = 'id, name, facts, conflicts, merge_events, version'

// useUpdateFacts/useResolveConflict's read-modify-write CAS loop never
// actually needs generated_sections — they only ever touch facts/conflicts.
// They select this narrower column list instead of LIVE_COLUMNS so their own
// DB calls can never 42703 on a column their own logic doesn't use, migration
// applied or not — this is unconditional resilience, not a DEMO_MODE
// fallback (see docs/DECISIONS.md). `generated_sections`/
// `generatedSectionsIsDemo` are then carried forward from whatever's already
// in the TanStack Query cache (populated by useProject, which does fetch/
// fall back on that column) rather than re-read, since nothing in a facts or
// conflict write ever changes them.
export const PROJECT_FACTS_COLUMNS = PRE_MIGRATION_COLUMNS
export type ProjectFactsRow = Pick<ProjectRow, 'id' | 'name' | 'facts' | 'conflicts' | 'merge_events' | 'version'>

export function withCachedGeneratedSections(row: ProjectFactsRow, cached: ProjectRow | undefined): ProjectRow {
  return {
    ...row,
    generated_sections: cached?.generated_sections ?? {},
    generatedSectionsIsDemo: cached?.generatedSectionsIsDemo ?? false,
  }
}

async function fetchProjectRow(projectId: string): Promise<ProjectRow> {
  const { data, error } = await supabase.from('projects').select(LIVE_COLUMNS).eq('id', projectId).single()

  if (error) {
    if (isDemoMode() && isMissingSchemaError(error)) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('projects')
        .select(PRE_MIGRATION_COLUMNS)
        .eq('id', projectId)
        .single()

      if (fallbackError) throw fallbackError
      return {
        ...(fallback as Omit<ProjectRow, 'generated_sections' | 'generatedSectionsIsDemo'>),
        generated_sections: fixtureGeneratedSections(),
        generatedSectionsIsDemo: true,
      }
    }
    throw error
  }

  return { ...(data as Omit<ProjectRow, 'generatedSectionsIsDemo'>), generatedSectionsIsDemo: false }
}

export function projectQueryKey(projectId: string) {
  return ['project', projectId] as const
}

export function useProject(projectId: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: projectQueryKey(projectId),
    queryFn: () => fetchProjectRow(projectId),
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
