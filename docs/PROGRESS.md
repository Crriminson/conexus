# Progress Log

Read this before re-explaining anything. One entry per task: what was built/decided, files touched, what's still open.

---

## Task 1 — Scaffold
Vite + React + TS + Tailwind + shadcn + wouter. Single route `/project`, no sidebar, no extra routes.
**Files:** `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/components/ui/button.tsx`.
**Outstanding:** `CLAUDE.md`'s stack line still lists Zustand + Framer Motion; `docs/ARCHITECTURE.md` explicitly drops both in favor of TanStack Query. Never reconciled — CLAUDE.md needs a manual update.

## Task 2 — Fact types
`src/types/facts/`: `Field<T>` envelope + `FieldStatus`, six domain files (company, financials, promoters, capitalStructure, litigation, relatedParties), composite `IssuerFacts`. Repeating groups (promoters/litigation/relatedParties) are arrays of `{id} & Field<T>` records; the other three are flat.
**Files:** `src/types/facts/*.ts`.
**Outstanding:** none.

## Task 3 — Supabase client + schema
`src/lib/supabase.ts` (env-driven, no hardcoded keys), migration creating `projects(id, name, facts jsonb, conflicts jsonb)` and `documents(id, project_id, filename, storage_path, extraction_status)`.
**Decision:** discovered the original Supabase project (`qghdelmrdnnznsqyisbm`) was the old Next.js/Prisma app's live DB, still holding its full legacy schema (`Project`, `Document`, 15 other tables). Switched to a fresh project (`fvtazfdppcajoglteutz`) instead of cleaning up the old one. Storage bucket `documents` created (private) with anon insert/select RLS policies.
**Files:** `src/lib/supabase.ts`, `.env.example`, `supabase/migrations/20260801000000_init_schema.sql`, `supabase/migrations/20260802000000_documents_bucket_policies.sql`.
**Outstanding:** none.

## Task 4 — TanStack Query hooks
`useProject`, `useDocuments`, `useUpdateFacts` (optimistic update + rollback). `main.tsx` wired with `QueryClientProvider` (unavoidable cross-phase touch).
**Files:** `src/hooks/useProject.ts`, `useDocuments.ts`, `useUpdateFacts.ts`, `src/main.tsx`.
**Outstanding:** none.

## Task 5 — Upload UI
Drag-drop + click-to-browse + status list, uploads to Storage then inserts a `documents` row.
**Bug found & fixed:** hidden `<input>` click bubbled to the drop zone's `onClick`, firing `input.click()` twice per interaction (could double-open the file dialog). Fixed with `stopPropagation`.
**Necessary addition:** `useEnsureProject` — roadmap is explicitly single-project ("one project, deep," no create-flow task exists), so something has to supply a `projectId`. Fetches or creates a singleton "Demo Issuer" row.
**Files:** `src/features/upload/UploadPanel.tsx`, `src/hooks/useUploadDocument.ts`, `src/hooks/useEnsureProject.ts`.
**Outstanding:** (later found in Task 8) `useEnsureProject` inserted `facts: {}` instead of a real empty `IssuerFacts` skeleton — fixed then, noted here for the record.

## Task 6 — Extract Edge Function
`callLLM()` seam (Gemini 2.5 Flash) + `extract` Edge Function: downloads document from Storage, sends to Gemini with the six-domain schema, defensively parses/coerces the response (never guesses — missing fields default to `{value: null, confidence: null, sourcePage: null}`).
**The timeout saga:**
1. Naive base64 encoding (`String.fromCharCode` loop) on the 13.6MB test PDF → `WORKER_RESOURCE_LIMIT`.
2. Swapped to `@std/encoding`'s `encodeBase64` → still failed. Root cause wasn't the encoding algorithm, it was holding the ~18MB base64 string + its JSON.stringify copy in memory at once.
3. Swapped inline base64 → Gemini **Files API** (raw-byte upload, referenced by URI) in `callLLM.ts` → got further (upload + polling succeeded, reached `generateContent`) but still hit `WORKER_RESOURCE_LIMIT` on retry.
4. Pulled function logs: `"reason": "WallClockTime", 26MB memory, 76ms CPU` — **not a memory problem at all**, a hard execution-time ceiling.
5. Confirmed directly: full 13.6MB DRHP times out at **150.9s wall clock**, consistently, via `curl -w time_total`.
6. **Plan approved, not yet built:** async pattern — `/extract` validates and returns `202` immediately, `EdgeRuntime.waitUntil()` runs the actual Gemini call + merge + persist in the background. Client polls via `refetchInterval`. If a background task itself can still exceed the wall clock (unverified — a probe function was designed to test this but **not yet deployed**), full 400-page DRHPs will also need deterministic page-range chunking (not RAG — no embeddings/retrieval, just splitting into independent extract jobs that each merge in via the existing conflict machinery). A `pg_cron` reaper will flip anything stuck in `processing` past a timeout to `failed`, since a hard-killed worker can't be trusted to clean up after itself.
**Files:** `supabase/functions/_shared/callLLM.ts`, `supabase/functions/extract/index.ts`.
**Outstanding:** wall-clock probe not written. Async+chunking not built. A known lost-update race also surfaced during this design discussion: concurrent merges into the same project row have no locking — becomes near-certain once chunking makes extraction concurrent. Needs `select ... for update` or an optimistic version column before chunking lands.

