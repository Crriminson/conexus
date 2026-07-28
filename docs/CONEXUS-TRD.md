# CONEXUS — Technical Requirements Document

**AI-Powered IPO Drafting & Compliance Platform**
Document status: Build-phase v1.0
Companion to: CONEXUS-PRD.md (product requirements), CONEXUS-User-Flows.md (role flows)

This document specifies the buildable technical architecture for Conexus. Every decision here is either a direct carry-forward of a Validated Direction from the ideation document, or a concrete default chosen to close a gap that was deliberately left open at product-decision level (RAG corpus chunking detail, notification transport, hosting target, LLM/OCR vendor, blockchain custody). Defaults are marked where they resolve a previously open item.

---

## 1. Architecture Overview

Conexus is a single Next.js application — not a literal multi-package monorepo, since there is no separate backend service to "mono" against. This was confirmed by the actual repo structure (`next.config.mjs`, single `package.json`, `prisma/`, `src/`, `public/`).

```
Client (Next.js UI, role-scoped route groups)
        │
        ▼
Next.js API Routes  ──────────────►  Background Jobs (Inngest)
        │                                     │
        ▼                                     ▼
  Prisma ORM                         LLM API (Claude) / OCR API / pgvector
        │
        ▼
Supabase Postgres (+ RLS, + pgvector)
        │
        ├── Supabase Auth (invite-based membership, session)
        └── Supabase Storage (uploads, generated exports)
```

**Why this shape:** shared TypeScript types between UI and API with no duplication, no cross-origin/CORS overhead, atomic frontend+API changes in a single commit, one deploy target. Splitting into separate services would only be justified by an independent client (e.g. a future mobile app) or a separate release cadence for a separate team — neither applies here. No Python service is included in v1; every AI task in scope (OCR, AI Interview, AI Copilot, drafting, gap detection, validation) is a call to a hosted third-party model, not a self-run ML pipeline. Add a Python service later only if a concrete task surfaces that hosted LLM APIs handle unreliably — not as a speculative addition now.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router), single app | API routes serve as the entire backend |
| Language | TypeScript | End-to-end type safety, UI and API share types |
| ORM | Prisma | Pooled connection (`DATABASE_URL`, port 6543) at runtime; direct connection (`DIRECT_URL`, port 5432) for migrations/CLI |
| Database | Supabase Postgres | Also hosts the pgvector extension for retrieval |
| Auth | Supabase Auth | Native Row Level Security integration; invite-based `ProjectMember` role assignment |
| Storage | Supabase Storage | Uploaded source documents, generated PDF/DOCX exports |
| Vector search | Supabase pgvector | Validation Engine's ICDR corpus retrieval — no separate vector-DB service |
| LLM | Claude (Anthropic API) | Drafting, AI Interview, AI Copilot, Validation Engine reasoning — hosted inference only |
| OCR | Third-party OCR API (e.g. Google Document AI, AWS Textract) | Abstracted behind an internal `OcrProvider` interface so the vendor is swappable |
| Background jobs | Inngest | Pulls long AI-calling operations out of synchronous serverless functions |
| Email | Supabase Auth built-in mailer | Invite delivery only — 2 emails/hour project-wide, team-members-only without custom SMTP |
| Blockchain (Phase 2) | Polygon, Amoy testnet | Document hash registry; platform-custodied signing key |
| Hosting | Vercel (application) + Supabase (data plane) | Free/Hobby tier sufficient for hackathon-scale demo traffic |

**On Vercel cost for an AI-native backend:** model inference runs on the LLM/OCR provider's infrastructure, not Vercel's. The actual Vercel cost driver is function *duration* while waiting on external calls — background jobs (Inngest) pull long AI waits out of synchronous request handlers, which addresses this directly.

---

## 3. Repository Structure

