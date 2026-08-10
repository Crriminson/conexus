import type { ConfirmedFactEntry } from './types.ts'

// Every confirmed fact fed in is already citable (collectConfirmedFacts.ts
// filters for that) — the model is told to cite only from this exact list
// so resolveGeneratedSections.ts can validate citations against real
// entries afterward rather than trusting free-text citations.
export function buildGenerationPrompt(entries: ConfirmedFactEntry[]): string {
  const factLines = entries.map((e) => `${e.fieldPath} | ${e.label} = ${JSON.stringify(e.value)}`).join('\n')

  return `You are drafting three narrative sections of an IPO prospectus (DRHP) for a company, using ONLY the confirmed facts listed below. Do not use any information not present in this list — do not guess, infer, or bring in outside knowledge about any company.

Confirmed facts (format: fieldPath | label = value):
${factLines}

Write exactly three sections:
1. "riskFactors" — key risks facing the company, grounded only in the facts above (e.g. litigation exposure, capital structure, financial position). If the facts don't support identifying a real risk, keep the section short rather than inventing one.
2. "mdAndA" — Management Discussion & Analysis: a narrative discussion of the company's financial position and performance based only on the facts above.
3. "businessOverview" — a narrative overview of the company and its business based only on the facts above.

For each section, also list "citedFieldPaths": the exact fieldPath values (from the list above, verbatim) for every fact you actually used in that section's text. Do not invent a fieldPath that isn't in the list above.

Output strict JSON only — no markdown, no commentary — matching exactly this structure:
{
  "riskFactors": { "body": "<prose>", "citedFieldPaths": ["<fieldPath>", ...] },
  "mdAndA": { "body": "<prose>", "citedFieldPaths": ["<fieldPath>", ...] },
  "businessOverview": { "body": "<prose>", "citedFieldPaths": ["<fieldPath>", ...] }
}`
}
