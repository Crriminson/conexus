import { describe, expect, it } from 'vitest'
import type { Field } from '@/types/facts'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { createMockProvider } from '@/lib/llm'
import { parseModelJson } from '@/lib/parseModelJson'
import { buildGenerationPrompt, collectConfirmedFacts, resolveGeneratedSections } from './index'

function confirmedField<T>(value: T, sourceDocId: string | null = 'doc-1', page = 1): Field<T> {
  return { value, confidence: null, sourceDocId, sourcePage: page, status: 'confirmed', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function aiField<T>(value: T | null): Field<T> {
  return { value, confidence: 0.9, sourceDocId: 'doc-1', sourcePage: 1, status: 'ai', updatedAt: '2026-01-01T00:00:00.000Z' }
}

describe('collectConfirmedFacts', () => {
  it('returns nothing for entirely empty facts', () => {
    expect(collectConfirmedFacts(emptyIssuerFacts())).toEqual([])
  })

  it('includes a confirmed flat-domain field with a source, excludes ai/edited/empty', () => {
    const facts = emptyIssuerFacts()
    facts.company.legalName = confirmedField('Sundfin Industries Limited', 'doc-1', 4)
    facts.company.industry = aiField('Industrial Machinery')

    const entries = collectConfirmedFacts(facts)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({
      fieldPath: 'company.legalName',
      label: 'Legal name',
      value: 'Sundfin Industries Limited',
      sourceDocId: 'doc-1',
      sourcePage: 4,
    })
  })

  it('excludes a confirmed field with no sourceDocId — not citable, so not offered to generation', () => {
    const facts = emptyIssuerFacts()
    facts.company.legalName = confirmedField('Sundfin Industries Limited', null)
    expect(collectConfirmedFacts(facts)).toEqual([])
  })

  it('flattens array-domain records with a heading-derived label and indexed fieldPath', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      {
        id: 'promoter-1',
        name: confirmedField('Rajesh Kumar Mehta', 'doc-1', 88),
        panOrId: confirmedField('ABCPM1234K', 'doc-1', 88),
        din: aiField('01234567'),
        shareholdingPercent: confirmedField(38.5, 'doc-1', 88),
        category: confirmedField('Promoter', 'doc-1', 88),
      },
    ]
    const entries = collectConfirmedFacts(facts)
    const paths = entries.map((e) => e.fieldPath)
    expect(paths).toEqual([
      'promoters[promoter-1].name',
      'promoters[promoter-1].panOrId',
      'promoters[promoter-1].shareholdingPercent',
      'promoters[promoter-1].category',
    ])
    expect(entries.find((e) => e.fieldPath === 'promoters[promoter-1].shareholdingPercent')?.label).toBe(
      'Rajesh Kumar Mehta — Shareholding %',
    )
  })

  it('uses the heading field even when it is only AI-proposed — it labels the prompt, it is not itself cited', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      {
        id: 'promoter-1',
        name: aiField('Unconfirmed Name'),
        panOrId: confirmedField('ABCPM1234K'),
        din: aiField(null),
        shareholdingPercent: aiField(38.5),
        category: aiField('Promoter'),
      },
    ]
    const entries = collectConfirmedFacts(facts)
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Unconfirmed Name — PAN / ID')
  })

  it('falls back to a generic record label when the heading field has no value at all', () => {
    const facts = emptyIssuerFacts()
    facts.promoters = [
      {
        id: 'promoter-1',
        name: aiField<string>(null),
        panOrId: confirmedField('ABCPM1234K'),
        din: aiField(null),
        shareholdingPercent: aiField(38.5),
        category: aiField('Promoter'),
      },
    ]
    const entries = collectConfirmedFacts(facts)
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Promoter 1 — PAN / ID')
  })
})

describe('buildGenerationPrompt', () => {
  it('lists every entry as "fieldPath | label = value" and names all three output sections', () => {
    const prompt = buildGenerationPrompt([
      { fieldPath: 'company.legalName', label: 'Legal name', value: 'Sundfin Industries Limited', sourceDocId: 'doc-1', sourcePage: 4 },
    ])
    expect(prompt).toContain('company.legalName | Legal name = "Sundfin Industries Limited"')
    expect(prompt).toContain('riskFactors')
    expect(prompt).toContain('mdAndA')
    expect(prompt).toContain('businessOverview')
    expect(prompt).toContain('citedFieldPaths')
  })
})

