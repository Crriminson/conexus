#!/usr/bin/env bash
# Seeds a FULLY-confirmed, fully-cited IssuerFacts into the live Supabase
# project — purpose-built for the Task 12 (generate-section) live-browser
# check documented in docs/TASK12_LIVE_CHECK.md. Same technique as Step 2's
# seed (docs/PROGRESS.md, "Full-app-completion phase, Step 2"): a direct
# PostgREST PATCH via the anon key, version-conditioned (CAS) so it can't
# silently clobber a concurrent write.
#
# Different from Step 2's seed on purpose: Step 2 deliberately left 2 fields
# unconfirmed (company.cin, financials.netProfit) to exercise "incomplete"
# UI states. This seed confirms EVERYTHING across all 6 domains — Task 12's
# collectConfirmedFacts() reads all 6 (including company/litigation/
# relatedParties, which Task 11's computed sections never touch), so a
# realistic check needs citable facts in all of them, and a fully-confirmed
# input gives the cleanest pass/fail signal: after generating, the export
# gate should go from "3 generated.* missing" to fully allowed=true, with
# nothing else in the way.
#
# Fictional issuer "Meridian Textiles Limited" — distinct from every other
# name already used in this repo's history (Acme Industries = the Vitest
# fixture, Sundfin Industries = Step 2's seed, VERITAS FINANCE/Topical
# Generics = the original contamination incident) so nobody mistakes this
# for previously-seeded or real data.
#
# Safety: refuses to run if the project's facts aren't currently empty —
# this script is meant to seed a clean project, not overwrite whatever's
# there. Run scripts/teardown-seed-data.sh (or the matching teardown for
# whatever's currently seeded) first if this check comes back non-empty.
#
# Teardown: scripts/teardown-task12-check.sh — deletes the seed document
# row and resets facts AND generated_sections back to empty. Run it after
# the browser check, whether the check passed or failed.

set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${VITE_SUPABASE_URL:?Set VITE_SUPABASE_URL (or create .env at repo root)}"
: "${VITE_SUPABASE_ANON_KEY:?Set VITE_SUPABASE_ANON_KEY (or create .env at repo root)}"

PROJECT_ID="a15f3021-6fda-4662-bc49-d629a45cfe39"
SEED_DOCUMENT_ID="7c1e9b3a-2f5d-4a91-8e6c-3d0b9a5f1c22"

