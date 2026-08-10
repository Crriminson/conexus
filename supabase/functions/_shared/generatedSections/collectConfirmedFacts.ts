// Flattens every confirmed-and-citable fact out of IssuerFacts into a flat
// list generation can draw from. Two domains only Task 12 needs — company
// (for Business Overview) and litigation (for Risk Factors) — aren't
// touched by Task 11's computed sections at all, so their label tables live
// here rather than being shared with src/lib/templates/ (same "each module
// declares its own [key, label] pairs" convention already used by
// templates/capitalStructure.ts and financials.ts, not a new one).
//
// "Confirmed" alone isn't enough to include a fact: a confirmed field with
// no sourceDocId (possible in principle — `edited` is the normal path for a
// human-typed value with no document behind it, but nothing stops a
// `confirmed` field from having a null sourceDocId too) can't be cited, and
// CLAUDE.md requires every piece of AI-generated content to carry a
// citation back to its source. Filtering here means every fact the model
// ever sees is already citable — the model can't be blamed for an
// uncitable output if it was never given uncitable input.

import type { Field, IssuerFacts } from '../factsTypes.ts'
import type { ConfirmedFactEntry } from './types.ts'

function confirmedEntry(fieldPath: string, label: string, field: Field<unknown>): ConfirmedFactEntry | null {
  if (field.status !== 'confirmed' || field.value === null || !field.sourceDocId) return null
  return { fieldPath, label, value: field.value, sourceDocId: field.sourceDocId, sourcePage: field.sourcePage }
}

const FLAT_DOMAINS: Array<{
  key: 'company' | 'financials' | 'capitalStructure'
  fields: Array<[string, string]>
}> = [
  {
    key: 'company',
    fields: [
      ['legalName', 'Legal name'],
      ['cin', 'CIN'],
      ['incorporationDate', 'Incorporation date'],
      ['registeredOfficeAddress', 'Registered office'],
      ['industry', 'Industry'],
      ['businessDescription', 'Business description'],
    ],
  },
  {
    key: 'financials',
    fields: [
      ['fiscalYearEnd', 'Fiscal year end'],
      ['revenue', 'Revenue'],
      ['ebitda', 'EBITDA'],
      ['netProfit', 'Net profit'],
      ['totalAssets', 'Total assets'],
      ['totalLiabilities', 'Total liabilities'],
      ['netWorth', 'Net worth'],
    ],
  },
  {
    key: 'capitalStructure',
    fields: [
      ['authorizedCapital', 'Authorized capital'],
      ['issuedCapital', 'Issued capital'],
      ['paidUpCapital', 'Paid-up capital'],
      ['faceValuePerShare', 'Face value per share'],
      ['totalSharesOutstanding', 'Shares outstanding'],
    ],
  },
]

const ARRAY_DOMAINS: Array<{
  key: 'promoters' | 'litigation' | 'relatedParties'
  recordLabel: string
  fields: Array<[string, string]>
}> = [
  {
    key: 'promoters',
    recordLabel: 'Promoter',
    fields: [
      ['name', 'Name'],
      ['panOrId', 'PAN / ID'],
      ['din', 'DIN'],
      ['shareholdingPercent', 'Shareholding %'],
      ['category', 'Category'],
    ],
  },
  {
    key: 'litigation',
    recordLabel: 'Litigation matter',
    fields: [
      ['caseNumber', 'Case number'],
      ['forum', 'Forum'],
      ['partiesInvolved', 'Parties'],
      ['natureOfProceeding', 'Nature'],
      ['amountInvolved', 'Amount'],
      ['status', 'Status'],
    ],
  },
  {
    key: 'relatedParties',
    recordLabel: 'Related party',
    fields: [
      ['partyName', 'Party'],
      ['relationship', 'Relationship'],
      ['natureOfTransaction', 'Transaction'],
      ['amount', 'Amount'],
      ['transactionDate', 'Date'],
    ],
  },
]

export function collectConfirmedFacts(facts: IssuerFacts): ConfirmedFactEntry[] {
  const entries: ConfirmedFactEntry[] = []

  for (const domain of FLAT_DOMAINS) {
    const group = facts[domain.key] as unknown as Record<string, Field<unknown>>
    for (const [key, label] of domain.fields) {
      const entry = confirmedEntry(`${domain.key}.${key}`, label, group[key])
      if (entry) entries.push(entry)
    }
  }

  for (const domain of ARRAY_DOMAINS) {
    const records = facts[domain.key] as unknown as Array<Record<string, unknown> & { id: string }>
    records.forEach((record, index) => {
      const heading = (record[domain.fields[0][0]] as Field<unknown> | undefined)?.value
      const recordDesc = heading ? String(heading) : `${domain.recordLabel} ${index + 1}`
      for (const [key, label] of domain.fields) {
        const entry = confirmedEntry(
          `${domain.key}[${record.id}].${key}`,
          `${recordDesc} — ${label}`,
          record[key] as Field<unknown>,
        )
        if (entry) entries.push(entry)
      }
    })
  }

  return entries
}
