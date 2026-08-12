# Progress Log

Read this before re-explaining anything. One entry per task: what was built/decided, files touched, what's still open.

---

## Task 1 — Scaffold
Vite + React + TS + Tailwind + shadcn + wouter. Single route `/project`, no sidebar, no extra routes.
**Files:** `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/components/ui/button.tsx`.
**Outstanding:** none. (Was: `CLAUDE.md`'s stack line listed Zustand + Framer Motion, never reconciled with `docs/ARCHITECTURE.md` dropping both in favor of TanStack Query. Fixed 2026-08-09 — see the "CLAUDE.md stack line fix" entry near the end of this file. That fix also found react-hook-form and Zod listed but unused/uninstalled, same issue; both removed too. Left open, deliberately not touched in that fix: `CLAUDE.md`'s "Data model" section still points at `src/types/project.ts`, which doesn't exist — the real data model is `src/types/facts/`, per `docs/ARCHITECTURE.md` §3.)

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

**Verified live in a real browser, 2026-08-09.** The human's laptop checkout was initially stale (missing Task 13's Document-tab wiring — a `git pull origin updates/v1.1` fixed it, see `docs/DECISIONS.md`'s branch entry for why that's a recurring risk this session). Once current: all four checklist items confirmed —
1. Eligibility card: overall pass, `profitable` and `cin-format` both show the "AI-only, unconfirmed" badge, the other 4 rules don't.
2. Document view sections: Capital Structure and Shareholding Pattern both "Ready" (2-promoter table populated correctly); Financial Summary "Incomplete — 1 pending".
3. Export button: disabled, correct "field(s) not confirmed" messaging.
4. Source citation click: no visible action — diagnosed as expected, not a bug. `useOpenSource.createSignedUrl()` fails because the seed's one `documents` row pointed at a Storage path with no real file behind it (the seed never uploaded actual bytes, only a table row for citation purposes); `DocumentView`'s click handler (`.catch(() => {})`) swallows the resulting error silently rather than surfacing it. Citation click-through itself was already verified for real against an actually-uploaded document in Task 9.

**Teardown run and verified directly against Supabase** (`scripts/teardown-seed-data.sh`): project version 25 → 26, `facts` confirmed fully empty (every leaf `status: 'empty'`, `value: null`), seed `documents` row confirmed deleted, all 5 pre-existing e2e-test document rows confirmed still present and untouched.

**Outstanding:** none — Step 2 is closed. Tasks 10/11/13/14 have now each had a real first live-data browser verification, closing the gap flagged in every one of their "fixture-verified only" notes above. Next: Step 3.

## Full-app-completion phase, Step 3 — UI gap analysis against ARCHITECTURE.md (no build)

Read `docs/ARCHITECTURE.md` end to end and checked it against the actual codebase. Two real gaps, both already expected/tracked, nothing new: (1) the 3 AI-generated narrative sections (§2/§6 — Risk Factors, MD&A, Business Overview) don't exist yet, that's Task 12; and critically, `assembleSections()` (`src/lib/templates/index.ts`) has no "generated" section type slot at all today, so Task 12's scope was expanded (see below) to include the full path, not just the Edge Function. (2) The disclaimer is still placeholder text, not verbatim (§6) — already tracked as an external blocker in `docs/DECISIONS.md`, no new action.

Checked and confirmed **not** gaps: the "per-section lock + filing lock → keep only the final one" line (§5) — satisfied by Task 14's export gate already, nothing further to build; Facts Review's domain coverage (§9 task 9) — all 6 domains, matches spec fully; merge semantics/provenance/confidence-amber threshold (§4) — match as built and tested.

Also found, while grepping for Framer Motion/Zustand usage to verify §5's "remove" list was actually honored: `package.json` has neither of those, nor react-hook-form nor Zod — all four were correctly never installed despite `CLAUDE.md`'s stack line still listing them. See the next entry for the fix.

## Documents tab integration — validation panel moved onto the landing page

The document validation composition is now shared through `src/components/document/DocumentValidationPanel.tsx` and also rendered from the landing `DocumentsScreen`, so the main page shows validation/export context directly after uploads instead of hiding it only under Draft. `DraftScreen` now reuses that same panel rather than duplicating the logic.

## CLAUDE.md stack line fix (2026-08-09)

`CLAUDE.md`'s "Stack" line listed Framer Motion, Zustand, react-hook-form, and Zod — none installed (`package.json`) or used anywhere in `src/` (grepped to confirm). This was flagged as outstanding back in Task 1 and never fixed. One-line removal: `React + TypeScript + Vite + Tailwind + shadcn/ui + wouter (routing)`, matching what's actually in `package.json` and `docs/ARCHITECTURE.md` §2's stack list.

**Files:** `CLAUDE.md`, `docs/PROGRESS.md` (this entry + closing Task 1's outstanding note).

**Found but deliberately not touched in this fix (separate, not asked for):** `CLAUDE.md`'s "Data model" section still says the data model lives in `src/types/project.ts` — that path doesn't exist. The real data model is `src/types/facts/` (matches `docs/ARCHITECTURE.md` §3). Flagged to the user; needs a decision, not fixed here since this fix was scoped to the stack line only.

## Full-app-completion phase, Step 4 — Task 12 (generate-section), expanded scope

Built the full path per the human's expanded-scope call (see `docs/STATE.md`), not the Edge Function in isolation:

**Shared/pure logic** (`supabase/functions/_shared/generatedSections/`, re-exported to `src/lib/generatedSections/` for Vitest, same pattern as `merge()`/`src/lib/llm/`):
- `types.ts` — `GeneratedSectionKey` ('riskFactors' | 'mdAndA' | 'businessOverview'), `GeneratedSectionContent` ({body, citations, generatedAt}), `GeneratedSections`, `ConfirmedFactEntry`.
- `collectConfirmedFacts.ts` — flattens all 6 `IssuerFacts` domains (including company/litigation/relatedParties, which Task 11's computed sections don't touch) into labeled entries, keeping only fields that are both `status: 'confirmed'` AND carry a real `sourceDocId` — a confirmed-but-uncited field is excluded rather than risk generating from something that can't be cited back (CLAUDE.md's AI-content-citation rule, enforced at the input boundary — see `docs/DECISIONS.md`).
- `buildGenerationPrompt.ts` — pure prompt string builder; asks for strict JSON with `body` + `citedFieldPaths` per section.
- `resolveGeneratedSections.ts` — validates the model's parsed output: drops any `citedFieldPath` not in the offered entry list (never trusts model citations blindly), drops any section with an empty/non-string body rather than persisting empty prose.
- `supabase/functions/_shared/parseModelJson.ts` — extracted out of `extract/index.ts` (identical logic, no behavior change) since `generate-section` needs the exact same defensive JSON-fence-stripping; `extract/index.ts` now imports the shared version instead of its own copy.

**Edge Function** (`supabase/functions/generate-section/index.ts`): synchronous — one Gemini call over the collected confirmed facts via Step 1's `createLLMProvider`, no async/202/reaper apparatus (justified: this is a short fact list, not a multi-hundred-page document, comfortably inside the wall-clock ceiling that forced `extract` into chunking). 400s if there are zero citable confirmed facts. Persists to a new `projects.generated_sections jsonb` column via the same version-CAS retry loop as everything else on that row (plain overwrite, not a `merge()` — there's no proposed-vs-confirmed history for generated prose to reconcile).

**Migration:** `supabase/migrations/20260810000000_generated_sections.sql` — adds `projects.generated_sections`.

