import type { IssuerFacts } from '@/types/facts'
import { evaluateEligibility } from '@/lib/eligibility'
import type { EligibilityStatus } from '@/lib/eligibility'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'

// Pinned in docs/DESIGN_SYSTEM.md's status-vocabulary table: pass -> confirmed,
// warning -> caution, fail -> signature (the seal-red rule's case 4 —
// "a hard-fail verdict from the deterministic eligibility rules engine"),
// unknown -> ink-muted (data not there yet, not a verdict).
const TONE: Record<EligibilityStatus, NonNullable<VariantProps<typeof badgeVariants>['tone']>> = {
  pass: 'confirmed',
  warning: 'caution',
  fail: 'signature',
  unknown: 'neutral',
}

const DOT: Record<EligibilityStatus, string> = {
  pass: 'bg-confirmed',
  warning: 'bg-caution',
  fail: 'bg-signature',
  unknown: 'bg-ink-muted/40',
}

const LABEL: Record<EligibilityStatus, string> = {
  pass: 'Pass',
  warning: 'Warning',
  fail: 'Fail',
  unknown: 'Unknown',
}

export function EligibilityCard({ facts }: { facts: IssuerFacts }) {
  const report = evaluateEligibility(facts)

  return (
    <div className="rounded-lg border border-hairline bg-paper-raised px-3 py-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Eligibility</h2>
        <Badge tone={TONE[report.overall]}>{LABEL[report.overall]}</Badge>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {report.results.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-xs">
            <span className={`mt-1 size-2 shrink-0 rounded-full ${DOT[r.status]}`} aria-hidden="true" />
            <div>
              <span className="font-medium text-ink">{r.label}</span>{' '}
              <span className="text-ink-muted">— {r.detail}</span>
              {r.basis === 'unconfirmed' && (
                <Badge tone="caution" className="ml-1.5 px-1.5 py-0 text-[0.625rem]">
                  AI-only, unconfirmed
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
