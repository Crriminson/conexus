// DEMO_MODE's read-path fallback (useProject's generated_sections, the
// fact_events audit log, generate-section's persist step) only ever kicks in
// for one specific, narrow condition: the column/table a pending migration
// would add doesn't exist yet. Postgres/PostgREST report that as a fixed
// error code — 42703 (undefined_column) or 42P01 (undefined_table) — never
// anything broader. Checking the exact code, not just "any error", means
// DEMO_MODE can't accidentally swallow an unrelated real failure (auth,
// network, RLS) behind a "looks like demo data" fallback.
export function isMissingSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code
  return code === '42703' || code === '42P01'
}
