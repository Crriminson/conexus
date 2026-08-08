# State — read this first

A cold session (fresh clone, no prior context) should read this before anything else. `docs/PROGRESS.md` has the full task-by-task history if you need the detail behind any of this; `docs/DECISIONS.md` has the reasoning behind non-obvious calls; `docs/SETUP.md` has everything needed to actually run this.

## What's built and verified

Tasks 1–8 of `docs/ARCHITECTURE.md` section 9 are done: scaffold, fact types (`src/types/facts/`), Supabase schema + client, TanStack Query hooks, upload UI (drag-drop + click, both verified working), the Gemini `extract` Edge Function, the `merge()` pure function (18 passing Vitest tests), and the wiring between all of them.

**Verified live, end-to-end, via the actual UI** (not just curl): upload a document → extraction runs → facts land on the project row with correct `sourceDocId`/confidence/page → a merge event is recorded. Confirmed on a 10-page test PDF.

**Async extraction is deployed and verified.** `/extract` returns `202` immediately (confirmed: 1.27s) and does the real work — Gemini call, `merge()`, persist — in a background task via `EdgeRuntime.waitUntil()`. Optimistic concurrency (`projects.version` + retry loop), the `pg_cron` reaper, and the three-layer failure handling (in-process catch → `beforeunload` best-effort PATCH → reaper backstop) are all live on the project (`fvtazfdppcajoglteutz`) and were exercised for real, not just read from code.

## What's in flight — READ BEFORE TOUCHING extraction

**Async unblocked the client but did not raise the wall-clock ceiling.** Verified end-to-end against the real 8.35MB DRHP: `POST /extract` returns 202 in ~1s, then the background task runs for **145s** and the document flips to `failed` with `"Edge function terminated (wall clock exceeded)"`. Layer 2 (`beforeunload`) caught it before the reaper had to. `projects.version` and `merge_events` were both unchanged afterward — the "a failed extraction writes nothing" guarantee held.

**Conclusion: chunking is no longer optional.** Real DRHPs (200–400 pages) cannot be extracted in a single Gemini call regardless of sync/async — the ceiling is per-invocation wall-clock, not blocked-client time.

**Chunking strategy is now decided** (was open, human call made 2026-08-08):
1. **Fixed page-count splits**, 20 pages/chunk. Not section-boundary detection — that's its own unsolved extraction problem on an unstructured 400-page filing; fixed ranges need no intelligence and are deterministic.
2. **Sequential per document**, not concurrent chunk jobs. No contention to handle; ~20 chunks × ~60s is fine for one-time preprocessing.
3. **Merge each chunk immediately after it completes**, not batched at the end. A failed chunk shouldn't lose the whole document's already-merged work, and it gives the UI a real progress signal to show.

**Timeboxed.** If full chunking isn't working within a couple hours of when this was started, the fallback is a capped version instead: extract up to ~100 pages in one call, documents larger than that ask the user to split the upload — then move on to Task 9 regardless.

## Exact next action

1. Build chunking per the three decisions above, in `supabase/functions/extract/`. Split the source PDF into 20-page sub-documents (in-memory, e.g. via `pdf-lib`), extract each sequentially, remap each chunk's `sourcePage` back to the original document's page numbers before merging, merge immediately after each chunk completes (reusing the existing read-merge-write optimistic-concurrency loop), and track per-document progress (needs new columns — something like `extraction_total_chunks`/`extraction_completed_chunks`) so the UI can show real progress later.
2. Deploy and re-verify on the real DRHP the same way this round was verified — via direct API calls if the browser-through-proxy limitation noted below is still in effect, otherwise via the actual UI.
3. If the couple-hour timebox is hit first: fall back to the capped-at-~100-pages version, ship that, move to Task 9 (Facts Review screen) instead.

## Open decisions — need a human call, not yet made

- **`useUpdateFacts` (Task 4) is not version-aware.** It does a blind `.update({facts})` with no optimistic-concurrency check, unlike the extraction path. Not fixed because it currently takes a full-facts replacement with no notion of which field changed — a real fix means changing its call contract to a single field-path patch, which is properly Task 9's (Facts Review screen) concern. Until Task 9 exists, a human edit racing a concurrent background extraction can silently lose the extraction's write to the `facts` column specifically (not `conflicts`/`merge_events`/`version`, which that call doesn't touch). Chunking makes this more likely to matter sooner, since a chunked extraction now holds a document in `processing` for several minutes instead of ~1, widening the race window — still not fixed here, but don't build Task 9 without addressing this.

## Environment notes for whoever runs this next

- **Supabase CLI may not work through a proxied sandbox.** In this session, `supabase` (Node/undici-based CLI) could not get a transport through the session's HTTP proxy — `Transport error` on every management call — even though plain `curl` through the identical proxy worked fine, and even with `NODE_USE_ENV_PROXY=1` set. Worked around it entirely via the Supabase **Management REST API** (`api.supabase.com/v1/projects/{ref}/...`) over curl: same deploy, same secrets/migration checks, same result. If you hit the same wall, don't burn time on the CLI — the REST API does everything `functions deploy`/`db push`/`secrets list` do.
- **A headless Chromium in this sandbox could not reach any external host through the session's proxy**, `api.supabase.com` included, even with `proxy: {server: ...}` passed explicitly to Playwright's `launch()` — while the same proxy served `curl` and the Node CLI's own HTTPS calls fine. Root cause not chased down (out of scope, timeboxed). If you need to verify through the actual browser UI in a similar sandboxed session, expect this to bite you; driving the same REST/Storage/Functions calls directly with curl was the workaround used here.
