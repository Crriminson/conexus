// Persisted shape of Task 12's 3 generated narrative sections (Risk
// Factors, MD&A, Business Overview — architecture §2/§6). Lives in its own
// module rather than factsTypes.ts: this isn't part of IssuerFacts, it's a
// separate `projects.generated_sections` column, regenerated wholesale on
// demand rather than merged.

export type GeneratedSectionKey = 'riskFactors' | 'mdAndA' | 'businessOverview'

export interface GeneratedSectionCitation {
  label: string
  fieldPath: string
  sourceDocId: string
  sourcePage: number | null
}

// Where this content's *text* actually came from — 'real' means the
// deployed Gemini call, 'fixture' means any fallback that stands in for it
// (generate-section's own demo response when Gemini fails, or useProject's
// fixtureGeneratedSections() when the generated_sections column itself
// can't be read). Set once, at the point each piece of content is created,
// and never re-derived later from something indirect like whether the row
// persisted — that indirection is exactly what let real content get
// mislabeled as fixture (and fixture content escape the "Demo data" banner
// entirely) depending on unrelated persistence timing. See
// docs/FIXTURE_INVENTORY.md §4.1.
export type GeneratedSectionSource = 'real' | 'fixture'

export interface GeneratedSectionContent {
  body: string
  citations: GeneratedSectionCitation[]
  generatedAt: string
  source: GeneratedSectionSource
}

export type GeneratedSections = Partial<Record<GeneratedSectionKey, GeneratedSectionContent>>

// One confirmed fact, flattened out of IssuerFacts and labeled, ready to
// drop into a generation prompt and to validate a model's citations
// against. Only facts with a real sourceDocId are ever collected (see
// collectConfirmedFacts.ts) — CLAUDE.md's "AI-generated content must always
// carry a citation back to its source" is enforced here, at the input
// boundary, rather than trusted to hold downstream.
export interface ConfirmedFactEntry {
  fieldPath: string
  label: string
  value: unknown
  sourceDocId: string
  sourcePage: number | null
}
