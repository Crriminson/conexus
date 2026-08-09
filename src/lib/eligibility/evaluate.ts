import type { IssuerFacts } from '@/types/facts'
import { RULES } from './rules'
import type { EligibilityReport, EligibilityRuleResult, EligibilityStatus } from './types'

function overallStatus(results: EligibilityRuleResult[]): EligibilityStatus {
  if (results.some((r) => r.status === 'fail')) return 'fail'
  if (results.some((r) => r.status === 'warning')) return 'warning'
  if (results.some((r) => r.status === 'unknown')) return 'unknown'
  return 'pass'
}

export function evaluateEligibility(facts: IssuerFacts): EligibilityReport {
  const results = RULES.map((rule) => rule(facts))
  return { overall: overallStatus(results), results }
}
