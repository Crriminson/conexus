# CONEXUS — Project Requirements Document

**AI-Powered IPO Drafting & Compliance Platform**
Prepared for: SEBI Securities Market TechSprint 2026
Document status: Build-phase v1.0
Source: Conexus Ideation Document (all sessions through 2026-07-23) — this PRD converts every Validated Direction in that document into a firm, buildable requirement. Nothing below is contingent on further discussion.

---

## 1. Executive Summary

Conexus is an end-to-end IPO documentation workflow platform. It takes a company from initial readiness assessment through a fully drafted, compliance-checked, multi-party-reviewed Draft Red Herring Prospectus (DRHP), ready for export. It is not a chatbot and not a generic document editor — it is a structured pipeline with a mandatory human-review gate at every disclosure, built to augment the six professional roles involved in an IPO, not replace any of them.

The build targets a working, hosted, end-to-end demo within 1–2 weeks, on a single Next.js application backed by Supabase (Postgres, Auth, Storage, pgvector) and Prisma.

---

## 2. Problem Statement & Positioning

**Problem statement:** How might an AI-powered platform help companies prepare IPO offer documents by streamlining information collection, automating repetitive drafting, validating disclosures, identifying documentation gaps, and supporting collaboration with IPO intermediaries — while keeping final review and approval with qualified professionals.

**Positioning:** Conexus augments professionals; it does not replace them. Every AI-generated disclosure must trace back to a fact the company or its advisors actually supplied, and every section requires human sign-off before it counts as final. This positioning is a hard constraint on the build, not a marketing line — it shapes the drafting architecture (Section 6.10), the review gate (Section 7.2), and the abstention behavior of the Validation Engine (Section 6.12).

---

## 3. Scope

### 3.1 In Scope (v1)
- IPO readiness assessment
- Company information collection
- Document upload with OCR-based extraction
- AI-guided interview to fill gaps not covered by uploaded documents
- Unified company knowledge repository
- AI-assisted DRHP generation
- Compliance validation engine
- Documentation gap detection
- Expert review workspace with role-based sign-off
- Draft export (PDF/DOCX)
- AI Copilot (cross-module assistant)
- Role-based access control across six stakeholder types
- Notifications
- Document verification via blockchain (Phase 2 — see Section 7)

### 3.2 Out of Scope (v1)
- Regulatory approvals
- Legal certification
- Financial auditing
- Replacing the merchant banker
- Automatic filing with regulatory authorities

---

## 4. Stakeholders & Roles

Six roles are modeled, each with a distinct dashboard and distinct edit/approve authority:

1. **Applicant Company** — project owner. Initiates the project, owns Company Profile and Business/Offer content, invites every other role.
2. **Merchant Banker** — lead intermediary. Broadest edit rights across all section categories, sole holder of final export approval.
3. **Chartered Accountant (CA)** — owns Financial Sections.
4. **Company Secretary (CS)** — owns Secretarial/Compliance Sections.
5. **Legal Advisor** — owns Legal/Risk Sections.
6. **Underwriter** — edits offer-terms content within Business/Offer Sections; no approval authority.

Full per-role, per-section-category permissions are defined in Section 7.1.

---

## 5. Functional Requirements by Module

Eighteen modules make up the v1 product surface. Each is specified below with its purpose, capabilities, dependencies, and the concrete acceptance criteria that define "done" for the build.

### 5.1 Landing
**Purpose:** Public entry point communicating what Conexus is and is not — augmentation, not replacement of professional judgment.
**Key Capabilities:**
- Static marketing/info page: problem statement, module overview, positioning statement.
- Entry points to sign in and to request access.
**Depends On:** none.
**Acceptance Criteria:**
- Page is reachable without authentication.
- Sign-in CTA routes into Auth.

### 5.2 Auth
**Purpose:** Identity and session management; the entry point through which every role joins a project.
**Key Capabilities:**
- Sign up / sign in via Supabase Auth.
- Invite-acceptance flow: a user accepts an email invite tied to a specific `ProjectMember` row, which is where their project role is assigned — role is never a global user attribute.
- Session persists across the app; role context is resolved per-project on every request.
**Depends On:** none.
**Acceptance Criteria:**
- A user can hold different roles on different projects simultaneously.
- Accepting an invite transitions the corresponding `ProjectMember.status` from `INVITED` to `ACTIVE`.

