export type SectionKind = 'static' | 'computed' | 'generated'

export interface SectionCell {
  label: string
  value: unknown
  confirmed: boolean
  sourceDocId: string | null
  sourcePage: number | null
}

export interface SectionCitation {
  label: string
  fieldPath: string
  sourceDocId: string
  sourcePage: number | null
}

export interface Section {
  id: string
  title: string
  kind: SectionKind
  status: 'ready' | 'incomplete'
  /** Static and generated sections. */
  body?: string
  /** Computed sections only — one inner array per row. */
  rows?: SectionCell[][]
  /** Generated sections only — which confirmed facts the text draws on. */
  citations?: SectionCitation[]
  missingFieldPaths: string[]
}
