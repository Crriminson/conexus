import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GeneratedSections } from '@/lib/generatedSections'
import { projectQueryKey, type ProjectRow } from './useProject'
import { describeFunctionError } from './describeFunctionError'

interface GenerateSectionsResponse {
  generatedSections: GeneratedSections
  /**
   * False when the write to `projects.generated_sections` couldn't happen
   * because that column's migration hasn't been applied yet (DEMO_MODE's
   * persist-step fallback — see generate-section/index.ts's
   * persistGeneratedSections). When false, the content only exists in this
   * response; there is nothing to re-fetch.
   *
   * This says nothing about whether `generatedSections` itself is real or
   * fixture content — that's `GeneratedSectionContent.source`, tagged
   * independently on the content by generate-section/index.ts at the point
   * it's generated. Persistence and content provenance are unrelated;
   * either combination is possible (real content that fails to persist,
   * fixture content that persists fine once the migration lands).
   */
  persisted: boolean
}

// Unlike useRunExtraction, generate-section responds synchronously (see
// supabase/functions/generate-section/index.ts — one Gemini call over a
// short confirmed-facts list, well inside the wall-clock ceiling that
// forced extraction into async+polling), so this hook just awaits the call.
export function useGenerateSections(projectId: string) {
  const queryClient = useQueryClient()
  const queryKey = projectQueryKey(projectId)

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-section', { body: { projectId } })
      if (error) throw new Error(await describeFunctionError(error, 'Failed to generate narrative sections'))
      return data as GenerateSectionsResponse
    },
    onSuccess: (result) => {
      if (result.persisted) {
        // Real write landed — refetch so every other field on the row
        // (version, etc.) is current too, not just generated_sections.
        queryClient.invalidateQueries({ queryKey })
        return
      }
      // Nothing was written (pre-migration DEMO_MODE fallback): the content
      // this call just generated — real or fixture, whichever generate-
      // section actually produced, each section already tagged with its own
      // `source` — only exists in this response, so patch it into the cache
      // directly rather than invalidating. A refetch here would just re-run
      // useProject's own unrelated fixture fallback and discard whatever
      // this call actually produced.
      queryClient.setQueryData<ProjectRow>(queryKey, (previous) =>
        previous
          ? {
              ...previous,
              generated_sections: { ...previous.generated_sections, ...result.generatedSections },
            }
          : previous,
      )
    },
  })
}
