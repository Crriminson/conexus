# UI Architecture

Phase 2 of the UI revamp track (`docs/UI_INVENTORY.md` was Phase 0, `docs/DESIGN_SYSTEM.md` was Phase 1). This maps every backend capability on `updates/v1.1` to a screen, decides routes and component hierarchy, and pins the state-vocabulary → design-token mapping so Phase 3 doesn't reinvent it per screen. **No code changes in this phase** — file paths below are the target layout for Phase 3, not what exists today.

## Scope check, before mapping screens

The brief's first bullet is "Project list → project workspace shell." Checked against the backend before mapping it: `docs/ARCHITECTURE.md` explicitly cuts multi-project — *"Consistency engine and multi-project list are scaffolding/derived value — demonstrate nothing about the actual innovation. Cut for prototype"* — and `CLAUDE.md` describes this as a single-issuer, single-project, no-auth app. `useEnsureProject` (`src/hooks/useEnsureProject.ts`) doesn't list projects; it fetches the one row or creates it. There is no `useProjects()`, no project-switching, nothing to list.

Per the instruction not to invent a shim: **there is no "project list" screen in this phase.** What the backend actually supports, and what's mapped below instead, is a **project workspace shell** — a persistent header/nav wrapping the existing single project, replacing `App.tsx`'s current inline tab-button block. If multi-project ever becomes real scope, it re-enters as a genuinely new backend capability (a projects table query + create flow), not a UI-only addition — flagging that here so it isn't silently assumed later.

## Screen map

| # | Screen | Route | Backend capability | Primary hooks |
|---|---|---|---|---|
| 0 | **Workspace shell** | wraps all routes below | `useEnsureProject` (get-or-create the one project) | `useEnsureProject`, `useProject` (for the header eligibility badge) |
| 1 | **Documents & extraction** | `/project/documents` | Upload → chunked async extraction (`extract` Edge Function, `pg_cron` reaper) | `useDocuments`, `useUploadDocument`, `useRunExtraction` |
| 2 | **Facts Review** (incl. conflict resolution) | `/project/review` | Merged `IssuerFacts` (37 fields / 6 domains on the live ANP dataset), human confirm/edit, `FactConflict` resolution | `useProject`, `useDocuments`, `useUpdateFacts`, `useResolveConflict`, `useOpenSource` |
| 3 | **Draft** (eligibility, narrative sections, citations, export) | `/project/draft` | `assembleSections` (static/computed/generated), `evaluateEligibility`, `generate-section` Edge Function, `checkExportGate` + Markdown export | `useProject`, `useDocuments`, `useGenerateSections`, `useOpenSource` |

Every data need across all three screens is served by an existing hook. **No new hook or backend shim is required for this phase's scope** — see "Flagged gaps" at the end for the one real (non-hook) gap found.

## Routes

```
/                    → redirect → /project
/project             → redirect → /project/documents  (first tab is upload; nothing else exists until a document lands)
/project/documents   → Documents & extraction screen
/project/review      → Facts Review screen (conflict queue lives here, not a separate route — see below)
/project/draft       → Draft screen (eligibility detail, narrative, citations, export)
```

Wouter, same as today. Conflict resolution does **not** get its own route: `FactConflict`s are a state *of* the facts on this project, not an independent resource — a dedicated route would let someone deep-link into "conflicts" while Facts Review itself renders stale data. It gets first-class **screen real estate** instead (see below), inside `/project/review`.

## Screen 0 — Workspace shell

**Today:** `App.tsx`'s `ProjectPage` inlines a 3-button tab switcher and owns `useEnsureProject` directly. No persistent chrome, no branding, eligibility is buried inside one tab.

**Target:** `src/components/layout/AppShell.tsx` — header with the logo (kept as-is per the salvage instruction), project name, and a compact eligibility indicator; nav switches the three routes above. `App.tsx` becomes routing + `AppShell` composition only.

