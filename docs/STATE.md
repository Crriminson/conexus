# State — read this first

A cold session (fresh clone, no prior context) should read this before anything else. `docs/PROGRESS.md` has the full task-by-task history if you need the detail behind any of this; `docs/DECISIONS.md` has the reasoning behind non-obvious calls; `docs/SETUP.md` has everything needed to actually run this.

## What's built and verified

Tasks 1–8 of `docs/ARCHITECTURE.md` section 9 are done: scaffold, fact types (`src/types/facts/`), Supabase schema + client, TanStack Query hooks, upload UI (drag-drop + click, both verified working), the Gemini `extract` Edge Function, the `merge()` pure function (18 passing Vitest tests), and the wiring between all of them.

**Verified live, end-to-end, via the actual UI** (not just curl): upload a document → extraction runs → facts land on the project row with correct `sourceDocId`/confidence/page → a merge event is recorded. Confirmed on a 10-page test PDF.

## What's in flight — READ BEFORE TOUCHING extraction

The extraction pipeline was just rewritten from synchronous to async, and **the rewrite is uncommitted-turned-committed-but-NOT deployed or re-verified as of this file's writing.** Check `git log -1` — if the top commit isn't about async extraction, this section is stale; trust `docs/PROGRESS.md`'s latest entry over this paragraph instead.

**Why it changed:** the synchronous `extract` function reliably timed out at 150.9s wall-clock on a real 13.6MB DRHP (confirmed by direct measurement, not estimated). A throwaway probe function confirmed `EdgeRuntime.waitUntil()` does **not** grant a new time budget — background tasks die at the same ~150s ceiling. So the fix needed to be async (to stop blocking the client) **and** will eventually need chunking (to actually finish large documents) — async alone doesn't solve the underlying ceiling, it just moves where the failure is visible.

**What changed:** `/extract` now returns `202` immediately and does the real work (Gemini call, `merge()`, persist) in a background task. `merge()` relocated to `supabase/functions/_shared/merge/` as the canonical implementation (Deno needs to run it directly now); `src/lib/merge/` is a re-export. Added optimistic concurrency (`projects.version` column + retry loop) since background tasks can race on the same project row. Added a `pg_cron` reaper for anything stuck in `processing`. Client hooks (`useDocuments`, `useProject`) now poll while a document is processing.

## Exact next action

1. `supabase functions deploy extract`
2. `supabase functions delete wallclock-probe` (throwaway probe function — source already removed locally, but it may still be live on the project)
3. Upload a real document through the UI and confirm it goes `pending → processing → complete` (or `failed` with a message) via polling, without you needing to refresh.
4. If it works: proceed to chunking (page-range splits — see open decisions below) or Task 9 (Facts Review screen), whichever you're prioritizing.
5. If it still times out even async: the background task itself is hitting the ceiling on a single huge Gemini call — chunking is no longer optional, it's the next thing to build, not a later optimization.

## Open decisions — need a human call, not yet made

- **Chunking page-range strategy.** Confirmed necessary (see above). Not yet decided: how pages get split (fixed page-count chunks vs. detecting section boundaries first), how many concurrent chunk jobs run per document, and whether chunk results merge in one at a time or need their own batching. `merge()`'s natural-key array matching already supports multiple independent proposers, so the merge side is ready — this is purely an extraction-orchestration design question.
- **`useUpdateFacts` (Task 4) is not version-aware.** It does a blind `.update({facts})` with no optimistic-concurrency check, unlike the extraction path. Not fixed because it currently takes a full-facts replacement with no notion of which field changed — a real fix means changing its call contract to a single field-path patch, which is properly Task 9's (Facts Review screen) concern. Until Task 9 exists, a human edit racing a concurrent background extraction can silently lose the extraction's write to the `facts` column specifically (not `conflicts`/`merge_events`/`version`, which that call doesn't touch). Low probability today (single project, no Task 9 UI yet to trigger it), but don't build Task 9 without addressing this.
