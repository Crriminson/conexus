import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FieldStatus } from '@/types/facts'
import { applyHumanEdit, getFieldAtPath, setFieldAtPath, type FactPath } from '@/lib/facts/fieldPath'
import { projectQueryKey, type ProjectRow } from './useProject'

const MAX_WRITE_RETRIES = 5

export interface FieldPatch {
  path: FactPath
  status: Extract<FieldStatus, 'confirmed' | 'edited'>
  /** Required for `edited`; ignored for `confirmed`, which keeps the current value. */
  value?: unknown
}

/**
 * Applies one human edit to one field, under optimistic concurrency.
 *
 * This used to take a whole `IssuerFacts` and blind-`.update({facts})` it,
 * which meant a human edit submitted while a background extraction was
 * running would overwrite the entire facts column with a copy read *before*
 * that extraction's merge — silently discarding it. Chunked extraction made
 * that window ~15+ minutes wide (one `processing` document, 26 sequential
 * chunk merges), and this screen is exactly where humans edit during it.
 *
 * Two changes close it. The contract is now a single field path rather than
 * a full-object replacement, and each attempt re-reads the row, applies just
 * that one field to the fresh copy, and writes back conditioned on the
 * `version` it read (`.eq('version', …)`, same compare-and-swap the extract
 * function uses). A concurrent merge bumps `version`, the update matches
 * zero rows, and we retry against the new state instead of clobbering it —
 * so the extraction's writes to *other* fields survive, and the human's edit
 * still lands.
 *
 * "Extraction proposes, humans dispose" only holds if the human's disposal
 * can't be lost to a proposal that arrived mid-edit.
 */
export function useUpdateFacts(projectId: string) {
  const queryClient = useQueryClient()
  const queryKey = projectQueryKey(projectId)

  return useMutation({
    mutationFn: async (patch: FieldPatch) => {
      let lastError = 'Exceeded retries resolving concurrent updates'

      for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
        const { data: project, error: readError } = await supabase
          .from('projects')
          .select('id, name, facts, conflicts, merge_events, generated_sections, version')
          .eq('id', projectId)
          .single()

        if (readError) throw readError
        const current = project as ProjectRow

        const field = getFieldAtPath(current.facts, patch.path)
        if (!field) throw new Error(`No field at path "${patch.path}"`)

        const nextFacts = setFieldAtPath(
          current.facts,
          patch.path,
          applyHumanEdit(field, patch, new Date().toISOString()),
        )

        const { data: updated, error: writeError } = await supabase
          .from('projects')
          .update({ facts: nextFacts, version: current.version + 1 })
          .eq('id', projectId)
          .eq('version', current.version)
          .select('id, name, facts, conflicts, merge_events, generated_sections, version')

        if (writeError) throw writeError
        if (updated && updated.length > 0) return updated[0] as ProjectRow

        // version moved under us — a background chunk merged while we were
        // reading. Loop: re-read and re-apply this same field onto the newer
        // facts rather than overwriting that merge.
        lastError = `Field "${patch.path}" kept losing a race with a concurrent extraction`
      }

      throw new Error(lastError)
    },

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey })
      const previousProject = queryClient.getQueryData<ProjectRow>(queryKey)

      if (previousProject) {
        const field = getFieldAtPath(previousProject.facts, patch.path)
        if (field) {
          queryClient.setQueryData<ProjectRow>(queryKey, {
            ...previousProject,
            facts: setFieldAtPath(
              previousProject.facts,
              patch.path,
              applyHumanEdit(field, patch, new Date().toISOString()),
            ),
          })
        }
      }

      return { previousProject }
    },

    onError: (_error, _patch, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKey, context.previousProject)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
