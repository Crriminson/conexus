export type EligibilityStatus = 'pass' | 'warning' | 'fail' | 'unknown'

// Whether a rule's verdict rests on human-confirmed data, AI-extracted but
// unconfirmed data, or data that isn't there yet. Unlike Task 11's document
// sections (confirmed-only, gated for what gets assembled/exported), this
// engine is a live at-a-glance signal — it reads whatever value is present
// so the traffic light updates as extraction happens, but callers can tell
// from `basis` whether a green light rests on verified fact or an AI guess.
export type EligibilityBasis = 'confirmed' | 'unconfirmed' | 'missing'

export interface EligibilityRuleResult {
  id: string
  label: string
  status: EligibilityStatus
  basis: EligibilityBasis
  detail: string
}

export interface EligibilityReport {
  overall: EligibilityStatus
  results: EligibilityRuleResult[]
}