### 5.3 Dashboard
**Purpose:** Role-scoped home screen — the first thing a user sees after sign-in.
**Key Capabilities:**
- Project list (or single active project for non-owner roles).
- Quick navigation into the modules the current role has access to.
- Project Timeline & Activity Feed — a chronological feed of recent project events scoped to what the current role is entitled to see.
- Notification tray.
**Depends On:** Auth, Notifications.
**Acceptance Criteria:**
- Dashboard content differs meaningfully by role — an Underwriter and a CA see different modules surfaced, matching the Permission Matrix.
- Activity feed never surfaces an event from a section category the current role has no visibility into.

### 5.4 Company Profile
**Purpose:** Capture baseline company identity data once, at project creation, so no downstream module re-collects the same facts.
**Key Capabilities:**
- One-time form at project creation, capturing: Company Legal Name, CIN, Date of Incorporation, Registered Office Address, Sector/Industry, Promoter(s) — name, DIN/PAN, shareholding percentage, Capital Structure — authorized capital, paid-up capital, face value per share, PAN, GSTIN, Fiscal Year End, Company Website (optional), Primary Contact — name, email, phone.
- Edit rights: Applicant Company, Merchant Banker. All other roles: view-only.
- On save, every field is written into Knowledge Base as the project's seed record.
**Depends On:** Auth.
**Feeds:** Eligibility Assessment, Knowledge Base.
**Acceptance Criteria:**
- A project cannot proceed past this step until all required fields are captured.
- Fields appear in Knowledge Base immediately on save, tagged `sourceType = company_profile`.
- Eligibility Assessment reads these fields directly — no re-entry.

### 5.5 Eligibility Assessment
**Purpose:** Evaluate IPO readiness against SEBI ICDR eligibility criteria.
**Key Capabilities:**
- Runs automatically once Company Profile is saved, using relevant profile fields plus a short additional eligibility questionnaire where profile fields alone are insufficient.
- Produces an eligibility status (eligible / eligible with conditions / not yet eligible) with a criteria-by-criteria breakdown.
**Depends On:** Company Profile.
**Feeds:** IPO Readiness Dashboard.
**Acceptance Criteria:**
- Assessment result updates automatically if a relevant Company Profile field is later edited by an authorized role.
- Each criterion in the breakdown states pass/fail and the specific data point it was evaluated against.

### 5.6 Upload Center
**Purpose:** Central intake point for source documents.
**Key Capabilities:**
- Upload with category tagging (financials, incorporation documents, board resolutions, etc.).
- Files stored in Supabase Storage; each upload creates a `Document` row.
- Upload triggers OCR Engine asynchronously.
**Depends On:** Auth, Company Profile (project must exist).
**Feeds:** OCR Engine.
**Acceptance Criteria:**
- Upload succeeds for the standard document types the demo company profile requires.
- Each `Document` row shows a visible OCR status (pending / processing / complete / failed) in the UI.

### 5.7 OCR Engine
**Purpose:** Extract structured data from uploaded documents, particularly financial tables, without a self-hosted model.
**Key Capabilities:**
- Third-party OCR API call, triggered as a background job per upload.
- Extracted fields written to `Document.ocrExtracted` and mirrored into Knowledge Base entries tagged `sourceType = ocr`, each carrying a confidence score.
**Depends On:** Upload Center.
**Feeds:** Knowledge Base, AI Interview (gap detection against what OCR already covered).
**Acceptance Criteria:**
- A financial statement upload produces at least the core line items as Knowledge Base entries with non-null confidence scores.
- Low-confidence extractions are visibly flagged, not silently accepted as fact.

