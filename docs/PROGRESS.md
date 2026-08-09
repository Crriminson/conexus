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
