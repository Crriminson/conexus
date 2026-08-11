import { CheckCircle, FileText, ShieldCheck, Upload } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Step {
  icon: LucideIcon
  title: string
  body: string
}

// Re-ordered to match the product's actual sequence (upload precedes any
// eligibility signal, since eligibility is computed from extracted facts).
// The original listed Eligibility first and linked it to /docs/eligibility.pdf,
// a file that does not exist in this repo — a 404 on the landing page. The
// link is gone; the steps are uniform, non-interactive cards.
const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'Extract',
    body: 'Upload source documents. Large filings are split and extracted chunk by chunk, with real progress.',
  },
  {
    icon: CheckCircle,
    title: 'Review',
    body: 'Confirm, edit or reject every extracted fact. Disagreements between documents surface as conflicts.',
  },
  {
    icon: ShieldCheck,
    title: 'Check',
    body: 'Deterministic eligibility rules run over the confirmed data and show what each verdict rests on.',
  },
  {
    icon: FileText,
    title: 'Draft',
    body: 'Assemble the offer document from confirmed facts only, then export once every gate passes.',
  },
]

export function LandingWorkflow() {
  return (
    <section id="workflow" className="scroll-mt-16 bg-paper px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl text-balance text-ink sm:text-4xl">The Conexus workflow</h2>
        </div>

        <ol className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              className="flex flex-col items-center rounded-lg border border-hairline bg-paper-raised p-6 text-center"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-confirmed-tint text-confirmed">
                <Icon className="size-6" />
              </span>
              {/* Not `font-data` — docs/DESIGN_SYSTEM.md reserves that face for
                  citable values (figures, CINs, page refs). A step ordinal is a
                  label, and tabular-nums rendered it as "1 . Extract". */}
              <span className="mt-4 text-xs font-medium tracking-wide text-ink-muted uppercase">
                Step {index + 1}
              </span>
              <h3 className="mt-1 text-lg text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
