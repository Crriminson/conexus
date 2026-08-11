#!/usr/bin/env bash
# Teardown for scripts/seed-task12-check.sh (see docs/TASK12_LIVE_CHECK.md).
# Resets projects.facts to fully empty AND projects.generated_sections back
# to '{}' (the column's own default), and deletes the one seed documents
# row this created. Mirrors scripts/teardown-seed-data.sh's discipline:
# version-conditioned (CAS) PATCH, fails loudly and is safe to re-run
# rather than silently doing nothing on a version mismatch.
#
# Run this after the Task 12 live-browser check, whether it passed or
# failed — do not leave scripts/seed-task12-check.sh's data sitting in the
# live project.
#
# GUARDED (2026-08-11): PROJECT_ID below is this app's one singleton
# project — the same row real extraction runs write into. A prior version
# of this script reset `facts` unconditionally, which would silently
# destroy real confirmed data (e.g. the live ANP dataset's 37 confirmed
# facts + any pending FactConflicts) if run at the wrong time. It now
# refuses to touch anything unless the project's current facts still look
# exactly like scripts/seed-task12-check.sh's own seed — same legal name,
# same seed document as the source. Anything else aborts loudly instead
# of resetting.

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

EMPTY_FACTS='{"company":{"legalName":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"cin":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"incorporationDate":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"registeredOfficeAddress":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"industry":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"businessDescription":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"}},"financials":{"fiscalYearEnd":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"revenue":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"ebitda":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"netProfit":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"totalAssets":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"totalLiabilities":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"netWorth":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"}},"capitalStructure":{"authorizedCapital":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"issuedCapital":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"paidUpCapital":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"faceValuePerShare":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"},"totalSharesOutstanding":{"value":null,"confidence":null,"sourceDocId":null,"sourcePage":null,"status":"empty","updatedAt":"__NOW__"}},"promoters":[],"litigation":[],"relatedParties":[]}'
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
EMPTY_FACTS="${EMPTY_FACTS//__NOW__/${NOW}}"

echo "Reading current project version and facts..."
CURRENT=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&select=version,facts" "${AUTH_HEADERS[@]}")
VERSION=$(echo "$CURRENT" | grep -o '"version":[0-9]*' | grep -o '[0-9]*$')
if [ -z "$VERSION" ]; then
  echo "Could not read current version. Response was: $CURRENT" >&2
  exit 1
fi
echo "Current version: ${VERSION}"

# Hard guard: only reset facts that still look like this script's own seed
# (scripts/seed-task12-check.sh) -- same legal name AND same seed document
# as the source of that value. This is the one singleton project real
# extraction runs also write into; without this check, running this script
# at the wrong time would silently destroy real confirmed data (e.g. the
# live ANP dataset) instead of just this seed. Both conditions must match;
# either mismatching means this is NOT the seed, so refuse.
if ! echo "$CURRENT" | grep -q '"value":"Meridian Textiles Limited"' \
  || ! echo "$CURRENT" | grep -q "\"sourceDocId\":\"${SEED_DOCUMENT_ID}\""; then
  echo "" >&2
  echo "REFUSING TO RUN: current project facts do not look like scripts/seed-task12-check.sh's own seed" >&2
  echo "(expected to find company.legalName = \"Meridian Textiles Limited\" sourced from document ${SEED_DOCUMENT_ID})." >&2
  echo "This project is the app's one singleton project -- real extraction runs write into the same row." >&2
  echo "If this is real confirmed data (e.g. the live ANP dataset), do NOT reset it. Inspect manually." >&2
  exit 1
fi
echo "Facts match the expected seed shape -- safe to reset."

echo "Resetting facts + generated_sections to empty (version ${VERSION} -> $((VERSION + 1)))..."
RESET_HTTP=$(curl -sS -o /tmp/teardown-task12-reset-response.json -w "%{http_code}" \
  -X PATCH "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&version=eq.${VERSION}" \
  "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"facts\": ${EMPTY_FACTS}, \"generated_sections\": {}, \"version\": $((VERSION + 1))}")

if [ "$RESET_HTTP" != "200" ] || [ "$(cat /tmp/teardown-task12-reset-response.json)" = "[]" ]; then
  echo "Reset failed or matched 0 rows (version mismatch — someone/something else wrote to this project concurrently). Re-run this script." >&2
  cat /tmp/teardown-task12-reset-response.json >&2
  exit 1
fi
echo "Reset OK."

echo "Deleting seed document row ${SEED_DOCUMENT_ID}..."
DELETE_HTTP=$(curl -sS -o /tmp/teardown-task12-delete-response.json -w "%{http_code}" \
  -X DELETE "${VITE_SUPABASE_URL}/rest/v1/documents?id=eq.${SEED_DOCUMENT_ID}" \
  "${AUTH_HEADERS[@]}" \
  -H "Prefer: return=representation")

if [ "$DELETE_HTTP" != "200" ]; then
  echo "Document delete returned HTTP ${DELETE_HTTP}:" >&2
  cat /tmp/teardown-task12-delete-response.json >&2
  exit 1
fi
echo "Seed document deleted."

rm -f /tmp/teardown-task12-reset-response.json /tmp/teardown-task12-delete-response.json
echo ""
echo "Done. Project facts and generated_sections are both empty; the seed document row is gone."
