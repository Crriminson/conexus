import type { Field, FieldStatus, IssuerFacts } from '@/types/facts'
import { ARRAY_DOMAINS, DOMAIN_ORDER, FLAT_DOMAINS, type DomainKey } from './domains'

/**
 * One field, flattened out of its domain (and, for array domains, its
 * record) into a self-describing entry. This is the single walk over
 * `IssuerFacts` that every other piece of the Facts Review screen builds
 * on — rendering, filtering, and the status counts all read this same
 * list rather than each re-walking the facts tree with their own
 * traversal, which is exactly the kind of duplicated logic
 * `docs/DECISIONS.md`'s `isTable()` regression warns against.
 */
export interface FactFieldEntry {
  path: string
  domainKey: DomainKey
  domainTitle: string
  label: string
  field: Field<unknown>
  recordId?: string
  recordHeading?: string
}

export function listFactFields(facts: IssuerFacts): FactFieldEntry[] {
  const entries: FactFieldEntry[] = []

  for (const domain of FLAT_DOMAINS) {
    const record = facts[domain.key] as unknown as Record<string, Field<unknown>>
    for (const [fieldKey, label] of domain.fields) {
      const field = record[fieldKey]
      if (!field) continue
      entries.push({
        path: `${domain.key}.${fieldKey}`,
        domainKey: domain.key,
        domainTitle: domain.title,
        label,
        field,
      })
    }
  }

  for (const domain of ARRAY_DOMAINS) {
    const records = (facts[domain.key] ?? []) as unknown as Array<Record<string, unknown>>
    records.forEach((record, index) => {
      const recordId = record.id as string
      const heading = (record[domain.labelField] as Field<unknown> | undefined)?.value
      const recordHeading = heading ? String(heading) : `${domain.title} ${index + 1}`

      for (const [fieldKey, label] of domain.fields) {
        const field = record[fieldKey] as Field<unknown> | undefined
        if (!field) continue
        entries.push({
          path: `${domain.key}[${recordId}].${fieldKey}`,
          domainKey: domain.key,
          domainTitle: domain.title,
          label,
          field,
          recordId,
          recordHeading,
        })
      }
    })
  }

  return entries
}

export type FactStatusCounts = Record<FieldStatus, number>

export function countFactsByStatus(entries: FactFieldEntry[]): FactStatusCounts {
  const counts: FactStatusCounts = { empty: 0, ai: 0, confirmed: 0, edited: 0 }
  for (const entry of entries) counts[entry.field.status] += 1
  return counts
}

/** Groups a flat entry list back into per-domain buckets, in `DOMAIN_ORDER` order. */
export function groupEntriesByDomain(entries: FactFieldEntry[]): Map<DomainKey, FactFieldEntry[]> {
  const groups = new Map<DomainKey, FactFieldEntry[]>()
  for (const domain of DOMAIN_ORDER) groups.set(domain.key, [])
  for (const entry of entries) groups.get(entry.domainKey)?.push(entry)
  return groups
}

/** Groups one array domain's entries back into per-record buckets, in record order. */
export function groupEntriesByRecord(entries: FactFieldEntry[]): Map<string, FactFieldEntry[]> {
  const groups = new Map<string, FactFieldEntry[]>()
  for (const entry of entries) {
    if (!entry.recordId) continue
    if (!groups.has(entry.recordId)) groups.set(entry.recordId, [])
    groups.get(entry.recordId)!.push(entry)
  }
  return groups
}