## Task 7 — merge() pure function
`merge(existing, extracted, deps?) → {facts, conflicts, event}` in `src/lib/merge/`. Implements section 4 exactly: status-precedence table, natural-key array matching (never array position), never-delete on unmatched existing records, no numeric coercion, no mutation of `existing`. `deps` (`now`/`generateId`) is the one deliberate deviation from the literal two-arg signature, added for deterministic tests.
**Files:** `src/lib/merge/types.ts`, `merge.ts`, `merge.test.ts` (18 Vitest tests, all passing). Added `vitest` + `npm test` script (no test runner existed before).
**Outstanding:** per the Task 6 async plan, this will relocate to `supabase/functions/_shared/merge/` as the canonical implementation, with `src/lib/merge/` becoming a re-export — needed because Deno can't resolve the `@/` alias or extensionless imports the Vite side uses. Acceptance criterion when that happens: all 18 tests pass unchanged.

## Task 8 — Wire upload → extract → merge() → persist
`useRunExtraction`: sets `processing` → invokes `extract` → fetches current project → `merge()` → one atomic `.update()` writing `facts`+`conflicts`+`merge_events` together → sets `complete`/`failed`. Auto-triggers after upload; manual "Extract"/"Retry" button added for pending/failed rows.
**Schema addition:** `projects.merge_events jsonb` — Task 3's schema had nowhere to store section 4's provenance log.
**Bug found & fixed:** `useEnsureProject` (Task 5) created projects with `facts: {}` (bare SQL default), not a real empty `IssuerFacts` skeleton — would throw inside `merge()` on first use. Added `src/types/facts/empty.ts`, fixed the insert, backfilled the one live project row that already had it.
**Verified end-to-end live** (UI click, not just curl): 10-page test PDF → `pending → processing → complete`, 8 fields written with correct `sourceDocId`/confidence, 1 merge event, 0 conflicts (first-ever merge, nothing to conflict with).
**Then stress-tested per explicit request:** full 13.6MB DRHP through the same pipeline → confirmed the 150.9s wall-clock timeout from Task 6's saga reproduces on the real file, not just a synthetic case.
**Files:** `src/hooks/useRunExtraction.ts`, `supabase/migrations/20260803000000_add_merge_events.sql`, `src/hooks/useProject.ts` + `useUpdateFacts.ts` (added `merge_events`, tightened `conflicts` to `FactConflict[]`), `src/types/facts/empty.ts`, `src/hooks/useEnsureProject.ts`, `src/features/upload/UploadPanel.tsx`.
**Outstanding:** everything listed under Task 6's saga (async/chunking/reaper/probe/lost-update race) — this task's pipeline works correctly but only within the 150s ceiling.

## Task 6/8 rework — async extraction + optimistic concurrency
Deployed a throwaway `wallclock-probe` function to test whether `EdgeRuntime.waitUntil()` grants a fresh time budget. **Result: no.** Logs showed `"reason": "WallClockTime"`, never `SURVIVED` — background tasks die at the same ~150s ceiling as a normal request. Async alone is insufficient; chunking is still needed for real 200-400 page DRHPs. Probe deleted (source and, pending your confirmation, the deployed function).

