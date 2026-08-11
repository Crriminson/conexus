# Setup — running this from a fresh clone

## Prerequisites
- Node.js (v18+) and npm
- Supabase CLI (`npm install -g supabase`)
- A Supabase project — see below for which one, or create your own

## Supabase project

Current project ref: `fvtazfdppcajoglteutz`. (An earlier project, `qghdelmrdnnznsqyisbm`, is NOT this app — it's the old pre-rebuild Next.js/Prisma app's database and should be ignored.)

If you don't have access to `fvtazfdppcajoglteutz` and need a fresh project instead, create one in the Supabase dashboard, then adjust the steps below accordingly (a fresh project needs everything from "Migrations" onward; an existing one you have access to may already have some of it).

## Environment variables

Create `.env` at the repo root (gitignored — not in the repo, must be created manually). Names only, get values from Supabase dashboard → Settings → API:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_STORAGE_BUCKET=
```

`VITE_SUPABASE_STORAGE_BUCKET` should be `documents` if using the existing project (see Storage bucket below).

Additionally, the `extract` Edge Function's LLM provider is set via **Supabase secrets** (not repo env vars — server-side only). As of the pluggable-provider refactor (2026-08-09, `supabase/functions/_shared/llm/`), provider choice, model, and endpoint are all config:

```bash
supabase secrets set GEMINI_API_KEY=your-key-here    # required if LLM_PROVIDER is gemini or unset
# optional — all default to the values below if unset:
supabase secrets set LLM_PROVIDER=gemini              # or "mock" for a no-network, no-quota-cost stand-in
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
supabase secrets set GEMINI_BASE_URL=https://generativelanguage.googleapis.com
```
Get a Gemini key from https://ai.google.dev/. Verify secrets are set with `supabase secrets list` after linking (below). `LLM_PROVIDER=mock` is useful for exercising the upload → extract → merge pipeline end-to-end without spending Gemini's free-tier daily quota (see `docs/DECISIONS.md`, "LLM provider abstraction") — it returns a valid-shape empty-facts response rather than calling any real API.

## Migrations

Apply in order — either via the Supabase SQL Editor (paste each file's contents) or via `psql` against the project's direct connection string (Dashboard → Settings → Database):

```
supabase/migrations/20260801000000_init_schema.sql          -- projects, documents tables
supabase/migrations/20260802000000_documents_bucket_policies.sql  -- storage RLS (needs the bucket to exist first, see below)
supabase/migrations/20260803000000_add_merge_events.sql     -- projects.merge_events
supabase/migrations/20260804000000_async_extraction.sql     -- documents.extraction_started_at/extraction_error, projects.version
supabase/migrations/20260804000001_reaper.sql                -- pg_cron reaper for stuck extractions
supabase/migrations/20260808000000_extraction_chunk_progress.sql  -- documents.extraction_total_chunks/extraction_completed_chunks
supabase/migrations/20260808000100_document_chunk_plan.sql   -- documents.chunk_plan (client-side chunking)
supabase/migrations/20260810000000_generated_sections.sql    -- projects.generated_sections (Task 12 narrative sections)
supabase/migrations/20260811000000_fact_events.sql           -- fact_events table (audit trail)
```

**As of 2026-08-11, neither of the last two migrations above (`generated_sections`, `fact_events`) has been applied to the live `fvtazfdppcajoglteutz` project** — every session since Task 12 has only had the anon key, which can't run DDL. Someone with DB/Management access needs to apply both before Task 12's Edge Function and the audit trail work against live data. Check `select generated_sections from projects limit 1;` (unknown-column error → not applied) and `select 1 from fact_events limit 1;` (undefined-table error → not applied).

**`fact_events` also needs the `extract` Edge Function redeployed once the migration lands** — `supabase/functions/extract/index.ts` now writes to this table after every merge. This is safe to deploy *before* the migration too: `recordFactEvents` is deliberately best-effort (see `docs/DECISIONS.md`), so a missing table logs a console error and does not block extraction — but the audit trail obviously won't have any rows until both are done.

Note: `supabase db push` (CLI) is the normal way to do this once linked, but wasn't reliably usable in this project's history due to CLI/environment quirks — direct `psql` against the connection string was used instead and is known to work. Either should be fine on a clean setup.

## Storage bucket

Create a bucket named `documents` (Dashboard → Storage → New bucket), **private** (not public). Do this *before* applying `20260802000000_documents_bucket_policies.sql`, since that migration adds RLS policies scoped to `bucket_id = 'documents'`.

## Deploying edge functions

```bash
supabase login                              # opens a browser OAuth flow
supabase link --project-ref fvtazfdppcajoglteutz   # will prompt for the DB password
supabase functions deploy extract
supabase functions deploy generate-section   # Task 12 — also NOT yet deployed as of 2026-08-10, same reason as the migration above
```

Edge function logs: this CLI version has no `logs` subcommand — use the Dashboard (Project → Edge Functions → `<function-name>` → Logs tab) instead.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest run — pure-function unit tests (merge, fieldPath, eligibility, templates, export, the LLM provider abstraction, generate-section's fact-collection/prompt/citation logic), no network/DB needed
npm run build       # tsc -b && vite build
```

The app is a single route (`/project`) with no login/multi-project flow — it fetches or creates one singleton "Demo Issuer" project on load.

## Seeding/wiping test data directly in Supabase

For browser-checking screens against realistic data without running (and paying for) real extraction, facts can be seeded directly into `projects.facts` via the PostgREST API (same version-conditioned PATCH the app itself uses — see `docs/PROGRESS.md`'s "Step 2 — live-data seed" entry for a worked example). **Always track exactly what was seeded and clean it up afterward** — this project had a real contamination incident from stray test data (`docs/DECISIONS.md`, "Task 11 built ahead of a clean confirmed dataset"). `scripts/teardown-seed-data.sh` is the teardown for the current seed; if you seed something new, write (or extend) a teardown alongside it rather than leaving data behind.