```
conexus/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (marketing)/               # Landing
│   │   ├── (auth)/                    # Sign-in, sign-up, invite-accept
│   │   ├── (dashboard)/
│   │   │   ├── applicant/             # Role-scoped route groups
│   │   │   ├── merchant-banker/
│   │   │   ├── ca/
│   │   │   ├── cs/
│   │   │   ├── legal-advisor/
│   │   │   ├── underwriter/
│   │   │   └── shared/                # Documentation Workspace, Expert Review — common shell, permission-aware inside
│   │   └── api/
│   │       ├── projects/
│   │       ├── company-profile/
│   │       ├── documents/             # Upload + OCR trigger
│   │       ├── interview/
│   │       ├── knowledge-base/
│   │       ├── drhp-sections/
│   │       ├── validation-engine/
│   │       ├── gap-detection/
│   │       ├── copilot/
│   │       ├── notifications/
│   │       ├── invites/
│   │       ├── export/
│   │       └── blockchain/            # Phase 2
│   ├── components/
│   │   ├── ui/                        # Base primitives
│   │   ├── workspace/                 # Documentation/Review workspace components
│   │   └── dashboard/
│   ├── modules/                       # Domain/business logic — one folder per functional module, first-class, not buried under utils/
│   │   ├── eligibility-assessment/
│   │   ├── ocr/
│   │   ├── ai-interview/
│   │   ├── knowledge-base/
│   │   ├── drafting/
│   │   ├── validation-engine/         # RAG pipeline, pgvector queries, abstention logic
│   │   ├── gap-detection/             # Hardcoded ICDR checklist rules
│   │   ├── copilot/
│   │   ├── versioning/
│   │   ├── notifications/
│   │   └── blockchain/                # Phase 2
│   ├── compliance/                    # First-class, auditable regulatory rule set — kept separate from generic modules/
│   │   ├── icdr-checklist/            # Gap Detection's hardcoded rules, versioned
│   │   └── icdr-corpus/               # Curated RAG source corpus + chunking scripts
│   ├── rbac/                          # Permission matrix as code — source of truth for both UI gating and RLS policy generation
│   ├── jobs/                          # Inngest function definitions
│   ├── lib/                           # Prisma client, Supabase client, auth helpers
│   ├── types/
│   └── hooks/
├── storage/                           # Supabase Storage bucket policy definitions (policy source, not runtime files)
├── docs/                              # PRD.md, TRD.md, User-Flows.md, ideation doc
├── next.config.mjs
├── tsconfig.json
├── package.json
└── .env.example
```

This resolves the structural gaps flagged against a generic frontend-only skeleton: an explicit `modules/` layer for AI-orchestration work (the harder half of this build, not an afterthought under `services/`), an explicit `rbac/` layer so six-role access is a first-class concern rather than convention, an explicit home for file/document handling (`documents` API route + `storage/` policy folder + `Document` entity), and an explicit `compliance/` layer so SEBI ICDR rules stay a traceable, auditable rule set rather than scattered logic inside generic helpers.

---

## 4. Data Model

Core Prisma schema (representative — not every scalar field is enumerated, but every entity and relationship needed for v1 is):

