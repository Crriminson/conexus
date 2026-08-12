import { Check, CircleDot, Lock } from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { computeProgressSteps, type ProgressStep } from '@/lib/progress/computeProgressSteps'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const STATE_STYLE: Record<ProgressStep['state'], string> = {
  done: 'text-confirmed',
  current: 'text-caution',
  locked: 'text-ink-muted',
}

const STATE_ICON = {
  done: Check,
  current: CircleDot,
  locked: Lock,
} as const

function StepItem({ step, index }: { step: ProgressStep; index: number }) {
  const Icon = STATE_ICON[step.state]
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Icon className={cn('mt-0.5 size-4 shrink-0', STATE_STYLE[step.state])} aria-hidden="true" />
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', step.state === 'locked' ? 'text-ink-muted' : 'text-ink')}>
          <span className="font-data tabular-nums text-ink-muted">{index + 1}.</span> {step.label}
        </p>
        {step.detail && <p className="text-xs text-ink-muted">{step.detail}</p>}
      </div>
    </li>
  )
}

/**
 * Read-only, five-step guidance so an SME knows what to do next — lives in
 * the shell so it's present on all three screens. Every step's number and
 * reason comes straight from `computeProgressSteps` (which itself only
 * calls the app's real, existing gate functions) — this component renders,
 * it doesn't compute.
 */
export function ProgressRail({ projectId }: { projectId: string }) {
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: documents, isLoading: documentsLoading } = useDocuments(projectId)

  if (projectLoading || documentsLoading) {
    return (
      <div className="border-b border-hairline bg-paper-raised">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    )
  }

  // Errors are already surfaced by whichever screen is active — this is
  // supplementary guidance, not critical path, so it simply steps aside
  // rather than duplicating an error state.
  if (!project || !documents) return null

  const steps = computeProgressSteps(project, documents)

  return (
    <div className="border-b border-hairline bg-paper-raised">
      <div className="mx-auto max-w-5xl px-6 py-3">
        <ol className="flex flex-wrap items-start gap-x-8 gap-y-2">
          {steps.map((step, index) => (
            <StepItem key={step.id} step={step} index={index} />
          ))}
        </ol>
      </div>
    </div>
  )
}
