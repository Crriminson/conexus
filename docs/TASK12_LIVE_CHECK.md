# Task 12 (generate-section) — live-browser check

Written 2026-08-11, in advance of deploy access landing, so execution is just running this, not designing it.

**Uses the real ANP dataset, not a synthetic seed.** Originally this mirrored the Step 2 seed → browser check → teardown pattern (`docs/PROGRESS.md`, "Full-app-completion phase, Step 2") with a hand-written fictional issuer. Revised same day: the live singleton project already holds a real, non-seeded dataset — "ANP TECHNOLOGIES LIMITED" (CIN `U80900RJ2020PLC070889`), extracted for real from an actually-uploaded document (`Draft_Abridge_Prospectus_ANP.pdf`), 37 fields confirmed across all 6 domains — found live during Step 5 (`docs/STATE.md`, "Found during Step 5"). That's a better basis for this check: real extracted+confirmed facts instead of hand-written fixture data, and a real Storage-backed document behind every citation (the old synthetic seed's document row pointed at no real file, so source-citation clicks always 404'd — that should no longer happen here). `scripts/seed-task12-check.sh` was rewritten accordingly: it no longer writes a seed, it only verifies this dataset is actually ready (see step 1 below).

**Do not start this until all of the following are true** (see `docs/SETUP.md`'s "Migrations" / "Deploying edge functions"):
1. `supabase/migrations/20260810000000_generated_sections.sql` has been applied to the live `fvtazfdppcajoglteutz` project.
2. `generate-section` has been deployed (`supabase functions deploy generate-section`).
3. The 3 pending `FactConflict`s on the ANP dataset (`company.industry`, `company.businessDescription`, `capitalStructure.paidUpCapital`) have been resolved via Facts Review — see step 1 below. **Confirmed 2026-08-11: Facts Review is blocked by the same issue as the Document tab** (`useProject`, which both tabs call, unconditionally selects `generated_sections` — that query fails live with a 400/`42703` until migration item 1 lands; `FactsReview.tsx` has no fallback around it). So in practice item 3 is also gated on item 1 — there is no way to resolve the conflicts until the migration is applied, regardless of who has Supabase access.

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

## 1. Verify the ANP dataset is ready

```bash
npm run build && npm test   # sanity: repo is clean before touching live data
./scripts/seed-task12-check.sh
```

No seeding happens here anymore — the live singleton project already carries a real dataset, "ANP TECHNOLOGIES LIMITED" (CIN `U80900RJ2020PLC070889`), extracted from an actually-uploaded document, **37 fields confirmed across all 6 domains** (company profile, 3 promoters summing to 65.45%, 5 litigation records, 5 financial figures, capital structure — see `docs/STATE.md`, "Found during Step 5", for the full breakdown). The script is now a read-only readiness gate: it checks (a) zero pending `FactConflict`s and (b) `company.cin` still matches the expected ANP value (confirming nobody's overwritten or torn down the dataset since).

If it fails on (a), the 3 pending conflicts (`company.industry`, `company.businessDescription`, `capitalStructure.paidUpCapital`) haven't been resolved yet — go do that in Facts Review first (see this doc's intro for why that's currently blocked on the same migration as everything else). If it fails on (b), the ANP dataset itself is gone or changed — stop and investigate before proceeding; do not fall back to writing synthetic data without a deliberate decision to do so.

**Pass:** script prints `Done. ANP dataset (project ..., ANP TECHNOLOGIES LIMITED, CIN ...) is fully confirmed with zero pending conflicts. Ready...` and exits 0.

## 2. Browser check

Run `npm run dev` on a machine with real browser + network access (same constraint as every prior live check — this sandbox's Chromium can't reach external hosts through its proxy). Open `/project`.

| Step | Action | Expected result |
|---|---|---|
| 2.1 | Open the **Document** tab | Loads without error (this is the tab that was broken pre-migration — confirms the fix actually landed). Company shows "ANP TECHNOLOGIES LIMITED". Capital Structure / Shareholding Pattern / Financial Summary all show **Ready**. Eligibility card shows overall **pass**, no "AI-only, unconfirmed" badges (everything's confirmed). |
| 2.2 | Look at the 3 generated-section entries (Risk Factors, MD&A, Business Overview) | Each shows status **"Not yet generated"**, body reads *"Not yet generated."* |
| 2.3 | Check the Export button | **Disabled**, tooltip/message names exactly 3 missing fields: `generated.riskFactors`, `generated.mdAndA`, `generated.businessOverview` |
| 2.4 | Click **"Generate narrative sections"** | Button shows "Generating…", disabled during the call. Real Gemini call — **this spends quota** (1 request), do this once, not repeatedly. |
| 2.5 | On success | All 3 sections flip to **Ready** / "Not yet generated" badge disappears, prose renders for each, each has a non-empty **Sources:** line at the bottom |
| 2.6 | Click one of the source links in a generated section's Sources line | Opens a signed URL to `Draft_Abridge_Prospectus_ANP.pdf` — **should actually open the real document this time**, unlike every prior synthetic-seed check (Step 2, and the old Meridian seed here), where the seed's document row had no real file behind it and this always 404'd. If it still 404s, that's now a real bug worth flagging, not an expected non-issue. |
| 2.7 | Re-check the Export button | Now **enabled**, no missing-field message |
| 2.8 | Click Export | Downloads a `.md` file. Open it: contains the liability disclaimer (placeholder text, expected — see `docs/DECISIONS.md`), all 5 assembled sections, and prose + citations for all 3 generated sections. Since this is a real company, eyeball that the generated prose is plausible for an ed-tech aggregator, not obviously hallucinated. |
| 2.9 | Click **"Regenerate narrative sections"** (button label should have changed from step 2.5) | Runs again, overwrites all 3 sections with fresh content — **this spends a 2nd quota request**, only do this if you specifically want to confirm regeneration works; otherwise skip |

## 3. Failure modes worth recognizing, not chasing

- **400 "No confirmed, citable facts yet"** on generate — would mean the ANP dataset's facts aren't actually confirmed/persisted (re-run step 1's readiness script). Should not happen against this dataset since it's fully confirmed.
- **502 "Generation failed: ..."** — Gemini call itself failed (quota, network, malformed prompt). Check the message; if it's a quota 429, this is the same known daily-cap issue as extraction (`docs/DECISIONS.md`, "Gemini quota"), not a Task 12 bug.
- **502 "Failed to parse model output as JSON"** — model didn't return valid JSON despite `responseMimeType: 'application/json'`. Log the raw text (truncated in the error message) and treat as a prompt-engineering follow-up, not a pipeline bug.
- **Citations pointing at the wrong document/page** — would mean `resolveGeneratedSections`' citation validation has a bug (it's supposed to drop anything not in the offered fact list). Unlike the old synthetic seed, the ANP dataset has **two** real document rows (the original extraction and the re-extraction that raised the 3 conflicts) — so this is actually a meaningful test now: a wrong `sourceDocId` pointing at the unrelated document would be visible and worth flagging, not just wrong `sourcePage`.

## 4. Teardown

**Do not run `scripts/teardown-task12-check.sh` against this dataset.** It was written for the old synthetic seed — it wipes `projects.facts` back to fully empty and deletes a hardcoded seed document row. Run against the ANP dataset, it would destroy 37 real confirmed facts and the resolved conflicts, not clean up disposable test data. (It's also targeting a `SEED_DOCUMENT_ID` that doesn't exist in this dataset, so it would only ever get partway before failing — but don't rely on that as a safety net.)

There is nothing here that needs tearing down: the ANP facts are real, not seed data, and are worth keeping regardless of this check's outcome (per the standing rule in `docs/STATE.md` not to wipe this project's facts). If you want the project back to a clean pre-generation state to re-run the browser check, reset only `generated_sections` to `{}` — leave `facts` and `conflicts` untouched:

```bash
# Optional: reset only generated_sections, keep the real ANP facts intact.
# Read current version first (CAS, same discipline as every other write script here).
curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.a15f3021-6fda-4662-bc49-d629a45cfe39&select=version" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
# Then, with VERSION from above:
curl -sS -X PATCH "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.a15f3021-6fda-4662-bc49-d629a45cfe39&version=eq.VERSION" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"generated_sections": {}, "version": VERSION_PLUS_1}'
```

## Overall pass/fail

**Pass** = every row in section 2's table matches its expected result. That closes Task 12's "code-complete but never run against live data" gap the same way Step 2 closed it for Tasks 10/11/13/14 — record the result in `docs/STATE.md`/`docs/PROGRESS.md` afterward, per the standing workflow rule (`CLAUDE.md`).

**Fail** = any row doesn't match. Note exactly which step and what happened instead, and treat it as a real bug to fix — not a someday item, per this project's usual bar. Since there's no teardown to run either way, the ANP dataset stays live and confirmed regardless of outcome — nothing to clean up before investigating.