```prisma
enum ProjectRole {
  APPLICANT_COMPANY
  MERCHANT_BANKER
  CHARTERED_ACCOUNTANT
  COMPANY_SECRETARY
  LEGAL_ADVISOR
  UNDERWRITER
}

enum MemberStatus {
  INVITED
  ACTIVE
}

enum SectionCategory {
  COMPANY_PROFILE
  FINANCIAL
  LEGAL_RISK
  SECRETARIAL_COMPLIANCE
  BUSINESS_OFFER
}

enum SectionStatus {
  DRAFT
  SUBMITTED_FOR_REVIEW
  CHANGES_REQUESTED
  APPROVED
}

enum ValidationSource {
  GAP_DETECTION
  VALIDATION_ENGINE
}

enum ValidationStatus {
  PASS
  FAIL
  FLAGGED_FOR_REVIEW
}

model User {
  id            String          @id @default(cuid())
  email         String          @unique
  name          String
  createdAt     DateTime        @default(now())
  memberships   ProjectMember[]
  notifications Notification[]
}

model Project {
  id             String               @id @default(cuid())
  name           String
  ownerId        String
  status         String               @default("active")
  createdAt      DateTime             @default(now())
  members        ProjectMember[]
  companyProfile CompanyProfile?
  documents      Document[]
  sections       DRHPSection[]
  knowledgeBase  KnowledgeBaseEntry[]
  gapFlags       GapFlag[]
  notifications  Notification[]
  auditLogs      AuditLog[]
}

model ProjectMember {
  id        String       @id @default(cuid())
  projectId String
  userId    String
  role      ProjectRole
  status    MemberStatus @default(INVITED)
  invitedAt DateTime     @default(now())
  joinedAt  DateTime?
  project   Project      @relation(fields: [projectId], references: [id])
  user      User         @relation(fields: [userId], references: [id])

  @@unique([projectId, userId, role])
}

model CompanyProfile {
  id                String   @id @default(cuid())
  projectId         String   @unique
  companyName       String
  cin               String
  incorporationDate DateTime
  registeredOffice  String
  sector            String
  promoters         Json
  capitalStructure  Json
  pan               String
  gstin             String?
  fiscalYearEnd     String
  website           String?
  project           Project  @relation(fields: [projectId], references: [id])
}

model Document {
  id           String   @id @default(cuid())
  projectId    String
  uploadedById String
  fileUrl      String
  fileType     String
  category     String
  ocrStatus    String   @default("pending")
  ocrExtracted Json?
  createdAt    DateTime @default(now())
  project      Project  @relation(fields: [projectId], references: [id])
}

model KnowledgeBaseEntry {
  id          String   @id @default(cuid())
  projectId   String
  sourceType  String   // company_profile | ocr | interview | manual
  sourceRefId String?
  fieldKey    String
  fieldValue  String
  confidence  Float?
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id])
}

model DRHPSection {
  id                   String               @id @default(cuid())
  projectId            String
  sectionKey           String
  category             SectionCategory
  content              String
  status               SectionStatus        @default(DRAFT)
  assignedReviewerRole ProjectRole?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt
  project              Project              @relation(fields: [projectId], references: [id])
  versions             DRHPSectionVersion[]
  validationResults    ValidationResult[]

  @@unique([projectId, sectionKey])
}

model DRHPSectionVersion {
  id          String        @id @default(cuid())
  sectionId   String
  content     String
  status      SectionStatus
  createdById String
  reviewRound Int
  reviewerId  String?
  reviewNotes String?
  createdAt   DateTime      @default(now())
  section     DRHPSection   @relation(fields: [sectionId], references: [id])
}

model ValidationResult {
  id                String            @id @default(cuid())
  sectionId         String
  source            ValidationSource
  status            ValidationStatus
  confidenceScore   Float?
  matchedRegulation String?
  explanation       String?
  createdAt         DateTime          @default(now())
  section           DRHPSection       @relation(fields: [sectionId], references: [id])
}

model GapFlag {
  id          String   @id @default(cuid())
  projectId   String
  sectionKey  String
  missingItem String
  status      String   @default("open")
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id])
}

model Notification {
  id              String   @id @default(cuid())
  userId          String
  projectId       String
  type            String
  message         String
  relatedEntityId String?
  readStatus      Boolean  @default(false)
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
  project         Project  @relation(fields: [projectId], references: [id])
}

model AuditLog {
  id         String   @id @default(cuid())
  projectId  String
  actorId    String
  action     String
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
  project    Project  @relation(fields: [projectId], references: [id])
}

// Phase 2
model BlockchainRecord {
  id               String   @id @default(cuid())
  sectionVersionId String?
  documentHash     String
  txHash           String
  chain            String
  blockNumber      Int?
  status           String
  createdAt        DateTime @default(now())
}
```

