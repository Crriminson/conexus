import type { Field } from '@/types/facts'
import type { SectionCell } from './types'

// Computed sections read confirmed facts only (architecture §9 task 11,
// reaffirmed 2026-08-09 after finding contaminated test data): an
// unconfirmed or human-edited-but-not-confirmed value renders as a blank
// cell rather than showing something nobody has signed off on.
export function cellFromField(label: string, field: Field<unknown>): SectionCell {
  const confirmed = field.status === 'confirmed'
  return {
    label,
    value: confirmed ? field.value : null,
    confirmed,
    sourceDocId: confirmed ? field.sourceDocId : null,
    sourcePage: confirmed ? field.sourcePage : null,
  }
}
