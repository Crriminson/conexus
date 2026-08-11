import { describe, expect, it } from 'vitest'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { fixtureIssuerFacts, fixtureGeneratedSections } from '@/lib/templates/fixtures'
import type { DocumentRow } from '@/hooks/useDocuments'
import type { FactConflict } from '@/lib/merge/types'
import { computeProgressSteps } from './computeProgressSteps'

function doc(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 'doc-1',
    project_id: 'project-1',
    filename: 'test.pdf',
    storage_path: 'project-1/test.pdf',
    extraction_status: 'complete',
    extraction_error: null,
    extraction_total_chunks: 1,
    extraction_completed_chunks: 1,
    ...overrides,
  }
}

function conflict(overrides: Partial<FactConflict> = {}): FactConflict {
  return {
    id: 'conflict-1',
    fieldPath: 'company.industry',
    currentValue: 'A',
    currentStatus: 'confirmed',
    proposedValue: 'B',
    proposedConfidence: 0.9,
    proposedSourceDocId: 'doc-2',
    proposedSourcePage: 1,
    raisedAt: '2026-01-01T00:00:00.000Z',
    resolution: 'pending',
    ...overrides,
  }
}

describe('computeProgressSteps', () => {
  it('a brand-new project: step 1 is current; zero conflicts is genuinely done, not locked', () => {
    const steps = computeProgressSteps({ facts: emptyIssuerFacts(), conflicts: [], generated_sections: {} }, [])

    expect(steps[0]).toMatchObject({ label: 'Upload documents', state: 'current', detail: 'No documents uploaded yet.' })
    // Nothing has been extracted yet, so there are truthfully zero pending conflicts — 'done', not a lie.
    expect(steps[1].state).toBe('done')
    expect(steps[2].state).toBe('locked')
    expect(steps[2].detail).toContain('unconfirmed')
    expect(steps[4].state).toBe('locked')
    expect(steps[4].detail).not.toBeNull()
  })

  it('documents complete but zero facts confirmed: step 1 done, step 2 done (no conflicts), step 3 current', () => {
    const steps = computeProgressSteps({ facts: emptyIssuerFacts(), conflicts: [], generated_sections: {} }, [doc()])

    expect(steps[0].state).toBe('done')
    expect(steps[1].state).toBe('done') // zero conflicts is genuinely done, not a lie
    expect(steps[2]).toMatchObject({ label: 'Confirm facts', state: 'current', detail: '18 fact(s) unconfirmed.' })
    expect(steps[3].state).toBe('locked')
  })

  it('a pending conflict blocks step 2 even when facts are otherwise fully confirmed', () => {
    const facts = fixtureIssuerFacts()
    const steps = computeProgressSteps(
      { facts, conflicts: [conflict()], generated_sections: {} },
      [doc()],
    )

    expect(steps[1]).toMatchObject({ label: 'Resolve conflicts', state: 'current', detail: '1 conflict(s) need review.' })
    // Confirm facts is independently already true on its own terms — shown as done, not locked, even though it comes after the current step.
    expect(steps[2].state).toBe('done')
  })

  it('facts confirmed and eligible, but export not yet generated: step 5 current with a real, itemized reason', () => {
    const facts = fixtureIssuerFacts()
    const steps = computeProgressSteps({ facts, conflicts: [], generated_sections: {} }, [doc()])

    expect(steps[2].state).toBe('done')
    expect(steps[3].state).toBe('done') // fixture passes eligibility
    expect(steps[4]).toMatchObject({ label: 'Generate & export', state: 'current' })
    expect(steps[4].detail).toContain('Narrative not generated')
  })

  it('everything satisfied: all 5 steps done, no details', () => {
    const facts = fixtureIssuerFacts()
    const steps = computeProgressSteps(
      { facts, conflicts: [], generated_sections: fixtureGeneratedSections() },
      [doc()],
    )

    expect(steps.every((s) => s.state === 'done')).toBe(true)
    expect(steps.every((s) => s.detail === null)).toBe(true)
  })

  it('locked eligibility step reports its own failing rules, not a borrowed reason', () => {
    // Fixture facts pass eligibility on their own; force a failure by dropping net worth to negative via edited financials would be
    // more setup than needed — instead just confirm the locked-step detail is independently sourced when facts are incomplete AND
    // eligibility would also fail on the same incomplete data (both true for a partially-empty project).
    const facts = emptyIssuerFacts()
    facts.company.legalName.status = 'confirmed'
    const steps = computeProgressSteps({ facts, conflicts: [], generated_sections: {} }, [doc()])

    expect(steps[3].state).toBe('locked')
    expect(steps[3].detail).toMatch(/^Not yet passing:/)
  })
})