`AuditLog` is an addition beyond what the ideation document explicitly named, included because the Human Review Gate's "who approved, when" requirement needs a durable record independent of `DRHPSectionVersion` — every status transition on a section, invite action, and export event writes one row here.

---

## 5. Role-Based Access Control & Row Level Security

The Permission Matrix (PRD Section 6.1) is the source of truth. Every table holding project data enforces RLS policies derived from it, keyed off `ProjectMember.role` and `ProjectMember.status = ACTIVE`. Representative policies:

```sql
-- SELECT: Financial sections visible to Applicant Company, Merchant Banker, CA
create policy "financial_section_select"
on "DRHPSection" for select
using (
  category = 'FINANCIAL'
  and exists (
    select 1 from "ProjectMember" pm
    where pm."projectId" = "DRHPSection"."projectId"
      and pm."userId" = auth.uid()
      and pm."status" = 'ACTIVE'
      and pm."role" in ('APPLICANT_COMPANY','MERCHANT_BANKER','CHARTERED_ACCOUNTANT')
  )
);

-- UPDATE: Financial sections editable by CA and Merchant Banker only
create policy "financial_section_update"
on "DRHPSection" for update
using (
  category = 'FINANCIAL'
  and exists (
    select 1 from "ProjectMember" pm
    where pm."projectId" = "DRHPSection"."projectId"
      and pm."userId" = auth.uid()
      and pm."status" = 'ACTIVE'
      and pm."role" in ('CHARTERED_ACCOUNTANT','MERCHANT_BANKER')
  )
);
```

The same pattern repeats per category (`LEGAL_RISK` → Legal Advisor + Merchant Banker, `SECRETARIAL_COMPLIANCE` → CS + Merchant Banker, `BUSINESS_OFFER` → Applicant Company + Underwriter + Merchant Banker with approve restricted further to Merchant Banker only). The `src/rbac/` module generates these policies from a single typed matrix definition, so the matrix is edited in one place and both UI gating and SQL policy stay in sync.

---

## 6. AI / LLM Subsystems

### 6.1 OCR Engine
Upload lands in Supabase Storage → background job calls the OCR provider (behind the `OcrProvider` interface) → structured JSON written to `Document.ocrExtracted` → mapped into `KnowledgeBaseEntry` rows (`sourceType = ocr`) with the confidence score the OCR API returns per field.

### 6.2 AI Interview
Question generation reads the delta between Gap Detection's checklist requirements and current Knowledge Base coverage. Every answer writes a `KnowledgeBaseEntry` (`sourceType = interview`). A field with an existing high-confidence entry is never re-asked.

### 6.3 AI-Assisted Drafting — Grounding Enforcement
This is the technical mechanism behind the PRD's "AI must not originate facts" rule:
- The drafting prompt is restricted to reference only `KnowledgeBaseEntry` rows belonging to the current project — no open-ended world-knowledge injection of facts.
- The model returns structured output: drafted clause text plus a `source_refs` array (Knowledge Base / Document entry IDs) for every factual claim in the clause.
- A response with an empty `source_refs` array for a factual claim is rejected server-side before it reaches the UI. Instead, the missing fact is routed into the AI Interview question queue.
- The Expert Review Workspace displays `source_refs` inline next to each clause, so a human reviewer can trace any stated fact back to its origin in one click.

### 6.4 Validation Engine (RAG)
- **Corpus:** curated ICDR Regulations + amendments, chunked at regulation/sub-regulation boundaries (PRD Section 6.7), embedded and stored in Supabase pgvector with `{regulation_number, sub_clause, title}` metadata.
- **Retrieval:** top-k chunks retrieved against a section's content; a confidence score is computed from retrieval similarity.
- **Decision rule:** `confidence >= 0.75` → return pass/fail with the matched regulation reference. `confidence < 0.75` → `ValidationResult.status = FLAGGED_FOR_REVIEW`, surfaced in Expert Review Workspace as "AI flagged — needs [owning role] review." The 0.75 default is stored as a config value, not hardcoded, so it can be recalibrated during QA without a schema change.

