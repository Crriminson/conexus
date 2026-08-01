# CONEXUS — Architecture
### Template-First DRHP Prototype

---

## 0. Scope note

There is no implementation on `rebuild/v1.1` — old app code was removed, only `CLAUDE.md` remains. This is the target architecture, not a critique of existing code.

---

## 1. Critique of the original plan

**Biggest over-engineering: RAG.** DRHP structure is fixed → AI's job is **extraction into a schema**, not retrieval over a corpus. Gemini's 1M context means send the document directly. Kill: embeddings, chunking, vector DB, retrieval layer.

**Two sources of truth.** Client state + server DB both holding project data = sync bugs. Pick one — Supabase.

**Four status vocabularies** across documents/disclosures/drafts/eligibility. Collapse to one: `missing | extracted | confirmed`.

**Gap Ledger duplicates Documents** — both are "checklist by category with a completion %." One module.

**Consistency engine and multi-project list** are scaffolding/derived value — demonstrate nothing about the actual innovation. Cut for prototype.

**AI used unnecessarily** on sections that are really templated (Capital Structure = table + boilerplate, not prose). **Deterministic is correct** for eligibility math, capital-structure tables, lock-in schedules, completeness checks.

---

## 2. Redesigned architecture

```
UPLOAD  →  EXTRACT  →  REVIEW  →  ASSEMBLE  →  EXPORT
(files)   (AI→JSON)   (human)   (templates)  (document)
```

**Stack:**
- React + Vite + TypeScript + Tailwind + shadcn + wouter
- **Supabase** — Postgres (facts JSONB), Storage (files), Edge Functions (Gemini calls), Auth. This *is* the backend. No Express, no Prisma, no Next.js.
- **TanStack Query** for server state. No Zustand — Supabase is the single source of truth.
- **Gemini 2.5 Flash**, called through one `callLLM()` seam — provider-agnostic, Gemini is just the first implementation.
- Dropped entirely: vector DB, embeddings, RAG, Framer Motion, Prisma, Express, Next.js.

**Section types — the whole AI strategy in one table:**

| Type | Source | Example |
|---|---|---|
| Static | Boilerplate | Definitions, General Info |
| Computed | Facts → template fn | Capital Structure, Shareholding, Financials |
| Generated | Gemini, from confirmed facts only | Risk Factors, MD&A, Business Overview (3 total) |

*We generate only what requires judgment.*

---

## 3. Fact model

One logical source of truth, six domain modules — not one giant blob.

```ts
// src/types/facts/envelope.ts
export type FieldStatus = "empty" | "ai" | "confirmed" | "edited";

export interface Field<T> {
  value: T | null;
  confidence: number | null;      // 0–1, null when human-set
  sourceDocId: string | null;
  sourcePage: number | null;
  status: FieldStatus;
  updatedAt: string;
}
```

```ts
// src/types/facts/index.ts
export interface IssuerFacts {
  company: CompanyFacts;
  financials: FinancialsFacts;
  promoters: PromoterFacts;
  capitalStructure: CapitalStructureFacts;
  litigation: LitigationFacts;
  relatedParties: RelatedPartyFacts;
}
```

Each domain in its own file (`facts/company.ts`, `facts/financials.ts`, …). Every leaf is a `Field<T>`, never a bare value. Repeating groups (promoters, litigation, RPTs) are arrays of records with an `id` plus `Field<T>` leaves — the `id` is the merge key.

**Why modular, not one flat interface:** Review screen renders one domain per section, extraction can target one domain at a time, a schema change touches one file.

---

## 4. Merge strategy

The rule that governs everything: **extraction proposes, humans dispose.**

**Status precedence:**

| Existing status | New extraction | Result |
|---|---|---|
| `empty` | any | Overwrite → `ai` |
| `ai` | higher confidence | Overwrite → `ai` |
| `ai` | equal/lower confidence | Keep existing, discard |
| `confirmed` | same value | Keep, no change |
| `confirmed` | different value | Keep existing, **raise conflict** |
| `edited` | same value | Keep, no change |
| `edited` | different value | Keep existing, **raise conflict** |

Never silently overwrite `confirmed` or `edited`. That's the whole trust model.

**Conflicts are first-class:**
```ts
export interface FactConflict {
  id: string;
  fieldPath: string;              // "financials.fy2025.ebitda"
  currentValue: unknown;
  currentStatus: FieldStatus;
  proposedValue: unknown;
  proposedConfidence: number;
  proposedSourceDocId: string;
  proposedSourcePage: number;
  raisedAt: string;
  resolution: "pending" | "kept_current" | "accepted_proposed";
  resolvedAt?: string;
}
```
A conflict never mutates the fact — it sits next to it until a human resolves it (Keep current / Accept proposed, shown side by side with sources).

**Array merging** (promoters, litigation, RPTs): match on a natural key (normalized name; case number falling back to party+description hash; normalized party+nature), not array position. No match → append as `ai`. Existing record absent from new extraction → **keep it, never delete** — absence in one document isn't evidence of non-existence.