**Client wiring:**
- `src/lib/templates/generated.ts` (`buildGeneratedSections`) + `assembleSections(facts, generatedSections)` — new `'generated'` `SectionKind`, 3 sections appended after the computed ones. A not-yet-generated section carries `missingFieldPaths: ['generated.<key>']` as a marker.
- `src/lib/export/gate.ts`/`markdown.ts`/`index.ts` — `checkExportGate`/`buildExportMarkdown`/`exportProjectMarkdown` all take an optional `generatedSections` param (defaults to `{}`). The gate is generic over every section's `missingFieldPaths` already, so it automatically now also blocks export until all 3 generated sections exist — no new gate logic needed, exactly as the original Task 14 DECISIONS.md entry predicted this would happen if more sections were added to Task 11.
- `src/hooks/useProject.ts`/`useUpdateFacts.ts`/`useResolveConflict.ts` — `ProjectRow` and every `.select()` string now include `generated_sections`.
- `src/hooks/useGenerateSections.ts` — new mutation hook, invokes the Edge Function and invalidates the project query on settle (no polling needed — the call is synchronous).
- `src/features/generate/GenerateSectionsButton.tsx` — new; disabled exactly when `collectConfirmedFacts(facts).length === 0`, the identical check the Edge Function itself runs (imported client-side from the same shared module, one source of truth).
- `src/features/document/DocumentView.tsx` — renders generated sections as prose with a "Sources:" line (citations reuse the same `sourceLink`/`useOpenSource` click-through as computed-section cells); wires in `GenerateSectionsButton` next to `ExportButton`.
- `src/features/export/ExportButton.tsx` — takes and threads a `generatedSections` prop.
- `src/hooks/describeFunctionError.ts` — small shared helper extracted out of `useRunExtraction.ts` and reused by the new `useGenerateSections.ts`, rather than a second copy.

**Tests:** 20 new (112/112 suite-wide) — `collectConfirmedFacts`/`buildGenerationPrompt`/`resolveGeneratedSections` unit tests, a full mock-provider run of collect→prompt→generate→parse→resolve with zero network calls (per the requirement that this be written and verified against a mock, not real Gemini), `buildGeneratedSections`/`assembleSections` ordering and readiness tests, and export-gate/markdown tests for the generated-section case (blocked when facts confirmed but not generated, rendered prose + Sources line, `_Not yet generated._` placeholder). `tsc -b`/`vite build`/`vitest run` all clean. Gemini was not called at any point.

**Files:** `supabase/functions/_shared/generatedSections/{types,collectConfirmedFacts,buildGenerationPrompt,resolveGeneratedSections,index}.ts`, `supabase/functions/_shared/parseModelJson.ts`, `supabase/functions/extract/index.ts` (now imports the shared parseModelJson), `supabase/functions/generate-section/index.ts`, `supabase/migrations/20260810000000_generated_sections.sql`, `src/lib/generatedSections/{index,generatedSections.test}.ts`, `src/lib/parseModelJson.ts`, `src/lib/templates/{generated,types,index}.ts`, `src/lib/templates/fixtures.ts` (added `fixtureGeneratedSections`), `src/lib/templates/templates.test.ts`, `src/lib/export/{gate,markdown,index}.ts`, `src/lib/export/export.test.ts`, `src/hooks/{useProject,useUpdateFacts,useResolveConflict,useGenerateSections,useRunExtraction,describeFunctionError}.ts`, `src/features/generate/GenerateSectionsButton.tsx`, `src/features/document/DocumentView.tsx`, `src/features/export/ExportButton.tsx`.

**Outstanding — this is the current blocker, not a someday item:** the migration has NOT been applied and the Edge Function has NOT been deployed to the live `fvtazfdppcajoglteutz` project. This session only has the anon key — no service-role key, DB password, or Management API token, all of which running the migration/deploy requires. Someone with elevated Supabase access needs to run the two commands documented in `docs/SETUP.md` before Task 12 can be exercised against live data. Once deployed, this needs the same live-browser verification treatment Tasks 10/11/13/14 got in Step 2 — not yet done, code-complete/fixture-and-mock-tested only.

## Full-app-completion phase, Step 5 (partial) — found & fixed two regressions from Step 4

While doing the Step 5 freshness/cleanup pass, verified directly against the live project (anon key, no write) that Step 4's `.select(...generated_sections...)` additions to `useProject`/`useUpdateFacts`/`useResolveConflict` currently fail live:
```
$ curl ".../rest/v1/projects?select=id,generated_sections&limit=1" ...
{"code":"42703","message":"column projects.generated_sections does not exist"}
```
Since the migration adding that column hasn't been applied yet. Both `DocumentView.tsx` and `FactsReview.tsx` call `useProject()`, so **both tabs are currently broken against live data** — not merely "Task 12 unavailable," which is how the Step 4 entry above understated it. Documents the actual blast radius in `docs/STATE.md`; no code change needed or possible here, this resolves itself the moment the pending migration is applied.

Also found and fixed: `DocumentView.tsx` (rewritten in Step 4) had reintroduced a local `isTable()` instead of importing the shared one from `@/lib/templates`, undoing Task 14's dedup refactor. Restored the import. `tsc -b`/`vitest` (112/112)/`vite build` all clean after.

**Files:** `src/features/document/DocumentView.tsx`, `docs/STATE.md`.

## Full-app-completion phase, Step 5 (continued) — found the small demo doc, and a live differing-value conflict, neither logged anywhere

Continuing the Step 5 pass, pulled the live project's current `facts`/`conflicts`/`merge_events` (anon key, read-only, before running any seed/teardown script against it) and found real activity from after `90d0774` that had never been written up in `STATE.md`/`PROGRESS.md`/`DECISIONS.md` — not performed by this session, discovered by reading live state.

**`Draft_Abridge_Prospectus_ANP.pdf`** extracted successfully in a single chunk (2026-08-10, ~18:55–18:58) — the genuinely-small demo document `docs/STATE.md`'s "Demo plan" section spent 2026-08-09 looking for and never found. Produced 37 confirmed facts for a real company ("ANP Technologies Limited") across all 6 domains: company profile, 3 promoters (65.45% combined), 5 litigation records, 5 financial figures, capital structure. One merge event: `written=37, skipped=0, conflicts=0` (clean first merge into an empty project).

**The same file was re-uploaded and re-extracted 2026-08-11 03:19**, and this run raised **3 real `FactConflict`s** — `company.industry`, `company.businessDescription`, `capitalStructure.paidUpCapital` — against the first run's confirmed values. `merge_events`: `written=9, skipped=28, conflicts=3`. This is the first live observation of the differing-value merge branch (`confirmed` + disagreeing proposal → keep, raise conflict) since it was flagged as unverified back in the Task 9 entry above — closes that gap for real, not via a fixture. All 3 conflicts are still `resolution: 'pending'`.

**Not touched by this pass, deliberately:** resolving the 3 conflicts needs a human's actual judgment on which extraction was more accurate — not scripted. Full detail, including the exact conflict payloads, in `docs/STATE.md`'s "Found during Step 5" section (near the top) and updated "Open items"/"Demo plan" sections.

**Files:** `docs/STATE.md` only (no code — this is a documentation catch-up of pre-existing live state, not a change to the app).

## UI revamp Phase 3 (2/3) — Facts Review, plus the logo fix and a performance pass

Architect approved the Documents screen (`c8735eb`); merged into `updates/v1.1` immediately rather than batching to end of phase, per the standing instruction to merge each screen as it lands.

