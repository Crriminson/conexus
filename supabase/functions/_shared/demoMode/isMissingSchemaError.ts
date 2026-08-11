// DEMO_MODE's read-path fallback (useProject's generated_sections, the
// fact_events audit log, generate-section's persist step) only ever kicks in
// for one specific, narrow condition: the column/table a pending migration
// would add doesn't exist yet. Checking the exact code, not just "any
// error", means DEMO_MODE can't accidentally swallow an unrelated real
// failure (auth, network, RLS) behind a "looks like demo data" fallback.
//
// Two different layers can report this, with two different codes for the
// same underlying condition — verified live against the real project
// (2026-08-11, both still unmigrated): a missing *column* on a table that
// exists (`projects.generated_sections`) surfaces the raw Postgres code,
// 42703 (undefined_column). A missing *table* (`fact_events`) never reaches
// Postgres at all — PostgREST's schema cache doesn't know the table exists
// and reports its own code, PGRST205 ("Could not find the table ... in the
// schema cache"), not the Postgres 42P01 undefined_table code a direct SQL
// error would carry. Both are checked; 42P01 is kept too in case a future
// caller ever hits Postgres directly (a raw SQL RPC, for instance) rather
// than going through PostgREST.
export function isMissingSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code
  return code === '42703' || code === '42P01' || code === 'PGRST205'
}