**Provenance log** — every merge writes an append-only event:
```ts
export interface MergeEvent {
  id: string;
  documentId: string;
  ranAt: string;
  fieldsWritten: string[];
  fieldsSkipped: string[];
  conflictsRaised: string[];
}
```
This log powers the diff trail on the Review screen — "AI said ₹4.2cr, you corrected to ₹4.7cr, source: audited-financials.pdf p.14." Cheapest genuine differentiator in the build; falls out of the merge logic for free.

**Non-negotiables:** `merge(existing, extracted) → { facts, conflicts, event }` is a **pure function** — no DB calls, no side effects, unit-tested in isolation before it's wired to anything. No numeric coercion/rounding during merge. A failed extraction writes nothing — never a partial merge. Confidence below 0.5 still writes the field but flags it amber in review.

---

## 5. Remove

RAG/embeddings/vector DB/chunking · Zustand · Gap Ledger as separate module · consistency engine · multi-project list & create flow (one project, deep) · Merchant Reviews/Settings/Help routes · Framer Motion, Prisma, Express, Next.js · 4 status vocabularies → 1 · per-section lock + filing lock → keep only the final one.

## 6. Keep

Eligibility engine (deterministic) · upload→extract→review loop · field-level provenance · template-driven assembly · human confirm step · export + verbatim liability disclaimer · exactly 3 AI-generated narrative sections.

---

## 7. Risks & assumptions

| Risk | Mitigation |
|---|---|
| Extraction accuracy on scanned PDFs | Confidence scores + mandatory review; curate demo docs |
| Gemini rate limits mid-demo | Cache extractions in Supabase; never re-extract live |
| "Is this a real DRHP?" | Be explicit: N sections end-to-end, not all ~200 pages |
| Supabase ownership split | Teammate owns schema+auth; you own extraction+templates |
| Template correctness | Hand-verify computed sections against one real filed DRHP |

**Assumptions:** DRHP structure stable enough to template; demo runs on 3–5 curated docs; single-user, no real multi-role permissions.

---

## 8. Roadmap

1. **Spine** — Supabase project + schema, upload to Storage, fact types, project shell
2. **Extraction** — Edge Function → Gemini → typed JSON with confidence + source, cached
3. **Review** — the Facts Review screen (this screen *is* the product)
4. **Assembly** — static + computed sections, eligibility engine
5. **Generation** — 3 narrative sections from confirmed facts only
6. **Export + polish** — full document view, export, disclaimer, demo dataset

---

## 9. Atomic tasks for Claude Code

**Send exactly one per message. Wait for it to finish and for you to review before sending the next — do not let it chain ahead into the next task on its own.**

1. Scaffold Vite + React + TS + Tailwind + shadcn + wouter. Single route `/project`. No sidebar, no extra routes.
2. Define `src/types/facts/` — the `Field<T>` envelope plus six domain files (company, financials, promoters, capitalStructure, litigation, relatedParties) and the composite `IssuerFacts`. Nothing else this task.
3. Supabase client + schema: `projects` (id, name, facts JSONB, conflicts JSONB), `documents` (id, project_id, filename, storage_path, extraction_status). Env vars, no hardcoded keys.
4. TanStack Query hooks: `useProject`, `useUpdateFacts`, `useDocuments`. Optimistic updates.
5. Upload UI → Supabase Storage → `documents` row. Drag-drop + status list. No extraction yet.
6. Edge Function `extract`: document → Gemini 2.5 Flash → JSON matching the facts schema. Nulls for anything not found, never guesses. Defensive parse. Route the model call through a single `callLLM()` function so the provider is swappable later.
7. Implement `merge(existing, extracted) → { facts, conflicts, event }` as a **pure function with unit tests**, per section 4 above. Do not wire it to anything yet — this task is the function and its tests only.
8. Wire upload → extract → `merge()` → persist facts, conflicts, and merge event to the project row.
9. **Facts Review screen** — grouped by domain, confidence highlighting (low = amber), click source → opens document at page, inline edit, Confirm per field. Conflict badges where `resolution: "pending"`, with a resolution UI (Keep current / Accept proposed, both sides shown with source). Include the diff trail reading from merge events. *Demo centerpiece — build carefully.*
10. `src/lib/eligibility/` — rules config + pure evaluation from `IssuerFacts`. Traffic-light card.
11. `src/lib/templates/` — static boilerplate + computed section functions (capital structure, shareholding, financial summary).
12. Edge Function `generate-section`: 3 narrative sections from confirmed facts only, citing which facts were used.
13. Document view: all sections in order, source links live, per-section status.
14. Export to Markdown + verbatim liability disclaimer. Gate on all-facts-confirmed.
15. Seed demo dataset + polish.

---

## 10. Three-advisor check

**Breaker:** Cutting the multi-project list means judges see a single-tenant toy — "does this scale to 50 issuers?" has no visual answer. Merge logic (task 7) is where subtle bugs hide.

**Rebuilder:** Same time, same team — skip Supabase entirely, client-side IndexedDB + direct Gemini calls, static deploy, zero backend to break mid-demo.

**Opportunity Hunter:** The diff trail (task 9) is the genuinely novel angle — nearly free on top of the merge log, and no other team will demo it.

**Verdict:** Rebuilder is tempting but wrong — teammate is already on Supabase; rearchitecting around her costs more than it saves. Take Breaker's task-7 warning seriously — it's isolated as its own task with tests specifically because of this. The diff trail is already folded into task 9.