describe('resolveGeneratedSections', () => {
  const entries = [
    { fieldPath: 'company.legalName', label: 'Legal name', value: 'Sundfin Industries Limited', sourceDocId: 'doc-1', sourcePage: 4 },
    { fieldPath: 'financials.netWorth', label: 'Net worth', value: 254000000, sourceDocId: 'doc-1', sourcePage: 114 },
  ]

  it('resolves valid citedFieldPaths into full citation objects', () => {
    const raw = {
      riskFactors: { body: 'Some risk text.', citedFieldPaths: ['financials.netWorth'] },
      mdAndA: { body: 'Some MD&A text.', citedFieldPaths: ['company.legalName', 'financials.netWorth'] },
      businessOverview: { body: 'Some overview text.', citedFieldPaths: [] },
    }
    const result = resolveGeneratedSections(raw, entries, '2026-08-10T00:00:00.000Z')

    expect(result.riskFactors).toEqual({
      body: 'Some risk text.',
      citations: [{ label: 'Net worth', fieldPath: 'financials.netWorth', sourceDocId: 'doc-1', sourcePage: 114 }],
      generatedAt: '2026-08-10T00:00:00.000Z',
    })
    expect(result.mdAndA?.citations).toHaveLength(2)
    expect(result.businessOverview?.citations).toEqual([])
  })

  it('drops a citedFieldPath that was never offered to the model rather than trusting it', () => {
    const raw = {
      riskFactors: { body: 'Text.', citedFieldPaths: ['financials.netWorth', 'company.cin'] },
    }
    const result = resolveGeneratedSections(raw, entries, '2026-08-10T00:00:00.000Z')
    expect(result.riskFactors?.citations).toEqual([
      { label: 'Net worth', fieldPath: 'financials.netWorth', sourceDocId: 'doc-1', sourcePage: 114 },
    ])
  })

  it('omits a section entirely when its body is missing, empty, or non-string', () => {
    const raw = {
      riskFactors: { body: '', citedFieldPaths: [] },
      mdAndA: { body: '   ', citedFieldPaths: [] },
      businessOverview: { body: 42, citedFieldPaths: [] },
    }
    expect(resolveGeneratedSections(raw, entries, '2026-08-10T00:00:00.000Z')).toEqual({})
  })

  it('returns {} for malformed or empty input rather than throwing', () => {
    expect(resolveGeneratedSections(null, entries, '2026-08-10T00:00:00.000Z')).toEqual({})
    expect(resolveGeneratedSections({}, entries, '2026-08-10T00:00:00.000Z')).toEqual({})
    expect(resolveGeneratedSections('not an object', entries, '2026-08-10T00:00:00.000Z')).toEqual({})
  })
})

// End-to-end through the mock provider — proves the full
// collect -> prompt -> generate -> parse -> resolve path works without ever
// touching Gemini, per the requirement that Task 12 be written and verified
// against a mock (see docs/DECISIONS.md).
describe('generate-section flow, via the mock provider', () => {
  it('produces valid, citation-checked GeneratedSections from a canned model response', async () => {
    const facts = emptyIssuerFacts()
    facts.company.legalName = confirmedField('Sundfin Industries Limited', 'doc-1', 4)
    facts.financials.netWorth = confirmedField(254000000, 'doc-1', 114)

    const entries = collectConfirmedFacts(facts)
    const prompt = buildGenerationPrompt(entries)

    const provider = createMockProvider({
      response: JSON.stringify({
        riskFactors: { body: 'Risk text citing net worth.', citedFieldPaths: ['financials.netWorth'] },
        mdAndA: { body: 'MD&A text citing legal name and net worth.', citedFieldPaths: ['company.legalName', 'financials.netWorth'] },
        businessOverview: { body: 'Overview text.', citedFieldPaths: ['company.legalName'] },
      }),
    })

    const rawText = await provider.generate({ prompt, responseMimeType: 'application/json' })
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].prompt).toBe(prompt)

    const parsed = parseModelJson(rawText)
    const result = resolveGeneratedSections(parsed, entries, '2026-08-10T00:00:00.000Z')

    expect(Object.keys(result)).toEqual(['riskFactors', 'mdAndA', 'businessOverview'])
    expect(result.riskFactors?.citations).toEqual([
      { label: 'Net worth', fieldPath: 'financials.netWorth', sourceDocId: 'doc-1', sourcePage: 114 },
    ])
  })

  it('handles a fence-wrapped mock response identically to a bare one', async () => {
    const provider = createMockProvider({
      response: '```json\n' + JSON.stringify({ riskFactors: { body: 'Text.', citedFieldPaths: [] } }) + '\n```',
    })
    const rawText = await provider.generate({ prompt: 'x' })
    const parsed = parseModelJson(rawText)
    expect(resolveGeneratedSections(parsed, [], '2026-08-10T00:00:00.000Z')).toEqual({
      riskFactors: { body: 'Text.', citations: [], generatedAt: '2026-08-10T00:00:00.000Z' },
    })
  })
})
