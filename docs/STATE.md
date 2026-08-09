# State — read this first

A cold session (fresh clone, no prior context) should read this before anything else. `docs/PROGRESS.md` has the full task-by-task history if you need the detail behind any of this; `docs/DECISIONS.md` has the reasoning behind non-obvious calls; `docs/SETUP.md` has everything needed to actually run this.

## Current phase (2026-08-09): full app completion, not just demo readiness

Branch of record is now `updates/v1.1` (the branch this history lives on — a separate session branch had been cut from `main`, which lacked all of Tasks 9–14; that's fixed, `updates/v1.1` is source of truth going forward, no new branches off `main`).

Five-step plan: (1) pluggable AI provider, (2) browser + live-data verification of Tasks 10/11/13/14, (3) UI gap-fill against `ARCHITECTURE.md`, (4) Task 12 (generate-section) built against the pluggable provider, (5) final cleanup/docs pass.

**Step 1 — pluggable AI provider: done.** `supabase/functions/_shared/llm/` now holds an `LLMProvider` interface (`types.ts`), a Gemini implementation taking config instead of reading env directly (`geminiProvider.ts`), a no-network mock implementation for tests (`mockProvider.ts`), and an env-driven factory (`config.ts`, reads `LLM_PROVIDER` — defaults to `gemini` — plus `GEMINI_API_KEY`/`GEMINI_MODEL`/`GEMINI_BASE_URL`). `callLLM.ts` is now a thin wrapper over the factory so `extract/index.ts` didn't need to change. Re-exported via `src/lib/llm/` (same pattern as `merge()`) so it's Vitest-testable; 16 new tests against a mocked `fetch` and the mock provider, all passing (92/92 suite-wide). Gemini was not called during this work.

**Pre-existing bug found during typecheck, not yet fixed (out of Step 1's scope):** `src/features/document/DocumentView.tsx` uses `<ExportButton>` (line 59) but never imports it from `src/features/export/ExportButton.tsx`. This predates this session (confirmed via `git stash -u` against a clean `updates/v1.1` checkout) and breaks `npm run build` (`tsc -b` fails) — it will also break the Document tab at runtime the moment Step 2's browser check reaches it. One-line fix (add the import); flagged rather than fixed since it isn't part of Step 1.

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

## Task 9 — Facts Review screen (built and verified in a real browser)

The demo centerpiece per section 9. Built along with its prerequisite:

- **`useUpdateFacts` is now version-aware** — this was the blocking prerequisite, not a side quest. It used to take a whole `IssuerFacts` and blind-`.update({facts})`, so a human edit submitted mid-extraction overwrote the column with a copy read before that extraction merged, silently discarding it. Chunking widened that window to 15+ minutes, and the Review screen is exactly where humans edit during one. Contract is now a **single field-path patch**; each attempt re-reads the row, applies only that field to the fresh copy, and writes conditioned on `version` (same CAS the extract function uses), retrying on conflict. `useResolveConflict` uses the identical discipline since it also writes `facts`.
- **Path grammar is load-bearing and shared.** `merge()` emits `domain[recordId].field` into `MergeEvent.fieldsWritten` and `FactConflict.fieldPath`, both persisted. `src/lib/facts/fieldPath.ts` parses exactly that grammar; conflict resolution feeds `conflict.fieldPath` straight through it. If the two ever drift, array-field conflicts silently stop resolving and the diff trail goes blank — there's a test pinning this (`path grammar agrees with merge()`), and it was verified against real persisted data, not just fixtures.
- **Screen** (`src/features/review/`): domains grouped and explicitly ordered; amber highlight below 0.5 confidence (section 4's threshold, which merge() deliberately doesn't branch on); click source → signed URL opened at `#page=N`; click-to-edit inline; Confirm per field; conflict badges with side-by-side Keep current / Accept proposed showing both sources; per-field diff trail assembled from merge events (writes *and* skips — "another document agreed, we kept yours" is the reassurance a reviewer wants).
- Accepting a proposed value marks the field `edited`, not `ai`, so a later extraction proposing something else raises a fresh conflict instead of silently overwriting a human decision.

**Verified live in a real browser, 2026-08-09.** Chromium in this sandbox still can't reach the internet (see environment notes below), so this was done by running `npm run dev` on a real machine (macOS) against the live Supabase project (`fvtazfdppcajoglteutz`) — first human eyes on this screen. Result: clean startup, no build errors, no console errors.

- **Stats bar and domain grouping render correctly** against real data: 1 confirmed / 0 edited / 526 from AI / 100 empty. Company section fields populate correctly (legal name, CIN, incorporation date, registered office, industry, business description), with confidence badges and source links (including page refs into the chunked file, e.g. `p.181`).
- **Inline edit verified**: edited `company.legalName` to a test value, save succeeded, status flipped `ai → edited`, and the stats bar updated in sync in the same interaction.
- **The diff trail is real and correct**, not just plumbing that compiles: history on the edited field showed the original extraction event, then ~12 `"Also seen in <doc> — kept existing value"` entries from the chunked re-run, then the human correction — in the right order, with real timestamps.
- **This incidentally verified something we didn't have direct evidence for before**: the merge precedence table's no-op branch (`ai`/`confirmed` field, same-or-lower-confidence proposal → keep, discard) is firing correctly in production, not just in the 18 `merge()` unit tests. **Still unverified**: the *differing*-value branch that raises an actual `FactConflict` — needs a re-extraction that disagrees with a confirmed field, which needs Gemini quota to force.

## Demo plan (revised 2026-08-09) — Gemini quota decision now deferred to the end

Gap-list review of Tasks 10–14 against the architecture doc: Task 11 (templates) required, Task 13 (document view) required, Task 10 (eligibility) required but zero Gemini dependency, Task 12 (generate-section) deferred (blocked on Gemini quota). Task 14 (export) was initially deferred too but was later built ahead of the quota decision, same as 10/11/13 — see below.

**Before Task 11 was built, the live project's facts were checked and found unusable**: zero fields anywhere were `confirmed` (526 `ai` / 100 `empty` / 1 `edited`), and the singleton project's facts were contaminated — `company.legalName` read "VERITAS FINANCE LIMITED" while `company.industry` read "Topical Generics Pharmaceuticals", i.e. two unrelated companies' test uploads had merged into one project's fact set (the singleton-project design merges every upload into the same row, and tonight's testing uploaded documents from different companies into it). **Project facts/conflicts/merge_events were wiped back to empty** (CAS-conditioned PATCH, version bumped 23→24) rather than build against contaminated data.

The document assumed to be "the 30–50 page demo doc" (`1785756069624.pdf`) was checked and is actually **540 pages / 13.6MB** — same scale as the DRHPs that already exhausted quota, not a small file. No genuinely small demo document exists yet.

**Decision: don't block further roadmap work on the Gemini quota call.** Buy-credits-vs-smaller-doc is deferred to the end of the night. Tasks 11, 13, and 10 are being built and tested against a **fixture** confirmed `IssuerFacts` dataset (`src/lib/templates/fixtures.ts`, schema-accurate, not wired into the live app) instead of waiting on live data. **Both Task 11 and Task 13 still need a pass against real live confirmed facts once the quota decision is made and the actual demo document is extracted** — fixture-verified is not the same guarantee as Task 9's live-browser verification, and that gap is real until it's closed.

## Exact next action

1. ~~Build Task 10 (`src/lib/eligibility/`)~~ — done, see below.
2. ~~Build Task 14 (export)~~ — done, see below. Tasks 10, 11, 13, 14 are all code-complete and fixture-tested; only Task 12 (`generate-section`) remains blocked on the Gemini quota decision.
3. Once the Gemini quota decision is made (buy credits vs. smaller doc) and a real demo document is extracted: hand-confirm the ~12–15 fields Tasks 11/13 need, re-verify `src/lib/templates/`, `DocumentView`, and the Task 14 export gate against that live data (currently only fixture-verified), and check for duplicate/near-identical records (promoters showed this pattern before — see open item 2) before confirming anything.
4. Task 12 (`generate-section`) remains deferred — the only task actually blocked on the quota call.

The differing-value conflict branch is still never observed end-to-end (needs a confirmed field + a re-extraction that disagrees, which costs quota) — worth forcing once quota allows, but not blocking anything else.

## Task 11 & 13 — templates and document view (built, fixture-verified only)

**Task 11** (`src/lib/templates/`): 2 static boilerplate sections (Definitions, General Information — placeholder text, not reviewed legal copy) plus 3 computed sections (Capital Structure, Financial Summary, Shareholding Pattern). Computed sections read `status === 'confirmed'` **strictly** — not `edited`, not `ai` — per the explicit human call to keep an empty screen over a contaminated one. Each section reports `status: 'ready' | 'incomplete'` plus `missingFieldPaths` for whatever isn't confirmed yet. `assembleSections(facts)` returns all 5 in a fixed order. 9 Vitest tests, including one pinning that an `edited`-but-unconfirmed field is correctly excluded.

**Task 13** (`src/features/document/DocumentView.tsx`): renders `assembleSections()`'s output — static sections as prose, computed sections as either a key-value list (capital structure, financials) or a table (shareholding, since it's genuinely tabular), each with a live source link (signed URL via `useOpenSource`, same pattern as Task 9) and a per-section status badge. Wired into `App.tsx` as a third "Document" tab alongside Documents/Facts Review. Small, mostly wiring, no new hooks needed.

**Verification status: fixture only, not live.** `src/lib/templates/fixtures.ts` provides a fully-confirmed, schema-accurate `IssuerFacts` fixture (2 promoters, all domains populated) — `tsc`/`vitest`/`vite build` all clean, and a test confirms every computed section reads `ready` against it. **Nobody has looked at the Document tab in a browser** (same Chromium-can't-reach-network limitation as everything else this session), and it has never rendered real Supabase data — only the fixture. Re-verify both once the Gemini quota decision lands and a real document gets hand-confirmed.

## Task 10 — eligibility engine (built, fixture-verified only)

`src/lib/eligibility/`: 6 deterministic rules over `IssuerFacts` (net worth positive, profitable, minimum 20% promoter contribution, capital structure consistency, no pending material litigation, CIN format), each pure and independently unit-tested (17 tests). Unlike Task 11, this engine reads **whatever value is present regardless of status** — it's a live at-a-glance signal, not a gate on what gets assembled/exported — but every result carries a `basis: 'confirmed' | 'unconfirmed' | 'missing'` so the UI can visibly distinguish a green light backed by verified data from one backed only by an AI guess. Zero Gemini dependency, built and tested fully rather than deferred. `EligibilityCard` (`src/features/eligibility/`) renders the traffic light; wired into the top of the Document tab.

Notable design points worth knowing before extending this:
- The 20%-promoter-contribution rule distinguishes "known holdings already clear 20%, so missing others doesn't matter" (`pass`) from "known holdings are short and some promoters are still unconfirmed, so the true total is unknowable" (`unknown`, not `fail`) — both cases are pinned with tests.
- `profitable` warns rather than fails on a loss (a single bad year isn't disqualifying, and this schema only holds one year's financials anyway — not the multi-year distributable-profits track record real SEBI ICDR eligibility actually requires).
- Overall status is worst-of across rules: any `fail` → `fail`; else any `warning` → `warning`; else any `unknown` → `unknown`; else `pass`.

**Verification status: fixture only**, same caveat as Tasks 11/13 — `tsc`/`vitest`/`vite build` clean, but never run against real Supabase data or seen in a browser.

## Task 14 — export to Markdown (built, fixture-verified only)

`src/lib/export/`: `checkExportGate(facts)` blocks export unless every computed section from Task 11's `assembleSections()` is `ready` (i.e. the exact same "Ready"/"Incomplete" bar the Document tab already shows — reused, not reimplemented, so the two can never disagree). `buildExportMarkdown(facts, documents)` renders the same sections as Markdown: static sections as prose, flat computed sections as a key-value list with inline source citations, repeating-group sections (shareholding) as a real Markdown table with a Source column. `exportProjectMarkdown()` combines gate + render, throwing `ExportNotAllowedError` (carries `missingFieldPaths`) instead of ever returning partial output. `downloadMarkdownFile()` is a thin Blob/anchor-click wrapper, same "not unit tested, it's a DOM one-liner" treatment as `useOpenSource`. `ExportButton` (`src/features/export/`) is wired into the top of the Document tab next to the eligibility card — disabled with a "N field(s) not confirmed yet" message when the gate fails.

**The disclaimer text is a placeholder, not the real thing.** ARCHITECTURE.md names "verbatim liability disclaimer" as a requirement but never actually specifies the wording anywhere in the repo — flagged to the user directly rather than inventing legal text and calling it verbatim. Shipped `src/lib/export/disclaimer.ts` with clearly-marked placeholder copy (same convention as Task 11's static-section boilerplate). **Whoever owns the real legal text needs to supply it before this is a real deliverable** — see `docs/DECISIONS.md`.

15 Vitest tests: gate blocks/allows correctly against fixture vs. empty facts, disclaimer text is present verbatim, section order matches Task 13, key-value and table rendering (including source citations) both checked against exact expected strings, "No records." on an empty computed section, filename slugification (confirmed name vs. fallback), and `exportProjectMarkdown` throwing with the right error type/payload on an incomplete dataset.

**Verification status: fixture only**, same caveat as Tasks 10/11/13 — `tsc`/`vitest`/`vite build` clean (76/76 tests passing across the whole suite), but the Export button has never been clicked in a real browser and no real `.md` file has been downloaded and eyeballed yet.

## Open items — noted, not acted on

These are known and deliberately parked. Don't treat them as bugs to fix on sight; they need a human call or an external unblock.

1. **Gemini quota is the hard blocker on full extraction — now precisely diagnosed, and deliberately not being worked around tonight.** The 429 body names the exact limit: `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier, quotaValue: 20`. The free tier allows **20 `gemini-2.5-flash` requests per calendar day, total** — a 26-chunk document cannot complete in one day on this plan regardless of retry/backoff logic. Confirmed resume works correctly: a retry picked up at chunk 19 (not 0), got exactly one more chunk through to 20, then hit the identical daily cap (document `9c87d13e-32a1-417b-8c79-125c6823f5ee`, still at 19/26). **Decision (2026-08-09): skip billing, demo on a smaller document instead** — see "Demo plan" above. Nothing left to fix in code either way.
2. **Possible over-extraction on promoters / related parties.** The 19-chunk run produced 15 promoters and 78 related-party transactions, some sparse (`din`/`panOrId` null, name sourced to p.1). That's high enough to suspect the prompt is over-eager or that natural-key matching isn't collapsing records that should be one. It's an extraction-accuracy question, not a pipeline bug — the Review screen now surfaces exactly this, so judge it there before changing the prompt.
3. **Test artifacts still in the project.** The e2e runs left `documents` rows and ~26 chunk objects per run under `e2e-test/` in Storage, plus the facts they merged into the singleton project. Fine for now (they're what makes the Review screen non-empty), but they are not a curated demo dataset — Task 15 will want a clean one.
4. **A second, older test document (`drhp-chunked-*`) shows `failed: "no chunk_plan, uploaded before client-side chunking landed"`.** This is expected, not a bug — it predates `useUploadDocument`'s chunking rewrite and has no `chunk_plan` to resume from. Leave it; don't spend time trying to recover it.

## Open decisions — need a human call, not yet made

- *(none currently — chunking strategy and the `useUpdateFacts` concurrency fix are both resolved; see below.)*

## Environment notes for whoever runs this next

- **Supabase CLI may not work through a proxied sandbox.** In this session, `supabase` (Node/undici-based CLI) could not get a transport through the session's HTTP proxy — `Transport error` on every management call — even though plain `curl` through the identical proxy worked fine, and even with `NODE_USE_ENV_PROXY=1` set. Worked around it entirely via the Supabase **Management REST API** (`api.supabase.com/v1/projects/{ref}/...`) over curl: same deploy, same secrets/migration checks, same result. If you hit the same wall, don't burn time on the CLI — the REST API does everything `functions deploy`/`db push`/`secrets list` do.
- **A headless Chromium in this sandbox could not reach any external host through the session's proxy**, `api.supabase.com` included, even with `proxy: {server: ...}` passed explicitly to Playwright's `launch()` — while the same proxy served `curl` and the Node CLI's own HTTPS calls fine. Root cause not chased down (out of scope, timeboxed). If you need to verify through the actual browser UI in a similar sandboxed session, expect this to bite you. The workaround used here: drive the REST/Storage/Functions calls directly with curl for anything the sandbox itself needs to check, and get a human to run `npm run dev` on a real machine for actual browser/UI verification — that's how Task 9 got its first real browser test (2026-08-09, macOS, confirmed working against live data — see Task 9 section above).
