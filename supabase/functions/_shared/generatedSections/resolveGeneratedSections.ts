// Turns the model's raw parsed JSON into a validated GeneratedSections,
// checked against the confirmed facts actually offered to it. Two things
// are never trusted from the model: a citedFieldPath that isn't one of the
// entries it was given (dropped, not kept — a citation pointing at a fact
// that was never offered would be worse than no citation, not better), and
// an empty/non-string body (treated as "didn't generate this section"
// rather than persisted as empty prose).

import type { ConfirmedFactEntry, GeneratedSectionCitation, GeneratedSectionKey, GeneratedSections } from './types.ts'

const SECTION_KEYS: GeneratedSectionKey[] = ['riskFactors', 'mdAndA', 'businessOverview']

function citationFor(entry: ConfirmedFactEntry): GeneratedSectionCitation {
  return { label: entry.label, fieldPath: entry.fieldPath, sourceDocId: entry.sourceDocId, sourcePage: entry.sourcePage }
}

export function resolveGeneratedSections(raw: unknown, entries: ConfirmedFactEntry[], generatedAt: string): GeneratedSections {
  const byPath = new Map(entries.map((e) => [e.fieldPath, e]))
  const root = raw as Record<string, unknown> | null | undefined
  const result: GeneratedSections = {}

  for (const key of SECTION_KEYS) {
    const section = root?.[key] as { body?: unknown; citedFieldPaths?: unknown } | undefined
    const body = typeof section?.body === 'string' ? section.body.trim() : ''
    if (!body) continue

    const requestedPaths = Array.isArray(section?.citedFieldPaths) ? section.citedFieldPaths : []
    const citations = requestedPaths
      .filter((p): p is string => typeof p === 'string' && byPath.has(p))
      .map((p) => citationFor(byPath.get(p)!))

    result[key] = { body, citations, generatedAt }
  }

  return result
}
