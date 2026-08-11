import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading placeholder shaped like the content it stands in for — never a
 * bare spinner for data-dense screens (see docs/DESIGN_SYSTEM.md, "Loading
 * state"). Compose several with widths/heights matching the real layout
 * (a row of field skeletons the same height as a real FieldRow, etc.) so
 * there's no layout shift when data arrives.
 */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse motion-reduce:animate-none rounded-md bg-paper-recessed',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
