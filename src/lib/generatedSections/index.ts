// Canonical implementation lives in supabase/functions/_shared/generatedSections/
// (the Deno-side generate-section Edge Function is the real caller). Re-exported
// here so this project's Vitest suite can test the fact-collection/prompt/
// citation-validation logic without a Deno runtime — same pattern as
// src/lib/merge/ and src/lib/llm/.
export { collectConfirmedFacts } from '../../../supabase/functions/_shared/generatedSections/collectConfirmedFacts.ts'
export { buildGenerationPrompt } from '../../../supabase/functions/_shared/generatedSections/buildGenerationPrompt.ts'
export { resolveGeneratedSections } from '../../../supabase/functions/_shared/generatedSections/resolveGeneratedSections.ts'
export { buildDemoGeneratedSectionsResponse } from '../../../supabase/functions/_shared/generatedSections/buildDemoGeneratedSectionsResponse.ts'
export type {
  ConfirmedFactEntry,
  GeneratedSectionCitation,
  GeneratedSectionContent,
  GeneratedSectionKey,
  GeneratedSections,
} from '../../../supabase/functions/_shared/generatedSections/types.ts'