### 6.5 Gap Detection
A versioned, hardcoded rule set in `src/compliance/icdr-checklist/`, enumerating required disclosures/sections per SEBI ICDR. Runs presence/absence checks against `DRHPSection` records per project; raises a `GapFlag` per miss. No retrieval, no inference — fully unit-testable.

### 6.6 AI Copilot
Scoped to the requesting user's `ProjectMember` role. Reads project state to answer status questions and can trigger permitted actions (e.g., re-run Gap Detection), but every read and every action passes through the same RBAC layer as direct API calls — the Copilot has no elevated privilege and cannot approve a section.

---

## 7. Review & Versioning Workflow

`DRHPSection.status` state machine (four states, matching the three explicit review-cycle snapshot boundaries plus the initial draft state):

```
DRAFT
  │ editor submits
  ▼
SUBMITTED_FOR_REVIEW ──── owning reviewer approves ────► APPROVED (locked)
  │
  │ owning reviewer requests changes
  ▼
CHANGES_REQUESTED
  │ editor edits directly in this state, resubmits
  ▼
SUBMITTED_FOR_REVIEW (reviewRound + 1)

APPROVED ── Merchant Banker–initiated reopen only ──► SUBMITTED_FOR_REVIEW (new reviewRound)
```

Every transition into `SUBMITTED_FOR_REVIEW`, `APPROVED`, or `CHANGES_REQUESTED` writes a `DRHPSectionVersion` snapshot (`content`, `status`, `createdById`, `reviewRound`, `reviewerId`, `reviewNotes`) and an `AuditLog` row. On `APPROVED`, the live `DRHPSection` is locked — further edits require a Merchant Banker–initiated reopen, which starts a new review round. This is the only unlock path in v1, consistent with the Merchant Banker's broadest edit and sole final-approval authority.

---

## 8. Notifications Architecture

In-app notifications are written synchronously to the `Notification` table on the same request that produces the triggering event, and delivered to connected clients via Supabase Realtime subscription on that table, scoped per-user by RLS. Email is reserved for invite events only (Section 9), reusing the already-validated Supabase mailer rather than adding a second email provider. Trigger-to-recipient mapping is defined in PRD Section 6.4.

---

## 9. Invite & Email Delivery

- Applicant Company (or Merchant Banker, per invite rights in the Permission Matrix) sends an invite with a role tag attached, creating a `ProjectMember` row (`status = INVITED`).
- Delivery uses Supabase Auth's built-in invite email service — no custom SMTP, no separate transactional email provider.
- **Constraint:** the built-in mailer is capped at 2 emails/hour, project-wide (shared across signups, invites, and password resets — not a per-user bucket), and only delivers to addresses added as **team members** in the Supabase organization; sending to an arbitrary external address without custom SMTP returns "Email address not authorized."
- **Operational rule for the demo:** the six stakeholder test accounts must be added as Supabase project team members ahead of time, and invites should be sent in a batch that respects the 2/hour cap rather than all at once immediately before a demo.
- On acceptance, `ProjectMember.status` moves to `ACTIVE` and `joinedAt` is set.

---

## 10. Document Verification (Blockchain) — Phase 2

Full product-level spec is in PRD Section 6.5. Technical implementation notes:
- **Trigger:** Export Module's final export action.
- **What's hashed:** SHA-256 of each `DRHPSectionVersion` marked `APPROVED`, plus a hash of the assembled final export.
- **Write path:** a background job (`blockchain-hash-register`) submits the hash to a lightweight registry smart contract on Polygon Amoy testnet, using a server-held signing key (no user-facing wallet flow). Result written to `BlockchainRecord` (`txHash`, `blockNumber`, `status`).
- **Verification path (Phase 2 UI):** given a `DRHPSectionVersion`, recompute its hash and compare against the on-chain record — a mismatch means the content was altered outside the approved version, independent of trusting Conexus's own database.

---

## 11. Background Jobs (Inngest)

