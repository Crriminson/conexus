import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Determinate progress only — no indeterminate mode. Screens with a real
 * count (chunk N of M) should show it; a spinner standing in for a number
 * that already exists is exactly what docs/DESIGN_SYSTEM.md's loading-state
 * rule warns against.
 */
interface ProgressProps extends Omit<ComponentProps<'div'>, 'value'> {
  value: number
  max: number
}

function Progress({ value, max, className, ...props }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-paper-recessed', className)}
      {...props}
    >
      <div className="h-full rounded-full bg-confirmed transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

export { Progress }
