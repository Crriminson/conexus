import type { ComponentProps, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, Info, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * One flexible primitive for empty, error, and blocked-by-gate states
 * (docs/DESIGN_SYSTEM.md) rather than three near-identical components —
 * they're the same shape (icon + title + explanation + optional checklist
 * + optional action), just different tones and content.
 *
 * `items` is specifically for blocked-by-gate: pass the real list of unmet
 * conditions (e.g. checkExportGate's missingFieldPaths) so the reader sees
 * exactly what's missing, never just "Export unavailable." A disabled
 * control should almost always have one of these sitting next to it
 * explaining why — see docs/DESIGN_SYSTEM.md, "Disabled state."
 */

const calloutVariants = cva('rounded-lg border border-l-4 p-4', {
  variants: {
    tone: {
      neutral: 'border-hairline border-l-ink-muted bg-paper-raised',
      confirmed: 'border-confirmed/30 border-l-confirmed bg-confirmed-tint',
      caution: 'border-caution/30 border-l-caution bg-caution-tint',
      signature: 'border-signature/30 border-l-signature bg-signature-tint',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
})

const TONE_ICON = {
  neutral: Info,
  confirmed: Info,
  caution: CircleAlert,
  signature: Ban,
} as const

interface CalloutProps extends ComponentProps<'div'>, VariantProps<typeof calloutVariants> {
  title: string
  children?: ReactNode
  /** Unmet conditions, rendered as a checklist — pass real data, not a vague summary. */
  items?: string[]
  action?: ReactNode
}

function Callout({ tone = 'neutral', title, children, items, action, className, ...props }: CalloutProps) {
  const Icon = TONE_ICON[tone ?? 'neutral']

  return (
    <div data-slot="callout" data-tone={tone} className={cn(calloutVariants({ tone }), className)} {...props}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1 space-y-2">
          <p className="font-semibold text-ink">{title}</p>
          {children ? <div className="text-sm text-ink-muted">{children}</div> : null}
          {items && items.length > 0 ? (
            <ul className="space-y-1 text-sm text-ink-muted">
              {items.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                  <span className="font-data">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}

export { Callout }
