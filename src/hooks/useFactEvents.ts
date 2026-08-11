import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isDemoMode, isMissingSchemaError } from '@/lib/demoMode'
import { fixtureFactEvents, sortFactEventsDescending, type FactEventLogRow } from '@/lib/factEvents'

export interface FactEventsResult {
  rows: FactEventLogRow[]
  isDemo: boolean
}

export function factEventsQueryKey(projectId: string) {
  return ['fact-events', projectId] as const
}

// Same DEMO_MODE shape as useProject's generated_sections fallback: try the
// real table first, and only reach for fixture data if that specific read
// fails because the fact_events migration hasn't been applied yet — never on
// any other kind of failure, and never at all with DEMO_MODE off. Verified
// live against the real project (2026-08-11): a missing table goes through
// PostgREST's schema cache, not Postgres directly, so it reports its own
// PGRST205 rather than the raw Postgres 42P01 undefined_table code —
// isMissingSchemaError checks both. Once the migration lands, this call
// simply stops erroring and the real rows flow through unchanged.
async function fetchFactEvents(projectId: string): Promise<FactEventsResult> {
  const { data, error } = await supabase
    .from('fact_events')
    .select('id, project_id, fact_id, event_type, old_value, new_value, source, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isDemoMode() && isMissingSchemaError(error)) {
      return { rows: sortFactEventsDescending(fixtureFactEvents()), isDemo: true }
    }
    throw error
  }

  return { rows: data as FactEventLogRow[], isDemo: false }
}

export function useFactEvents(projectId: string) {
  return useQuery({
    queryKey: factEventsQueryKey(projectId),
    queryFn: () => fetchFactEvents(projectId),
    enabled: Boolean(projectId),
  })
}