| Function | Triggered by | Does |
|---|---|---|
| `ocr-extract` | `document.uploaded` | Calls OCR provider, writes `Document.ocrExtracted`, mirrors into Knowledge Base |
| `draft-generate` | User request in Documentation Workspace | Calls Claude with grounded prompt, returns clause + `source_refs`, rejects ungrounded output |
| `gap-detection-run` | `section.submitted-for-review`, or manual trigger | Runs the hardcoded checklist, raises/clears `GapFlag` rows |
| `validation-engine-run` | `section.submitted-for-review` | Runs the RAG pipeline, writes `ValidationResult` |
| `export-generate` | Merchant Banker's Approve + Export action | Assembles approved section versions into PDF/DOCX |
| `blockchain-hash-register` | `export.completed` (Phase 2) | Writes document hashes to the Polygon registry contract |

Pulling these off the synchronous request path is what keeps Vercel function duration — and therefore cost — bounded, per the reasoning in Section 2.

---

## 12. Non-Functional Requirements

- **Security:** RLS enforced on every table holding project data; Supabase Storage access via signed URLs, not public buckets; every Human Review Gate transition writes an `AuditLog` row.
- **Reliability:** Supabase free-tier projects pause after 7 days of inactivity (data preserved, ~30s cold-start restore, no backups on free tier) — mitigated with a scheduled ping (~15 min setup) so the project doesn't go cold before or during judging.
- **Performance:** No AI-calling operation runs synchronously inside a user-facing request; all route through Inngest.
- **Auditability:** `AuditLog` plus `DRHPSectionVersion` together give a complete, queryable history of who changed and who approved what, and when.
- **Data integrity:** `DRHPSectionVersion` rows are write-once — never updated or deleted after creation.

---

## 13. Deployment & Hosting

**Default:** Vercel for the Next.js application (API routes and page rendering), Supabase for the entire data plane (Postgres, Auth, Storage, pgvector). This was left open in the ideation document by explicit user choice ("not relevant for now"); it is set here as the concrete default because it requires zero additional infrastructure decisions beyond what's already confirmed (Next.js + Supabase), and Free/Hobby tier is sufficient for demo-scale traffic. A single environment is acceptable for the hackathon timeline — no separate staging/production split is required for v1.

---

## 14. Environment Configuration

```
DATABASE_URL=              # Supabase pooled connection (port 6543), runtime queries
DIRECT_URL=                # Supabase direct connection (port 5432), Prisma migrations/CLI
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OCR_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
NEXT_PUBLIC_APP_URL=
# Phase 2
BLOCKCHAIN_RPC_URL=
BLOCKCHAIN_PRIVATE_KEY=
```

---

## 15. Build Sequencing

| Phase | Scope | Depends on |
|---|---|---|
| 0 — Foundation | Auth, RBAC/RLS, Project creation, invite flow, Company Profile step, base schema | — |
| 1 — Data Intake | Upload Center, OCR Engine, Knowledge Base aggregation, AI Interview | Phase 0 |
| 2 — Drafting & Compliance Core | Documentation Workspace, grounded AI drafting, Gap Detection, Validation Engine, Eligibility Assessment | Phase 1 |
| 3 — Review & Governance | Expert Review Workspace, review state machine, Draft Versioning, Notifications | Phase 2 |
| 4 — Output | Export Module, IPO Readiness Dashboard, AI Copilot | Phase 3 |
| 5 — Phase 2 / Post-MVP | Blockchain document verification, dynamic RAG corpus scraping, domain-verified email | Phase 4 |

Two tracks run in parallel with every phase above, not sequentially after them: timeboxed (1–2 hour) UI/UX wireframes for whichever module is actively being built next, and seed/demo data preparation (a realistic fictional company plus a partially complete DRHP), started from day one alongside engineering rather than left until the demo is imminent.

---

*Companion documents: CONEXUS-PRD.md (product requirements), CONEXUS-User-Flows.md (per-role and end-to-end flows).*
