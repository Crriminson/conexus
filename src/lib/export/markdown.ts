import type { IssuerFacts } from '@/types/facts'
import type { DocumentRow } from '@/hooks/useDocuments'
import type { GeneratedSections } from '@/lib/generatedSections'
import { assembleSections, isTable } from '@/lib/templates'
import type { Section, SectionCell, SectionCitation } from '@/lib/templates'
import { LIABILITY_DISCLAIMER } from './disclaimer'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

// Escapes the pipe/newline characters that would otherwise break a Markdown
// table cell. Facts are short structured fields, not free text, so this is
// deliberately minimal rather than a full Markdown-escaping pass.
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function sourceLabel(cell: SectionCell, documents: DocumentRow[]): string {
  if (!cell.confirmed || !cell.sourceDocId) return ''
  const doc = documents.find((d) => d.id === cell.sourceDocId)
  if (!doc) return ''
  return `${doc.filename}${cell.sourcePage ? `, p.${cell.sourcePage}` : ''}`
}

function renderKeyValueSection(section: Section, documents: DocumentRow[]): string {
  return (section.rows ?? [])
    .map(([cell]) => {
      const source = sourceLabel(cell, documents)
      return `- **${cell.label}:** ${formatValue(cell.value)}${source ? ` (source: ${source})` : ''}`
    })
    .join('\n')
}

function renderTableSection(section: Section, documents: DocumentRow[]): string {
  const rows = section.rows ?? []
  if (rows.length === 0) return '_No records._'

  const headers = rows[0].map((cell) => cell.label)
  const header = `| ${headers.join(' | ')} | Source |`
  const separator = `| ${headers.map(() => '---').join(' | ')} | --- |`
  const body = rows
    .map((row) => {
      const cells = row.map((cell) => escapeCell(formatValue(cell.value)))
      const source = escapeCell(sourceLabel(row[0], documents))
      return `| ${cells.join(' | ')} | ${source} |`
    })
    .join('\n')

  return [header, separator, body].join('\n')
}

function citationLine(citations: SectionCitation[] | undefined, documents: DocumentRow[]): string {
  if (!citations || citations.length === 0) return ''
  const parts = citations.map((citation) => {
    const doc = documents.find((d) => d.id === citation.sourceDocId)
    const source = doc
      ? `${doc.filename}${citation.sourcePage ? `, p.${citation.sourcePage}` : ''}`
      : citation.sourceDocId
    return `${citation.label} (${source})`
  })
  return `\n\n**Sources:** ${parts.join('; ')}`
}

function renderSection(section: Section, documents: DocumentRow[]): string {
  const heading = `## ${section.title}`

  if (section.kind === 'static') {
    return `${heading}\n\n${section.body ?? ''}`
  }

  if (section.kind === 'generated') {
    const body = section.body ?? '_Not yet generated._'
    return `${heading}\n\n${body}${citationLine(section.citations, documents)}`
  }

  if ((section.rows ?? []).length === 0) {
    return `${heading}\n\n_No records._`
  }

  const body = isTable(section) ? renderTableSection(section, documents) : renderKeyValueSection(section, documents)
  return `${heading}\n\n${body}`
}

function exportTitle(facts: IssuerFacts): string {
  return facts.company.legalName.status === 'confirmed'
    ? (facts.company.legalName.value ?? 'Draft Red Herring Prospectus')
    : 'Draft Red Herring Prospectus'
}

// Renders the same sections Task 13's DraftScreen shows, as Markdown.
// Pure and gate-agnostic — callers that need to enforce all-facts-confirmed
// before exporting should check `checkExportGate()` first (see ./gate).
export function buildExportMarkdown(
  facts: IssuerFacts,
  documents: DocumentRow[],
  generatedSections: GeneratedSections = {},
): string {
  const sections = assembleSections(facts, generatedSections).map((section) => renderSection(section, documents))
  return [`# ${exportTitle(facts)}`, LIABILITY_DISCLAIMER, ...sections].join('\n\n') + '\n'
}

// Derives a filesystem-safe .md filename from the confirmed legal name,
// falling back to a generic name when it isn't confirmed yet.
export function exportFilename(facts: IssuerFacts): string {
  const slug = exportTitle(facts)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'drhp-draft'}.md`
}
