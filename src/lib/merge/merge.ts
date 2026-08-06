// Canonical source moved to supabase/functions/_shared/merge/merge.ts (see
// docs/PROGRESS.md, Task 6 async work) — the extract Edge Function now runs
// merge() itself, so the logic has to live somewhere Deno can import it
// directly. This file re-exports it so nothing on the client (useRunExtraction,
// the 18 tests in merge.test.ts, etc.) has to change its import path.
//
// The two IssuerFacts declarations (this project's src/types/facts and the
// Deno side's factsTypes.ts) are structurally identical but separately
// declared — TypeScript's structural typing makes them interchangeable
// without casting. If Task 2's fact shape ever changes, factsTypes.ts must
// be updated to match; nothing enforces that automatically.
export { merge } from '../../../supabase/functions/_shared/merge/merge.ts'
export type { MergeDeps } from '../../../supabase/functions/_shared/merge/merge.ts'
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