The eligibility promotion is the one real structural decision here: `src/lib/eligibility/types.ts` already documents `EligibilityStatus` as *"a live at-a-glance signal... the traffic light updates as extraction happens"* — that's a description of shell-level chrome, not one-tab content. Proposal: `src/components/eligibility/EligibilityBadge.tsx`, a compact `VerificationStamp`-based summary in the header (visible on every screen, every tab), while the existing rule-by-rule breakdown (`EligibilityCard`) stays put on the Draft screen for the detail view. Same `useProject` call, no new hook — React Query already dedupes the cache key across `AppShell` and whichever screen also calls it.

## Screen 1 — Documents & extraction (`/project/documents`)

**Today:** `UploadPanel.tsx` — dropzone + a flat list of documents with a status pill. Chunk progress is already tracked (`DocumentRow.extraction_completed_chunks` / `extraction_total_chunks`, polled every 3s via `useDocuments`) but only ever rendered as text (`processing (N/M)`), never a real progress bar — this is the "not a spinner" requirement the brief calls out, and the data to satisfy it already exists; what's missing is a component, not a hook.

**Target:**
```
src/features/documents/
  DocumentsScreen.tsx          screen composition (was UploadPanel.tsx)
src/components/documents/
  Dropzone.tsx                 drag/drop + click-to-browse zone
  DocumentListItem.tsx         one document's row: filename, status, retry/extract action
  ExtractionProgress.tsx       "chunk N of M" — determinate, uses ui/progress.tsx
src/components/ui/
  progress.tsx                 NEW primitive — generic value/max bar, reusable beyond this screen
```

