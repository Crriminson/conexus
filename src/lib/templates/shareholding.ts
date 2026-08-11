import type { IssuerFacts, PromoterRecord } from '@/types/facts'
import { cellFromField } from './shared'
import type { Section, SectionCell } from './types'

const FIELDS: Array<[key: 'name' | 'category' | 'shareholdingPercent', label: string]> = [
  ['name', 'Name'],
  ['category', 'Category'],
  ['shareholdingPercent', 'Shareholding %'],
]

function buildRow(promoter: PromoterRecord, missingFieldPaths: string[]): SectionCell[] {
  return FIELDS.map(([key, label]) => {
    const field = promoter[key]
    if (field.status !== 'confirmed') {
      missingFieldPaths.push(`promoters[${promoter.id}].${key}`)
    }
    return cellFromField(label, field)
  })
}

export function buildShareholdingSection(facts: IssuerFacts): Section {
  const missingFieldPaths: string[] = []
  const rows = facts.promoters.map((promoter) => buildRow(promoter, missingFieldPaths))

  return {
    id: 'shareholding',
    title: 'Shareholding Pattern',
    kind: 'computed',
    // An empty promoter list isn't "ready" — a demo shareholding table
    // with zero rows looks broken, not correct.
    status: facts.promoters.length > 0 && missingFieldPaths.length === 0 ? 'ready' : 'incomplete',
    rows,
    missingFieldPaths,
  }
}
