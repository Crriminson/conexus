export type SectionKind = 'static' | 'computed'

export interface SectionCell {
  label: string
  value: unknown
  confirmed: boolean
  sourceDocId: string | null
  sourcePage: number | null
}

export interface Section {
  id: string
  title: string
  kind: SectionKind
  status: 'ready' | 'incomplete'
  /** Static sections only. */
  body?: string
  /** Computed sections only — one inner array per row. */
  rows?: SectionCell[][]
  missingFieldPaths: string[]
}
