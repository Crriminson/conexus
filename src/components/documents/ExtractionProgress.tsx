import { Progress } from '@/components/ui/progress'

/** "chunk N of M" — the real count from DocumentRow, never an indeterminate spinner. */
export function ExtractionProgress({ completed, total }: { completed: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={completed} max={total} className="w-28" />
      <span className="font-data text-xs text-ink-muted">
        chunk {completed} of {total}
      </span>
    </div>
  )
}
