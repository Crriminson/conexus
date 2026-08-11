import { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface BulkConfirmBarProps {
  /** ai-status field paths currently visible under the active filter/domain. */
  paths: string[]
  isBusy: boolean
  onConfirmField: (path: string) => Promise<unknown>
}

/**
 * Appears only when 2+ AI-proposed fields are visible under the current
 * filter — never a hidden global "confirm all" (docs/UI_ARCHITECTURE.md).
 * Fires useUpdateFacts sequentially, one field at a time: that mutation's
 * optimistic-concurrency retry loop is built for one write racing a
 * background extraction, not N writes racing each other on the same row
 * (see the "lost update" note in src/hooks/useUpdateFacts.ts) — sequential
 * avoids that self-inflicted race entirely.
 */
export function BulkConfirmBar({ paths, isBusy, onConfirmField }: BulkConfirmBarProps) {
  const [progress, setProgress] = useState(0)
  const [isConfirmingAll, setIsConfirmingAll] = useState(false)

  if (paths.length < 2) return null

  async function confirmAll() {
    setIsConfirmingAll(true)
    setProgress(0)
    for (const path of paths) {
      await onConfirmField(path)
      setProgress((n) => n + 1)
    }
    setIsConfirmingAll(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-paper-raised px-3 py-2">
      <p className="text-sm text-ink">
        <span className="font-data tabular-nums font-medium">{paths.length}</span> AI-proposed field
        {paths.length === 1 ? '' : 's'} visible
      </p>
      <Button type="button" variant="outline" size="sm" disabled={isBusy || isConfirmingAll} onClick={confirmAll}>
        {isConfirmingAll ? `Confirming ${progress}/${paths.length}…` : `Confirm ${paths.length} visible`}
      </Button>
    </div>
  )
}
