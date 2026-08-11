// DEMO_MODE's fallback for generate-section's one Gemini call. Produces raw
// text in the exact shape resolveGeneratedSections() already expects from a
// real model response — `{ <key>: { body, citedFieldPaths } }` — so it can
// go through the identical parse/validate/persist pipeline as a real Gemini
// reply rather than needing a second code path. Deterministic (no network,
// no randomness) and clearly labeled in the body text itself, so a reader
// can't mistake it for a real generation even without the UI's own demo
// banner.
import type { ConfirmedFactEntry, GeneratedSectionKey } from './types.ts'

const SECTION_LABELS: Record<GeneratedSectionKey, string> = {
  riskFactors: 'Risk Factors',
  mdAndA: "Management's Discussion and Analysis",
  businessOverview: 'Business Overview',
}

export function buildDemoGeneratedSectionsResponse(entries: ConfirmedFactEntry[]): string {
  const citedFieldPaths = entries.map((entry) => entry.fieldPath)

  const sections = Object.fromEntries(
    (Object.keys(SECTION_LABELS) as GeneratedSectionKey[]).map((key) => [
      key,
      {
        body: `[Demo mode] ${SECTION_LABELS[key]} narrative generated from ${entries.length} confirmed fact(s) — not produced by Gemini. Shown because the real call failed and DEMO_MODE is on.`,
        citedFieldPaths,
      },
    ]),
  )

  return JSON.stringify(sections)
}
