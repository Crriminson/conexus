# Fixture Inventory — DEMO_MODE and hardcoded content, complete map

Read-only audit, `updates/v2`, 2026-08-12. Goal: know exactly what the deployed
app renders as real Supabase data vs. fixture/fabricated content, so mock
replacement and a trustworthy live e2e walkthrough can be planned. No
application code changed to produce this document — see `docs/PROGRESS.md`
for the corresponding entry.

**Verified against source, not assumed complete from memory**: every
`DEMO_MODE`/`isDemoMode`/`isMissingSchemaError`/`fixture` reference in the
repo was grepped and read (client `src/`, edge functions `supabase/functions/`,
excluding tests). There are exactly **4** `isMissingSchemaError`-gated call
sites and **1** ungated (any-failure) fallback, all listed below. The list in
the task prompt (generated_sections reads, `useFactEvents`, generate-section's
Gemini call) was correct but incomplete in one respect: generate-section
actually has **two** separate fallback mechanisms, not one — its own Gemini
call, and its persist step, gated differently (see §1.4).

**Read this before §1.3/1.4 — "DEMO_MODE" is not one flag, it's two, and they
can disagree.** `.env.example` documents this explicitly but it's easy to
miss: the client reads `VITE_DEMO_MODE` (governs §1.1/§1.2, both client-side
hooks); the `generate-section` Edge Function reads a **separate**,
unprefixed `DEMO_MODE` Supabase secret (governs §1.3/§1.4). This audit
**confirmed `VITE_DEMO_MODE=true` is baked into the live GitHub Pages build**
(§5) but **could not find any evidence the server-side `DEMO_MODE` secret has
ever been set** — `docs/SETUP.md`'s secrets section documents
`GEMINI_API_KEY`/`LLM_PROVIDER`/`GEMINI_MODEL`/`GEMINI_BASE_URL` step by step
and never once mentions `DEMO_MODE`, and no `docs/STATE.md`/`PROGRESS.md`/
`DECISIONS.md` entry records it being set. No deploy/secrets access this
session (same standing limitation as every other undeployed-migration note in
`docs/STATE.md`), so this can't be checked directly — but the evidence points
the same way from every angle available, and it materially changes what
"Generate narrative sections" does on the live build today. See §1.3/§1.4 and
§5 for what this means in practice; **verifying the actual secret value
(`supabase secrets list`) before any live walkthrough is the single most
useful five-minute check this audit can recommend.**

---

## 1. Complete site inventory

### 1.1 `useProject` — `generated_sections` read fallback

- **File / symbol:** `src/hooks/useProject.ts`, `fetchProjectRow()`
- **Trigger:** the initial `.select(LIVE_COLUMNS)` read (`LIVE_COLUMNS` includes
  `generated_sections`) fails, `isDemoMode()` is true, and
  `isMissingSchemaError(error)` is true (Postgres `42703` — the column doesn't
  exist on `projects` yet).
- **Fixture substituted:** re-reads the row with `PRE_MIGRATION_COLUMNS` (no
  `generated_sections`), then splices in `fixtureGeneratedSections()`
  (`src/lib/templates/fixtures.ts`) — three canned sections: `'Fixture risk
  factors text.'`, `'Fixture MD&A text.'`, `'Fixture business overview
  text.'`, each with one identical citation pointing at
  `sourceDocId: 'fixture-doc'` (a document ID that never exists in the real
  `documents` table).
- **Screens:** Draft (`DraftScreen` → `DocumentValidationPanel`), and
  Documents (same `DocumentValidationPanel`, nested lower on the page).
- **Visible?** Yes. Sets `ProjectRow.generatedSectionsIsDemo = true`, which
  `DocumentValidationPanel.tsx` reads to show a `Callout tone="neutral"
  title="Demo data"` banner: *"The narrative sections below are fixture
  content, not real output — the live `generated_sections` column hasn't been
  deployed yet."* — Correctly worded for this specific trigger.
  **Secondary quirk:** the one citation's `sourceDocId: 'fixture-doc'` never
  matches a real document, so `CitationLink` (`src/components/document/CitationLink.tsx:24-25`)
  returns `null` — the citation silently doesn't render at all. Combined with
  the banner this isn't deceptive, but on its own a citation-less AI-content
  block would look like it violates `CLAUDE.md`'s citation rule.

