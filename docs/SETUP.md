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

Additionally, `GEMINI_API_KEY` must be set as a **Supabase secret** (not a repo env var — it's only used server-side by the edge function):
```bash
supabase secrets set GEMINI_API_KEY=your-key-here
```
Get a key from https://ai.google.dev/. Verify it's set with `supabase secrets list` after linking (below).

## Migrations

Apply in order — either via the Supabase SQL Editor (paste each file's contents) or via `psql` against the project's direct connection string (Dashboard → Settings → Database):

```
supabase/migrations/20260801000000_init_schema.sql          -- projects, documents tables
supabase/migrations/20260802000000_documents_bucket_policies.sql  -- storage RLS (needs the bucket to exist first, see below)
supabase/migrations/20260803000000_add_merge_events.sql     -- projects.merge_events
supabase/migrations/20260804000000_async_extraction.sql     -- documents.extraction_started_at/extraction_error, projects.version
supabase/migrations/20260804000001_reaper.sql                -- pg_cron reaper for stuck extractions
```

Note: `supabase db push` (CLI) is the normal way to do this once linked, but wasn't reliably usable in this project's history due to CLI/environment quirks — direct `psql` against the connection string was used instead and is known to work. Either should be fine on a clean setup.

## Storage bucket

Create a bucket named `documents` (Dashboard → Storage → New bucket), **private** (not public). Do this *before* applying `20260802000000_documents_bucket_policies.sql`, since that migration adds RLS policies scoped to `bucket_id = 'documents'`.

## Deploying edge functions

```bash
supabase login                              # opens a browser OAuth flow
supabase link --project-ref fvtazfdppcajoglteutz   # will prompt for the DB password
supabase functions deploy extract
```

Edge function logs: this CLI version has no `logs` subcommand — use the Dashboard (Project → Edge Functions → `extract` → Logs tab) instead.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest run — merge() unit tests, no network/DB needed
npm run build       # tsc -b && vite build
```

The app is a single route (`/project`) with no login/multi-project flow — it fetches or creates one singleton "Demo Issuer" project on load.
