import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Generic tone badge — the same 4-tone vocabulary as `Callout`
 * (neutral/confirmed/caution/signature), for status labels that don't fit
 * `VerificationStamp`'s fixed 3-state stamp motif. Per
 * docs/DESIGN_SYSTEM.md's status-vocabulary mapping, `VerificationStamp` is
 * reserved for `Field.status` and `FactConflict.resolution`; everything else
 * (`Section.status`, `EligibilityStatus`, gate/progress states) is "a
 * token/color", not a stamp — this is that token, as a reusable primitive
 * instead of each screen redeclaring its own pill.
 */
const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'bg-paper-recessed text-ink-muted',
      confirmed: 'bg-confirmed-tint text-confirmed',
      caution: 'bg-caution-tint text-caution',
      signature: 'bg-signature-tint text-signature',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
})

interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

function Badge({ tone, className, ...props }: BadgeProps) {
  return <span data-slot="badge" data-tone={tone} className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }
