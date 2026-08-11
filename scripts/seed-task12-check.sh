#!/usr/bin/env bash
# Readiness check for the Task 12 (generate-section) live-browser check
# (docs/TASK12_LIVE_CHECK.md).
#
# Originally this script *seeded* a fictional issuer ("Meridian Textiles
# Limited") via a direct PostgREST PATCH. That's no longer needed: the live
# singleton project (fvtazfdppcajoglteutz, a15f3021-6fda-4662-bc49-d629a45cfe39)
# already holds a real, non-seeded dataset — "ANP TECHNOLOGIES LIMITED"
# (CIN U80900RJ2020PLC070889), extracted for real from an actually-uploaded
# document (Draft_Abridge_Prospectus_ANP.pdf), 37 fields confirmed across all
# 6 domains. See docs/STATE.md's "Found during Step 5" section for the full
# story, including why it's a better basis for this check than a synthetic
# seed: real extracted+confirmed facts, and a real Storage-backed document
# behind the citations (the old synthetic seed's document row had no real
# file, so source-citation clicks always 404'd — that should no longer
# happen against this dataset).
#
# This script therefore no longer WRITES anything. It only verifies the ANP
# dataset is actually in the ready state this check needs:
#   1. Zero pending FactConflicts (a second extraction of the same document
#      raised 3 — company.industry, company.businessDescription,
#      capitalStructure.paidUpCapital — that need a human resolving them in
#      Facts Review first; this script can't and won't resolve them, same
#      reasoning as docs/STATE.md: it's a real judgment call, not scriptable).
#   2. The project's facts still identify as the ANP dataset (checked via
#      CIN, the least ambiguous field), i.e. nobody's torn it down or
#      overwritten it with something else since.
#
# Read-only against Supabase. Safe to run repeatedly.

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
EXPECTED_CIN="U80900RJ2020PLC070889"

AUTH_HEADERS=(-H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")

echo "Checking for pending FactConflicts..."
CONFLICTS=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&select=conflicts" "${AUTH_HEADERS[@]}")
PENDING_COUNT=$(echo "$CONFLICTS" | grep -oE '"resolution":[[:space:]]*"pending"' | wc -l | tr -d ' ')

if [ "$PENDING_COUNT" != "0" ]; then
  echo "" >&2
  echo "${PENDING_COUNT} conflict(s) still pending — resolve them in Facts Review before running Task 12's live check." >&2
  echo "Expected 3, last known: company.industry, company.businessDescription, capitalStructure.paidUpCapital." >&2
  echo "(Facts Review may itself be blocked by the pending generated_sections migration — see docs/STATE.md" >&2
  echo "and docs/TASK12_LIVE_CHECK.md's pre-flight section. Resolve that first if so.)" >&2
  exit 1
fi
echo "No pending conflicts."

echo "Confirming project facts still identify as the ANP dataset (CIN check)..."
FACTS=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&select=facts" "${AUTH_HEADERS[@]}")
if ! echo "$FACTS" | grep -qE '"cin":[[:space:]]*\{"value":[[:space:]]*"'"${EXPECTED_CIN}"'".*"status":[[:space:]]*"confirmed"'; then
  echo "" >&2
  echo "This project's company.cin doesn't match the expected confirmed ANP value (${EXPECTED_CIN})." >&2
  echo "The ANP dataset may have been torn down, overwritten, or never landed here. Check docs/STATE.md's" >&2
  echo "\"Found during Step 5\" section and inspect the project's facts directly before proceeding." >&2
  exit 1
fi

echo ""
echo "Done. ANP dataset (project ${PROJECT_ID}, ANP TECHNOLOGIES LIMITED, CIN ${EXPECTED_CIN}) is"
echo "fully confirmed with zero pending conflicts. Ready for docs/TASK12_LIVE_CHECK.md."