### 1.2 `useFactEvents` — Audit Log fallback

- **File / symbol:** `src/hooks/useFactEvents.ts`, `fetchFactEvents()`
- **Trigger:** `.from('fact_events').select(...)` fails, `isDemoMode()` true,
  `isMissingSchemaError(error)` true. In practice this is **`PGRST205`**, not
  `42703`/`42P01` — the table doesn't exist at all, so PostgREST's schema
  cache reports it, not raw Postgres (documented in
  `supabase/functions/_shared/demoMode/isMissingSchemaError.ts`'s own
  comment).
- **Fixture substituted:** `fixtureFactEvents()` (`src/lib/factEvents/fixtures.ts`)
  — 6 hand-written rows telling an "Acme Industries Limited" story covering
  all 5 `event_type` values (`extracted`, `conflict_raised`,
  `conflict_resolved`, `edited`, `confirmed`).
- **Screens:** Audit Log (`AuditLogScreen`) only.
- **Visible?** Yes. `FactEventsResult.isDemo = true` drives `AuditLogScreen.tsx`'s
  own `Callout tone="neutral" title="Demo data"`: *"These events are fixture
  content, not real activity — the live `fact_events` table hasn't been
  deployed yet."*
- **Note:** the fixture story is "Acme Industries Limited" — a different
  company name than whatever real issuer is in the live `projects` row. Not a
  bug (it's clearly banner-flagged either way), but worth knowing if
  screenshots from Facts Review (real data) and Audit Log (fixture, different
  company) are ever placed side by side.

### 1.3 `generate-section` Edge Function — Gemini call fallback (ungated by schema check)

- **File / symbol:** `supabase/functions/generate-section/index.ts`, the
  `try { rawText = await callLLM(...) } catch` block (~line 148).
- **Governed by the SERVER `DEMO_MODE` Supabase secret, not `VITE_DEMO_MODE`**
  — see the callout at the top of this document. `demoMode` here comes from
  `isDemoMode(Deno.env)`, which reads the unprefixed `DEMO_MODE` env var
  (`supabase/functions/_shared/demoMode/config.ts`'s default `key`), set only
  via `supabase secrets set DEMO_MODE=...`. This audit found no evidence that
  step has ever been run.
- **Trigger:** **any** failure of the real Gemini call, while `demoMode` is
  true. This is **not** `isMissingSchemaError`-gated — quota exhaustion
  (`429`, the documented free-tier daily cap), network failure, an auth/API
  key problem, a timeout, anything that throws out of `callLLM()`, all fall
  back identically. The comment in the source says so directly: *"anything
  that stops the real call from returning falls back the same way when
  DEMO_MODE is on."*
- **If the server secret is actually unset (most likely, per the evidence
  above): this fallback never fires at all.** A Gemini failure instead
  returns a real `502` with `Generation failed: <message>`, surfaced to the
  user via `describeFunctionError` — no fixture text, just a visible error.
  That's a *better* outcome for judging integrity than a silent fixture, but
  a *worse* outcome for a live walkthrough if it happens to hit the
  documented daily quota cap at the wrong moment — see §1.4, which is the
  more likely failure a walkthrough actually hits today.
- **Fixture substituted:** `buildDemoGeneratedSectionsResponse(entries)`
  (`supabase/functions/_shared/generatedSections/buildDemoGeneratedSectionsResponse.ts`)
  — deterministic text per section: *"[Demo mode] Risk Factors narrative
  generated from N confirmed fact(s) — not produced by Gemini. Shown because
  the real call failed and DEMO_MODE is on."* Its citations are **not**
  fabricated — `citedFieldPaths` is every real confirmed fact's field path
  (`entries`, from `collectConfirmedFacts(project.facts)`), so the citation
  links this content shows are real and clickable, unlike §1.1's fixture.
- **Screens:** wherever generated narrative sections render — Draft and
  Documents (`DocumentValidationPanel`, both places) — but only *after* a user
  clicks "Generate narrative sections" (`GenerateSectionsButton`); this is not
  triggered by a plain page load like §1.1/1.2 are.
- **Visible? Conditionally — see §4.1, the primary finding of this audit.**
  The body text is self-labeled ("[Demo mode]... not produced by Gemini") but
  whether the systemic "Demo data" `Callout` banner also appears depends
  entirely on §1.4's outcome, which is a *different* condition. They can
  disagree.

### 1.4 `generate-section` Edge Function — persist fallback

- **File / symbol:** `supabase/functions/generate-section/index.ts`,
  `persistGeneratedSections()`, both its read (`readError`) and write
  (`updateError`) branches.
- **Also governed by the SERVER `DEMO_MODE` secret** (same as §1.3, same
  caveat: no evidence it's set).
- **Trigger:** the write-back to `projects.generated_sections` fails,
  `demoMode` true, `isMissingSchemaError` true (same `42703` condition as §1.1
  — this is the same missing column, hit from the write side instead of the
  read side).
- **Fixture substituted:** nothing extra — returns `{ ok: true, persisted:
  false }`. The generated content (real Gemini output, or §1.3's fallback
  text — either can reach here) is returned in the HTTP response but never
  written to the database.
- **Screens:** same as §1.3.
- **Visible?** Yes, but only through a chain: `useGenerateSections.ts`'s
  `onSuccess` reads `result.persisted`; when `false`, it patches the query
  cache directly with `generatedSectionsIsDemo: true`, which is what makes
  `DocumentValidationPanel`'s "Demo data" banner fire for a *just-generated*
  section (as opposed to §1.1's fire-on-page-load path for previously
  generated content).
- **If the server secret is unset, this is the most consequential single
  finding in this audit.** `generated_sections` is confirmed still unapplied
  live (`docs/STATE.md`, `docs/SETUP.md` line 53), so `persistGeneratedSections`
  is **guaranteed** to hit `isMissingSchemaError` on every single "Generate
  narrative sections" click today, regardless of whether Gemini itself
  succeeds. Without `demoMode = true` to catch it, that error falls straight
  through to `{ ok: false, error: ... }` → the whole request returns a real
  `500`, surfaced to the user as a visible failure via `describeFunctionError`
  — **not** a graceful demo fallback, not any generated content shown at all,
  even transiently. If this is the live state, the "Generate narrative
  sections" button on both Draft and Documents is simply broken in the judged
  build right now, independent of Gemini quota. This is a five-minute check
  (`supabase secrets list`, or just click the button once) that should happen
  before any live walkthrough, not an assumption either way.

### Not a DEMO_MODE site, but adjacent — `recordFactEvents` best-effort write swallow

- **File / symbol:** `supabase/functions/_shared/factEvents/recordFactEvents.ts`
- **Trigger:** any error inserting into `fact_events` — from any of its three
  call sites (`extract`'s `persistChunkFacts`, `useUpdateFacts`,
  `useResolveConflict`) — **completely independent of `DEMO_MODE`'s state.**
- **Behavior:** `console.error`s and returns; never throws, never surfaces to
  the UI. By design (documented in the function's own comment: the audit
  trail must never block the facts write it's describing).
- **Impact:** even with `DEMO_MODE` off and the `fact_events` table fully
  deployed, a write failure (RLS misconfiguration, transient network error,
  anything) silently drops that one audit-trail row with zero user-facing
  signal. The Audit Log screen would just show fewer real events than
  actually happened, indistinguishable from "nothing happened yet." Flagged
  here because it directly affects trust in Audit Log's REAL-data
  completeness, even though it isn't a fixture-substitution path.

---

## 2. Confirmed NOT fixture-gated (reassurance, stated explicitly)

Grepped and confirmed no `DEMO_MODE`/fixture involvement at all:

- **`extract` Edge Function** (`supabase/functions/extract/index.ts`) — the
  extraction Gemini call has no DEMO_MODE fallback of any kind. A real
  extraction failure surfaces as a real `failed` document status, full stop.
- **`facts` / `conflicts` / `merge_events`** — always read via
  `PRE_MIGRATION_COLUMNS` (`'id, name, facts, conflicts, merge_events,
  version'`), which has never included `generated_sections` and therefore
  never 42703s on it. This is the columns list `useProject`, `useUpdateFacts`,
  and `useResolveConflict` all actually use for facts reads/writes — there is
  **no fixture fallback for facts data at all**, at any layer. (This closes a
  gap `docs/STATE.md` flagged as open — it reads as already fixed by the
  narrower column list, not merely worked around.)
- **Eligibility** (`src/lib/eligibility/`) — deterministic rules engine over
  real `facts`, per `CLAUDE.md`'s "numeric/eligibility figures are never
  generated by an LLM" rule. No DEMO_MODE reference anywhere in the module.
- **Computed sections** — Capital Structure, Shareholding Pattern, Financial
  Summary (`src/lib/templates/{capitalStructure,financials,shareholding,generated}.ts`)
  — pure derivations of real `facts`, no DEMO_MODE reference.
- **`fixtureIssuerFacts()` / `fixtureDocuments()`** (`src/lib/templates/fixtures.ts`)
  exist and are exported, but grepped and confirmed **unused outside test
  files** — no production code path ever calls them. Facts and documents
  themselves are never fixture-swapped in the running app, DEMO_MODE on or
  off.

---

## 3. Per-screen inversion

| Screen | Verdict | Detail |
|---|---|---|
| **Documents** | **MIXED** | Upload/dropzone, document list, extraction status (`useDocuments`, `useUploadDocument`, `useRunExtraction`) — **REAL**, no fixture path exists. Nested `DocumentValidationPanel` at the bottom of the screen — see **Draft** row below, identical component. |
| **Facts Review** | **REAL** | Entirely real — facts, conflicts, merge events, edits, confirms, conflict resolution. No fixture fallback exists for any of it (§2). |
| **Eligibility** (Task 10) | **REAL** | Deterministic rules engine, always real `facts`. Rendered inline inside `DocumentValidationPanel`'s `EligibilityCard`, not its own route. |
| **Templates** (Task 11 — computed sections) | **REAL** | Capital Structure / Shareholding Pattern / Financial Summary always derive from real `facts`. The two *static* boilerplate sections in the same list (Definitions, General Information) are a different category — see §4.3, not data-derived at all. |
| **Draft** | **MIXED** | Same `DocumentValidationPanel` as Documents' nested panel. Eligibility + computed sections — REAL. Static boilerplate (Definitions/General Info) — hardcoded, not gated by DEMO_MODE at all (§4.3). Generated narrative sections (Risk Factors/MD&A/Business Overview) — REAL, FIXTURE, or REAL-but-mislabeled-as-fixture depending on which of §1.1/1.3/1.4 fired (see §5 for what actually happens today). Export gate/panel — REAL (`checkExportGate` off real assembled sections). Export disclaimer text — hardcoded, not gated (§4.3). |
| **Audit Log** | **REAL or FIXTURE, never mixed within one load** | Whole-screen binary: either every row is real (`fact_events` table exists and the read succeeds) or every row is the 6-row "Acme Industries Limited" fixture (§1.2) with the "Demo data" banner. Real writes to this table can silently no-op regardless of DEMO_MODE (see the `recordFactEvents` note in §1). |

---

## 4. Flags

### 4.1 Judging-integrity risk: fabricated content that can render as real with no systemic indication

**This is the primary structural finding of this audit — a risk that is
dormant today (most likely) but activates automatically later, silently,
with no code change required to trigger it.** §1.3 (generate-section's own
Gemini-call fallback) and §1.4 (its persist fallback) are two **independent**
conditions, gated by the server `DEMO_MODE` secret (not confirmed set — see
the callout in this document's header) and by whether `generated_sections`
has been migrated. They only coincide the way described below once **both**
"the server secret gets set" and "the migration lands" are true — today,
per §1.4, neither is confirmed, and the more likely near-term behavior is
the outright `500` described there, not a graceful fixture.

- **The scenario that creates this risk:** server `DEMO_MODE` secret set to
  `true` **and** `generated_sections` migrated. At that point, persistence
  starts succeeding. If the Gemini call *then* fails for any reason (quota, a
  transient network blip, a misconfigured API key), §1.3's fallback fires,
  `persisted: true` this time, and `useGenerateSections.ts`'s `onSuccess`
  takes the `invalidateQueries` branch — **never setting
  `generatedSectionsIsDemo`**. The screen refetches, `useProject`'s live read
  now succeeds cleanly (`generatedSectionsIsDemo: false`, hardcoded on every
  successful live read), and **the "Demo data" banner — the one mechanism
  this entire app otherwise uses consistently to flag fixture content — does
  not appear.**
- **Why this is worth fixing before it can happen, not after:** the natural
  path to this state is someone setting the server secret specifically
  *because* the client one is already `true` and they reasonably assume (the
  code comments even describe them as "the same flag, different names per
  runtime") that both need to move together. The two are documented as a
  pair in `.env.example` but are operationally two independent switches that
  can drift — this scenario is the direct consequence of that drift.
- **Not fully silent, but easy to miss:** the fabricated text is self-labeled
  inline (*"[Demo mode] ... not produced by Gemini"*), so a reader who reads
  the full paragraph would catch it. But anyone who skims for the banner —
  which is exactly what every other fixture path in this app trains a reader
  to rely on — would see three normally-formatted narrative sections with no
  flag at all.
- **Secondary, inverse accuracy issue, same root cause:** the reverse can also
  happen — real Gemini output that generated successfully but hit the same
  §1.4 persist failure gets `generatedSectionsIsDemo: true`, i.e. **real
  content mislabeled as fixture.** Lower stakes (errs toward under-claiming,
  not over-claiming) but worth knowing when triaging any "why does this say
  Demo data" report post-migration.

### 4.2 Fixture paths that could mask a genuine failure during a live walkthrough

- §1.1 and §1.2 both key off `isMissingSchemaError`, which matches **any**
  `42703`/`42P01`/`PGRST205`, not specifically "the known pending migration."
  A different real bug that happens to produce a schema-shaped error — a
  typo'd column reference, a broken RLS policy that manifests this way, an
  anon key pointed at the wrong Supabase project — would be swallowed
  identically into the same expected-looking "Demo data" banner. It would
  look exactly like the known, already-documented pending-migration state
  rather than surface as a new problem.
- §1.3 is broader still, **if** the server `DEMO_MODE` secret is ever set: it
  collapses quota exhaustion (expected, documented, free-tier 20/day cap —
  see `docs/STATE.md`'s "Open items") together with genuine integration
  failures (bad API key, network egress blocked, a malformed prompt) into the
  identical fallback text. A judge (or the walkthrough operator) would not be
  able to tell "Gemini is out of quota today" from "the generate button is
  actually broken" just by watching the screen — both would look like the
  same demo-mode message. Per the header callout and §1.4, this specific risk
  is most likely **not live today** (no evidence the server secret is set) —
  today's more likely failure mode for this same button is the outright `500`
  described in §1.4, which is at least honestly visible as an error rather
  than masked as content.
- §1.1/§1.2's masking risk, by contrast, **is confirmed live right now** —
  `VITE_DEMO_MODE=true` is baked into the judged build (§5), so any
  schema-shaped error on those two reads is unconditionally swallowed into
  the "Demo data" banner today, with no way to distinguish "the known pending
  migration" from a different real bug from outside the app.

### 4.3 Hardcoded/stubbed data NOT behind the DEMO_MODE flag at all

Two pieces of always-on placeholder content, present regardless of
`DEMO_MODE`'s value, migration status, or any live data:

- **`src/lib/templates/staticSections.ts`** — the "Definitions" and "General
  Information" sections shown on every Draft/Documents-validation view.
  Fixed boilerplate text, self-labeled inline: *"[Placeholder boilerplate —
  not reviewed legal text.]"*
- **`src/lib/export/disclaimer.ts`** — `LIABILITY_DISCLAIMER`, included
  verbatim at the bottom of every exported Markdown file. Self-labeled
  inline: *"[Placeholder disclaimer — not reviewed legal text.]"*
  `docs/STATE.md` already flags this needs real legal text before export is a
  genuine deliverable — restated here because it's the same category of risk
  as this audit's subject (hardcoded content presented in the live app), even
  though it predates DEMO_MODE and isn't gated by it.

Both are self-labeled in their own body text (lower risk than §4.1's finding,
which lacks any banner at all), but neither would be caught by a search for
`DEMO_MODE` — worth keeping on the mock-replacement list under a separate
heading from the DEMO_MODE-gated items above.

---

## 5. `VITE_DEMO_MODE=true` in the GitHub Pages deploy — confirmed, blast radius

Confirmed at `.github/workflows/deploy-pages.yml:41`, inside the `build` job's
`npm run build` step. The workflow triggers `on: push: branches:
[updates/v1.1]` — **not** `main`, not `updates/v2`; this repo's live judged
build tracks `updates/v1.1` specifically. The workflow's own comment states
the intent plainly: the flag serves fixture data through the same interfaces
whenever `generated_sections`/`fact_events` reads fail on the still-unapplied
migrations, and is meant to **stay set** rather than be pulled later, since it
stops doing anything once those migrations land.

**This is the client flag only.** It sets `VITE_DEMO_MODE`, which governs
§1.1 and §1.2 exclusively. It has **no effect on §1.3/§1.4** — those read the
separate server-side `DEMO_MODE` Supabase secret, which this workflow never
touches (it only builds and deploys the static client bundle; Edge Function
secrets are configured independently against the Supabase project, and this
audit found no record of that ever being done — see this document's header).

**Practical blast radius today** (both migrations confirmed still unapplied
per `docs/STATE.md`):

- **Audit Log: 100% fixture, every session, guaranteed.** The `fact_events`
  table doesn't exist at all yet, so §1.2 fires on every single load with no
  possible real-data outcome. Every judge who opens `/project/audit` sees the
  same 6-row "Acme Industries Limited" story (correctly banner-flagged).
  Governed entirely by the confirmed-on client flag.
- **Generated narrative sections: most likely broken outright today, not
  gracefully fixture-served — verify before relying on this button.** Per
  §1.4: `generated_sections` is unmigrated, so `persistGeneratedSections`
  will hit `isMissingSchemaError` on every "Generate narrative sections"
  click regardless of Gemini's own outcome. If the server `DEMO_MODE` secret
  is unset, as the evidence suggests, that error is not caught — the whole
  request fails with a real `500` and the user sees a visible error, no
  content at all. **If** the server secret turns out to be set after all,
  the behavior instead matches the old assumption: `persisted: false`,
  `generatedSectionsIsDemo: true`, the "Demo data" banner fires, and either
  real Gemini prose (mislabeled as demo — §4.1's secondary note) or the
  canned "[Demo mode]" text (if Gemini also failed) is shown. Either way,
  **§4.1's silent-fabrication risk is not reachable today** — it requires
  the server secret *and* the migration both landing, which hasn't happened.
- **Everything else — Documents, Facts Review, Eligibility, computed
  Templates sections, export gate — 0% affected.** No fixture path exists for
  any of it (§2); neither `DEMO_MODE` value is relevant to what those screens
  show.
- **Static boilerplate and the export disclaimer — 100% placeholder, but this
  was already true before `DEMO_MODE` existed and stays true after both
  migrations land** (§4.3) — not part of either flag's blast radius, listed
  here only so it isn't mistaken for being covered by them.

---

## Summary for planning

For a trustworthy live e2e walkthrough today: Documents, Facts Review,
Eligibility, and the three computed Template sections can be demonstrated as
fully real with no caveats. Audit Log is guaranteed fixture and openly says
so.

**Two things to verify directly before any walkthrough, in priority order:**

1. **Run `supabase secrets list` against `fvtazfdppcajoglteutz` (or just click
   "Generate narrative sections" once) to find out whether the server
   `DEMO_MODE` secret is set.** This audit found strong circumstantial
   evidence it isn't (§1.4) — if so, that button currently fails outright with
   a `500`, which is a functional gap to know about walking in, independent
   of anything DEMO_MODE-related.
2. Whatever that check finds, re-read §4.1: the moment both the server secret
   and the `generated_sections` migration are set/applied together — a very
   plausible next step for whoever unblocks item 1 — a Gemini failure during
   generation will render as normal-looking narrative text with no "Demo
   data" banner. Worth fixing (making `useGenerateSections` key the banner
   off content provenance, not just persistence) before that combination
   happens, not after.

The two hardcoded-placeholder sections (Definitions/General Info, the export
disclaimer) aren't `DEMO_MODE`'s problem to fix but are real content gaps if
the deliverable needs to look final. No code changed here per this task's
scope — both items above are flagged for a future task, not actioned.
