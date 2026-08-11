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

export interface GeneratedSectionContent {
  body: string
  citations: GeneratedSectionCitation[]
  generatedAt: string
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