**Built anyway, since async is still required before chunking has anywhere to land:**
- `/extract` now validates + atomically claims the document (single conditional `.update().neq('extraction_status','processing')`, closing a TOCTOU race a naive check-then-write would have had), returns `202` immediately, and runs the actual Gemini call + merge + persist in `EdgeRuntime.waitUntil()`.
- **merge() relocated**: canonical implementation is now `supabase/functions/_shared/merge/{types.ts,merge.ts}` (Deno needs to run it directly now that persistence happens server-side). `src/lib/merge/` is a thin re-export. Zero logic changes — all 18 Vitest tests pass unchanged against the relocated code, which was the acceptance bar.
- **Type-sharing caveat**: Deno can't resolve the `@/` alias or extensionless imports, so `supabase/functions/_shared/factsTypes.ts` is a structural mirror of `src/types/facts`'s `Field`/`FieldStatus`/`IssuerFacts`/domain types. Only the *types* are duplicated (TypeScript's structural typing makes them interchangeable) — the merge *logic* stays single-sourced, which was the actual concern raised. If Task 2's fact shape changes, this mirror needs manual updating; nothing enforces that.
- **Optimistic concurrency**: `projects.version` column + compare-and-swap retry loop (up to 5 attempts) in the background task, since concurrent extractions can now race on the same project row (background tasks today, chunked sub-extractions imminently). Each attempt is one atomic `.update()` — never a partial write.
- **Failure handling, three layers**: (1) `try/catch/finally` around the background task marks `documents.failed` + `extraction_error` for ordinary errors; (2) a `beforeunload` listener best-effort-patches any in-flight document to `failed` if the worker gets killed (opportunistic, not guaranteed — may not complete before the isolate dies); (3) a `pg_cron` job (`reap-stuck-extractions`, runs every minute) flips anything stuck in `processing` past 5 minutes to `failed` — the only actual guarantee, since nothing inside a hard-killed worker can be trusted to clean up after itself. Confirmed the cron job is registered and active.
- **Client-side**: `useRunExtraction` shrank to just invoking the function and returning — no more client-side merge/persist. `useDocuments` and `useProject` now poll (`refetchInterval`, 3s) while any document is `processing`; `useProject`'s polling reads `useDocuments`' cache directly rather than duplicating status tracking. `UploadPanel` surfaces `extraction_error` per failed row.
- **Schema**: `documents.extraction_started_at`, `documents.extraction_error`, `projects.version`.
**Files:** `supabase/functions/extract/index.ts`, `supabase/functions/_shared/factsTypes.ts`, `supabase/functions/_shared/merge/{types.ts,merge.ts}`, `src/lib/merge/{types.ts,merge.ts}` (now re-exports), `src/hooks/useRunExtraction.ts`, `useDocuments.ts`, `useProject.ts`, `useUpdateFacts.ts` (select list only), `src/features/upload/UploadPanel.tsx`, two new migrations.
**Outstanding:**
- **Not yet deployed** — needs `supabase functions deploy extract` and the probe function deleted from the dashboard/CLI.
- **Not yet re-verified end-to-end** post-deploy.
- **`useUpdateFacts` is not version-aware** — still does a blind `.update({facts})`. Deliberately not fixed here: it takes a full-facts replacement with no notion of which field changed, so a real fix means changing its call contract (single field-path patch, not whole-object replacement), which is Task 9's (Facts Review screen) concern, not this one's. Flagging so it isn't mistaken for solved.
- **Chunking not built.** Confirmed necessary for real 200-400 page DRHPs; deterministic page-range splits per section 1's anti-RAG stance, each an independent extract job merging in via the now-concurrency-safe project row.

## Task 6/8 rework — deploy + post-deploy verification

Deployed `extract` (v3 → v4) and deleted `wallclock-probe` via the Supabase **Management REST API** directly (`api.supabase.com/v1/projects/{ref}/functions/deploy`), not the `supabase` CLI — the CLI (Node/undici) could not get a transport through this session's HTTP proxy even with `NODE_USE_ENV_PROXY=1` set, while plain `curl` through the same proxy worked fine. Confirmed via the Management API that migrations `20260804000000`/`20260804000001` (async columns + `pg_cron` reaper) were already applied and `GEMINI_API_KEY` was already set as a secret — nothing left to apply, only the function itself was stale.

**End-to-end verification, direct API (not the browser UI):** Chromium in this session's sandbox cannot reach *any* external host through the session's proxy (`api.supabase.com` included) even though `curl` reaches the same hosts fine — a sandbox/proxy limitation, unrelated to the app. Drove the actual REST/Storage/Functions API calls the client would make instead, timing each step, against the real 8.35MB DRHP.

**Result — async contract holds, ceiling doesn't move:**
- `POST /extract` → **202 in 1.27s** (was: blocks 150.9s then times out). Client is genuinely unblocked now.
- Background task ran for **145s**, then the document flipped to `failed`, error: `"Edge function terminated (wall clock exceeded)"`.
- **Layer 2 caught it, not Layer 3**: the `beforeunload` handler's PATCH landed before the worker died, so the document self-reported `failed` at 145s rather than sitting in `processing` until the `pg_cron` reaper's 5-minute sweep. Reaper never had to fire this time, but remains the only guaranteed backstop.
- **"A failed extraction writes nothing" held**: `projects.version` unchanged (still 0), `merge_events` unchanged — the failed chunk's read-merge-write loop never got far enough to persist anything. Confirmed by checking the one merge event on the project belonged to an unrelated Aug 5 document, not this run.
- Test document row and storage object deleted after the run (`e2e-test/drhp-*.pdf`).

**Conclusion: async moved *where* the failure is visible, not the ceiling itself.** The 8.35MB/large-page-count DRHP still cannot be extracted in one Gemini call. Chunking is now the blocking item, not a later optimization.

**Chunking decisions made (human call, resolving the three open questions from the previous entry):**
1. **Fixed page-count splits** (20 pages/chunk), not section-boundary detection — deterministic, no extra extraction-of-structure problem to solve first.
2. **Sequential per document**, not concurrent chunk jobs — no contention to manage; ~20 chunks × ~60s is acceptable for one-time preprocessing.
3. **Merge each chunk immediately after it completes**, not batched — isolates a failed chunk's damage to just that chunk, and gives the UI a real progress signal.

Timeboxed: if full chunking isn't working within a couple hours, fall back to a capped version (extract up to ~100 pages in one call, larger documents ask the user to split the upload) and move on to Task 9 instead.

## Chunking — built, after a second platform limit forced a redesign

**Attempt 1 (server-side split) failed on a limit nobody had found yet.** Split the PDF with `pdf-lib` inside the extract function; it died in ~2s. Function logs gave the real reason — `"reason": "CPUTime", cpu_time_used: 2001` — a **~2s CPU-time budget, entirely separate from and far stricter than the ~150s wall-clock ceiling** the previous entry was about. Merely `PDFDocument.load()`-ing an 8.35MB/503-page PDF to read its page count exhausted it before any Gemini call. Unfixable by chunking: chunk 0 still has to parse the whole source once.

**Attempt 2 (client-side split) works.** The browser has no CPU budget, so `useUploadDocument` now splits the PDF into 20-page chunks at upload time, uploads each as its own Storage object, and records a `chunk_plan` on the document row. The edge function never touches PDF structure — it downloads an already-chunk-sized file and forwards bytes to Gemini. Each chunk runs in its own invocation via self-triggered continuation (fresh wall-clock budget each), merging immediately on completion.

**Verified end-to-end on the real 503-page DRHP: 19 of 26 chunks merged** before hitting a Gemini daily quota (429 — account limit, not a design failure).

| | single-shot | chunked |
|---|---|---|
| fact leaves filled | 8 / 18 | **523 / 621** |
| promoters / litigation / RPTs | 0 / 0 / 0 | **15 / 23 / 78** |
| `projects.version` | 0 | **19** (one clean bump per chunk) |

`sourcePage` remap verified: facts cite pages 181, 240, 339, 362, 371 — not 1-20, which is what a broken offset would produce. `conflicts: 0` is **correct**, not a gap: per section 4 conflicts only raise against `confirmed`/`edited`, and every field was `ai`. Rising `skipped` counts in later merge events (e.g. `written=39 skipped=50`) show the precedence table working.

**Two gaps the 429 exposed, both fixed:** retry now **resumes from the last merged chunk** instead of restarting at 0 (which would re-burn the quota that just failed it — verified: retry returned `resumedFrom: 19`), and transient 429/5xx now **requeue the same chunk** in a fresh invocation (3 attempts, backoff sleeping inside the retry's own invocation so it can't eat the scheduler's budget) instead of failing the document.

**Files:** `supabase/functions/extract/index.ts` (rewritten twice), `src/hooks/useUploadDocument.ts`, `src/hooks/useDocuments.ts`, `src/features/upload/UploadPanel.tsx`, migrations `20260808000000_extraction_chunk_progress.sql`, `20260808000100_document_chunk_plan.sql`.
**Outstanding:** Gemini quota blocks a clean 26/26; possible over-extraction on promoters/RPTs to judge in the Review screen.

## Task 9 — Facts Review screen (+ the useUpdateFacts concurrency fix)

**Prerequisite first: `useUpdateFacts` is now version-aware.** It took a whole `IssuerFacts` and blind-`.update({facts})`, so a human edit submitted mid-extraction overwrote the column with a copy read *before* that extraction merged — silently discarding it. Chunking widened the window to 15+ minutes and this screen is exactly where humans edit during one. Fixed as the previous entries said it had to be: the contract is now a **single field-path patch**, and each attempt re-reads the row, applies only that field to the fresh copy, and writes conditioned on `version` (`.eq('version', …)`, the same CAS the extract function uses), retrying on mismatch. Untouched fields therefore keep whatever a concurrent merge just wrote. `useResolveConflict` uses identical discipline — it writes `facts` too when a proposal is accepted.

**A real bug caught before shipping:** `merge()` emits paths as `promoters[<id>].name` (bracket form) into `MergeEvent.fieldsWritten` and `FactConflict.fieldPath`, both already persisted. The first draft of `fieldPath.ts` parsed `promoters.<id>.name` — every array-field conflict would have thrown on resolve and the diff trail would have silently shown nothing. Aligned to merge's grammar, pinned with a test (`path grammar agrees with merge()`), and checked against live persisted data: a generated path matched a real `fieldsWritten` entry exactly.

**Built:** `src/lib/facts/fieldPath.ts` (get/set/human-edit, pure, 15 tests), `src/hooks/useUpdateFacts.ts` (rewritten), `useResolveConflict.ts`, `useOpenSource.ts` (signed URL + `#page=N`), `src/features/review/{FactsReview,FieldRow,ConflictCard,DiffTrail}.tsx`, tab nav in `App.tsx`.

Screen covers section 9's list: domains grouped and explicitly ordered, amber below 0.5 confidence, click-source-opens-document-at-page, inline edit, Confirm per field, conflict badges with side-by-side Keep current / Accept proposed both showing sources, and the diff trail from merge events. The trail shows **skips as well as writes** — "another document mentioned this and we kept yours" is the reassurance a reviewer actually wants. Accepting a proposal marks the field `edited`, not `ai`, so a later extraction disagreeing raises a fresh conflict rather than silently overwriting a human decision.

**Outstanding at the time:** 33 tests pass, `tsc` and `vite build` clean, path grammar verified against live data — but nobody had opened this in a browser (this session's Chromium can't reach external hosts through the sandbox proxy). No conflict had been observed end-to-end either, since conflicts require a `confirmed`/`edited` field and nothing was confirmed before this screen existed.

## Task 9 — browser verification (2026-08-09)

Ran `npm run dev` on a real machine (macOS) against the live Supabase project (`fvtazfdppcajoglteutz`) — first human eyes on the Review screen. Clean startup on `localhost:5173`, no build errors, no console errors.

**Documents tab**, for the record at time of check: one document `complete` (`1785756069624-1-10.pdf`), one `pending` with an Extract button, one `failed` at chunk 21/26 with the diagnosed Gemini 429/quota error (`client-split-1786191381363.pdf`, Retry button present), and one older pre-chunking upload `failed: "no chunk_plan"` (`drhp-chunked-1786190400.pdf` — expected, predates client-side chunking, not a bug).

**Facts Review tab — confirmed working against real data:**
- Stats bar: 1 confirmed / 0 edited / 526 from AI / 100 empty. Domain grouping renders (Company section checked in detail: legal name `VERITAS FINANCE LIMITED`, CIN, incorporation date, registered office, industry, business description all populated with confidence badges and clickable source links carrying real page refs, e.g. `client-split-1786191381363.pdf p.181`).
- **Inline edit + status transition verified**: edited `company.legalName`, save succeeded, status flipped `ai → confirmed → edited` across the interaction, stats bar updated in sync (1 confirmed/0 edited → 0 confirmed/1 edited).
- **Diff trail verified as real, not just wired**: history (14 entries) showed the original extraction event, then ~12 `"Also seen in <doc> — kept existing value"` entries from the chunked re-run (timestamped across the actual chunk run), then the human correction, in correct chronological order.
- **Bonus finding**: those "kept existing value" entries are live proof the merge precedence table's no-op branch (same-or-lower-confidence proposal against an already-set field → keep, discard) is firing correctly in production, not just in the 18 `merge()` unit tests. Still unverified: the *differing*-value branch that raises an actual `FactConflict` — needs a confirmed field plus a disagreeing re-extraction, which costs Gemini quota to force.

**Decision arising from this session:** not pursuing Gemini billing tonight. Demo plan is to extract a smaller document (30–50 pages, well inside the free tier's 20 req/day cap) end-to-end instead of finishing the 503-page DRHP, which stays parked at 19/26.

## Pre-Task-11 data check — found the project's facts unusable

Before starting Task 11, pulled the live project's facts to confirm the fields its computed sections need were actually populated. Found two blockers instead: **zero fields were `status: confirmed`** anywhere (526 `ai` / 100 `empty` / 1 `edited`, that one `edited` being the test edit from the Task 9 browser verification), and **the facts were contaminated** — `company.legalName` read "VERITAS FINANCE LIMITED" (an NBFC) while `company.industry` read "Topical Generics Pharmaceuticals" (a pharma classification), meaning two unrelated companies' test documents had merged into the same singleton project.

Checked the document assumed to be the "30–50 page demo doc" (`1785756069624.pdf`, two pending duplicate uploads) — downloaded it and measured **540 pages / 13.6MB**, the same scale as the DRHPs that already exhausted quota, not a small file. Neither pending copy has a `chunk_plan` (`extraction_total_chunks: null`), so neither is extractable as-is with the current chunked `extract` function regardless.

**Actions taken:** wiped `projects.facts`/`conflicts`/`merge_events` back to empty via a CAS-conditioned PATCH (`version` 23→24, using the service-role key fetched via the Management API's `/api-keys` endpoint since the anon key can't write past RLS and the Management API's own SQL-execution endpoint would have worked equally well). Started slicing pages 1–40 out of the 540-page file as a genuine small demo document (mirroring the existing `1785756069624-1-10.pdf` precedent) but **stopped before calling Gemini or finishing the upload** — the quota decision (buy credits vs. commit to a small doc) was still open, and spending quota before that call risked wasting it. No extraction has run since the wipe.

**Decision: don't block the roadmap on the quota call.** Logged in `docs/DECISIONS.md`. Build Tasks 11/13/10 against fixture data now; re-verify against live confirmed facts once the quota decision is made.

## Task 11 — templates

`src/lib/templates/`: `types.ts` (`Section`/`SectionCell`), `shared.ts` (`cellFromField` — the one place `status === 'confirmed'` is checked, strictly, not relaxed to `edited` or `ai`), `staticSections.ts` (Definitions, General Information — fixed placeholder text), `capitalStructure.ts`, `financials.ts`, `shareholding.ts` (three computed-section builders, each returning `status: 'ready' | 'incomplete'` + `missingFieldPaths`), `index.ts` (`assembleSections()`, fixed order: 2 static then 3 computed), `fixtures.ts` (a fully-confirmed, schema-accurate `IssuerFacts` fixture + matching document row, since there's no live confirmed dataset to test against right now).

**Files:** `src/lib/templates/{types,shared,staticSections,capitalStructure,financials,shareholding,index,fixtures}.ts`, `src/lib/templates/templates.test.ts` (9 tests: empty-facts incomplete, partial-confirmed still incomplete, edited-not-confirmed correctly excluded, per-field — not per-record — missing-path tracking on shareholding, section order, and one test against the fixture confirming every computed section reads `ready`).

**Outstanding:** fixture-verified only — no live data has ever passed through this code. Re-verify once real facts are confirmed.

## Task 13 — document view

`src/features/document/DocumentView.tsx`: reads `useProject`, calls `assembleSections(facts)`, renders static sections as prose and computed sections as either a key-value list or a table (auto-detected by row width — shareholding's multi-cell rows render as a table, capital structure/financials' single-cell rows render as a list), each row/cell carrying a live source link via `useOpenSource` (same signed-URL-at-page pattern as Task 9) and each section carrying a `Ready`/`Incomplete — N pending` status badge. Wired into `App.tsx` as a third "Document" tab.

**Files:** `src/features/document/DocumentView.tsx`, `src/App.tsx` (added tab).

**Outstanding:** same as Task 11 — `tsc`/`vitest`/`vite build` clean, renders correctly against the fixture logically (verified via Task 11's fixture test, since `DocumentView` is a thin render of `assembleSections()`'s output), but the component itself has never been opened in a browser, fixture or live. No component-testing infrastructure exists in this codebase (all tests so far are pure-function) — consistent with how Task 9's screen was verified (a human, not an automated render test), that's what real verification here will require too.

## Task 10 — eligibility engine

`src/lib/eligibility/`: `types.ts` (`EligibilityStatus`, `EligibilityBasis`, `EligibilityRuleResult`, `EligibilityReport`), `rules.ts` (6 pure rule functions + a `RULES` config array — net worth positive, profitable, minimum 20% promoter contribution, capital structure consistency, no pending material litigation, CIN format), `evaluate.ts` (`evaluateEligibility()`, worst-of aggregation: fail > warning > unknown > pass), `index.ts` re-exports. `src/features/eligibility/EligibilityCard.tsx` renders the traffic light + per-rule detail list; wired into `DocumentView` above the assembled sections.

**Deliberate design choice, different from Task 11:** this engine reads whatever value is present regardless of `status` (not confirmed-only) — it's meant as a live signal that updates as extraction happens, not a gate on what gets assembled or exported. Every result carries `basis: 'confirmed' | 'unconfirmed' | 'missing'` so a green light backed only by unreviewed AI output is visibly distinguishable (a small "AI-only, unconfirmed" badge) from one backed by confirmed data. This was a judgment call, not dictated by the architecture doc (which only specifies "deterministic rules + traffic-light card"), flagged here in case it should be reconsidered.

Two rules got extra care because their naive version would have been wrong:
- **Minimum promoter contribution (20%)** distinguishes "known holdings already clear 20%, so it doesn't matter that other promoters are still unconfirmed" (→ `pass`) from "known holdings fall short and some promoters are still unconfirmed, so the true total isn't knowable yet" (→ `unknown`, deliberately not `fail`) — both branches are pinned with tests, since collapsing them would either wrongly fail a company that's actually fine or wrongly pass one that isn't.
- **Profitable** warns rather than fails on a loss — the schema only holds one year of financials, nowhere near the multi-year distributable-profits track record real SEBI ICDR eligibility rules actually require, so failing outright would overclaim precision this data doesn't support.

**Files:** `src/lib/eligibility/{types,rules,evaluate,index}.ts`, `src/lib/eligibility/eligibility.test.ts` (17 tests), `src/features/eligibility/EligibilityCard.tsx`, `src/features/document/DocumentView.tsx` (wired), `src/lib/templates/fixtures.ts` (added a litigation record — the fixture was missing one, which the fixture-consistency test caught immediately).

**Outstanding:** fixture-verified only, same as Tasks 11 and 13 — never run against real Supabase data or seen in a browser. Zero Gemini dependency means this one has no further blocker once real confirmed data exists; it'll just work.

## Task 14 — export to Markdown

`src/lib/export/`: `gate.ts` (`checkExportGate(facts)` — reuses Task 11's `assembleSections()` and blocks unless every computed section is `ready`, so the export gate and the Document tab's status badges can never disagree), `markdown.ts` (`buildExportMarkdown(facts, documents)` — renders static sections as prose, flat computed sections as a key-value list with inline `(source: filename, p.N)` citations, repeating-group sections as a real Markdown table with a Source column; `exportFilename(facts)` slugifies the confirmed legal name, falling back to a generic name), `disclaimer.ts` (`LIABILITY_DISCLAIMER`), `download.ts` (`downloadMarkdownFile()` — Blob + object-URL + anchor-click, same untested-DOM-one-liner treatment as `useOpenSource`), `index.ts` (`exportProjectMarkdown()` combining gate + render, throwing `ExportNotAllowedError` with the missing field paths attached rather than ever returning partial output). `src/features/export/ExportButton.tsx` is wired into the top of the Document tab beside the eligibility card — disabled with a "N field(s) not confirmed yet" message when the gate fails.

**The disclaimer text is a flagged placeholder, not the real thing.** ARCHITECTURE.md calls for "the verbatim liability disclaimer" but never actually specifies the wording anywhere in the repo (checked STATE.md/PROGRESS.md/DECISIONS.md — nothing). Rather than invent legal text and call it verbatim, asked the user directly; agreed to ship clearly-marked placeholder copy (same `[Placeholder ... — not reviewed legal text.]` convention as Task 11's static sections) and log the gap. See `docs/DECISIONS.md` — this needs real legal text before it's a real deliverable, not just a someday cleanup.

Also refactored `isTable()` out of `DocumentView.tsx` into `src/lib/templates/shared.ts` (re-exported from `src/lib/templates/index.ts`) so Task 13's on-screen rendering and Task 14's Markdown rendering agree on which sections are tables from one shared source, rather than two copies of the same row-shape check drifting apart.

**Files:** `src/lib/export/{disclaimer,gate,markdown,download,index}.ts`, `src/lib/export/export.test.ts` (15 tests), `src/features/export/ExportButton.tsx`, `src/features/document/DocumentView.tsx` (wired, `isTable` now imported not redefined), `src/lib/templates/shared.ts` + `index.ts` (added shared `isTable`).

**Outstanding:** fixture-verified only, same caveat as Tasks 10/11/13 — `tsc`/`vitest`/`vite build` all clean (76/76 tests passing across the whole suite), but the Export button has never been clicked in a real browser and no `.md` file has actually been downloaded and read yet. Zero Gemini dependency, so — like Task 10 — this has no further blocker once real confirmed data exists.

## Full-app-completion phase, Step 1 — pluggable AI provider

Abstracted the Gemini calls in the `extract` Edge Function behind an `LLMProvider` interface so swapping providers (or moving to a paid tier) is a config change, not a code change. `supabase/functions/_shared/llm/types.ts` (`LLMProvider`/`LLMRequest`/`LLMFile`), `geminiProvider.ts` (`createGeminiProvider(config)` — the exact prior Files-API-upload + generateContent logic, unchanged, just parameterized on `{ apiKey, model, baseUrl }` instead of reading `Deno.env` internally), `mockProvider.ts` (`createMockProvider()` — no network, returns a valid-shape empty-facts JSON by default or a configured/computed response, records every call for test assertions; reusable as-is for Task 12), `config.ts` (`createLLMProvider(env)` — reads `LLM_PROVIDER` (default `gemini`), `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`; throws clearly on a missing key or unknown provider name). `callLLM.ts` is now a thin wrapper (`createLLMProvider(Deno.env).generate(input)`) preserving its exact prior export signature, so `extract/index.ts` required zero changes.

Re-exported via `src/lib/llm/index.ts`, same canonical-in-Deno / re-export-into-src pattern already used for `merge()`, so the abstraction is testable under Vitest without a Deno runtime. `src/lib/llm/llm.test.ts`: 16 tests — Gemini provider text-only and with-file paths (mocked `fetch`, asserts correct URL/model/apiKey/body construction, file upload → `file_uri` reference, config defaults), error paths (upload-init failure, file never reaching `ACTIVE`, non-ok `generateContent`, missing text in response), the mock provider (default/static/computed responses, call recording), and the env factory (defaults to gemini, missing-key error, `GEMINI_MODEL`/`GEMINI_BASE_URL` passthrough, `LLM_PROVIDER=mock` selection, unknown-provider error). Whole suite: 92/92 passing. Gemini was not called during this work — everything verified against a mocked `fetch`.

One type fix needed along the way: `LLMFile.bytes` is now typed `Uint8Array<ArrayBuffer>` rather than bare `Uint8Array` — TypeScript 6's generic-TypedArray lib types don't consider `Uint8Array<ArrayBufferLike>` assignable to `fetch`'s `BodyInit`, and pulling the Deno-side file into `src/`'s type-checked graph (via the new re-export) surfaced it for the first time. No runtime behavior change; every real caller already produces `ArrayBuffer`-backed bytes.

**Files:** `supabase/functions/_shared/llm/{types,geminiProvider,mockProvider,config}.ts`, `supabase/functions/_shared/callLLM.ts` (rewritten as thin wrapper), `src/lib/llm/{index,llm.test}.ts`.

**Found, not fixed (out of scope for this step):** `src/features/document/DocumentView.tsx` calls `<ExportButton>` without importing it — pre-existing, breaks `npm run build`. See `docs/STATE.md`.

**Outstanding:** none for the provider abstraction itself. Next: Step 2, browser + live-data verification of Tasks 10/11/13/14 against seeded mock facts (no Gemini calls).

## Full-app-completion phase — bugfix: missing ExportButton import

`src/features/document/DocumentView.tsx` referenced `<ExportButton>` without importing it from `src/features/export/ExportButton.tsx`. Pre-existing (predates this phase — confirmed via `git stash -u` against a clean `updates/v1.1` checkout, so it landed sometime during Task 14 and was never caught because nobody had run `npm run build` since). One-line fix. `npm run build` and the full test suite (92/92) both clean after.

**Files:** `src/features/document/DocumentView.tsx`.

## Full-app-completion phase, Step 2 — live-data seed for Tasks 10/11/13/14

Seeded realistic mock `IssuerFacts` directly into the live Supabase project (`fvtazfdppcajoglteutz`, project row `a15f3021-6fda-4662-bc49-d629a45cfe39` / "Demo Issuer") via the PostgREST API using the anon key — no Gemini calls, no extraction pipeline involved. Used the same version-conditioned (CAS) PATCH discipline the app itself uses, so this couldn't race a concurrent write.

**What was seeded** (fictional issuer "Sundfin Industries Limited" — deliberately not reusing any real/prior-test company name, given the earlier contamination incident):
- **Confirmed:** all of `company` (legalName, incorporationDate, registeredOfficeAddress, industry, businessDescription — CIN is the one exception, see below), all of `capitalStructure` (self-consistent: paid-up = issued ≤ authorized, shares × face value = paid-up), all of `financials` except `netProfit` (self-consistent: totalAssets − totalLiabilities = netWorth), 2 `promoters` (name/panOrId/shareholdingPercent/category confirmed, summing to 54.7% — clears the 20% minimum), 1 `litigation` record (status "Dismissed" — not a pending term), 2 `relatedParties` records.
- **Deliberately left `status: 'ai'` (unconfirmed), one field at a time, each for a specific reason:**
  - `company.cin` — value is a well-formed CIN, so the eligibility rule still *passes*, but with `basis: 'unconfirmed'`. This is the cleanest way to exercise Task 10's "AI-only, unconfirmed" badge without it looking like broken data.
  - `financials.netProfit` — the one gap that (a) makes the Financial Summary section render "Incomplete — 1 pending" instead of fully Ready, (b) is exactly what blocks Task 14's export gate (`checkExportGate` → `{ allowed: false, missingFieldPaths: ['financials.netProfit'] }`), and (c) gives the eligibility "profitable" rule an unconfirmed badge too.
- One new `documents` row was created as the citation source for every seeded field's `sourceDocId` (id `d2feda0c-1854-4bee-b3f4-9b791532d311`, filename `seed-demo-drhp.pdf`, storage_path `seed-data/seed-demo-drhp.pdf`, `extraction_status: 'complete'`). **No actual file was uploaded to Storage** — clicking a source citation on this seeded data will produce a signed URL that 404s, since there's nothing at that path. That's expected for this seed, not a bug; the citation click-through itself was already verified live in Task 9 against a real uploaded document.
- Pre-existing `documents` rows on the project (the e2e-test leftovers noted in this file's "Task 9 — browser verification" section and `docs/STATE.md`'s open items) were left untouched — not part of this seed, not this seed's concern.

**Verified against the actual `assembleSections`/`evaluateEligibility`/`checkExportGate` functions (via `tsx`, against the exact JSON that was written to Supabase) before handing off for a browser check:**
```
Sections: capital-structure=ready, shareholding=ready, financial-summary=incomplete (missing financials.netProfit); definitions/general-info=ready (static)
Eligibility: overall=pass; profitable and cin-format both basis=unconfirmed; all 6 rules pass
Export gate: allowed=false, missingFieldPaths=['financials.netProfit']
```

**Teardown:** `scripts/teardown-seed-data.sh` — resets the project's `facts` to the fully-empty shape (version-conditioned PATCH, same CAS discipline as seeding) and deletes the one seed `documents` row. Reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `.env` or the environment. Does not touch `conflicts`/`merge_events` (both were already empty pre-seed) or any pre-existing document row. Tested: confirmed the version-mismatch failure path returns `[]`/200 (script detects this and exits non-zero rather than silently doing nothing), and confirmed anon-key DELETE on `documents` works, using a disposable throwaway row — not the real seed data.

**Files:** `scripts/teardown-seed-data.sh`. (Seed itself was applied directly via the REST API, not via a committed script — there's nothing to re-run since the intent is one seed → one browser check → one teardown, not a repeatable fixture load.)

**Outstanding:** waiting on a human to actually run `npm run dev` and look — this is fixture-shaped data but the first time any of Tasks 10/11/13/14 will have rendered against a live Supabase row instead of the static fixture. See the checklist handed to the user directly (not duplicated here to avoid drift — if it needs to be permanent, promote it into this file later).
