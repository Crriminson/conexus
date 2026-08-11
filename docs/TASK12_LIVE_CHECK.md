# Task 12 (generate-section) — live-browser check

Written 2026-08-11, in advance of deploy access landing, so execution is just running this, not designing it. Mirrors the Step 2 seed → browser check → teardown pattern (`docs/PROGRESS.md`, "Full-app-completion phase, Step 2") that already verified Tasks 10/11/13/14 live.

**Do not start this until both of the following are true** (see `docs/SETUP.md`'s "Migrations" / "Deploying edge functions"):
1. `supabase/migrations/20260810000000_generated_sections.sql` has been applied to the live `fvtazfdppcajoglteutz` project.
2. `generate-section` has been deployed (`supabase functions deploy generate-section`).

## 0. Pre-flight — confirm the two deploy steps actually landed

Don't trust "I ran the command" — verify the effect directly, same discipline as every other verification in this repo.

```bash
# Migration check — should return 200 with a JSON array (even if empty),
# NOT a 42703 "column does not exist" error.
curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?select=id,generated_sections&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
```
**Pass:** `[{"id":"...","generated_sections":{}}]` (or similar, some value present). **Fail:** `{"code":"42703",...}` — migration not applied yet, stop here. (This exact check is what caught the Step 4 regression documented in `docs/STATE.md` on 2026-08-11 — the migration was still unapplied and both the Document and Facts Review tabs were broken live as a result.)

```bash
# Function deployed check — should return 400 (missing/invalid body), NOT 404.
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "${VITE_SUPABASE_URL}/functions/v1/generate-section" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" -d '{}'
```
**Pass:** `400` (function exists, rejected the empty body — see `supabase/functions/generate-section/index.ts`'s `projectId is required` check). **Fail:** `404` — function not deployed yet, stop here.

Only proceed past this section once both checks pass.

## 1. Seed

```bash
npm run build && npm test   # sanity: repo is clean before touching live data
./scripts/seed-task12-check.sh
```

This seeds fictional issuer "Meridian Textiles Limited" into the live singleton project, **fully confirmed and fully cited across all 6 domains** (company, financials, capitalStructure, 2 promoters, 1 litigation record, 1 related-party record) — deliberately different from Step 2's seed, which left 2 fields unconfirmed on purpose. Full confirmation here gives an unambiguous end state: after generation, the export gate should have nothing left blocking it.

The script refuses to run if the project's facts aren't currently empty (checks for any `confirmed`/`edited` status first) — if it aborts for that reason, something else is using the project; investigate before forcing anything.

**Pass:** script prints `Done. Project ... now has fully-confirmed, fully-cited facts...` and exits 0.

## 2. Browser check

Run `npm run dev` on a machine with real browser + network access (same constraint as every prior live check — this sandbox's Chromium can't reach external hosts through its proxy). Open `/project`.

| Step | Action | Expected result |
|---|---|---|
| 2.1 | Open the **Document** tab | Loads without error (this is the tab that was broken pre-migration — confirms the fix actually landed). Capital Structure / Shareholding Pattern / Financial Summary all show **Ready**. Eligibility card shows overall **pass**, no "AI-only, unconfirmed" badges (everything's confirmed). |
| 2.2 | Look at the 3 generated-section entries (Risk Factors, MD&A, Business Overview) | Each shows status **"Not yet generated"**, body reads *"Not yet generated."* |
| 2.3 | Check the Export button | **Disabled**, tooltip/message names exactly 3 missing fields: `generated.riskFactors`, `generated.mdAndA`, `generated.businessOverview` |
| 2.4 | Click **"Generate narrative sections"** | Button shows "Generating…", disabled during the call. Real Gemini call — **this spends quota** (1 request), do this once, not repeatedly. |
| 2.5 | On success | All 3 sections flip to **Ready** / "Not yet generated" badge disappears, prose renders for each, each has a non-empty **Sources:** line at the bottom |
| 2.6 | Click one of the source links in a generated section's Sources line | Opens a signed URL — will 404 (same as Step 2's seed: the seed document row has no real file behind it in Storage). **Expected, not a bug** — same diagnosed non-issue as Step 2. |
| 2.7 | Re-check the Export button | Now **enabled**, no missing-field message |
| 2.8 | Click Export | Downloads a `.md` file. Open it: contains the liability disclaimer (placeholder text, expected — see `docs/DECISIONS.md`), all 5 assembled sections, and prose + citations for all 3 generated sections |
| 2.9 | Click **"Regenerate narrative sections"** (button label should have changed from step 2.5) | Runs again, overwrites all 3 sections with fresh content — **this spends a 2nd quota request**, only do this if you specifically want to confirm regeneration works; otherwise skip |

## 3. Failure modes worth recognizing, not chasing

- **400 "No confirmed, citable facts yet"** on generate — would mean the seed didn't actually persist (re-check step 1's output, re-run seed script). Should not happen against this seed since it's fully confirmed.
- **502 "Generation failed: ..."** — Gemini call itself failed (quota, network, malformed prompt). Check the message; if it's a quota 429, this is the same known daily-cap issue as extraction (`docs/DECISIONS.md`, "Gemini quota"), not a Task 12 bug.
- **502 "Failed to parse model output as JSON"** — model didn't return valid JSON despite `responseMimeType: 'application/json'`. Log the raw text (truncated in the error message) and treat as a prompt-engineering follow-up, not a pipeline bug.
- **Citations pointing at the wrong document/page** — would mean `resolveGeneratedSections`' citation validation has a bug (it's supposed to drop anything not in the offered fact list). Since this seed only has one document, a wrong `sourceDocId` is impossible here to test — only wrong `sourcePage` would be visible. Flag if seen, don't silently accept it.

## 4. Teardown

```bash
./scripts/teardown-task12-check.sh
```

**Pass:** prints `Done. Project facts and generated_sections are both empty; the seed document row is gone.` and exits 0. Run this regardless of whether the check above passed or failed — don't leave seed data live.

## Overall pass/fail

**Pass** = every row in section 2's table matches its expected result, and teardown completes cleanly. That closes Task 12's "code-complete but never run against live data" gap the same way Step 2 closed it for Tasks 10/11/13/14 — record the result in `docs/STATE.md`/`docs/PROGRESS.md` afterward, per the standing workflow rule (`CLAUDE.md`).

**Fail** = any row doesn't match. Note exactly which step and what happened instead, run teardown regardless, and treat it as a real bug to fix — not a someday item, per this project's usual bar.
