import type { Field, IssuerFacts } from '@/types/facts'
import type { EligibilityBasis, EligibilityRuleResult } from './types'

function basisOf(fields: Array<Field<unknown>>): EligibilityBasis {
  if (fields.some((f) => f.value === null)) return 'missing'
  if (fields.every((f) => f.status === 'confirmed' || f.status === 'edited')) return 'confirmed'
  return 'unconfirmed'
}

function netWorthPositive(facts: IssuerFacts): EligibilityRuleResult {
  const field = facts.financials.netWorth
  const id = 'net-worth-positive'
  const label = 'Positive net worth'
  if (field.value === null) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'Net worth not yet extracted.' }
  }
  const pass = field.value > 0
  return {
    id,
    label,
    status: pass ? 'pass' : 'fail',
    basis: basisOf([field]),
    detail: pass ? `Net worth is ${field.value}.` : `Net worth is ${field.value}, not positive.`,
  }
}

function profitable(facts: IssuerFacts): EligibilityRuleResult {
  const field = facts.financials.netProfit
  const id = 'profitable'
  const label = 'Profitable (latest year)'
  if (field.value === null) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'Net profit not yet extracted.' }
  }
  const pass = field.value > 0
  return {
    id,
    label,
    status: pass ? 'pass' : 'warning',
    basis: basisOf([field]),
    // A loss-making year doesn't disqualify a filing on its own, so this
    // warns rather than fails — and it's a single-year snapshot, not the
    // multi-year distributable-profits track record real ICDR eligibility
    // actually requires (that data isn't in this schema).
    detail: pass
      ? `Net profit is ${field.value}.`
      : `Net profit is ${field.value} — not profitable in the latest confirmed year.`,
  }
}

function minimumPromoterContribution(facts: IssuerFacts): EligibilityRuleResult {
  const id = 'minimum-promoter-contribution'
  const label = 'Minimum promoter contribution (20%)'
  const promoters = facts.promoters
  if (promoters.length === 0) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'No promoters extracted yet.' }
  }
  const known = promoters.filter((p) => p.shareholdingPercent.value !== null)
  const missingCount = promoters.length - known.length
  const total = known.reduce((sum, p) => sum + (p.shareholdingPercent.value as number), 0)
  const pass = total >= 20

  if (!pass && missingCount > 0) {
    return {
      id,
      label,
      status: 'unknown',
      basis: 'missing',
      detail: `Known promoter holdings sum to ${total.toFixed(1)}% with ${missingCount} promoter(s) still missing a shareholding figure — cannot rule out the 20% minimum yet.`,
    }
  }
  return {
    id,
    label,
    status: pass ? 'pass' : 'fail',
    basis: basisOf(known.map((p) => p.shareholdingPercent)),
    detail: `Promoters hold ${total.toFixed(1)}% (minimum 20%).`,
  }
}

function capitalStructureConsistency(facts: IssuerFacts): EligibilityRuleResult {
  const id = 'capital-structure-consistency'
  const label = 'Capital structure consistent'
  const { paidUpCapital, issuedCapital, authorizedCapital } = facts.capitalStructure
  const fields = [paidUpCapital, issuedCapital, authorizedCapital]
  if (fields.some((f) => f.value === null)) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'Capital structure not fully extracted yet.' }
  }
  const pass = paidUpCapital.value! <= issuedCapital.value! && issuedCapital.value! <= authorizedCapital.value!
  return {
    id,
    label,
    status: pass ? 'pass' : 'fail',
    basis: basisOf(fields),
    detail: pass
      ? 'Paid-up ≤ issued ≤ authorized capital, as expected.'
      : `Inconsistent: paid-up ${paidUpCapital.value}, issued ${issuedCapital.value}, authorized ${authorizedCapital.value}.`,
  }
}

const PENDING_TERMS = ['pending', 'ongoing', 'active', 'sub judice']

function noPendingMaterialLitigation(facts: IssuerFacts): EligibilityRuleResult {
  const id = 'no-pending-litigation'
  const label = 'No pending material litigation'
  if (facts.litigation.length === 0) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'No litigation data extracted yet — cannot confirm there is none.' }
  }
  const withStatus = facts.litigation.filter((r) => r.status.value !== null)
  if (withStatus.length === 0) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'Litigation records exist but none have a status extracted yet.' }
  }
  const pending = withStatus.filter((r) => PENDING_TERMS.some((t) => r.status.value!.toLowerCase().includes(t)))
  if (pending.length > 0) {
    return {
      id,
      label,
      status: 'warning',
      basis: basisOf(withStatus.map((r) => r.status)),
      detail: `${pending.length} of ${withStatus.length} litigation record(s) show a pending/ongoing status.`,
    }
  }
  return {
    id,
    label,
    status: 'pass',
    basis: basisOf(withStatus.map((r) => r.status)),
    detail: `${withStatus.length} litigation record(s) reviewed, none pending.`,
  }
}

const CIN_PATTERN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/

function cinFormatValid(facts: IssuerFacts): EligibilityRuleResult {
  const field = facts.company.cin
  const id = 'cin-format'
  const label = 'CIN well-formed'
  if (field.value === null) {
    return { id, label, status: 'unknown', basis: 'missing', detail: 'CIN not yet extracted.' }
  }
  const pass = CIN_PATTERN.test(field.value)
  return {
    id,
    label,
    status: pass ? 'pass' : 'fail',
    basis: basisOf([field]),
    detail: pass
      ? `CIN ${field.value} matches the standard 21-character format.`
      : `CIN "${field.value}" does not match the standard 21-character format.`,
  }
}

// Rules config, per architecture §9 task 10. Each rule is a pure function
// over IssuerFacts — no I/O, easy to unit test in isolation, easy to add to.
export const RULES: Array<(facts: IssuerFacts) => EligibilityRuleResult> = [
  netWorthPositive,
  profitable,
  minimumPromoterContribution,
  capitalStructureConsistency,
  noPendingMaterialLitigation,
  cinFormatValid,
]
