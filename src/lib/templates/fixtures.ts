import type { Field, IssuerFacts } from '@/types/facts'
import { emptyIssuerFacts } from '@/types/facts/empty'

// A fully-confirmed, schema-accurate fixture — for building and testing
// Tasks 13/10 against realistic data while the live project's facts are
// empty (extraction paused pending the Gemini quota decision, 2026-08-09).
// Not wired into the live app; import directly where needed.
function confirmed<T>(value: T, page: number): Field<T> {
  return {
    value,
    confidence: null,
    sourceDocId: 'fixture-doc',
    sourcePage: page,
    status: 'confirmed',
    updatedAt: '2026-08-09T00:00:00.000Z',
  }
}

export function fixtureIssuerFacts(): IssuerFacts {
  const facts = emptyIssuerFacts()

  facts.company.legalName = confirmed('Acme Industries Limited', 1)
  facts.company.cin = confirmed('U65923TN2015PLC100328', 1)
  facts.company.incorporationDate = confirmed('April 30, 2015', 1)
  facts.company.registeredOfficeAddress = confirmed('123 MG Road, Chennai, Tamil Nadu 600002', 1)
  facts.company.industry = confirmed('Non-Banking Financial Company', 1)
  facts.company.businessDescription = confirmed('A financial services company serving retail borrowers.', 1)

  facts.financials.fiscalYearEnd = confirmed('March 31', 12)
  facts.financials.revenue = confirmed(18487, 12)
  facts.financials.ebitda = confirmed(6633, 12)
  facts.financials.netProfit = confirmed(4367, 13)
  facts.financials.totalAssets = confirmed(27921, 13)
  facts.financials.totalLiabilities = confirmed(8798, 13)
  facts.financials.netWorth = confirmed(19123, 13)

  facts.capitalStructure.authorizedCapital = confirmed(450000000, 20)
  facts.capitalStructure.issuedCapital = confirmed(303884790, 20)
  facts.capitalStructure.paidUpCapital = confirmed(303884790, 20)
  facts.capitalStructure.faceValuePerShare = confirmed(10, 20)
  facts.capitalStructure.totalSharesOutstanding = confirmed(30388479, 20)

  facts.promoters = [
    {
      id: 'promoter-1',
      name: confirmed('Asha Rao', 25),
      panOrId: confirmed('ABCDE1234F', 25),
      din: confirmed('00312359', 25),
      shareholdingPercent: confirmed(61.15, 25),
      category: confirmed('Promoter', 25),
    },
    {
      id: 'promoter-2',
      name: confirmed('Bhavin Shah', 26),
      panOrId: confirmed('ZYXWV9876K', 26),
      din: confirmed('00654321', 26),
      shareholdingPercent: confirmed(12.4, 26),
      category: confirmed('Promoter Family', 26),
    },
  ]

  return facts
}

export function fixtureDocuments() {
  return [
    {
      id: 'fixture-doc',
      project_id: 'fixture-project',
      filename: 'acme-drhp-fixture.pdf',
      storage_path: 'fixture-project/acme-drhp-fixture.pdf',
      extraction_status: 'complete',
      extraction_error: null,
      extraction_total_chunks: 1,
      extraction_completed_chunks: 1,
    },
  ]
}
