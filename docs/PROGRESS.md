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
