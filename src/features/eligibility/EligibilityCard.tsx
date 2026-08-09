import type { IssuerFacts } from '@/types/facts'
import { evaluateEligibility } from '@/lib/eligibility'
import type { EligibilityStatus } from '@/lib/eligibility'

const DOT: Record<EligibilityStatus, string> = {
  pass: 'bg-green-500',
  warning: 'bg-amber-500',
  fail: 'bg-red-500',
  unknown: 'bg-muted-foreground/40',
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
    <div className="rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[report.overall]}`} />
        <h2 className="text-sm font-semibold">Eligibility — {LABEL[report.overall]}</h2>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {report.results.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-xs">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[r.status]}`} />
            <div>
              <span className="font-medium">{r.label}</span>{' '}
              <span className="text-muted-foreground">— {r.detail}</span>
              {r.basis === 'unconfirmed' && (
                <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                  AI-only, unconfirmed
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
