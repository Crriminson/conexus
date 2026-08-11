// Read-only counterpart of src/lib/facts/fieldPath.ts's getFieldAtPath,
// duplicated across the runtime boundary for the same reason factsTypes.ts
// duplicates IssuerFacts's shape (see merge.ts's header comment): Deno edge
// functions can't resolve the frontend's `@/types/facts` path alias, so a
// structurally-identical mirror is this codebase's established way of
// crossing that boundary. Narrower than the original on purpose — this only
// ever reads a value at a path merge() already produced, never writes one,
// so the write-side half of fieldPath.ts (setFieldAtPath/applyHumanEdit) has
// no counterpart here. If the path grammar in fieldPath.ts ever changes,
// this must change with it — same caveat fieldPath.ts's own header already
// states about merge()/conflict resolution needing to agree.
export function getFactValue(facts: unknown, path: string): unknown {
  let current: unknown = facts

  for (const segment of path.split('.')) {
    const bracketed = segment.match(/^([^[\]]+)\[([^\]]+)\]$/)
    const key = bracketed ? bracketed[1] : segment
    const id = bracketed ? bracketed[2] : null

    if (current === null || current === undefined || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]

    if (id !== null) {
      if (!Array.isArray(current)) return null
      current = current.find((record) => (record as { id: string }).id === id) ?? null
    }
  }

  if (current && typeof current === 'object' && 'status' in current && 'value' in current) {
    return (current as { value: unknown }).value
  }
  return null
}
