export type FieldStatus = 'empty' | 'ai' | 'confirmed' | 'edited'

export interface Field<T> {
  value: T | null
  confidence: number | null
  sourceDocId: string | null
  sourcePage: number | null
  status: FieldStatus
  updatedAt: string
}
