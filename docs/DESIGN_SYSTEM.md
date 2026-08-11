# Design System

Phase 1 of the UI revamp track (`docs/UI_INVENTORY.md` was Phase 0). This establishes tokens, typography, and state patterns — no screens were built or restyled in this phase; that's Phase 3. Read `/mnt/skills/public/frontend-design/SKILL.md` before touching any of this further.

## The brief, in one sentence

This is a SEBI filing tool — the register is a legal/audit instrument, not a consumer dashboard. Every choice below was made against that, and against the specific failure mode of AI-generated design defaulting to one of three looks regardless of subject: warm-cream-serif-terracotta, near-black-with-neon-accent, or newspaper-hairline-broadsheet. None of the three is what's below, on purpose — see each section's "why" for how this brief's actual content (a document-review tool, financial figures, citations, human sign-off) drove the choice instead.

## Color

Six named colors, plus two neutral surfaces:

| Token | Hex | Role |
|---|---|---|
| `paper` | `#F1F3F1` | Page background |
| `paper-raised` | `#FFFFFF` | Cards, popovers — sits above the page |
| `paper-recessed` | `#E7E9E6` | Table stripes, secondary panels, skeleton fill |
| `ink` | `#0B1737` | Primary text, headings — **the logo wordmark color, unchanged** |
| `ink-muted` | `#5C6572` | Captions, metadata, secondary text |
| `confirmed` | `#2B6E5F` | Verified / pass — desaturated descendant of the logo gradient's teal end (`#17C0A9`) |
| `caution` | `#93701F` | Pending / unconfirmed — brass/ochre |
| `signature` | `#7E2430` | The one accent color — seal-red / oxblood |
| `focus` | `#1B3A66` | Focus ring — descendant of the logo gradient's navy end (`#0C3D72`) |

### Why this palette, not the old one

