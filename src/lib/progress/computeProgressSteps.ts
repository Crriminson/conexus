import type { IssuerFacts } from '@/types/facts'
import type { FactConflict } from '@/lib/merge/types'
import type { GeneratedSections } from '@/lib/generatedSections'
import type { DocumentRow } from '@/hooks/useDocuments'
import { countFactsByStatus, listFactFields } from '@/lib/facts/factList'
import { evaluateEligibility } from '@/lib/eligibility'
import { checkExportGate } from '@/lib/export'

export type ProgressStepState = 'done' | 'current' | 'locked'

export interface ProgressStep {
  id: string
  label: string
  state: ProgressStepState
  /** The real unmet condition — null only when `state === 'done'`. */
  detail: string | null
}

const STEP_LABELS = [
  'Upload documents',
  'Resolve conflicts',
  'Confirm facts',
  'Check eligibility',
  'Generate & export',
] as const

function describeDocuments(documents: DocumentRow[]): string | null {
  if (documents.length === 0) return 'No documents uploaded yet.'
  if (documents.some((d) => d.extraction_status === 'complete')) return null
  if (documents.some((d) => d.extraction_status === 'processing')) return 'Extraction in progress.'
  const failed = documents.filter((d) => d.extraction_status === 'failed').length
  return failed > 0 ? `${failed} document(s) failed extraction.` : 'Extraction not started yet.'
}

function describeMissingExport(missingFieldPaths: string[]): string {
  const facts = missingFieldPaths.filter((p) => !p.startsWith('generated.')).length
  const narrative = missingFieldPaths.filter((p) => p.startsWith('generated.')).length
  if (facts > 0 && narrative > 0) return `${facts} fact(s) unconfirmed, narrative not generated.`
  if (facts > 0) return `${facts} fact(s) unconfirmed.`
  if (narrative > 0) return 'Narrative not generated.'
  return ''
}

/**
 * Five-step read-only guidance for the workspace shell — no new hooks, no
 * schema change. Every number here comes from the same real functions the
 * actual gates call (`listFactFields`/`countFactsByStatus` — the same pair
 * Facts Review's own status stamp uses; `evaluateEligibility` — Task 10's
 * 6-rule engine; `checkExportGate` — Task 14's export gate), never a
 * parallel reimplementation.
 *
 * Every not-done step always has its own real reason (each `done[i]` above
 * is defined as exactly "this step's own detail string is null"), so
 * `locked` never needs a borrowed or made-up explanation — a locked step
 * explains itself, same as `current`. The only difference between the two
 * is which one is first: exactly one step is ever `current` (the first
 * not-done step, in the fixed 5-step order), so an SME sees a single next
 * action rather than five simultaneous traffic lights, while later
 * not-done steps are `locked` purely as that sequencing device.
 */
export function computeProgressSteps(
  project: { facts: IssuerFacts; conflicts: FactConflict[]; generated_sections: GeneratedSections },
  documents: DocumentRow[],
): ProgressStep[] {
  const entries = listFactFields(project.facts)
  const counts = countFactsByStatus(entries)
  const reviewed = counts.confirmed + counts.edited
  const total = entries.length

  const pendingConflicts = project.conflicts.filter((c) => c.resolution === 'pending')
  const eligibility = evaluateEligibility(project.facts)
  const failingRules = eligibility.results.filter((r) => r.status !== 'pass')
  const gate = checkExportGate(project.facts, project.generated_sections)

  const done = [
    documents.some((d) => d.extraction_status === 'complete'),
    pendingConflicts.length === 0,
    reviewed === total,
    eligibility.overall === 'pass',
    gate.allowed,
  ]

  const ownDetail: (string | null)[] = [
    describeDocuments(documents),
    pendingConflicts.length > 0 ? `${pendingConflicts.length} conflict(s) need review.` : null,
    total - reviewed > 0 ? `${total - reviewed} fact(s) unconfirmed.` : null,
    failingRules.length > 0 ? `Not yet passing: ${failingRules.map((r) => r.label).join(', ')}.` : null,
    gate.allowed ? null : describeMissingExport(gate.missingFieldPaths),
  ]

  const firstNotDone = done.findIndex((isDone) => !isDone)

  return STEP_LABELS.map((label, i) => {
    if (done[i]) return { id: String(i), label, state: 'done' as const, detail: null }
    const state: ProgressStepState = i === firstNotDone ? 'current' : 'locked'
    return { id: String(i), label, state, detail: ownDetail[i] }
  })
}
