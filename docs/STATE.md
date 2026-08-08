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

## Task 9 — Facts Review screen (built, not yet seen in a browser)

The demo centerpiece per section 9. Built along with its prerequisite:

- **`useUpdateFacts` is now version-aware** — this was the blocking prerequisite, not a side quest. It used to take a whole `IssuerFacts` and blind-`.update({facts})`, so a human edit submitted mid-extraction overwrote the column with a copy read before that extraction merged, silently discarding it. Chunking widened that window to 15+ minutes, and the Review screen is exactly where humans edit during one. Contract is now a **single field-path patch**; each attempt re-reads the row, applies only that field to the fresh copy, and writes conditioned on `version` (same CAS the extract function uses), retrying on conflict. `useResolveConflict` uses the identical discipline since it also writes `facts`.
- **Path grammar is load-bearing and shared.** `merge()` emits `domain[recordId].field` into `MergeEvent.fieldsWritten` and `FactConflict.fieldPath`, both persisted. `src/lib/facts/fieldPath.ts` parses exactly that grammar; conflict resolution feeds `conflict.fieldPath` straight through it. If the two ever drift, array-field conflicts silently stop resolving and the diff trail goes blank — there's a test pinning this (`path grammar agrees with merge()`), and it was verified against real persisted data, not just fixtures.
- **Screen** (`src/features/review/`): domains grouped and explicitly ordered; amber highlight below 0.5 confidence (section 4's threshold, which merge() deliberately doesn't branch on); click source → signed URL opened at `#page=N`; click-to-edit inline; Confirm per field; conflict badges with side-by-side Keep current / Accept proposed showing both sources; per-field diff trail assembled from merge events (writes *and* skips — "another document agreed, we kept yours" is the reassurance a reviewer wants).
- Accepting a proposed value marks the field `edited`, not `ai`, so a later extraction proposing something else raises a fresh conflict instead of silently overwriting a human decision.

**Not yet verified in a real browser** — this session's sandbox can't reach external hosts from Chromium (see environment notes below), so the screen has a clean `tsc`/`vitest`/`vite build` and its path grammar checked against live data, but nobody has clicked it. First thing to do next session: run `npm run dev`, open `/project` → Facts Review, and exercise confirm / edit / source-link / conflict resolution against the real extracted facts.

## Exact next action

1. **Open the Facts Review screen in a real browser and use it.** `npm run dev` → `/project` → Facts Review tab. Exercise confirm, inline edit, source link (should open the chunk PDF at the cited page), and — if any exist — conflict resolution. This is the one thing built this session that no human has actually looked at, and it's the demo centerpiece.
2. **Finish the stalled extraction when Gemini quota allows.** Document `9c87d13e-32a1-417b-8c79-125c6823f5ee` is at 19/26. Just re-invoke `/extract` with its id — it resumes at chunk 20, no re-extraction cost. That fills in the remaining ~7 chunks of facts.
3. Then continue the roadmap: Task 10 (`src/lib/eligibility/`) or Task 11 (`src/lib/templates/`).

A conflict has never actually been observed end-to-end, because conflicts only raise against `confirmed`/`edited` fields and nothing had been confirmed until this screen existed. To see the conflict UI work: confirm a field, then re-run extraction on a document that proposes a different value for it.

## Open items — noted, not acted on

These are known and deliberately parked. Don't treat them as bugs to fix on sight; they need a human call or an external unblock.

1. **Gemini quota is the hard blocker on full extraction — now precisely diagnosed.** The 429 body names the exact limit: `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier, quotaValue: 20`. The free tier allows **20 `gemini-2.5-flash` requests per calendar day, total** — a 26-chunk document cannot complete in one day on this plan regardless of retry/backoff logic. Confirmed resume works correctly: a retry picked up at chunk 19 (not 0), got exactly one more chunk through to 20, then hit the identical daily cap. Nothing left to fix in code — needs either a day's wait (quota resets daily) or billing enabled on the key. Don't spend further Gemini calls testing this today; the finding is already conclusive.
2. **Possible over-extraction on promoters / related parties.** The 19-chunk run produced 15 promoters and 78 related-party transactions, some sparse (`din`/`panOrId` null, name sourced to p.1). That's high enough to suspect the prompt is over-eager or that natural-key matching isn't collapsing records that should be one. It's an extraction-accuracy question, not a pipeline bug — the Review screen now surfaces exactly this, so judge it there before changing the prompt.
3. **Test artifacts still in the project.** The e2e runs left `documents` rows and ~26 chunk objects per run under `e2e-test/` in Storage, plus the facts they merged into the singleton project. Fine for now (they're what makes the Review screen non-empty), but they are not a curated demo dataset — Task 15 will want a clean one.

## Open decisions — need a human call, not yet made

- *(none currently — chunking strategy and the `useUpdateFacts` concurrency fix are both resolved; see below.)*

## Environment notes for whoever runs this next

- **Supabase CLI may not work through a proxied sandbox.** In this session, `supabase` (Node/undici-based CLI) could not get a transport through the session's HTTP proxy — `Transport error` on every management call — even though plain `curl` through the identical proxy worked fine, and even with `NODE_USE_ENV_PROXY=1` set. Worked around it entirely via the Supabase **Management REST API** (`api.supabase.com/v1/projects/{ref}/...`) over curl: same deploy, same secrets/migration checks, same result. If you hit the same wall, don't burn time on the CLI — the REST API does everything `functions deploy`/`db push`/`secrets list` do.
- **A headless Chromium in this sandbox could not reach any external host through the session's proxy**, `api.supabase.com` included, even with `proxy: {server: ...}` passed explicitly to Playwright's `launch()` — while the same proxy served `curl` and the Node CLI's own HTTPS calls fine. Root cause not chased down (out of scope, timeboxed). If you need to verify through the actual browser UI in a similar sandboxed session, expect this to bite you; driving the same REST/Storage/Functions calls directly with curl was the workaround used here.
