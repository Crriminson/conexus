import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getFieldAtPath, setFieldAtPath } from '@/lib/facts/fieldPath'
import { projectQueryKey, type ProjectRow } from './useProject'

const MAX_WRITE_RETRIES = 5

export interface ConflictResolution {
  conflictId: string
  resolution: 'kept_current' | 'accepted_proposed'
}

/**
 * Resolves one conflict, under the same optimistic-concurrency discipline as
 * useUpdateFacts — this writes `facts` too when the proposed value wins, so
 * it has the identical lost-update exposure.
 *
 * Accepting a proposal marks the field `edited`, not `ai`: a human chose it,
 * so a later extraction proposing something different must raise a fresh
 * conflict rather than silently overwriting. Marking it `ai` would let the
 * next chunk quietly overwrite a decision the human just made.
 *
 * The conflict is never deleted, only stamped with its resolution — the
 * Review screen's diff trail reads resolved conflicts to show what was
 * considered and rejected, not just what won.
 */
export function useResolveConflict(projectId: string) {
  const queryClient = useQueryClient()
  const queryKey = projectQueryKey(projectId)

  return useMutation({
    mutationFn: async ({ conflictId, resolution }: ConflictResolution) => {
      for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
        const { data: project, error: readError } = await supabase
          .from('projects')
          .select('id, name, facts, conflicts, merge_events, generated_sections, version')
          .eq('id', projectId)
          .single()

        if (readError) throw readError
        const current = project as ProjectRow

        const conflict = current.conflicts.find((c) => c.id === conflictId)
        if (!conflict) throw new Error(`No conflict with id "${conflictId}"`)
        if (conflict.resolution !== 'pending') return current // already resolved elsewhere

        const resolvedAt = new Date().toISOString()
        const nextConflicts = current.conflicts.map((c) =>
          c.id === conflictId ? { ...c, resolution, resolvedAt } : c,
        )

        let nextFacts = current.facts
        if (resolution === 'accepted_proposed') {
          const field = getFieldAtPath(current.facts, conflict.fieldPath)
          if (!field) throw new Error(`No field at path "${conflict.fieldPath}"`)
          nextFacts = setFieldAtPath(current.facts, conflict.fieldPath, {
            ...field,
            value: conflict.proposedValue,
            confidence: conflict.proposedConfidence,
            sourceDocId: conflict.proposedSourceDocId,
            sourcePage: conflict.proposedSourcePage,
            status: 'edited',
            updatedAt: resolvedAt,
          })
        }

        const { data: updated, error: writeError } = await supabase
          .from('projects')
          .update({ facts: nextFacts, conflicts: nextConflicts, version: current.version + 1 })
          .eq('id', projectId)
          .eq('version', current.version)
          .select('id, name, facts, conflicts, merge_events, generated_sections, version')

        if (writeError) throw writeError
        if (updated && updated.length > 0) return updated[0] as ProjectRow
      }

      throw new Error('Exceeded retries resolving concurrent updates')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
