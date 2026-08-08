import type { Field, FieldStatus, IssuerFacts } from '@/types/facts'

// Addressing a single leaf inside IssuerFacts.
//
// Flat domains address by key:            "company.legalName"
// Repeating groups address by record id:  "promoters[<recordId>].name"
//
// This grammar is NOT a free choice — it's the format merge() already emits
// into MergeEvent.fieldsWritten and FactConflict.fieldPath, both of which are
// persisted. Conflict resolution resolves `conflict.fieldPath` through here,
// so the two must agree exactly or every array-field conflict fails to
// resolve.
//
// Record id rather than array index, for the same reason merge() matches
// array records on a natural key instead of position: a background extraction
// can append or reorder records between a human opening the Review screen and
// hitting Confirm, and an index would then point at a different promoter than
// the one on screen.

export type FactPath = string

type PathToken = { kind: 'key'; key: string } | { kind: 'id'; id: string }

// Record ids are UUIDs (no dots), so splitting on '.' before unwrapping
// brackets is unambiguous.
function parsePath(path: FactPath): PathToken[] {
  const tokens: PathToken[] = []
  for (const segment of path.split('.')) {
    const bracketed = segment.match(/^([^[\]]+)\[([^\]]+)\]$/)
    if (bracketed) {
      tokens.push({ kind: 'key', key: bracketed[1] }, { kind: 'id', id: bracketed[2] })
    } else {
      tokens.push({ kind: 'key', key: segment })
    }
  }
  return tokens
}

/** Reads the leaf at `path`, or null if any segment is missing. */
export function getFieldAtPath(facts: IssuerFacts, path: FactPath): Field<unknown> | null {
  let current: unknown = facts

  for (const token of parsePath(path)) {
    if (current === null || current === undefined || typeof current !== 'object') return null

    if (token.kind === 'id') {
      if (!Array.isArray(current)) return null
      current = current.find((record) => (record as { id: string }).id === token.id)
    } else {
      current = (current as Record<string, unknown>)[token.key]
    }
  }

  if (current && typeof current === 'object' && 'status' in current && 'value' in current) {
    return current as Field<unknown>
  }
  return null
}

/**
 * Returns a copy of `facts` with the leaf at `path` replaced by `next`.
 *
 * Structurally shares everything off the path and clones only the spine down
 * to the target — which is what makes this safe to apply to a *freshly read*
 * server copy: every field the caller didn't touch keeps whatever value that
 * read contained, including writes a concurrent background extraction landed
 * moments earlier. Throws rather than silently no-op'ing if the path is dead,
 * so a stale record id surfaces as an error instead of a lost edit.
 */
export function setFieldAtPath(
  facts: IssuerFacts,
  path: FactPath,
  next: Field<unknown>,
): IssuerFacts {
  const tokens = parsePath(path)

  function walk(node: unknown, depth: number): unknown {
    const token = tokens[depth]
    const isLast = depth === tokens.length - 1

    if (token.kind === 'id') {
      if (!Array.isArray(node)) {
        throw new Error(`Expected an array of records at "${path}" before id "${token.id}"`)
      }
      const index = node.findIndex((record) => (record as { id: string }).id === token.id)
      if (index === -1) {
        throw new Error(`No record with id "${token.id}" in path "${path}"`)
      }
      const copy = node.slice()
      copy[index] = walk(node[index], depth + 1)
      return copy
    }

    if (node === null || typeof node !== 'object') {
      throw new Error(`Cannot resolve "${token.key}" in path "${path}"`)
    }

    const record = node as Record<string, unknown>
    if (!(token.key in record)) {
      throw new Error(`Unknown field "${token.key}" in path "${path}"`)
    }

    return { ...record, [token.key]: isLast ? next : walk(record[token.key], depth + 1) }
  }

  return walk(facts, 0) as IssuerFacts
}

/**
 * The human-edit transition for a single leaf.
 *
 * `confirmed` accepts what's already there — value and provenance untouched,
 * only the status changes. `edited` replaces the value, so confidence drops
 * to null (per the fact model: confidence is null when human-set) but
 * sourceDocId/sourcePage are deliberately *kept*: the diff trail's whole
 * point is showing "AI said X, sourced from this document at p.14 — you
 * corrected it to Y", which needs the superseded value's origin.
 */
export function applyHumanEdit(
  current: Field<unknown>,
  next: { status: Extract<FieldStatus, 'confirmed' | 'edited'>; value?: unknown },
  now: string,
): Field<unknown> {
  if (next.status === 'confirmed') {
    return { ...current, status: 'confirmed', updatedAt: now }
  }

  return {
    ...current,
    value: next.value ?? null,
    confidence: null,
    status: 'edited',
    updatedAt: now,
  }
}
