// Canonical source moved to supabase/functions/_shared/merge/types.ts —
// Deno (the extract Edge Function) needs this too, and can't resolve the
// `@/` alias or extensionless imports the Vite side uses. This file exists
// only so existing imports of `@/lib/merge/types` keep working.
export type {
  ExtractedCapitalStructureFacts,
  ExtractedCompanyFacts,
  ExtractedFacts,
  ExtractedFinancialsFacts,
  ExtractedLeaf,
  ExtractedLitigationRecord,
  ExtractedPromoterRecord,
  ExtractedRelatedPartyRecord,
  FactConflict,
  MergeEvent,
  MergeResult,
} from '../../../supabase/functions/_shared/merge/types.ts'
