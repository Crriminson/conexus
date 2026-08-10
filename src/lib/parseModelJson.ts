// Canonical implementation lives in supabase/functions/_shared/parseModelJson.ts,
// shared between extract/index.ts and generate-section/index.ts. Re-exported
// here for Vitest coverage, same pattern as src/lib/merge/, src/lib/llm/, and
// src/lib/generatedSections/.
export { parseModelJson } from '../../supabase/functions/_shared/parseModelJson.ts'
