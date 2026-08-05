import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { merge } from '@/lib/merge/merge'
import type { ExtractedFacts } from '@/lib/merge/types'
import type { IssuerFacts } from '@/types/facts'
import { projectQueryKey, type ProjectRow } from './useProject'
import { documentsQueryKey } from './useDocuments'

interface ExtractFunctionResponse {
  documentId: string
  extracted: Omit<ExtractedFacts, 'documentId'>
}

async function describeFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json()
        if (body?.error) return String(body.error)
      } catch {
        // fall through to generic message below
      }
    }
  }
  return error instanceof Error ? error.message : 'Extraction failed'
}

async function setDocumentStatus(documentId: string, status: string) {
  await supabase.from('documents').update({ extraction_status: status }).eq('id', documentId)
}

// Wires the pipeline from section 2: EXTRACT (AI→JSON) → merge() → persist.
// A failure at any step marks the document `failed` and stops — it never
// writes a partial merge to the project row (the facts/conflicts/events
// update is one single .update() call, so it's all-or-nothing at the DB level).
export function useRunExtraction(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: string) => {
      await setDocumentStatus(documentId, 'processing')
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(projectId) })

      const { data, error } = await supabase.functions.invoke<ExtractFunctionResponse>('extract', {
        body: { documentId },
      })

      if (error || !data) {
        await setDocumentStatus(documentId, 'failed')
        throw new Error(await describeFunctionError(error))
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, facts, conflicts, merge_events')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        await setDocumentStatus(documentId, 'failed')
        throw projectError ?? new Error('Project not found')
      }

      const extracted: ExtractedFacts = { documentId, ...data.extracted }
      const projectRow = project as ProjectRow
      const result = merge(projectRow.facts as IssuerFacts, extracted)

      const { error: persistError } = await supabase
        .from('projects')
        .update({
          facts: result.facts,
          conflicts: [...projectRow.conflicts, ...result.conflicts],
          merge_events: [...projectRow.merge_events, result.event],
        })
        .eq('id', projectId)

      if (persistError) {
        await setDocumentStatus(documentId, 'failed')
        throw persistError
      }

      await setDocumentStatus(documentId, 'complete')
      return result
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) })
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(projectId) })
    },
  })
}
