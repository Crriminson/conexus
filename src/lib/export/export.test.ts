import { describe, expect, it } from 'vitest'
import { emptyIssuerFacts } from '@/types/facts/empty'
import { fixtureDocuments, fixtureIssuerFacts } from '@/lib/templates/fixtures'
import { LIABILITY_DISCLAIMER } from './disclaimer'
import { checkExportGate } from './gate'
import { buildExportMarkdown, exportFilename } from './markdown'
import { ExportNotAllowedError, exportProjectMarkdown } from './index'

describe('checkExportGate', () => {
  it('blocks export on empty facts, listing every missing field', () => {
    const gate = checkExportGate(emptyIssuerFacts())
    expect(gate.allowed).toBe(false)
    expect(gate.missingFieldPaths.length).toBeGreaterThan(0)
    expect(gate.missingFieldPaths).toContain('capitalStructure.authorizedCapital')
  })

  it('allows export once the fully-confirmed fixture is used', () => {
    const gate = checkExportGate(fixtureIssuerFacts())
    expect(gate).toEqual({ allowed: true, missingFieldPaths: [] })
  })

  it('blocks export when even one field Task 11 needs is still unconfirmed', () => {
    const facts = fixtureIssuerFacts()
    facts.capitalStructure.authorizedCapital.status = 'ai'
    const gate = checkExportGate(facts)
    expect(gate.allowed).toBe(false)
    expect(gate.missingFieldPaths).toEqual(['capitalStructure.authorizedCapital'])
  })
})

describe('buildExportMarkdown', () => {
  it('includes the verbatim disclaimer text', () => {
    const markdown = buildExportMarkdown(fixtureIssuerFacts(), fixtureDocuments())
    expect(markdown).toContain(LIABILITY_DISCLAIMER)
  })

  it('titles the document with the confirmed legal name', () => {
    const markdown = buildExportMarkdown(fixtureIssuerFacts(), fixtureDocuments())
    expect(markdown.startsWith('# Acme Industries Limited\n')).toBe(true)
  })

  it('falls back to a generic title when the legal name is not confirmed', () => {
    const markdown = buildExportMarkdown(emptyIssuerFacts(), [])
    expect(markdown.startsWith('# Draft Red Herring Prospectus\n')).toBe(true)
  })

  it('renders every section from Task 11, in the same order Task 13 uses', () => {
    const markdown = buildExportMarkdown(fixtureIssuerFacts(), fixtureDocuments())
    const headingOrder = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1])
    expect(headingOrder).toEqual(['Definitions', 'General Information', 'Capital Structure', 'Shareholding Pattern', 'Financial Summary'])
  })

  it('renders flat computed sections as a key-value list with source citations', () => {
    const markdown = buildExportMarkdown(fixtureIssuerFacts(), fixtureDocuments())
    expect(markdown).toContain('- **Authorized Capital:** 450000000 (source: acme-drhp-fixture.pdf, p.20)')
  })

  it('renders repeating-group sections as a Markdown table', () => {
    const markdown = buildExportMarkdown(fixtureIssuerFacts(), fixtureDocuments())
    expect(markdown).toContain('| Name | Category | Shareholding % | Source |')
    expect(markdown).toContain('| Asha Rao | Promoter | 61.15 | acme-drhp-fixture.pdf, p.25 |')
  })

  it('renders "No records." for a computed section with zero rows', () => {
    const markdown = buildExportMarkdown(emptyIssuerFacts(), [])
    expect(markdown).toContain('## Shareholding Pattern\n\n_No records._')
  })
})

describe('exportFilename', () => {
  it('slugifies the confirmed legal name', () => {
    expect(exportFilename(fixtureIssuerFacts())).toBe('acme-industries-limited.md')
  })

  it('falls back to a generic filename when the legal name is not confirmed', () => {
    expect(exportFilename(emptyIssuerFacts())).toBe('draft-red-herring-prospectus.md')
  })
})

describe('exportProjectMarkdown', () => {
  it('throws ExportNotAllowedError instead of returning partial output on incomplete facts', () => {
    expect(() => exportProjectMarkdown(emptyIssuerFacts(), [])).toThrow(ExportNotAllowedError)
  })

  it('carries the missing field paths on the thrown error', () => {
    let caught: unknown
    try {
      exportProjectMarkdown(emptyIssuerFacts(), [])
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ExportNotAllowedError)
    expect((caught as ExportNotAllowedError).missingFieldPaths.length).toBeGreaterThan(0)
  })

  it('returns the same Markdown buildExportMarkdown would, once the gate passes', () => {
    const facts = fixtureIssuerFacts()
    const documents = fixtureDocuments()
    expect(exportProjectMarkdown(facts, documents)).toBe(buildExportMarkdown(facts, documents))
  })
})