States: **loading** (`Skeleton` rows while `useDocuments` is pending), **empty** (`Callout tone="neutral"`, "no documents yet," dropzone doubles as the action), **error** (upload/extraction failures — `Callout tone="signature"`, per the pinned rule's failed-extraction case), **in-progress** (`ExtractionProgress`, determinate, chunk count from real data), no disabled/blocked-by-gate state on this screen.

## Screen 2 — Facts Review (`/project/review`)

**Today:** `FactsReview.tsx` renders 6 domains flat, one long page — three flat-field domains (`FLAT_DOMAINS`) and three array domains (`ARRAY_DOMAINS`), each `FieldRow` inlining its own `ConflictCard` when a pending conflict exists on that field. On the live ANP dataset that's **37 fields**, and per `docs/STATE.md` **3 of them currently carry a live, unresolved `FactConflict`** — buried three levels deep in the render tree (domain → field → inline card) with no way to see all three at once.

This is the brief's explicit call-out — conflict resolution "as a first-class flow, not buried" — and it's a real, not hypothetical, problem: those 3 ANP conflicts are genuine unresolved judgment calls sitting in production data right now.

**Target:**
```
src/features/review/
  FactsReviewScreen.tsx        screen composition — status summary, filter bar, conflict queue, domain list
src/components/review/
  ConflictQueue.tsx            NEW — all pending conflicts, top of screen, rendered once
  ConflictCard.tsx             existing, unchanged — now only ever instantiated from ConflictQueue
  DomainSection.tsx            NEW — extracts FactsReview.tsx's per-domain render loop (flat + array) so
                                the screen file stays under ~200 lines with 37 fields' worth of iteration
  FieldRow.tsx                 existing, trimmed — no longer renders ConflictCard inline; shows a compact
                                "N conflicts — resolve above" badge/link that scrolls to ConflictQueue instead
  DiffTrail.tsx                existing, unchanged
  FilterBar.tsx                NEW — status filter chips (confirmed / edited / ai / empty) + domain jump links
  BulkConfirmBar.tsx           NEW — appears when 2+ ai-status fields are visible under the current filter;
                                fires sequential useUpdateFacts mutations (see gap note below)
```

**Density handling**, concretely: `FilterBar` lets a reviewer isolate "just the AI-proposed fields still needing a look" out of 37, instead of scrolling a flat list. `BulkConfirmBar` acts only on whatever's currently visible under a filter — never a hidden global "confirm all." Domain grouping is already structurally present (`FLAT_DOMAINS`/`ARRAY_DOMAINS`); `DomainSection` should stay collapsible per-domain so a reviewer working through Litigation doesn't have Company's 6 already-confirmed fields taking up scroll space.

**Conflict resolution as first-class flow:** `ConflictQueue` renders every pending conflict across the whole project as its own section at the top of the screen, above the domain list, using `ConflictCard` — same component, promoted to top-level real estate instead of nested per-field. The screen's own status summary bar gets a `signature`-colored count (per the pinned rule, case 1) that's impossible to miss on load when conflicts exist, not just a small red pill mixed in with three other status pills.

States: **loading** (`Skeleton` field rows), **empty conflict queue** (simply not rendered — no conflicts is the normal case, not an empty state needing explanation), **error** (mutation failures, `Callout tone="signature"`), no blocked-by-gate state on this screen.

## Screen 3 — Draft (`/project/draft`)

Named "Draft" rather than "Document" — the latter read as a near-duplicate of the Documents (uploads) screen, one letter apart. This is a screen-naming decision only; the underlying document data model (`Section`, `generated_sections`, `assembleSections`, etc.) keeps its existing names throughout.

**Today:** `DocumentView.tsx` does five things in one file: eligibility card, generate-sections button, export button, and rendering every section kind (static/generated/computed-list/computed-table) inline in one large conditional block.

**Target:**
```
src/features/draft/
  DraftScreen.tsx               screen composition
src/components/document/
  SectionCard.tsx              one section, dispatches on Section.kind — the single place each kind
                                renders, closing off the isTable() duplication risk (docs/DECISIONS.md)
                                for good rather than just re-fixing the one regression already found
  CitationLink.tsx             extracts the sourceLink() closure — used by both generated-section
                                citations and computed-section cell sources today; same component either way
src/features/eligibility/
  EligibilityCard.tsx           existing, restyled to tokens (see mapping below) — stays the detail view
src/features/generate/
  GenerateSectionsButton.tsx    existing, restyled
src/features/export/
  ExportPanel.tsx               reworked from ExportButton.tsx — promoted from a button + one-line caption
                                to a full section with a real blocked-by-gate Callout
```

**Export gets real screen real estate**, per the brief: today `!gate.allowed` renders `{gate.missingFieldPaths.length} field(s) not confirmed yet` as a caption under a disabled button. Target: `Callout tone="signature"` with `items={gate.missingFieldPaths}` — the literal field paths, in `.font-data`, exactly per `docs/DESIGN_SYSTEM.md`'s "never summarize this as '3 fields missing.'" `checkExportGate` (`src/lib/export/gate.ts`) already returns the full path list; nothing new to compute, only to actually render.

States: **loading** (`Skeleton`, section-shaped), **error** (project load failure), **incomplete sections** (`caution` badge per section, unchanged pattern — a section not being ready yet isn't a failure), **blocked-by-gate** (export, as above), **empty generated sections** (`Callout tone="neutral"` before first generation, distinct from `Callout tone="caution"` if generation was attempted and failed).

## Status vocabulary → design token mapping

Four different status vocabularies exist in the current code (`Field.status`, `EligibilityStatus`, `Section.status`, `DocumentRow.extraction_status`), each currently hand-rolled with its own Tailwind color classes (`bg-green-100 text-green-800`, `bg-blue-100`, etc. — none of them the new tokens). Pinning the mapping once here so Phase 3 doesn't re-decide it four times, once per screen:

| Vocabulary | Value | Token / component | Notes |
|---|---|---|---|
| `Field.status` (`envelope.ts`) | `empty` | `ink-muted`, no stamp | Nothing to confirm yet |
| | `ai` | `caution` / `VerificationStamp status="pending"` | AI-proposed, unreviewed — **not** signature (pinned rule) |
| | `confirmed` | `confirmed` / `VerificationStamp status="confirmed"` | |
| | `edited` | `confirmed` / `VerificationStamp status="confirmed"`, label text "Edited" | A human-authored correction is exactly as trustworthy as a confirmation — today's amber for `edited` conflates "AI, needs review" and "human already decided," which is worth fixing, not carrying forward. Color says trust tier; label text still says provenance. |
| `EligibilityStatus` (`eligibility/types.ts`) | `pass` | `confirmed` | |
| | `warning` | `caution` | Approaching a threshold, not disqualifying yet |
| | `fail` | `signature` | Pinned rule, case 4 — see `docs/DESIGN_SYSTEM.md` |
| | `unknown` | `ink-muted` | Data not there yet, not a verdict |
| `Section.status` (`templates/types.ts`) | `ready` | `confirmed` badge | |
| | `incomplete` | `caution` badge | Not signature — a section still filling in is normal mid-review state, not a conflict or a failure |
| `DocumentRow.extraction_status` | `pending` / `processing` | `caution`, `ExtractionProgress` | |
| | `complete` | `confirmed` | |
| | `failed` | `signature` | Pinned rule, case 3 |
| `FactConflict.resolution` | `pending` | `signature` / `VerificationStamp status="conflict"` | Pinned rule, case 1 |
| | `kept_current` / `accepted_proposed` | `confirmed` (in `DiffTrail`'s history) | Resolved — reads as settled, not as a residual flag |

This directly replaces every ad hoc `Record<Status, string>` color map currently living in `EligibilityCard.tsx`, `FieldRow.tsx`, `FactsReview.tsx`, `DocumentView.tsx`, and `UploadPanel.tsx` — five separate maps collapsing into one documented table, each screen just reading the same tokens.

## Flagged gaps

**No hook or backend gap.** Every screen's data need — including the ones that looked like they might need something new (chunk progress, bulk confirm, conflict-queue-wide view) — is already served by an existing hook reading data the backend already returns. Specifically checked and confirmed *not* gaps:

- **Chunked extraction progress** — `DocumentRow` already carries `extraction_completed_chunks`/`extraction_total_chunks`, polled live by `useDocuments`. The gap is a missing **component** (`ui/progress.tsx`), not missing data.
- **Bulk confirm** — `useUpdateFacts` operates one field at a time by design (its optimistic-concurrency retry loop is why: see the "lost update" comment in `src/hooks/useUpdateFacts.ts`). A "confirm all visible" action fires that same mutation multiple times, sequentially — sequentially specifically to avoid N calls racing each other's version-conflict retries on the same row. This is a screen-level orchestration pattern (`BulkConfirmBar`), not a new hook; a `useBulkConfirm` wrapper would just be a loop with no logic of its own to justify a shim.
- **Conflict-queue-wide view** — `project.conflicts` (from `useProject`) is already the full array for the project; `ConflictQueue` filters it client-side (`resolution === 'pending'`), same as `FactsReview.tsx` already does today for its summary count.

**One real, non-hook gap:** the eligibility badge's "live at-a-glance" promotion to the shell header means `useProject` now gets called from both `AppShell` and whichever screen is active. Confirmed this is safe, not a gap needing a fix — TanStack Query dedupes by `projectQueryKey(projectId)`, so this is a second subscriber to the same cached query, not a second network call. Noted here only so it isn't mistaken for something to build around.

## Verified

Doc-only phase — no code changed, so `npm run build` / `npm test` / `npm run lint` are unaffected (still clean from Phase 1, re-verified before writing this up). Every file path referenced above was checked against the actual current tree, not assumed.

## What's NOT done here

No screens were touched, no components created, no reorganization executed — this is the plan Phase 3 builds against, one screen per commit, in the order listed above (Documents → Facts Review → Draft), per the original phase brief.