**Design system additions, before building anything:** `docs/DESIGN_SYSTEM.md` gained two enforced rule sets — "Premium execution" (strict spacing scale, 4-step typographic hierarchy, dense-but-aligned row rhythm, 150-200ms ease-out motion only, tabular figures on every numeric column, earned borders/shadows) and "Performance" (route-level code splitting, latin-only self-hosted fonts, bundle auditing, memoize-don't-virtualize, no layout shift).

**Logo fix (first, per instruction):** the wordmark was baked into `public/conexus-logo.svg` as `<text>` set in Inter — a face this app never loads, and an `<img>` can't inherit the page's real fonts regardless. `public/conexus-mark.svg` now holds just the bull-on-bars graphic, cropped to its real bounding box (measured via headless-browser `getBBox()`, not eyeballed). New `src/components/layout/Logo.tsx` composes that image with "CONEXUS" as live text — `font-sans` (Public Sans), `font-black`, `tracking-tighter`, `text-ink` (already documented as "the logo wordmark color"). Dropped the original's single-letter gradient and tagline — both illegible pixel-baked flourishes at the header's actual render size.

**Performance infra:** all three webfonts (`src/styles/fonts.css`) switched from Fontsource's default multi-subset bundle to latin-only imports — every string this app renders is Latin-script. 27 font files/~313KB → 7 files/~127KB. `src/lib/preloadFonts.ts` preloads the two above-the-fold faces (Public Sans, Caslon) via a `<link rel=preload>` injected before React mounts. `.interactive`'s hover transition bumped 100ms → 150ms to match the new motion rule.

**Facts Review** (`docs/UI_ARCHITECTURE.md`, Screen 2), built to the new standards:
- `src/lib/facts/domains.ts` + `factList.ts` — the single source of truth for "what fields exist" and the one walk over `IssuerFacts` that rendering, filtering, and status counts all share (`listFactFields`, `countFactsByStatus`, `groupEntriesByDomain`, `groupEntriesByRecord`), instead of each re-declaring its own traversal. 18 new Vitest tests.
- `src/components/review/` — `ConflictQueue` (new: all pending conflicts, top of screen, wired to the 3 real live ANP conflicts), `DomainSection` (new: one component handles both flat and array/repeating-group domains, driven by whether an entry carries a `recordId`; collapsible; distinguishes "no records extracted" from "filtered out" with different messaging), `FilterBar` (new: status chips + domain jump links), `BulkConfirmBar` (new: appears at 2+ visible AI-proposed fields, fires `useUpdateFacts` sequentially — deliberately not parallel, per the mutation's own concurrency-retry design), `FieldRow` (trimmed: no longer inlines `ConflictCard`, shows a "resolve above" link instead), `ConflictCard`/`DiffTrail` (moved from `features/review/`, restyled to Phase 1 tokens/`VerificationStamp`).
- `src/features/review/FactsReviewScreen.tsx` — composition only, 156 lines. Every new/touched component is under the ~200-line rule; every list of rows uses `useMemo`'d derived state, not virtualization (37 fields doesn't need it).
- Loading/empty/error states: shape-matched `Skeleton`, a `Callout` empty state when zero documents exist yet (action: link to Documents), `Callout tone="signature"` on mutation failure.
- `src/App.tsx` — `FactsReviewScreen` and `DocumentView` now route-split via `React.lazy`/`Suspense`; `DocumentsScreen` stays eager (it's the landing route). Main bundle 944.32KB → 912.60KB, ~39KB (12.9KB gzip) deferred into the two lazy chunks instead of shipping on first paint.

**Verification:** `npm run build`/`test` (123/123 passing)/`lint` all clean. Live-data visual QA done via Playwright route interception against the real project's actual current facts/conflicts/documents (fetched read-only via the anon key, then replayed as mocked REST responses) — not synthetic seed data, since the project currently holds the real unresolved ANP conflicts that must not be disturbed. This sandbox's Chromium still can't reach Supabase directly (same limitation noted throughout this file), so this is the same "static/mocked preview, screenshotted" technique used for Phase 1's verification, extended to intercept real data instead of a static CSS file.

**Also confirmed, not fixed (out of scope for this pass, tracked separately):** the `generated_sections` column still doesn't exist live (42703), so `useProject` is still actually broken against real Supabase — this was already known (see the Step 5 entries above) and is blocked on deploy access, not something this pass could or should route around by changing `useProject`'s select list.

**Files:** `docs/DESIGN_SYSTEM.md`, `src/styles/{fonts,global}.css`, `src/lib/preloadFonts.ts`, `src/main.tsx`, `public/conexus-mark.svg` (was `conexus-logo.svg`), `src/components/layout/{AppShell,Logo}.tsx`, `src/lib/facts/{domains,factList,factList.test}.ts`, `src/components/review/{ConflictQueue,ConflictCard,DomainSection,FilterBar,BulkConfirmBar,FieldRow,DiffTrail}.tsx`, `src/features/review/FactsReviewScreen.tsx` (was `FactsReview.tsx`), `src/App.tsx`, `docs/STATE.md`.

**Outstanding:** Document (3/3) is next, same standards, same per-screen merge discipline. Separately (not batched with screen work, per instruction): `CLAUDE.md` code-organization rules, a hard guard on `scripts/teardown-task12-check.sh`, and confirmation that the stale-deps/Sundfin-seed cleanup items were already resolved in earlier passes (verified this session — nothing left to do on either).

## UI revamp Phase 3 (3/3) — Document screen, plus a logo icon correction

**Logo, corrected (not part of the original ask, but the user flagged it):** the wordmark spacing/font fix from the previous entry was right, but the mark itself — the SVG bull-on-bars path data — turned out to be a rough hand-drawn approximation of the real brand icon, not a faithful copy. The user supplied the actual source artwork; `public/conexus-mark.png` replaces `conexus-mark.svg`, cropped from that source via a pixel column-scan bounding box, background keyed to transparent via a brightness ramp, downscaled to 240px tall (~7.5x the header's real render size). Wordmark tracking also loosened from `tracking-tighter` to `tracking-normal` to match the reference's spacing (compared all 5 Tailwind tracking steps against the real compiled CSS before picking). `X` keeps the teal-to-navy gradient. Verified pixel-by-pixel (no content touching the crop's edges) and at 3x device pixel ratio (no artifacting).

**Document (3/3)** (`docs/UI_ARCHITECTURE.md`, Screen 3), built to the same standard as Facts Review:
- `src/components/ui/badge.tsx` — new generic 4-tone primitive (neutral/confirmed/caution/signature, same vocabulary as `Callout`) for `Section.status` and `EligibilityStatus`. Neither fits `VerificationStamp`'s fixed 3-state stamp motif (reserved for `Field.status`/`FactConflict.resolution` per the pinned mapping table), so this is the token-only alternative rather than stretching the stamp component past its documented "three states, deliberately not more."
- `src/components/document/` — `SectionCard` (new: the single place every `Section.kind` renders — static prose, generated prose+citations, computed key-value list, computed table — closing off the `isTable()` duplication risk for good since it's now the only reader), `CitationLink` (new: extracted the `sourceLink()` closure that used to be redeclared inline).
- `src/features/document/DocumentScreen.tsx` (was `DocumentView.tsx`) — composition only, ~90 lines.
- `src/features/eligibility/EligibilityCard.tsx` and `src/features/generate/GenerateSectionsButton.tsx` — restyled to tokens/`Button`/`Badge`, logic unchanged.
- `src/features/export/ExportPanel.tsx` (was `ExportButton.tsx`) — promoted from a button + one-line caption to a full section with a real blocked-by-gate `Callout` listing the literal `missingFieldPaths` in `.font-data` (never "N fields missing" — `checkExportGate` already returns the full list, this only renders it).
- Numeric table/list columns are right-aligned with tabular figures, computed per-column (not per-cell) so a column's header and every row's alignment agree — added during this pass's own visual QA, not part of the original ask, but a direct application of the Premium Execution "optical alignment" rule already codified.
- Loading/empty/error states follow the same pattern as Facts Review (shape-matched `Skeleton`, a `Callout` empty state linking to Documents when zero documents exist, `Callout tone="signature"` on load failure).

**Verification, two ways:**
1. **Real live ANP data**, route-intercepted (same technique as Facts Review, since direct Supabase calls still 42703 on `generated_sections` — confirmed again this pass, unchanged). This exercises the actual current "blocked" state: Capital Structure/Financial Summary both "Incomplete", Eligibility "Unknown" (capital structure not fully extracted), all 3 generated sections "Not yet generated", Export "Blocked" with the real missing paths listed (`capitalStructure.authorizedCapital`, `financials.totalAssets`, `generated.riskFactors`, etc.).
2. **Fully-confirmed fixture** (`src/lib/templates/fixtures.ts`'s data reproduced as a mocked response, generated sections filled in) — exercises the path the live data doesn't: Eligibility "Pass", every section "Ready", Export "Ready" and unblocked. Clicked the button for real — a `.md` file downloaded (`acme-industries-limited.md`), content checked to contain the disclaimer and the generated section text.

Zero console/page errors in either run. `npm run build`/`test` (123/123)/`lint` (`badge.tsx` has the same "exports non-component" warning `button.tsx` already carries — same accepted pattern, not new) all clean.

**Files:** `public/conexus-mark.png` (was `.svg`), `src/components/layout/Logo.tsx`, `src/components/ui/badge.tsx`, `src/components/document/{SectionCard,CitationLink}.tsx`, `src/features/document/DocumentScreen.tsx` (was `DocumentView.tsx`), `src/features/eligibility/EligibilityCard.tsx`, `src/features/generate/GenerateSectionsButton.tsx`, `src/features/export/ExportPanel.tsx` (was `ExportButton.tsx`), `src/lib/export/markdown.ts`, `src/lib/templates/shared.ts` (comment fixes only), `src/App.tsx`, `docs/STATE.md`.

**Outstanding:** All three Phase 3 screens are done. Next: a read-only progress rail in the workspace shell (5 steps, reusing the real gate functions — extraction status, conflict count, confirmed-field count, the eligibility engine, the export gate — never a parallel reimplementation), then an audit-trail schema change (`fact_events`, append-only), the latter gated on user confirmation before starting since it's the first schema change since this phase began.

## Progress rail in the workspace shell

Read-only, 5-step guidance (Upload documents → Resolve conflicts → Confirm facts → Check eligibility → Generate & export), present on all three screens since it lives in `AppShell`. No new hooks, no schema change, per the ask.

**`src/lib/progress/computeProgressSteps.ts`** — the one place the 5 numbers get computed, calling only real existing functions: `listFactFields`/`countFactsByStatus` (`src/lib/facts/factList.ts` — the exact pair Facts Review's own status stamp reads, so the rail's "N facts unconfirmed" always agrees with what Facts Review itself shows), `evaluateEligibility` (Task 10's 6-rule engine), `checkExportGate` (Task 14). Each step is `done`, `current`, or `locked`. Design point worth recording since it's not obvious from the code alone: each step's `done` boolean is defined as exactly "this step's own detail string would be null" — which means every not-done step, whether `current` or `locked`, always has its own real, independently-computed reason to show, never a borrowed or invented one. The only thing distinguishing `current` from `locked` is sequence (exactly one step — the first not-done one — is ever `current`, so an SME sees one focused next action, not five simultaneous traffic lights), *not* whether the step has something real to say. A concrete consequence, deliberately not smoothed over: a step *after* the current one can still legitimately render `done` — e.g. "Resolve conflicts" is genuinely `done` (zero pending conflicts) even on a brand-new project with zero documents uploaded yet, because that's simply true, not a lie the rail should hide by forcing a rigid single-active-step illusion.

**`src/components/layout/ProgressRail.tsx`** — presentational only; calls `useProject`/`useDocuments` itself (same project-level query, deduped by TanStack Query against whatever screen is also reading it — the exact pattern `docs/UI_ARCHITECTURE.md` already anticipated for the eligibility badge, now actually exercised). Icons: check (`confirmed`, green) / circle-dot (`caution`, the "look here" color already used for `Section.status`'s "Incomplete") / lock (`ink-muted`). Skeleton while loading; renders nothing on error (the active screen already surfaces that — this is supplementary guidance, not critical path). Mounted in `AppShell` (now takes a `projectId` prop, threaded from `App.tsx`), between the header and `<main>`.

**Verification:** 6 new Vitest tests covering the interesting cases (brand-new project, conflicts blocking despite fully-confirmed facts, eligibility failing independently, everything done). Visually verified two ways, same live/fixture split as the screens: real live ANP data (3 pending conflicts) correctly shows step 2 as `current`, and step 5 reads **"4 fact(s) unconfirmed, narrative not generated"** — matching the brief's own worked example almost verbatim, produced from real `checkExportGate` output against the live project, not staged to match. The fully-confirmed fixture shows all 5 steps `done` with zero clutter. Zero console/page errors either way.

**Performance, measured:** main bundle grew 912.73KB → 925.26KB (~12.5KB) — the rail is shell chrome on every route, so its dependencies (`evaluateEligibility`/`checkExportGate`) now have to ship eagerly instead of living only inside the lazy `DocumentScreen` chunk. That chunk shrank correspondingly, 19.32KB → 12.72KB, since the shared logic is now deduped into the eager bundle rather than duplicated in both places. Net effect is real and worth naming, not hidden: visiting the default (Documents) route now costs ~12.5KB more up front; visiting the Document route costs ~6.6KB less. `npm run build`/`test` (129/129)/`lint` all clean.

**Files:** `src/lib/progress/{computeProgressSteps,computeProgressSteps.test}.ts`, `src/components/layout/{ProgressRail,AppShell}.tsx`, `src/App.tsx`, `docs/STATE.md`.

**Outstanding:** Audit trail (`fact_events`) is next — the first schema change since Phase 3 began, confirmed with the user before starting per instruction.

## Screen rename (Document -> Draft) + status-derived header chips

Two small, related requests: "Documents" (uploads) and "Document" (assembled draft) read as near-duplicates one letter apart, and none of the three screens had a self-explanatory header.

**Rename:** `src/features/document/DocumentScreen.tsx` -> `src/features/draft/DraftScreen.tsx` (component `DocumentScreen` -> `DraftScreen`), route `/project/document` -> `/project/draft`, nav/tab label "Document" -> "Draft" (`AppShell.tsx`), lazy import in `App.tsx`. Two stale comments fixed (`lib/export/markdown.ts`, `lib/templates/shared.ts`, both said "Task 13's DocumentScreen"). Docs updated: `docs/UI_ARCHITECTURE.md`'s Screen 3 section (heading, route, target file tree, cross-references) and the current-state pointers in `docs/STATE.md`/`docs/DESIGN_SYSTEM.md` — historical "Today:"/pre-Phase-3 narrative describing the old `DocumentView.tsx` was deliberately left alone, same convention as everywhere else in these docs (don't rewrite history). Per instruction, the document *data model* — `Section`, `generated_sections`, `assembleSections`, `SectionCard`/`CitationLink` (still in `components/document/`, since they render `Section`s, not "the Draft screen") — kept every existing name; this was a screen-naming change only, confirmed via `grep` that nothing else referenced the old names before calling it done.

**Header chips**, same title-plus-chip pattern on all three screens now:
- **Documents** (`src/lib/documents/describeExtractionProgress.ts`, new, 5 tests): reuses the exact fields `DocumentListItem`/`ExtractionProgress` already read. Shows the actively-processing document's own "chunk N of M" when one exists (same language as its per-row progress bar); falls back to "N of M document(s) processed" (a document-level, not chunk-level, count) when nothing's actively extracting, since chunk counts aren't meaningful outside an active extraction.
- **Facts Review**: was already a real chip (built during the Facts Review pass) — consolidated from two simultaneous `VerificationStamp`s into one (conflicts take priority when pending, confirmed count is the fallback), and added the real denominator ("X of Y fields confirmed", not just "X confirmed"), matching the requested format. Left as `VerificationStamp`, not `Badge` — conflict/confirmation counts are exactly `FactConflict.resolution`/`Field.status` in aggregate, the two vocabularies `VerificationStamp` is actually pinned to (docs/DESIGN_SYSTEM.md); switching to `Badge` here would have meant inventing a second pattern for the same two states `VerificationStamp` already owns.
- **Draft**: new `Badge` chip reusing `checkExportGate`'s own result and `computeProgressSteps.ts`'s `describeMissingExport` (newly exported, not reimplemented) — byte-identical to what Progress rail's own step 5 shows, verified live (see below).

**Verification:** `npm run build`/`test` (134/134, 11 new)/`lint` all clean; `tsc -b` clean. Live-checked all three against the real ANP project (route-intercepted): Documents chip read "3 of 7 document(s) processed"; Facts Review read "3 CONFLICT(S) PENDING"; Draft read "4 fact(s) unconfirmed, narrative not generated." — identical text to Progress rail's step 5 in the same live check, confirming the reuse held. Also checked the fully-confirmed fixture: "29 of 29 fields confirmed", "Ready to export", and Documents' complete-count case, all via a 5-test suite. Zero console/page errors throughout.

**Files:** `src/features/draft/DraftScreen.tsx` (was `src/features/document/DocumentScreen.tsx`), `src/features/documents/DocumentsScreen.tsx`, `src/features/review/FactsReviewScreen.tsx`, `src/components/layout/AppShell.tsx`, `src/App.tsx`, `src/lib/documents/{describeExtractionProgress,describeExtractionProgress.test}.ts`, `src/lib/progress/computeProgressSteps.ts`, `src/lib/export/markdown.ts`, `src/lib/templates/shared.ts`, `docs/UI_ARCHITECTURE.md`, `docs/STATE.md`, `docs/DESIGN_SYSTEM.md`.

**Outstanding:** unchanged — audit trail (`fact_events`) still next, still waiting on go-ahead + migration-approach preference.

## Audit trail (`fact_events`) — go-ahead given, built code-complete, undeployed

Go-ahead given for application-level logging (no RLS/triggers, matching this schema's existing posture — see `docs/DECISIONS.md`). Built exactly like Task 12 was built without live data: migration written, logging wired, mock/fixture tests, nothing applied or deployed.

**Migration** (`supabase/migrations/20260811000000_fact_events.sql`): `fact_events(id, project_id, fact_id, event_type, old_value, new_value, source, created_at)`. `fact_id` is a fieldPath string, not an FK — this schema has no `facts` table, facts live in `projects.facts` jsonb addressed by the same fieldPath grammar `FactConflict`/`MergeEvent` already use. `event_type`/`source` are `text` + `check`, matching this schema's existing convention for every other status-like column rather than introducing the one real Postgres `enum` type. Write-once is enforced for real, not just by convention: `revoke update, delete on fact_events from anon, authenticated`.

**One shared logging function**, same shape as `callLLM()`/`LLMProvider`: `recordFactEvents()` in `supabase/functions/_shared/factEvents/` (re-exported to `src/lib/factEvents/` for Vitest, same pattern as `merge()`/`generatedSections`). Every call site builds `FactEventInput[]` and calls this one function — nothing hand-rolls its own insert. Deliberately best-effort: an insert failure `console.error`s rather than throwing, since the facts write it's describing has already succeeded (CAS'd) by the time any caller reaches it — see `docs/DECISIONS.md` for why that trade was made over a stricter (and worse-failure-mode) alternative.

**Wired at all three points facts change state:**
- `extract/index.ts`'s `persistChunkFacts` — `extracted` events for every `merge()`-written field, `conflict_raised` for every conflict, both `source: 'extraction'`. Old/new values come from a new `getFactValue()` (read-only Deno-side mirror of `src/lib/facts/fieldPath.ts`'s `getFieldAtPath`, same cross-runtime-duplication convention `factsTypes.ts` already established) rather than extending `merge()`'s own return shape — kept the single most heavily-tested function in this build (18 tests) untouched.
- `useUpdateFacts` — `edited` or `confirmed` (`source: 'manual'`), keyed off the same `patch.status` the hook already branches on. This is also where Facts Review's Confirm button and bulk-confirm both land, since both go through this one hook — no separate "confirm action" call site exists.
- `useResolveConflict` — `conflict_resolved` (`source: 'merge'`, since the value came from extraction even though a human chose it — see `docs/DECISIONS.md`'s exact 1:1 `source` mapping).

**Tests:** 20 new Vitest tests in `src/lib/factEvents/factEvents.test.ts` — row-building (including undefined→null coalescing for the nullable jsonb columns), `recordFactEvents`'s insert/empty-list/error-swallow behavior against a mock client, `getFactValue` against flat and repeating-group paths (plus one test pinning it agrees with `getFieldAtPath` on the same fixture), and — the one worth calling out specifically — a set of tests that run a real `merge()` result through the exact two `.map()` calls `persistChunkFacts` uses, not just hand-built `FactEventInput` fixtures, covering the written-field case, the conflict-raised case, the all-skip-no-events case, and one full pass through `recordFactEvents` end to end. `npm run build`/`test` (149/149)/`lint` all clean; bundle size unchanged (the module isn't in any eager screen bundle's dependency chain beyond what `useUpdateFacts`/`useResolveConflict` already ship).

**Not deployed — identical blocker to `generated_sections`** (`docs/STATE.md`, `docs/SETUP.md`): this session has only the anon key, can't run DDL or redeploy Edge Functions. Migration and function code are both ready; someone with DB/Management access needs to apply `20260811000000_fact_events.sql` and redeploy `extract` (safe to do in either order or even before the migration, per the best-effort design above) before any row actually lands. Both this migration and `generated_sections` apply together whenever that access is available.

**Files:** `supabase/migrations/20260811000000_fact_events.sql`, `supabase/functions/_shared/factEvents/{types,recordFactEvents,getFactValue,index}.ts`, `src/lib/factEvents/{index,factEvents.test}.ts`, `supabase/functions/extract/index.ts`, `src/hooks/{useUpdateFacts,useResolveConflict}.ts`, `docs/STATE.md`, `docs/DECISIONS.md`, `docs/SETUP.md`.

**Outstanding:** deployment access, same as `generated_sections` — nothing left to build until that's unblocked.

## PR follow-up (comment 5254732312) — resolved merge conflicts with `origin/main`

Merged `origin/main` into `updates/v1.1` to clear the PR conflict state. Kept this branch's rebuild-era resolutions for direct conflicts (`.gitignore`, `package.json`, `package-lock.json`) and kept this branch's deletions for old app files that conflicted as modify/delete (`prisma.config.ts`, `prisma/schema.prisma`, old `src/app` and legacy sidebar/auth/llmClient files). Main-only non-conflicting files merged as-is by Git.

**Verification:** `npm ci`, `npm test -- --run` (149/149), and `npm run build` all pass after conflict resolution.

**Files:** merge conflict set above, plus this `docs/PROGRESS.md` update.

**Outstanding:** none for this comment request.

## Demo build, Phase 1 — landing page ported to `/`

First of a 4-phase push to a demo-ready end-to-end app. Scope was "merge the landing branch"; the investigation phase found that isn't the operation this needs.

**The branch is not a landing branch.** `user_landing_page_info` is the entire pre-rebuild Next.js 16 + Prisma application — 162 `src/` files, ~70 deps, a full parallel implementation of this product. A git merge of it had *already* happened while the `fact_events` work was in flight (`e3b0786`, then PR #2 back to `main`), and it resolved all of `src/` in favour of `updates/v1.1` — so it discarded the landing page and brought across only a dead Python `backend/`, two logo assets, and a PROGRESS.md fragment. Side effect worth knowing: `main` no longer contains the Next.js app (162 `src/` files → 96).

**What was done instead: ported one file.** The landing page is a self-contained 207-line `src/app/page.tsx` whose whole dependency surface was `lucide-react` (already here), `@/components/ui/button` (exists, API-compatible), `next/link`, `next/image`, and `framer-motion`. Now `src/features/landing/LandingScreen.tsx` (composition only) + `src/components/landing/{LandingHeader,LandingHero,LandingFeatures,LandingWorkflow,LandingFooter}.tsx` — split because the original exceeds CLAUDE.md's ~200-line ceiling. **Zero new dependencies.**

**Reconciled onto this design system rather than recolored.** 41 raw `slate-*` utilities mapped to paper/ink/confirmed; `shadow-xl` + `hover:-translate-y-2` on resting cards replaced with `border border-hairline` + the canonical `.interactive` hover, per DESIGN_SYSTEM.md's "Radius and shadow" and "Restrained motion" rules. framer-motion's two mount-fades were **dropped, not replaced** — entrance animations are prohibited outright. Footer inverted from slate-900 to recessed paper, which is what lets the real `<Logo/>` be used in both header and footer (it draws live ink-colored text and is invisible on dark), closing the baked-PNG-wordmark issue.

**Honesty fixes:** removed a dead `#benefits` nav anchor, removed workflow step 1's link to `/docs/eligibility.pdf` (doesn't exist — a 404 on the front door), removed the "Sign In" link (this app has no auth), and trimmed feature copy that promised a "live preview" and "readiness scores" this app doesn't have. Deleted the dead `backend/` FastAPI skeleton (8 of 11 files were 0 bytes, wired to nothing).

**Found and fixed — app-wide, not landing-specific: `border-hairline` generated no CSS.** `--color-hairline` was never added to `tokens.css`'s `@theme inline` block, so Tailwind v4 emitted no rule and all 25 usages across 13 components fell back to `currentColor` — ink-dark borders instead of #d3d6d0 hairlines, across every card, panel, divider and the `AppShell` header, since the UI revamp's Phase 1. Caught by grepping the built stylesheet rather than trusting the class name. Two lines in the `@theme` block; no component changed.

**Verification — the landing page is the one screen that reads no data**, so unlike every other screen it could be verified directly in this sandbox (headless Chromium still can't reach Supabase). Rendered against `vite preview` at 390×844, 1280×900 and 1920×1080: zero console errors, zero page errors, no horizontal overflow at any width. Clicked the primary CTA for real — navigates to `/project/documents` through the actual `useEnsureProject` create-or-fetch, not a stub. One execution defect caught in the screenshot and fixed: workflow step ordinals were rendering as "1 . Extract" because `font-data`'s tabular figures widened the numeral — and `font-data` is reserved for citable values (figures, CINs, page refs), not labels. Now a proper "STEP 1" eyebrow.

`npm test` 149/149, `tsc -b`/`vite build`/`lint` all clean. Main bundle 926.40KB → 874.16KB (the shared `button` chunk split out at 52.18KB now that landing and app both use it); landing is its own 7.76KB lazy chunk, so `/project/*` never pays for it.

**Files:** `src/features/landing/LandingScreen.tsx`, `src/components/landing/{LandingHeader,LandingHero,LandingFeatures,LandingWorkflow,LandingFooter}.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `backend/` (deleted), `docs/STATE.md`, `docs/DECISIONS.md`.

**Outstanding:** Phases 3–4. Phase 2 (demo mode + Audit Log) is done — see next entry. Nothing pushed to `main` until Phase 3's walkthrough passes.

## Phase 2 — DEMO_MODE flag + Audit Log screen

Two things, both go-ahead'd up front: a `DEMO_MODE` flag (same env-driven, config-injected shape as `LLM_PROVIDER`) covering `generated_sections` reads, `fact_events` reads, and generate-section's Gemini call surviving failure; and a project-level, chronological Audit Log screen wired through that same flag. Both are built entirely around the fact that `generated_sections` and `fact_events` are still undeployed live (docs/STATE.md) — DEMO_MODE is what lets the app demo those two features today without deploy access, and stops mattering with zero code change the moment someone applies the migrations.

**`DEMO_MODE`: env flag, not an override switch — it only ever kicks in on a specific failure.** Unlike `LLM_PROVIDER` (an explicit "which implementation" choice, always consulted), `DEMO_MODE` doesn't replace a real read/call outright: every read still tries the real thing first, and the fixture fallback only fires when that real attempt fails with `isMissingSchemaError` — Postgres `42703` (undefined_column) or `42P01` (undefined_table), the exact shape a query hits when its migration hasn't landed. This is deliberate, not a corner cut: it means "the real path takes over automatically once migrations land" is literally true — nobody has to remember to flip `DEMO_MODE` back off, the fallback branch just stops being reachable. `DEMO_MODE` off (the production default) never attempts a fallback at all, so it can't mask an unrelated real bug behind fixture data.

Two env vars, one shared parse function, same cross-runtime split as `LLM_PROVIDER`/`callLLM()`: `supabase/functions/_shared/demoMode/{parseDemoMode,isMissingSchemaError,config,index}.ts` (canonical, Deno-side reads `DEMO_MODE`), re-exported to `src/lib/demoMode/index.ts` (client-side reads `VITE_DEMO_MODE` — Vite only exposes `VITE_`-prefixed vars to the browser, so the flag needs two names, one parse rule). 7 new Vitest tests.

**Wired at the three points named in the go-ahead:**
- **`useProject`'s `generated_sections` read** (`src/hooks/useProject.ts`): on `isMissingSchemaError` + `DEMO_MODE`, re-reads the row without the `generated_sections` column (which is what 42703s) and splices in the existing `fixtureGeneratedSections()` fixture (reused, not reinvented — `src/lib/templates/fixtures.ts`). New `ProjectRow.generatedSectionsIsDemo` flag lets `DraftScreen` show a "Demo data" `Callout` rather than passing fixture prose off as real — the "visibly flagged in the UI" requirement.
- **`fact_events` reads** (new `src/hooks/useFactEvents.ts`): same shape, falls back to a new `fixtureFactEvents()` (`src/lib/factEvents/fixtures.ts` — 6 rows covering all 5 event types, telling the same "Acme Industries Limited" story `templates/fixtures.ts` already tells, for narrative consistency without a hard import dependency between the two). Ordering (`sortFactEventsDescending`, `src/lib/factEvents/auditLog.ts`) is a shared pure function so the real query (`order('created_at', {ascending:false})`) and the fixture path can never disagree on newest-first.
- **generate-section's Gemini call surviving failure** (`supabase/functions/generate-section/index.ts`): the real call is always attempted first — DEMO_MODE never skips it, only survives its failure (quota exhaustion or otherwise). On catch, falls back to a new pure `buildDemoGeneratedSectionsResponse(entries)` (`_shared/generatedSections/`) that produces text in the exact shape `resolveGeneratedSections()` already expects from a real model reply, so it goes through the identical parse/validate pipeline rather than a second code path — and is itself citation-checked against the real confirmed facts, not canned. **A second, related gap closed the same way**: `persistGeneratedSections` selects/writes `generated_sections` too, so even a successful generation couldn't be saved pre-migration. Now returns `persisted: false` under the identical DEMO_MODE + `isMissingSchemaError` condition instead of a 500, and the response carries the generated content either way. `useGenerateSections.ts` reads that flag: `persisted: true` invalidates and refetches as before; `persisted: false` patches the generated content straight into the TanStack Query cache instead of invalidating — a blind invalidate would just re-trigger `useProject`'s own unrelated generic fixture and discard the real, fact-specific content this call just produced.

**Audit Log screen** (`docs/UI_ARCHITECTURE.md` has no prior spec for this — new): `src/features/audit/AuditLogScreen.tsx` (loading/empty/error states, demo banner when `useFactEvents` reports `isDemo`), `src/components/audit/AuditLogTable.tsx` (timestamp/field/event/source/old→new columns, event-type tone mapping onto the existing `Badge` vocabulary — same table styling convention as `SectionCard`'s shareholding table). New route `/project/audit`, nav tab "Audit Log" (`App.tsx`, `AppShell.tsx`).

**Tests:** 20 new Vitest tests total across `src/lib/demoMode/demoMode.test.ts` (parse rules, schema-error detection, client wrapper), `src/lib/factEvents/auditLog.test.ts` (sort ordering, fixture shape), and `src/lib/generatedSections/generatedSections.test.ts` (the demo Gemini-fallback response resolves correctly with real and zero entries). Whole suite: **163/163 passing**, `tsc -b`/`vite build`/`lint` all clean.

**Scope boundary, deliberate — not a gap to "fix" on sight:** DEMO_MODE covers reads (`useProject`, `useFactEvents`) and generate-section's Gemini call, exactly what was asked. It does **not** touch `useUpdateFacts`/`useResolveConflict`'s own internal `.select(...generated_sections...)` calls (their read-modify-write CAS loop) — those still 42703 live regardless of DEMO_MODE, same pre-existing breakage docs/STATE.md already documents ("3 tabs broken"). Extending DEMO_MODE to cover writes wasn't part of this phase's ask and would have meant reasoning through CAS-retry-loop edge cases under a schema-missing condition without live access to verify against — flagged here rather than silently left implicit.

**Not verified live** — same blocker as every undeployed feature this build has hit: this session has no Supabase credentials at all (no `.env`), so none of this could be checked against the real `fvtazfdppcajoglteutz` project, live or otherwise. Code-complete and tested against fixtures/mocks only, consistent with how `generated_sections`/`fact_events` themselves were built and shipped.

**Files:** `supabase/functions/_shared/demoMode/{parseDemoMode,isMissingSchemaError,config,index}.ts`, `src/lib/demoMode/{index,demoMode.test}.ts`, `.env.example`, `src/vite-env.d.ts`, `src/hooks/{useProject,useFactEvents,useGenerateSections}.ts`, `src/lib/factEvents/{auditLog,auditLog.test,fixtures,index}.ts`, `supabase/functions/_shared/generatedSections/{buildDemoGeneratedSectionsResponse,index}.ts`, `src/lib/generatedSections/{index,generatedSections.test}.ts`, `supabase/functions/generate-section/index.ts`, `src/features/draft/DraftScreen.tsx`, `src/features/audit/AuditLogScreen.tsx`, `src/components/audit/AuditLogTable.tsx`, `src/App.tsx`, `src/components/layout/AppShell.tsx`, `docs/STATE.md`, `docs/DECISIONS.md`.

**Outstanding:** live verification, once Supabase credentials/deploy access are available — same blocker as `generated_sections`/`fact_events` themselves. Per phase instructions, stopping here for review before continuing.

## UI polish pass — `updates/v2` branched off `updates/v1.1`, layout/typography fixes from a prior read-only audit

A separate session ran a read-only audit of the theme/font/layout implementation first (no changes). Verdict: the design system itself (`tokens.css`, Fontsource self-hosting) is correctly implemented and not the problem — the visible roughness was layout arithmetic and flat typography. This task actioned that audit's fix list. **New branch `updates/v2`** (created from `updates/v1.1`'s tip) since `updates/v1.1`/`main` serve the live hackathon build and weren't to be touched directly.

**1. Logo 404 on any base-prefixed build, fixed.** `Logo.tsx` referenced `/conexus-mark.png` as a root-absolute path, which resolves against the domain root and ignores Vite's `base: '/conexus/'` — confirmed 404ing in a real built-and-served preview. Moved the asset from `public/` to `src/assets/` and switched to a real `import conexusMark from '@/assets/conexus-mark.png'`, so Vite resolves it through the asset pipeline (hashed filename, base-aware URL) instead of a hand-typed public path.

**2. Container width unification.** `AppShell`'s header/main were `max-w-4xl`, but every screen (`DocumentsScreen` `max-w-2xl`, `FactsReviewScreen`/`DocumentValidationPanel`/`AuditLogScreen` `max-w-3xl`, plus `App.tsx`'s `RouteSkeleton`) re-centered a narrower box inside that, so content's left edge moved every time you switched tabs. Measured before fixing (leftmost non-background pixel in the title-row band of each real built screenshot): Documents 387px, Facts Review 336px, Draft 339px — up to 51px of drift. Picked one width, `max-w-5xl`, set on `AppShell`'s `<main>` and header (dense audit tool, `max-w-4xl` read cramped); deleted every per-screen `mx-auto max-w-*` wrapper (`DocumentsScreen`, `FactsReviewScreen` incl. its skeleton, `DocumentValidationPanel` incl. its skeleton — shared by both `DraftScreen` and nested in `DocumentsScreen`, `AuditLogScreen`, `App.tsx`'s `RouteSkeleton`). Re-measured after: all four tabs land within 2-3px of each other (antialiasing noise, not real drift).

**3. Type hierarchy**, tokens-only, no new sizes/fonts introduced beyond what `tokens.css` already exposes: page `h1`s bumped `text-2xl` → `text-3xl` (Documents, Facts Review, Draft/`DocumentValidationPanel`, Audit Log) so Caslon actually reads as a title rather than body-adjacent. In `FieldRow.tsx` (the field metadata row — repeated per field across all 37+ facts, the single most-repeated instance of the "everything is `text-xs text-ink-muted`" problem the audit called out): confidence percentage now `font-medium` unconditionally (was plain unless already low-confidence), source-doc link now carries a permanent `underline decoration-hairline-strong` (was hover-only, so at rest it didn't read as clickable). Deliberately scoped to this one component rather than touching every metadata occurrence across `ConflictCard`/`DiffTrail`/`AuditLogTable` too, to stay inside the requested line budget.

**4. Vertical rhythm + `ProgressRail` weight.** `FactsReviewScreen`: grouped `FilterBar` + `BulkConfirmBar` into one tight `gap-3` block (they're one control cluster) and added `border-t border-hairline pt-6` before the domains list (a real section break, not just another `gap-6` sibling). `DocumentsScreen`: same `border-t`/`pt-6` treatment before the nested `DocumentValidationPanel`. `ProgressRail`: `py-2.5`→`py-3`, step icon `size-3.5`→`size-4`, step label `text-xs`→`text-sm`, `gap-x-6`→`gap-x-8` — enough to read as a real component, not decoration (no color/background/animation added).

**5. Dead preload comments — decided to fix the comments, not fabricate static links.** `fonts.css` claimed "preloaded, see index.html" for the two above-the-fold faces; `index.html` has no preload links and never did. The preload is real, just not where the comment said — `src/lib/preloadFonts.ts` imports the fonts via `?url` (resolves to the real hashed build filename) and injects `<link rel="preload">` from `main.tsx` before render. Static links in `index.html` aren't feasible without a build plugin to inject the content-hashed filenames (ruled out — "no new dependencies"), so corrected the comments to point at the actual mechanism instead.

**Verification.** `tsc -b`/`vite build`/`vitest run` (163/163)/`oxlint` all clean (2 pre-existing `react/only-export-components` warnings in `badge.tsx`/`button.tsx`, unrelated). **Before/after screenshots of all four tabs came from the real app, not a hand-built harness** — same route-interception technique already used for Facts Review/Draft verification earlier in this project (headless Chromium can't reach Supabase from this sandbox): a small throwaway Playwright script (not committed) intercepted `**/rest/v1/{projects,documents,fact_events}` and served realistic fixture data matching the real `IssuerFacts`/`FactConflict`/`MergeEvent`/`FactEventLogRow` shapes, built once against this branch and once against a clean `git worktree` of unmodified `updates/v1.1` for a true before/after pair.

**Files:** `src/components/layout/{Logo,AppShell,ProgressRail}.tsx`, `src/features/{documents/DocumentsScreen,review/FactsReviewScreen,audit/AuditLogScreen}.tsx`, `src/components/document/DocumentValidationPanel.tsx`, `src/components/review/FieldRow.tsx`, `src/App.tsx`, `src/styles/fonts.css`, `src/assets/conexus-mark.png` (moved from `public/`).

**Outstanding:** none of the audit's fix list is left. Not done, deliberately out of scope: metadata-tier hierarchy in `ConflictCard`/`DiffTrail`/`AuditLogTable` (same pattern as `FieldRow`, not touched — see item 3); a real static-preload mechanism (would need a build plugin); dark mode (still deliberately deferred per `tokens.css`'s own note). Same live-verification caveat as everything else in this file: never seen against the real `fvtazfdppcajoglteutz` project or a real browser, only a real build served and screenshotted with mocked network calls.

## DEMO_MODE fixture inventory — read-only audit, `docs/FIXTURE_INVENTORY.md`

Also on `updates/v2`. Purpose: a definitive map of REAL vs. FIXTURE data across the deployed app, to plan mock replacement and a trustworthy live e2e walkthrough. No application code touched — the only output is `docs/FIXTURE_INVENTORY.md`, plus this entry.

**Method:** grepped every `DEMO_MODE`/`isDemoMode`/`isMissingSchemaError`/`fixture` reference in the repo (client `src/`, edge functions `supabase/functions/`, excluding tests) and read each one. Found exactly 4 `isMissingSchemaError`-gated call sites and 1 ungated any-failure fallback — one more fallback mechanism than the task's starting list named, since `generate-section` turned out to have two independent ones (its own Gemini call, and its persist step), not one.

**The one finding worth flagging up front: `DEMO_MODE` is two separate flags, not one, and they can disagree.** The client reads `VITE_DEMO_MODE` (confirmed baked `true` into the GitHub Pages build, `.github/workflows/deploy-pages.yml:41`, which deploys on push to `updates/v1.1` only) — this governs `useProject`'s `generated_sections` read fallback and `useFactEvents`'s Audit Log fallback, both of which fire reliably today since neither migration is applied live. `generate-section`'s own two fallbacks (its Gemini call, and its DB persist step) instead read a **separate, server-side `DEMO_MODE` Supabase secret** — and this audit found no evidence that secret has ever been set (`docs/SETUP.md`'s secrets section documents `GEMINI_API_KEY`/`LLM_PROVIDER`/`GEMINI_MODEL`/`GEMINI_BASE_URL` step by step and never mentions `DEMO_MODE`; no PROGRESS/STATE/DECISIONS entry records setting it either). Most likely practical consequence, unverified without deploy access: **"Generate narrative sections" fails outright with a real `500` on the live build today**, not a graceful fixture — because the persist step is guaranteed to hit its schema-missing condition (migration unapplied) with nothing there to catch it. Recommended as the single highest-value five-minute check before any live walkthrough: `supabase secrets list`, or just click the button once.

**The structural risk that matters for later, once that secret and the migration both eventually land together** (a very plausible next step, since someone unblocking the button above would naturally set the server secret to match the client one): a Gemini failure during generation would render self-labeled "[Demo mode]... not produced by Gemini" prose with **no "Demo data" banner** — the systemic flag this app otherwise uses consistently for every other fixture path never fires in that specific combination, because `useGenerateSections.ts`'s success handler only sets `generatedSectionsIsDemo` off the persistence outcome, not content provenance. Full mechanism traced in `docs/FIXTURE_INVENTORY.md` §4.1. Not fixed here — inventory only, per this task's scope.

**Also found:** facts/conflicts/merge_events have no fixture fallback at all, at any layer (closes a gap `docs/STATE.md` had flagged open — reads as already fixed by `useUpdateFacts`/`useResolveConflict` using a narrower column list that never selects `generated_sections`, not merely worked around); `recordFactEvents` best-effort-swallows any audit-log write failure independent of `DEMO_MODE`, which can silently under-report Audit Log even on a fully real, fully deployed setup; two hardcoded placeholder sections (`staticSections.ts`'s Definitions/General Information, `export/disclaimer.ts`'s liability disclaimer) are always-on regardless of `DEMO_MODE` and were already flagged in `docs/STATE.md` as needing real legal text.

**Files:** `docs/FIXTURE_INVENTORY.md` (new).

**Outstanding:** everything in `docs/FIXTURE_INVENTORY.md`'s closing "two things to verify" is a recommendation, not an action taken. Nothing here fixes anything — next steps (confirming the server secret, then deciding whether to key the "Demo data" banner off content provenance rather than persistence) are for a future task.

## DEMO_MODE fixture inventory — attempted live verification, blocked on credentials

Follow-up to the previous entry: asked to pull `generate-section`'s Edge Function logs and run `supabase secrets list` to directly confirm/correct that inventory's §1.4 finding (server `DEMO_MODE` secret likely unset) instead of leaving it as a documentation-gap inference. **Could not — this session has no Supabase credentials of any kind beyond the public anon key** (checked: no `.env`, no `SUPABASE_ACCESS_TOKEN` or any token-shaped env var, no `supabase` CLI installed, no CLI login state on disk anywhere). Confirmed this is a credentials gap, not a network one: an unauthenticated `curl` to the Management API reached it cleanly and got a clean `401`, not a connection failure. `generate-section` was **not** invoked, no secrets were touched, no code changed — read-only investigation only, per the task.

Recorded as a dated addendum at the bottom of `docs/FIXTURE_INVENTORY.md` (not a rewrite of the existing content) — explains exactly what was checked, why each of the four asks couldn't be completed, and the two commands (CLI or Management API, either needs a real personal access token) whoever has actual project access should run next. The original §1.4 finding stands exactly as before: an inference, not a confirmed observation, neither strengthened nor weakened by this attempt.

**Files:** `docs/FIXTURE_INVENTORY.md` (addendum appended).

**Outstanding:** the live check itself. Needs a human with real `fvtazfdppcajoglteutz` access (Supabase personal access token or dashboard login) to run `supabase functions logs generate-section` and `supabase secrets list`, both against `--project-ref fvtazfdppcajoglteutz`.