AUTH_HEADERS=(-H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")

echo "Checking project facts are currently empty..."
CURRENT=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&select=version,facts" "${AUTH_HEADERS[@]}")
VERSION=$(echo "$CURRENT" | grep -o '"version":[0-9]*' | grep -o '[0-9]*$')
if [ -z "$VERSION" ]; then
  echo "Could not read current version. Response was: $CURRENT" >&2
  exit 1
fi
if echo "$CURRENT" | grep -q '"status":"confirmed"\|"status": "confirmed"\|"status":"edited"\|"status": "edited"'; then
  echo "Project already has confirmed/edited facts — refusing to overwrite. Run the appropriate teardown first, or inspect manually." >&2
  exit 1
fi
echo "Current version: ${VERSION}. Facts are empty — safe to seed."

NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

# confirmed(value, page) as inline JSON, sourceDocId always the seed document.
c() { # $1=json-encoded value (already quoted/escaped by caller), $2=page
  echo "{\"value\":${1},\"confidence\":null,\"sourceDocId\":\"${SEED_DOCUMENT_ID}\",\"sourcePage\":${2},\"status\":\"confirmed\",\"updatedAt\":\"${NOW}\"}"
}

FACTS=$(cat <<JSON
{
  "company": {
    "legalName": $(c '"Meridian Textiles Limited"' 1),
    "cin": $(c '"U17111MH2016PLC281044"' 1),
    "incorporationDate": $(c '"June 14, 2016"' 1),
    "registeredOfficeAddress": $(c '"88 Senapati Bapat Marg, Mumbai, Maharashtra 400013"' 1),
    "industry": $(c '"Textiles and Apparel Manufacturing"' 1),
    "businessDescription": $(c '"An integrated textile manufacturer supplying woven fabrics to domestic and export apparel brands."' 1)
  },
  "financials": {
    "fiscalYearEnd": $(c '"March 31"' 12),
    "revenue": $(c 21540 12),
    "ebitda": $(c 3872 12),
    "netProfit": $(c 1965 13),
    "totalAssets": $(c 18420 13),
    "totalLiabilities": $(c 9110 13),
    "netWorth": $(c 9310 13)
  },
  "capitalStructure": {
    "authorizedCapital": $(c 200000000 20),
    "issuedCapital": $(c 152000000 20),
    "paidUpCapital": $(c 152000000 20),
    "faceValuePerShare": $(c 10 20),
    "totalSharesOutstanding": $(c 15200000 20)
  },
  "promoters": [
    {
      "id": "promoter-1",
      "name": $(c '"Rohan Deshmukh"' 25),
      "panOrId": $(c '"AAPPD1234M"' 25),
      "din": $(c '"01122334"' 25),
      "shareholdingPercent": $(c 44.8 25),
      "category": $(c '"Promoter"' 25)
    },
    {
      "id": "promoter-2",
      "name": $(c '"Meridian Family Trust"' 26),
      "panOrId": $(c '"AAATM5678N"' 26),
      "din": $(c 'null' 26),
      "shareholdingPercent": $(c 15.2 26),
      "category": $(c '"Promoter Group"' 26)
    }
  ],
  "litigation": [
    {
      "id": "litigation-1",
      "caseNumber": $(c '"CP/447/2021"' 40),
      "forum": $(c '"Bombay High Court"' 40),
      "partiesInvolved": $(c '"Meridian Textiles Limited vs. Regional Provident Fund Commissioner"' 40),
      "natureOfProceeding": $(c '"Labour dispute"' 40),
      "amountInvolved": $(c 1800000 40),
      "status": $(c '"Disposed"' 40)
    }
  ],
  "relatedParties": [
    {
      "id": "rpt-1",
      "partyName": $(c '"Meridian Fabtech LLP"' 55),
      "relationship": $(c '"Entity controlled by a promoter"' 55),
      "natureOfTransaction": $(c '"Purchase of raw cotton yarn"' 55),
      "amount": $(c 42500000 55),
      "transactionDate": $(c '"2025-11-30"' 55)
    }
  ]
}
JSON
)

echo "Creating seed document row ${SEED_DOCUMENT_ID}..."
DOC_HTTP=$(curl -sS -o /tmp/seed-task12-doc-response.json -w "%{http_code}" \
  -X POST "${VITE_SUPABASE_URL}/rest/v1/documents" \
  "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"id\": \"${SEED_DOCUMENT_ID}\", \"project_id\": \"${PROJECT_ID}\", \"filename\": \"task12-check-demo-drhp.pdf\", \"storage_path\": \"seed-data/task12-check-demo-drhp.pdf\", \"extraction_status\": \"complete\"}")

if [ "$DOC_HTTP" != "201" ]; then
  echo "Document insert failed (HTTP ${DOC_HTTP}):" >&2
  cat /tmp/seed-task12-doc-response.json >&2
  exit 1
fi
echo "Seed document created."

echo "Seeding fully-confirmed facts (version ${VERSION} -> $((VERSION + 1)))..."
SEED_HTTP=$(curl -sS -o /tmp/seed-task12-facts-response.json -w "%{http_code}" \
  -X PATCH "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&version=eq.${VERSION}" \
  "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"facts\": ${FACTS}, \"version\": $((VERSION + 1))}")

if [ "$SEED_HTTP" != "200" ] || [ "$(cat /tmp/seed-task12-facts-response.json)" = "[]" ]; then
  echo "Facts seed failed or matched 0 rows (version mismatch). Delete the document row just created and re-run." >&2
  cat /tmp/seed-task12-facts-response.json >&2
  exit 1
fi

rm -f /tmp/seed-task12-doc-response.json /tmp/seed-task12-facts-response.json
echo ""
echo "Done. Project ${PROJECT_ID} now has fully-confirmed, fully-cited facts"
echo "across all 6 domains, citing document ${SEED_DOCUMENT_ID}."
echo "Next: follow docs/TASK12_LIVE_CHECK.md. When finished, run"
echo "scripts/teardown-task12-check.sh to clean up."
