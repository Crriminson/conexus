#!/usr/bin/env bash
# Wipes the Step 2 seed data (see docs/PROGRESS.md, "Full-app-completion
# phase, Step 2 seed data" and docs/STATE.md) — the mock IssuerFacts seeded
# directly into the live Supabase project to browser-verify Tasks 10/11/13/14
# without spending Gemini quota. Run this once you're done checking.
#
# What this touches (and only this):
#   - projects.facts on project a15f3021-6fda-4662-bc49-d629a45cfe39
#     ("Demo Issuer"), reset to the fully-empty IssuerFacts shape (matching
#     its state before seeding — every leaf status:'empty', value:null).
#   - the one `documents` row created as the seed data's citation source
#     (id d2feda0c-1854-4bee-b3f4-9b791532d311, filename
#     seed-demo-drhp.pdf, storage_path seed-data/seed-demo-drhp.pdf).
#
# What this does NOT touch:
#   - conflicts / merge_events on the project (both were already empty
#     before seeding and were left untouched by the seed itself).
#   - any other `documents` row on the project — in particular the
#     pre-existing e2e-test leftovers documented in docs/STATE.md's open
#     items (drhp-chunked-*, client-split-*, 1785756069624*.pdf). Those
#     predate this seed and are not this script's concern.
#   - Supabase Storage — the seed never uploaded a real file, only a
#     `documents` row pointing at a path that was never written to, so
#     there is no Storage object to delete.
#
# Uses the version-conditioned PATCH the app itself uses (optimistic
# concurrency on projects.version) rather than a blind overwrite, so it
# won't silently clobber a concurrent edit — it fails loudly instead and
# it's safe to just re-run.

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
SEED_DOCUMENT_ID="d2feda0c-1854-4bee-b3f4-9b791532d311"

AUTH_HEADERS=(-H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")

EMPTY_FACTS='{"company":{"legalName":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"cin":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"incorporationDate":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"registeredOfficeAddress":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"industry":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"businessDescription":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"}},"financials":{"fiscalYearEnd":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"revenue":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"ebitda":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"netProfit":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"totalAssets":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"totalLiabilities":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"netWorth":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"}},"capitalStructure":{"authorizedCapital":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"issuedCapital":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"paidUpCapital":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"faceValuePerShare":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"totalSharesOutstanding":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"}},"promoters":[],"litigation":[],"relatedParties":[]}'
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
EMPTY_FACTS="${EMPTY_FACTS//__NOW__/${NOW}}"

echo "Reading current project version..."
CURRENT=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&select=version" "${AUTH_HEADERS[@]}")
VERSION=$(echo "$CURRENT" | grep -o '"version":[0-9]*' | grep -o '[0-9]*$')
if [ -z "$VERSION" ]; then
  echo "Could not read current version. Response was: $CURRENT" >&2
  exit 1
fi
echo "Current version: ${VERSION}"

echo "Resetting project facts to empty (version ${VERSION} -> $((VERSION + 1)))..."
RESET_HTTP=$(curl -sS -o /tmp/teardown-reset-response.json -w "%{http_code}" \
  -X PATCH "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&version=eq.${VERSION}" \
  "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"facts\": ${EMPTY_FACTS}, \"version\": $((VERSION + 1))}")

if [ "$RESET_HTTP" != "200" ] || [ "$(cat /tmp/teardown-reset-response.json)" = "[]" ]; then
  echo "Facts reset failed or matched 0 rows (version mismatch — someone/something else wrote to this project concurrently). Re-run this script." >&2
  cat /tmp/teardown-reset-response.json >&2
  exit 1
fi
echo "Facts reset OK."

echo "Deleting seed document row ${SEED_DOCUMENT_ID}..."
DELETE_HTTP=$(curl -sS -o /tmp/teardown-delete-response.json -w "%{http_code}" \
  -X DELETE "${VITE_SUPABASE_URL}/rest/v1/documents?id=eq.${SEED_DOCUMENT_ID}" \
  "${AUTH_HEADERS[@]}" \
  -H "Prefer: return=representation")

if [ "$DELETE_HTTP" != "200" ]; then
  echo "Document delete returned HTTP ${DELETE_HTTP}:" >&2
  cat /tmp/teardown-delete-response.json >&2
  exit 1
fi
echo "Seed document deleted."

rm -f /tmp/teardown-reset-response.json /tmp/teardown-delete-response.json
echo ""
echo "Done. Project facts are empty and the seed document row is gone."
echo "Pre-existing e2e-test document rows (docs/STATE.md open item 3) were left untouched, as intended."
