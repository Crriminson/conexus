import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Clock, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The design system's signature element (docs/DESIGN_SYSTEM.md, "Signature
 * element") — a verification stamp standing in for a human's judgment call
 * on a fact, section, or gate. Three states, deliberately not more:
 *
 *   confirmed — solid ring, filled. A human (or the deterministic rules
 *               engine) has signed off.
 *   pending   — dashed ring, hollow. Nothing has happened yet; this is the
 *               default/neutral state, not a warning.
 *   conflict  — solid ring, signature-red. Two sources disagree; a human
 *               needs to make a call. This is the one state that should
 *               draw the eye — it's blocking work, not just incomplete.
 *
 * `size="badge"` is the dense, inline form for use inside table rows (a
 * Facts Review field, an eligibility rule). `size="seal"` is the larger,
 * slightly-rotated circular form for hero moments — the top of a document
 * that's fully certified, an export gate that just passed.
 */

const stampVariants = cva(
  'inline-flex items-center gap-1 font-semibold uppercase tracking-wide select-none',
  {
    variants: {
      status: {
        confirmed: 'border-confirmed bg-confirmed-tint text-confirmed',
        pending: 'border-dashed border-ink-muted/50 bg-transparent text-ink-muted',
        conflict: 'border-signature bg-signature-tint text-signature',
      },
      size: {
        badge: 'rounded-sm border px-1.5 py-0.5 text-[0.625rem] leading-none',
        seal: 'flex-col justify-center rounded-full border-2 px-4 py-4 text-[0.6875rem] leading-tight -rotate-3',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'badge',
    },
  }
)

const STATUS_ICON = {
  confirmed: Check,
  pending: Clock,
  conflict: TriangleAlert,
} as const

const STATUS_LABEL = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  conflict: 'Needs review',
} as const

type StampStatus = keyof typeof STATUS_LABEL

interface VerificationStampProps
  extends Omit<ComponentProps<'span'>, 'children'>,
    VariantProps<typeof stampVariants> {
  status: StampStatus
  label?: string
}

function VerificationStamp({ status, size = 'badge', label, className, ...props }: VerificationStampProps) {
  const Icon = STATUS_ICON[status]
  const isSeal = size === 'seal'

  return (
    <span
      data-slot="verification-stamp"
      data-status={status}
      className={cn(stampVariants({ status, size }), className)}
      {...props}
    >
      <Icon className={isSeal ? 'size-5' : 'size-3'} aria-hidden="true" />
      <span>{label ?? STATUS_LABEL[status]}</span>
    </span>
  )
}

export { VerificationStamp, type StampStatus }
