import type { IssuerFacts } from '@/types/facts'
import type { GeneratedSections } from '@/lib/generatedSections'
import { collectConfirmedFacts } from '@/lib/generatedSections'
import { useGenerateSections } from '@/hooks/useGenerateSections'

export function GenerateSectionsButton({
  projectId,
  facts,
  generatedSections,
}: {
  projectId: string
  facts: IssuerFacts
  generatedSections: GeneratedSections
}) {
  // Same readiness check the Edge Function itself runs (collectConfirmedFacts
  // is shared with supabase/functions/generate-section) — the button is
  // disabled exactly when the call would 400, not on a separate guess at it.
  const citableFactCount = collectConfirmedFacts(facts).length
  const hasGenerated = Object.keys(generatedSections).length > 0
  const mutation = useGenerateSections(projectId)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={citableFactCount === 0 || mutation.isPending}
        title={citableFactCount === 0 ? 'No confirmed, citable facts yet' : undefined}
        className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? 'Generating…' : hasGenerated ? 'Regenerate narrative sections' : 'Generate narrative sections'}
      </button>
      {citableFactCount === 0 && (
        <span className="text-xs text-muted-foreground">No confirmed, citable facts yet</span>
      )}
      {mutation.isError && <span className="text-xs text-destructive">{(mutation.error as Error).message}</span>}
    </div>
  )
}