### 5.8 AI Interview
**Purpose:** Fill knowledge gaps that neither Company Profile nor OCR covered, by asking the Applicant Company directly.
**Key Capabilities:**
- Question set generated from the delta between what Gap Detection's checklist requires and what Knowledge Base currently holds.
- Every answer becomes a Knowledge Base entry tagged `sourceType = interview`.
- A field already present in Knowledge Base with acceptable confidence is never asked again.
**Depends On:** Knowledge Base, Gap Detection (for the checklist of what's required).
**Feeds:** Knowledge Base.
**Acceptance Criteria:**
- No interview question duplicates a field already answered via Company Profile or OCR.
- Every interview answer is traceable in Knowledge Base back to the specific question asked.

### 5.9 Knowledge Base
**Purpose:** Single aggregation layer for every fact known about the company, regardless of source.
**Key Capabilities:**
- Stores entries from Company Profile, OCR, AI Interview, and manual entry, each tagged with source type, source reference, field key, field value, and confidence where applicable.
- Serves as the only source AI-assisted drafting is permitted to read from.
**Depends On:** Company Profile, OCR Engine, AI Interview.
**Feeds:** Documentation Workspace (drafting), Eligibility Assessment.
**Acceptance Criteria:**
- Every fact used in a drafted DRHP clause can be traced to exactly one Knowledge Base entry.
- No duplicate active entries exist for the same field key without a clear precedence rule (most recent, or highest confidence, applied consistently).

### 5.10 Documentation Workspace
**Purpose:** Where DRHP sections are actually drafted, edited, and prepared for review.
**Key Capabilities:**
- Section-by-section editing surface, permission-aware per the Permission Matrix (Section 7.1) — a role only sees edit controls on categories it is authorized to edit.
- AI-assisted drafting: on request, generates section content grounded exclusively in Knowledge Base entries, returning both the drafted text and the specific source references it drew from (see Section 7.6 for the grounding mechanism).
- Submit-for-review action, which triggers the review workflow (Section 7.2).
**Depends On:** Knowledge Base, Permission Matrix.
**Feeds:** Expert Review Workspace, Gap Detection, Validation Engine.
**Acceptance Criteria:**
- An AI-drafted clause is never displayed without at least one attached source reference.
- A role without edit rights on a category cannot submit changes to it, enforced at the API layer, not just hidden in the UI.

### 5.11 AI Copilot
**Purpose:** Cross-module conversational assistant for status queries and light task triggering.
**Key Capabilities:**
- Answers questions about project status (readiness, gaps, flags, section approval progress) scoped to what the requesting role can see.
- Can trigger permitted actions on request (e.g., re-run Gap Detection) but cannot bypass the Permission Matrix or the Human Review Gate under any prompt.
**Depends On:** Every other module (reads their state).
**Acceptance Criteria:**
- A Copilot response never surfaces data from a section category the asking role has no view access to.
- Copilot cannot mark a section as approved — that action remains exclusively in Expert Review Workspace.

### 5.12 Validation Engine
**Purpose:** Substantive compliance check — does a disclosure's actual content satisfy the relevant SEBI ICDR regulation.
**Key Capabilities:**
- Retrieval-augmented check against a curated, static ICDR corpus (Section 7.7) via Supabase pgvector.
- Returns pass / fail / flagged-for-review per section, with the matched regulation reference on pass or fail.
- Mandatory abstention: when retrieval confidence falls below the default threshold (0.75) or no corpus chunk clears a minimum floor, the result is flagged for human review rather than returned as a confident answer — this is core logic, not a fallback.
- The flagged state is surfaced visibly in the Expert Review Workspace UI ("AI flagged — needs [owning role] review"), as a trust-building feature, not hidden.
**Depends On:** Documentation Workspace (content to check), curated ICDR corpus.
**Feeds:** Expert Review Workspace, IPO Readiness Dashboard.
**Acceptance Criteria:**
- Every validation result carries a confidence score and, where matched, a specific regulation reference — never a bare pass/fail with no basis shown.
- A result below threshold is never presented as a confident pass or fail.

### 5.13 Gap Detection
**Purpose:** Deterministic presence/absence check — is every required disclosure or section present at all.
**Key Capabilities:**
- Hardcoded SEBI ICDR checklist, evaluated against the current set of `DRHPSection` records per project.
- Raises a `GapFlag` per missing required item.
- Fully deterministic — no retrieval or model inference involved.
**Depends On:** Documentation Workspace.
**Feeds:** AI Interview (question generation), IPO Readiness Dashboard.
**Acceptance Criteria:**
- Running Gap Detection against the seeded demo company's intentionally incomplete DRHP correctly flags the missing items.
- A resolved gap (section subsequently added) clears the corresponding `GapFlag` automatically on next run.

### 5.14 Expert Review Workspace
**Purpose:** Where each reviewer role sees the sections it owns and exercises approve / request-changes authority.
**Key Capabilities:**
- Reviewer-role-specific queue: a CA sees Financial Sections awaiting review, a Legal Advisor sees Legal/Risk, and so on, per the category-ownership map in Section 7.1.
- Surfaces AI Validation Engine flags and drafted clauses' source references inline, so a reviewer is checking factual accuracy against a traceable origin, not rubber-stamping.
- Approve / Request Changes actions drive the section status state machine (Section 7.3).
**Depends On:** Documentation Workspace, Validation Engine, Gap Detection.
**Feeds:** Draft Versioning, Notifications, Export Module.
**Acceptance Criteria:**
- A section cannot reach Approved status without a recorded reviewer identity and timestamp.
- Only the role that owns a section's category can approve it; other roles may view but not act.

### 5.15 IPO Readiness Dashboard
**Purpose:** Aggregate, at-a-glance view of overall project compliance progress.
**Key Capabilities:**
- Eligibility status, open gap count, open validation flags, and section approval progress (approved / total required sections), refreshed from live project state — never from seeded or cached demo data.
**Depends On:** Eligibility Assessment, Gap Detection, Validation Engine, Expert Review Workspace.
**Acceptance Criteria:**
- Every figure shown is queryable back to a live database record at the moment it's displayed.

### 5.16 Export Module
**Purpose:** Produce the final DRHP once all required sections are approved.
**Key Capabilities:**
- Available only once every required section's status is Approved.
- Final "Approve + Export" action is exclusive to Merchant Banker, consistent with the Permission Matrix.
- Generates a downloadable PDF and DOCX of the assembled DRHP.
- Phase 2: on successful export, triggers the blockchain hash-registration described in Section 7.5.
**Depends On:** Expert Review Workspace (all sections approved).
**Acceptance Criteria:**
- Export is unavailable (control disabled, not just hidden) while any required section is not yet Approved.
- The exported document's section content matches the latest Approved `DRHPSectionVersion` for every section, not the live-edit draft.

### 5.17 Notifications
**Purpose:** Keep every role informed of events inside its own scope, without over-notifying roles outside that scope.
**Key Capabilities:**
- In-app, real-time notifications as the primary channel for all events.
- Email reserved specifically for invite-related events, using the same Supabase built-in mailer already validated for invite delivery (Section 7.6) — this avoids routing high-volume transactional notification traffic through the same rate-capped channel.
- Trigger list and recipient scoping defined in Section 7.4.
**Depends On:** every module that produces an event.
**Acceptance Criteria:**
- A CA never receives a notification for an edit made inside a category it has no ownership of.
- Every notification links directly to the entity it concerns (section, document, gap, invite).

### 5.18 Document Verification (Blockchain) — Phase 2
**Purpose:** Third-party-verifiable tamper-evidence for locked DRHP content, independent of trusting Conexus's own database.
**Key Capabilities:** see Section 7.5 for the full technical specification.
**Depends On:** Export Module.
**Status:** Deprioritized relative to the rest of the v1 build — scheduled after every other module, per explicit product decision. Fully specified below so it is buildable when its turn comes, not a placeholder.

---

## 6. Cross-Cutting Product Requirements

### 6.1 Permission Matrix

The single source of truth for who can view, edit, or approve each section category:

| Role | Company Profile | Financial Sections | Legal/Risk Sections | Secretarial/Compliance | Business/Offer Sections | Export | Invite Others |
|---|---|---|---|---|---|---|---|
| Applicant Company | Edit | View | View | View | Edit | View | Yes (owner) |
| Merchant Banker | Edit | Edit | Edit | Edit | Edit + Approve | Approve + Export | Yes |
| CA | View | Edit + Approve | View | View | View | View | No |
| CS | View | View | View | Edit + Approve | View | View | No |
| Legal Advisor | View | View | Edit + Approve | View | View | View | No |
| Underwriter | View | View | View | View | Edit (offer terms) | View | No |

Every specialist role approves its own domain. The Merchant Banker holds the broadest edit footprint and the sole final export authority, mirroring its real-world lead-intermediary function. This table is the direct source for Supabase Row Level Security policy design (Section 5 of the TRD).

### 6.2 Human Review Gate

Human review before finalization is a **mandatory hard gate**, enforced in the workflow layer — not a UI convention that can be bypassed by direct API access. A section cannot reach export-ready status without a recorded reviewer sign-off (who approved, when). Full state machine in Section 7.3.

### 6.3 Draft Versioning

A separate `DRHPSectionVersion` table records a snapshot at each review-cycle boundary (submitted-for-review, approved, changes-requested) — not on every autosave tick. The live `DRHPSection` remains the mutable current draft; approval creates an immutable version snapshot and locks the section. This gives every reviewer a clean answer to "what changed since the last review round."

### 6.4 Notifications — Trigger Policy

| Event | Channel | Recipients |
|---|---|---|
| Document uploaded | In-app | Applicant Company, Merchant Banker |
| OCR extraction complete | In-app | Applicant Company, Merchant Banker |
| Gap flagged | In-app | Applicant Company, Merchant Banker |
| Section submitted for review | In-app | Owning reviewer role for that category (Section 6.1 map) |
| Validation Engine flags a section | In-app | Owning reviewer role for that category |
| Section approved | In-app | Editor(s) of that category, Merchant Banker |
| Section changes requested | In-app | Editor(s) of that category |
| Invite sent | Email + In-app | Invitee |
| Invite accepted | In-app | Applicant Company, Merchant Banker |
| All required sections approved (export-ready) | In-app | Merchant Banker |
| Export completed | In-app | All active project members |

Email is deliberately restricted to invite events, since the demo's Supabase built-in mailer shares a single 2-emails-per-hour bucket across the whole project — routing notification volume through it would exhaust the cap before invites go out reliably.

### 6.5 Document Verification (Blockchain) — Phase 2 Specification

- **Network:** Polygon, Amoy testnet, for the hackathon demo. Mainnet migration is a post-hackathon decision, not part of this build.
- **Custody:** Platform-custodied signing key (server-side wallet). No end-user wallet requirement — the feature stays frictionless for a demo audience.
- **What gets recorded:** SHA-256 hash of each locked `DRHPSectionVersion` and of the final export, written to a lightweight on-chain registry contract alongside project ID and timestamp.
- **Trigger point:** Export Module's final export action, after Merchant Banker approval.
- **Gas:** Funded from a testnet faucet for the demo; production gas-cost handling is out of scope for this build.

### 6.6 AI Interview / Drafting Boundary

The AI may phrase and word a disclosure — that is the actual value of the drafting feature — but must never originate the underlying factual claim. Every drafted clause's content must trace back to something the user substantively supplied, via Company Profile, an uploaded document, or an interview answer. This keeps the Human Review Gate meaningful: a reviewer is checking whether a stated fact is accurate, not whether the AI invented something. Enforcement mechanism is specified in the TRD (Section 6.3).

### 6.7 Curated ICDR Corpus (Validation Engine)

- **Scope:** SEBI ICDR Regulations, 2018 (principal regulations, current consolidated text) plus amendments issued up to the corpus freeze date. Live/dynamic scraping is explicitly out of scope for v1.
- **Chunking:** Structured by regulation and sub-regulation boundary, not fixed-token windows, so retrieval results map cleanly to a citable regulation reference.
- **Refresh:** Manual, versioned reload when a new amendment is added — no standing background crawler.

---

## 7. Release Phasing

### 7.1 MVP — Hackathon Demo Build
Every module in Section 5 except Document Verification (Blockchain), built and working end-to-end against live data: a real project can be created, a real company profile entered, real documents uploaded and OCR'd, a real AI interview completed, real sections drafted and validated, and a real multi-role review cycle carried through to export.

### 7.2 Phase 2 — Post-Hackathon Roadmap
- Document Verification via blockchain (fully specified in Section 6.5, ready to build when scheduled).
- Dynamic/live scraping for the Validation Engine's ICDR corpus, replacing the static curated corpus.
- Domain-verified transactional email for invites, replacing reliance on Supabase's rate-capped built-in mailer.

---

## 8. Success Criteria

- All six roles can be demoed end-to-end, each landing on a dashboard that reflects the Permission Matrix, not a shared generic view.
- A DRHP section can be created, AI-drafted with grounded source references, run through Gap Detection and the Validation Engine, submitted for review, approved by its owning role, and locked with an immutable version snapshot.
- Gap Detection correctly flags the seeded demo company's intentionally incomplete DRHP sections.
- A live invite email is delivered end-to-end to a Supabase-team-authorized address.
- The IPO Readiness Dashboard reflects live project state at every point in the demo, not a scripted snapshot.
- The Export Module produces a downloadable PDF and DOCX once all required sections are approved.
- Seed/demo data (a realistic fictional company plus a partially complete DRHP) exists as rehearsal material, kept separate from — and never a substitute for — the real, working data pipeline.

---

## 9. Key Parameters & Defaults

| Parameter | Value | Basis |
|---|---|---|
| Demo timeline | 1–2 weeks to hosted, working end-to-end demo | Fixed project constraint |
| Validation Engine abstention threshold | 0.75 retrieval confidence (cosine similarity), default | Empirically tunable during QA without schema change |
| Supabase built-in mailer cap | 2 emails/hour, project-wide, team-members-only without custom SMTP | Governs invite batching and notification channel policy |
| Hosting | Vercel (application) + Supabase (data plane) | Matches the confirmed Next.js + Supabase stack |
| Primary LLM | Claude (Anthropic API) | Hosted inference only, consistent with the no-self-hosted-ML decision |
| OCR provider | Third-party OCR API with table-structure extraction, abstracted behind an internal service interface | Vendor-swappable by design |
| Blockchain network (Phase 2 demo) | Polygon, Amoy testnet | Free, no mainnet cost exposure for a deprioritized feature |

---

*Companion documents: CONEXUS-TRD.md (technical implementation), CONEXUS-User-Flows.md (per-role and end-to-end flows).*
