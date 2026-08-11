import type { IssuerFacts } from '@/types/facts'

/**
 * Field ordering and labels, declared rather than derived from
 * `Object.keys`, so the screen reads in a sensible order instead of
 * whatever order the type happens to be written in. This is the single
 * source of truth for "what fields exist and what do we call them" —
 * rendering (`DomainSection`), filtering, and the status counts all read
 * from it instead of each re-declaring their own copy.
 */
export interface FlatDomainConfig {
  key: keyof Pick<IssuerFacts, 'company' | 'financials' | 'capitalStructure'>
  title: string
  fields: [string, string][]
}

export interface ArrayDomainConfig {
  key: keyof Pick<IssuerFacts, 'promoters' | 'litigation' | 'relatedParties'>
  title: string
  labelField: string
  fields: [string, string][]
}

export const FLAT_DOMAINS: FlatDomainConfig[] = [
  {
    key: 'company',
    title: 'Company',
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
    title: 'Financials',
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
    title: 'Capital structure',
    fields: [
      ['authorizedCapital', 'Authorized capital'],
      ['issuedCapital', 'Issued capital'],
      ['paidUpCapital', 'Paid-up capital'],
      ['faceValuePerShare', 'Face value per share'],
      ['totalSharesOutstanding', 'Shares outstanding'],
    ],
  },
]

export const ARRAY_DOMAINS: ArrayDomainConfig[] = [
  {
    key: 'promoters',
    title: 'Promoters',
    labelField: 'name',
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
    title: 'Litigation',
    labelField: 'caseNumber',
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
    title: 'Related parties',
    labelField: 'partyName',
    fields: [
      ['partyName', 'Party'],
      ['relationship', 'Relationship'],
      ['natureOfTransaction', 'Transaction'],
      ['amount', 'Amount'],
      ['transactionDate', 'Date'],
    ],
  },
]

export type DomainKey = FlatDomainConfig['key'] | ArrayDomainConfig['key']

/** All 6 domains, flat first then array, in the fixed screen order. */
export const DOMAIN_ORDER: { key: DomainKey; title: string; isArray: boolean }[] = [
  ...FLAT_DOMAINS.map((d) => ({ key: d.key, title: d.title, isArray: false })),
  ...ARRAY_DOMAINS.map((d) => ({ key: d.key, title: d.title, isArray: true })),
]