`docs/UI_INVENTORY.md` flagged the old app's primary blue (`hsl(221 83% 53%)`, a bright, saturated blue) as reading like generic SaaS-dashboard blue — technically fine, tonally wrong for a filing product. This palette keeps the logo's **navy** (as `ink`, doing double duty as primary-action color and body text — an audit tool's most important action should look like authoritative text, not a bright call-to-action) but drops the bright blue entirely, and never introduces a second bright hue to replace it.

### Why paper is cool, not cream

The skill's own calibration note names "a warm cream background (near `#F4F1EA`) with a serif display and a terracotta accent" as the single most common AI-generated-design default. `paper` (`#F1F3F1`) is deliberately cool — a hair of green-grey, not yellow — so it reads as cotton/bond paper (the stock actual filings and certificates are printed on) rather than a coffee-shop warm neutral. Same instinct, opposite temperature.

### Why one accent, and why it's red

Most design systems reach for a bright primary + a separate destructive red. This one collapses that into a single **signature** color (`#7E2430`, a seal-red/oxblood) that does three jobs at once: it's the one real aesthetic risk this system takes (see "Signature element" below), the semantic marker for anything that needs a human's judgment call (a `FactConflict`, a blocked export gate), and the closest thing to a "destructive" color the app has. That collapse is intentional, not a shortcut: in this app, "flagged for a human" and "something's wrong" are the same underlying concept — the 3 live ANP conflicts (`docs/STATE.md`) are exactly this: not errors, but *judgment calls a human owes the system*. One color for that whole category is more honest than inventing a second red that means something subtly different.

`confirmed` (teal-green) and `caution` (brass) are the other two semantic colors, both genealogically descended from the **existing logo gradient** (`#17C0A9 → #0C3D72`) rather than invented fresh — `docs/UI_INVENTORY.md` flagged the logo as worth keeping as-is; this extends that same DNA into the UI's status vocabulary instead of introducing unrelated hues. Brass/ochre for `caution` specifically (not a generic amber) because it reads as an emblem/seal metal, keeping the whole palette inside the "official document" register rather than borrowing a traffic-light yellow.

### The seal-red rule — pinned once, here, not decided per-screen

`signature` is reserved for exactly three things. Nothing else gets it, in any screen, ever — if a Phase 3 screen wants to reach for red for something not on this list, that's a sign the state belongs to `caution` instead, not a reason to extend this list ad hoc:

1. **A pending `FactConflict`.** Two sources disagree and a human owes the system a call. `VerificationStamp status="conflict"`, `ConflictCard`, and any conflict-count summary pill (Facts Review's status bar, a per-domain conflict badge).
2. **Blocked-by-gate.** A gate — export, generation, or any future one — that is currently blocking forward progress on a specific, named condition. `Callout tone="signature"` with real `items`, never a bare disabled control.
3. **Destructive actions and terminal failures.** A failed extraction, a failed upload, a mutation error banner, a delete/discard control. The same "this needs a human's corrective attention now" logic as (1) and (2), just triggered by a system failure instead of a data disagreement.
4. **A hard-fail verdict from the deterministic eligibility rules engine** (`EligibilityStatus: 'fail'`, `src/lib/eligibility/types.ts`). The one case here that isn't interactive or gate-shaped — included on purpose, because a disqualifying result is exactly the kind of thing this color exists to flag, and leaving it uncovered would just mean Phase 3 invents its own answer for it (`docs/UI_ARCHITECTURE.md` maps the full `EligibilityStatus` vocabulary against this). `warning` is `caution`, not this — it hasn't failed yet.

Explicitly **not** signature: low-confidence-but-not-yet-conflicting data, an AI-proposed value nobody's reviewed yet, "empty/nothing here" states, or emphasis for its own sake. All of those are `caution` (unreviewed/incomplete — brass, lower alarm) or `neutral` (informational). Two colors that both mean "look at this" but at different urgency is the whole point of having two of them — collapsing them back into one red would just recreate the "one bright hue for everything" problem this palette was built to avoid.

### What was rejected

- **The old bright blue primary** — generic SaaS, not filing-tool register (see above).
- **A near-black background with a neon accent** — the skill's second named cliché; also wrong for a document-reading tool where most of the surface is dense text and tables that need to read like paper, not a control panel.
- **A literal broadsheet/newspaper treatment** (hairline rules, zero radius, dense columns) — the skill's third named cliché. Tempting given the subject (filings are, literally, printed documents), which is exactly why it's worth resisting as a *direct* lift — see "Radius and shadow" below for what was taken from that instinct instead of the whole aesthetic.

## Typography

Three faces, one job each:

| Role | Face | Used for |
|---|---|---|
| Display | **Libre Caslon Display** (400 only) | Page/section titles only — sparingly |
| Body | **Public Sans** (variable) | Everything else: labels, descriptions, controls, table content |
| Data | **IBM Plex Mono** (400/500) | Anything that's a precise, citable value |

All three are self-hosted via Fontsource (`@fontsource/libre-caslon-display`, `@fontsource-variable/public-sans`, `@fontsource/ibm-plex-mono`) — no runtime Google Fonts request, and no repeat of the old app's mistake (`docs/UI_INVENTORY.md`): its font stack named `'Proxima Nova'` first, but the CSS only ever loaded Montserrat and Inter, so Proxima Nova was a name in a variable that silently fell through every time. Every face named here is actually loaded; verified by inspecting `dist/assets/*.woff2` after a real build (see below).

### Why these three, specifically

- **Libre Caslon Display** — Caslon-family serifs have a genuine historical tie to official/legal typesetting (statutes, gazette notices, certificates were set in Caslon for centuries — "when in doubt, use Caslon" is an actual old printing-trade saying). That's a subject-grounded choice, not a generic "serif = serious" reach — and it deliberately avoids Fraunces/Playfair-style display serifs, which have become their own AI-generated-design tell in the warm-cream-terracotta cliché this system is explicitly not doing. Used at one weight, on titles only — this is the one place the design allows itself a flourish, and it's rationed.
- **Public Sans** — built by 18F for the U.S. Web Design System, specifically for dense, legibility-first government service delivery. That's not a metaphorical fit for "regulatory filing tool," it's a literal one: this typeface was designed to do exactly this job for a different filing-heavy institutional context. It also ships variable, with real tabular-figure support, which matters for the financial tables Phase 3 will build.
- **IBM Plex Mono** — reserved for values, not prose: CIN numbers, page citations, financial figures, dates inside a citation. This is a structural choice, not a decorative one (the skill: *"structural devices... should encode something true about the content"*) — monospacing signals "this exact value was pulled from a specific document," reinforcing the citation model that's core to this whole app (`CLAUDE.md`: *"AI-generated content must always carry a citation back to its source"*). A `.font-data` utility class applies the face + `tabular-nums` together; use it on every rendered fact value, never on prose.

### Type scale

No new `text-*` size scale was introduced — Tailwind's default scale (`text-xs` … `text-4xl`) stays, since redefining it wholesale risked breaking utility usage across the app for no real benefit. What's specified instead is which face/weight to use at each level, since that's where this system's actual point of view lives:

- **Display** (`h1`–`h3`, page/section titles): `font-display` (Caslon), default weight, `-0.01em` tracking, sentence case — never all-caps, never a shouted hero headline. Wired as the default for `h1`/`h2`/`h3` in `src/styles/global.css`, so it's automatic, not something every screen has to remember to apply.
- **Heading** (card/section headers, table headers): body face, semibold, `text-sm`–`text-lg`.
- **Body** (default UI text): body face, regular/medium, **`text-sm` as the default density**, not `text-base` — the real screens are dense (37+ ANP facts across 6 domains, per `docs/STATE.md`) and Public Sans is legible at UI sizes by design, so there's no need to inflate body text to compensate.
- **Data**: `.font-data` utility (mono + tabular-nums), sized to match whatever context it sits in.

No numbered-marker system (01 / 02 / 03) anywhere — the skill flags this as a default worth questioning, and nothing in this app is actually a sequence a reader needs numbered (Facts Review's domains aren't ordered steps, the assembled document's sections aren't either). Skip it.

## Radius and shadow — restrained on purpose

Base radius dropped from the old app's `0.75rem` to `0.375rem` (`--radius-lg`), with a `0.1875rem`–`0.75rem` scale around it. The old value is kept only as the rare `2xl` tier, reserved for modals/sheets. This is the concrete thing taken from the broadsheet instinct without adopting the whole cliché: tighter, less-rounded corners read as more precise/official than the soft, bubbly radius typical of consumer SaaS, without going all the way to zero-radius newspaper columns (which would fight the fact that this is still an interactive app with real controls, not a static page).

Shadows are reserved for things that actually float above the page — dialogs, dropdowns, popovers. Resting content (cards, panels) uses a `hairline` border instead of a shadow, the same logic: a document sitting on a desk doesn't cast a shadow on itself. The shadow scale itself (`--shadow-xs` … `--shadow-lg`) is tinted with `ink` at low alpha rather than pure black, so on the rare occasions a shadow does appear, it reads as part of this palette instead of a browser default.

### Interaction feedback — re-evaluated, not ported

The old app's `hover-elevate`/`active-elevate` utility (an `::after` overlay rather than a background-color swap) was flagged in Phase 0 as a legitimate low-level technique worth re-evaluating, not porting unchanged. Kept: the overlay mechanism itself, because it composes with any background color without precomputing a hover shade for each one. Changed: the tint is now `ink` at 4%/8% alpha (hover/active) instead of a neutral black/white wash, and the opacity is lower across the board — the old version was tuned for a glossy, elevated feel; this one is tuned to read as a small, precise nudge. Implemented as the `.interactive` utility in `src/styles/global.css`.

## Signature element — the verification stamp

Per the skill: spend the one real aesthetic risk in a single place, keep everything else disciplined. This system's signature element is `VerificationStamp` (`src/components/ui/verification-stamp.tsx`) — a literal stamp/seal motif for the app's central concept: a fact, section, or gate that has (or hasn't, or can't) receive a human's sign-off.

Three states, deliberately not more:

- **`confirmed`** — solid ring, filled `confirmed` color, check icon. Something has been signed off — by a human in Facts Review, or by the deterministic eligibility engine.
- **`pending`** — dashed ring, hollow, `ink-muted`. The neutral default — nothing has happened yet, this is not a warning.
- **`conflict`** — solid ring, `signature` color, triangle-alert icon. Two sources disagree; a human owes the system a judgment call. This is the state that should draw the eye.

Two sizes: `badge` (small inline pill, for dense contexts — a Facts Review row, an eligibility rule) and `seal` (larger, `-rotate-3`, thicker border — for hero moments: a document's overall confirmation status, an export gate that just passed). The rotation and heavier border on `seal` are the one place this system lets itself look hand-stamped rather than machine-drawn — everywhere else is disciplined and flat.

This is also why `signature` is the app's single accent color rather than one of several: the stamp motif only means something if red is rare and specific.

## State patterns

Every screen built in Phase 3 needs all five of these — no bare spinners, no silently-disabled buttons, no empty screens that don't say what to do.

- **Loading** — `Skeleton` (`src/components/ui/skeleton.tsx`), shaped to match the real content's dimensions so nothing shifts when data arrives. A row of skeletons the height of a real `FieldRow`, not a generic centered spinner. A small inline spinner is fine for a button-level async action (Generate, Confirm) — the rule is about whole-screen loading, where a shape-matched skeleton is almost always available and better.
- **Empty** — an invitation to act, not a dead end (skill: *"An empty screen is an invitation to act"*). Use `Callout` with `tone="neutral"`, a title stating what's missing, and — where there's a next step — an `action`.
- **Error** — explain what happened and how to fix it, in the interface's voice, never apologetic, never vague (skill: *"Errors don't apologize, and they are never vague about what happened"*). `Callout` with `tone="caution"` or `tone="signature"` depending on severity.
- **Disabled** — the control itself just looks disabled (existing `Button` primitive already handles this: reduced opacity, no pointer events). The rule that matters is what sits *next to* it: a disabled control is never allowed to be the only signal. Pair it with a `Callout` (or, inline, a one-line caption) that says why.
- **Blocked-by-gate** — this is the state the brief specifically called out as needing to be real, not just a disabled button (export gate: "why blocked, what's missing, how to fix"). `Callout` with `tone="signature"` and `items` set to the actual unmet conditions — e.g. `checkExportGate`'s `missingFieldPaths` (`src/lib/export/gate.ts`), rendered in `.font-data` since they're literal field-path values, not prose. **Never summarize this as "3 fields missing"** — list the real paths, the same way the pre-flight checks in `docs/TASK12_LIVE_CHECK.md` insist on verifying the actual effect rather than trusting a summary.

`Callout` (`src/components/ui/callout.tsx`) is one component for empty/error/blocked-by-gate rather than three near-identical ones — they're the same shape (icon, title, explanation, optional checklist, optional action), differing only in tone and content. Building three separate components for that would be exactly the kind of duplicated-helper problem `CLAUDE.md`'s code-organization rules (and the `isTable()` regression they cite) warn against.

## Premium execution — enforced, not aspirational

Phase 1 set the palette/type/radius vocabulary; this section is the execution bar every Phase 3+ screen is held to. "Filing/audit register, not consumer SaaS" is a content register, not an excuse for sloppy craft — a legal instrument that looks careless undermines its own credibility. These are rules, checked in review, not suggestions:

- **Strict spacing scale — no ad hoc values.** Every gap/padding/margin uses Tailwind's default scale (`gap-1`…`gap-8`, `p-2`, `px-3`, etc.) — never an arbitrary bracket value (`p-[13px]`, `gap-[7px]`). If the scale doesn't have the exact step a layout seems to want, that's a sign to round to the nearest scale step, not to reach for `[…]`. Grep for `-\[` in `className` strings as a review check; a match is a defect, not a style choice.
- **Real typographic hierarchy**, not just bigger-and-bolder. Four steps, always in this order — face, then weight, then size, then color — never size alone carrying the hierarchy:
  1. Page/section title: `font-display` (Caslon), default weight, `text-xl`–`text-2xl`, `text-ink`.
  2. Group/card header (a domain name, a table header): body face, `font-semibold`, `text-sm`, `text-ink`.
  3. Body/value text: body face, `font-normal` or `font-medium`, `text-sm`, `text-ink`.
  4. Caption/metadata: body face, `font-normal`, `text-xs`, `text-ink-muted`.
  A component that wants more emphasis reaches for the next step up this list, not a bigger size at the same weight/color.
- **Deliberate density with precise alignment.** This is a data-heavy tool — tight rows are correct — but tight only reads as intentional when rows line up exactly. Every list of rows (fields, conflicts, documents) uses one consistent row height and internal padding within that list, a fixed-width label column so values start at the same x-coordinate down the column, and `divide-y divide-hairline` (or an explicit `border-b border-hairline last:border-b-0`) rather than per-row ad hoc borders. Never mix row heights within one list to imply emphasis — use the typographic hierarchy above instead.
- **Restrained motion only.** `duration-150` or `duration-200` with `ease-out`, on state changes and hover — nothing else. No entrance animations (`animate-in`, fade/slide-on-mount), no staggered list reveals, no parallax. Motion confirms an action happened (a value saved, a row expanded, a button's hover state) — it never decorates arrival. The `.interactive` utility (`src/styles/global.css`) is the canonical hover/active pattern; new interactive elements should use it or match its timing (`150ms ease-out`) exactly rather than inventing a new duration.
- **Optical alignment — tabular figures on every numeric column.** Any column of numbers (confidence percentages, counts, financial figures, page numbers) uses `tabular-nums` (Tailwind's built-in `font-variant-numeric` utility) so digits occupy equal width and columns line up vertically — this is on top of, not instead of, `.font-data` on actual citable fact values (which already bakes tabular figures in via `font-variant-numeric`). A bare count in a filter chip or stat badge still gets `tabular-nums` even though it isn't a citation.
- **Every surface earns its border/shadow.** Default flat — a `paper-raised` background with no border/shadow is correct for most panels. Add a `border border-hairline` only where a surface needs to be visually distinguished from what's behind it; add a shadow (`shadow-xs`…`shadow-lg`) only for things that actually float (dialogs, dropdowns, popovers) per the existing "Radius and shadow" rule above. A new card that reflexively gets both a border and a shadow "to be safe" is a defect — pick the one the hierarchy actually demands, or neither.

## Performance — enforced, not aspirational

Measured, not assumed — every claim below was verified against a real `npm run build`, not estimated. Re-verify after any change that touches routes, fonts, or a large dependency.

- **Route-level code splitting.** `src/features/document/DocumentScreen.tsx` (eligibility, narrative sections, citations, export) and `src/features/review/FactsReviewScreen.tsx` are both loaded via `React.lazy` + `Suspense` in `App.tsx`, each with a skeleton fallback shaped like the real screen (see "Loading state" above — a route-level `Suspense` fallback is still a shape-matched skeleton, not a spinner). `DocumentsScreen` (the default/first route) stays eager — lazy-loading the screen a fresh visit lands on first would add a waterfall, not remove one.
- **Fonts: latin subset, self-hosted, two faces preloaded.** All three webfaces (`src/styles/fonts.css`) import Fontsource's `latin`-only files, not the default multi-subset bundle — every string this app ever renders (company names, CIN numbers, filing prose) is Latin-script, so the cyrillic/greek/vietnamese subsets Fontsource ships by default are dead weight. `font-display: swap` is Fontsource's own default in the generated CSS (verified by inspecting it directly, not assumed). `src/lib/preloadFonts.ts` preloads the two above-the-fold faces — Public Sans Variable (body text on every screen) and Libre Caslon Display (every `h1`/`h2`/`h3`) — via `<link rel="preload">` injected before React mounts (`main.tsx`). IBM Plex Mono (citation/data values) is deliberately not preloaded — first paint never depends on a citation being visible. All three faces stay: each is used broadly across every screen (body copy, every heading, every cited value respectively), not confined to one place — the "cut it if it's only used once" rule doesn't trigger for any of them.
- **Bundle size audited after every screen**, numbers recorded in the merge report, not asserted from memory. Baseline (this pass, `npm run build`, before/after in the Facts Review report): fonts alone dropped from 27 files / ~313 KB to 7 files / ~127 KB by subsetting.
- **Memoize expensive derived state; virtualize only if measured slow.** Facts grouping/filtering/counting (`countByStatus`, per-domain filtering across 37 fields) is memoized (`useMemo`) keyed on the actual inputs that can change it — not because 37 fields is slow (it isn't), but because it re-runs on every render otherwise for no reason. The facts list is **not** virtualized — 37 fields across 6 domains is not enough rows for virtualization to pay for its own complexity; revisit only if a real, larger dataset measurably drops interaction to jank, not preemptively.
- **No layout shift on load.** Every `Suspense`/loading fallback is a `Skeleton` composition sized to match the real content's dimensions (row heights, column widths) — verified visually against the loaded state, not just "some skeleton exists."

## Dark mode — deliberately deferred

Not built this phase. This is a document-reading tool first — `paper` is a considered default, not a placeholder waiting for a dark variant to "complete" it. Every component reads the shadcn-compatible token slots (`--background`, `--foreground`, etc.) rather than raw hex values, so a dark theme is architecturally a pure token swap whenever it's wanted — see the `.dark { }` block in `src/styles/tokens.css`, intentionally empty and commented rather than silently absent. Doing that swap properly (checking every semantic color's dark-mode contrast, not just inverting lightness) is its own design pass; deferring it here is a scope decision, not an oversight.

## File organization

```
src/
  styles/
    fonts.css     Font-face imports (Fontsource)
    tokens.css    Raw token values + shadcn-compatible slot mapping + @theme
    global.css    Tailwind/shadcn imports, base layer, .font-data/.interactive utilities
  components/
    ui/
      skeleton.tsx
      verification-stamp.tsx
      callout.tsx
      button.tsx    (pre-existing, unchanged — already reads the token slots)
```

`src/index.css` is now a one-line re-export of `src/styles/global.css`, kept only so `main.tsx`'s existing `import './index.css'` doesn't need to change.

## Verified

`npm run build` (`tsc -b && vite build`) is clean; the built CSS was inspected directly and a static preview page (outside the app, not committed) was screenshotted to confirm the palette/type/radius/shadow tokens and the three new primitives render as intended before writing this document up. `npm test` — 112/112 passing, unaffected (no application logic touched). `npm run lint` — no new warnings (the one pre-existing warning in `button.tsx` predates this phase).

## What's NOT done here

No screens were touched — `App.tsx`, `FactsReview.tsx`, `DocumentView.tsx`, `EligibilityCard.tsx`, `ExportButton.tsx`, `UploadPanel.tsx` are all unchanged. That's Phase 3, after Phase 2 (information architecture) decides what those screens actually need to show.
