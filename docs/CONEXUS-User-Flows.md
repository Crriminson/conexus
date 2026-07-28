# CONEXUS — User Flow Document

**AI-Powered IPO Drafting & Compliance Platform**
Companion to: CONEXUS-PRD.md (product requirements), CONEXUS-TRD.md (technical implementation)
Document status: Build-phase v1.0
Source: every flow below is a direct sequencing of the Functional Requirements (PRD §5), the Permission Matrix (PRD §6.1), the Review Gate state machine (TRD §7), and the Notification Trigger Policy (PRD §6.4). Nothing here introduces a requirement absent from the PRD/TRD — this document connects what is already specified into buildable, role-ordered sequences.

---

## 1. Purpose & Scope

This document defines every user-facing path through Conexus: the single end-to-end project lifecycle, the six per-role flows, the cross-cutting system flows that run underneath multiple roles, and the exception paths a reviewer or engineer needs on day one, not discovered mid-build. It is the frontend/UX build reference — screens and route groups (TRD §3) are built against these sequences directly.

## 2. Notation

- `→` sequential step, same actor
- `⤷` system-triggered step (background job, automated check) following a user action
- `⇢` branch point — flow forks on a condition
- `[ROLE]` the actor performing the step
- `{STATUS}` an entity's status value at that point
- Steps reference their governing module as **(PRD §x.x)** and, where relevant, their technical mechanism as **(TRD §x)**

---

## 3. End-to-End Project Lifecycle

The single master flow every project instance follows, start to export:

```
[AC] Sign Up / Sign In (PRD §5.2)
  → [AC] Create Project → lands on AC Dashboard (PRD §5.3)
  → [AC] Complete Company Profile {one-time} (PRD §5.4)
    ⤷ writes seed KnowledgeBaseEntry rows, sourceType=company_profile
  ⤷ Eligibility Assessment auto-runs (PRD §5.5) → status: eligible / eligible with conditions / not yet eligible
  → [AC/MB] Invite stakeholders — MB, CA, CS, Legal Advisor, Underwriter (PRD §5.2, TRD §9)
    ⤷ ProjectMember rows created {INVITED}
  → [AC/MB] Upload source documents in Upload Center (PRD §5.6)
    ⤷ OCR Engine background job runs per upload (PRD §5.7, TRD §11)
    ⤷ extracted fields mirrored into Knowledge Base, sourceType=ocr
  → [AC] Complete AI Interview questions generated from the Gap Detection ↔ Knowledge Base delta (PRD §5.8)
    ⤷ answers written to Knowledge Base, sourceType=interview
  → [Owning role per category] Draft in Documentation Workspace (PRD §5.10)
    ⤷ AI-assisted drafting, grounded exclusively in Knowledge Base, returns clause + source_refs (TRD §6.3)
  → [Editor] Submit section for review {DRAFT → SUBMITTED_FOR_REVIEW}
    ⤷ Gap Detection runs (PRD §5.13) → GapFlag raised or cleared
    ⤷ Validation Engine runs (PRD §5.12) → PASS / FAIL / FLAGGED_FOR_REVIEW
  → [Owning reviewer role] Review in Expert Review Workspace (PRD §5.14)
    ⇢ Approve → {APPROVED}, section locked, DRHPSectionVersion snapshot written (TRD §7)
    ⇢ Request Changes → {CHANGES_REQUESTED} → editor revises → resubmits, reviewRound + 1 → back to SUBMITTED_FOR_REVIEW
  → [System] Repeat drafting/review loop until every required section across every category is {APPROVED}
  ⤷ IPO Readiness Dashboard reflects live approval progress throughout (PRD §5.15)
  → [MB] Export Module unlocks (PRD §5.16) → "Approve + Export" → PDF/DOCX generated
  ⇢ [Phase 2] Export completion triggers blockchain hash registration (PRD §6.5, TRD §10)
```

Every arrow above is a hard sequencing dependency already encoded in each module's "Depends On" field in PRD §5 — this flow does not add new dependencies, it orders the existing ones.

---

## 4. Per-Role Flows

Each role's flow is scoped by the Permission Matrix (PRD §6.1). Category columns referenced below: Company Profile, Financial, Legal/Risk, Secretarial/Compliance, Business/Offer, Export.

### 4.1 Applicant Company (Project Owner)

| Step | Action | Module | Access Basis |
|---|---|---|---|
| 1 | Sign up, create project | Auth, Dashboard | Owner on creation |
| 2 | Complete Company Profile | Company Profile | Edit |
| 3 | Invite MB, CA, CS, Legal Advisor, Underwriter | Auth | Invite: Yes (owner) |
| 4 | Upload incorporation, financial, board-resolution documents | Upload Center | Implicit via project ownership |
| 5 | Answer AI Interview questions | AI Interview | Only person the interview targets |
| 6 | Draft/edit Company Profile and Business/Offer sections | Documentation Workspace | Edit on Company Profile, Business/Offer |
| 7 | Submit Business/Offer sections for review | Documentation Workspace | Editor of record |
| 8 | View Financial, Legal/Risk, Secretarial/Compliance sections | Documentation Workspace | View only |
| 9 | Track readiness, gaps, approvals | IPO Readiness Dashboard | View |
| 10 | Query project status via AI Copilot | AI Copilot | Scoped to own visibility |

**Cannot:** approve any section (no approve authority in any category); edit or view-edit Financial/Legal/Risk/Secretarial-Compliance content; export; use AI Copilot to trigger an approval.
**Receives notifications for:** OCR extraction complete, gap flagged, invite accepted, section approved/changes-requested on Business/Offer, all-required-sections-approved, export completed (PRD §6.4).

### 4.2 Merchant Banker (Lead Intermediary)

| Step | Action | Module | Access Basis |
|---|---|---|---|
| 1 | Accept invite, sign in | Auth | Invitee |
| 2 | Land on MB Dashboard — broadest module visibility | Dashboard | Role-scoped |
| 3 | Edit content in any category — Company Profile, Financial, Legal/Risk, Secretarial/Compliance, Business/Offer | Documentation Workspace | Edit across all five |
| 4 | Invite additional stakeholders | Auth | Invite: Yes |
| 5 | Approve or request changes on Business/Offer sections | Expert Review Workspace | Edit + Approve — Business/Offer only |
| 6 | Monitor Gap Detection and Validation Engine flags across every category | IPO Readiness Dashboard | View, broadest scope |
| 7 | Once every required section is Approved, execute "Approve + Export" | Export Module | Approve + Export — exclusive |
| 8 | Reopen an Approved section if a post-approval correction is needed | Expert Review Workspace | Sole unlock path (TRD §7) |

**Cannot:** approve Financial, Legal/Risk, or Secretarial/Compliance sections — editing rights there do not carry approval authority; those stay exclusive to CA, Legal Advisor, and CS respectively.
**Receives notifications for:** every event category (broadest recipient scope per PRD §6.4), specifically all gap-flagged, all validation-flagged, all section-submitted, all-approved, and export-completed events.

### 4.3 Chartered Accountant (CA)

| Step | Action | Module | Access Basis |
|---|---|---|---|
| 1 | Accept invite, sign in | Auth | Invitee |
| 2 | Land on CA Dashboard, scoped to Financial | Dashboard | Role-scoped |
| 3 | View Company Profile, Legal/Risk, Secretarial/Compliance, Business/Offer | Documentation Workspace | View only |
| 4 | Draft/edit Financial sections | Documentation Workspace | Edit + Approve |
| 5 | Review Financial sections in the review queue, inspect source_refs and Validation Engine result | Expert Review Workspace | Owning reviewer role |
| 6 | Approve or Request Changes | Expert Review Workspace | Exclusive approver, Financial |

**Cannot:** edit or approve outside Financial; export; approve without a recorded reviewer identity and timestamp (TRD §7 acceptance criteria).
**Receives notifications for:** section submitted for review (Financial), Validation Engine flags a Financial section.

### 4.4 Company Secretary (CS)

Identical structure to CA (§4.3), scoped to the Secretarial/Compliance category. Edit + Approve exclusive to Secretarial/Compliance; view-only elsewhere; no export authority.

### 4.5 Legal Advisor

Identical structure to CA (§4.3), scoped to the Legal/Risk category. Edit + Approve exclusive to Legal/Risk; view-only elsewhere; no export authority.

### 4.6 Underwriter

| Step | Action | Module | Access Basis |
|---|---|---|---|
| 1 | Accept invite, sign in | Auth | Invitee |
| 2 | Land on Underwriter Dashboard | Dashboard | Role-scoped |
| 3 | View Company Profile, Financial, Legal/Risk, Secretarial/Compliance, Export | Documentation Workspace, Export Module | View only |
| 4 | Draft/edit offer-terms content within Business/Offer sections | Documentation Workspace | Edit — offer-terms subset only, enforced at field level |
| 5 | Submit offer-terms edits for review | Documentation Workspace | Editor of record for that subset |

**Cannot:** approve any section; invite other stakeholders; edit Business/Offer content outside the offer-terms subset; export.
**Receives notifications for:** approved/changes-requested outcomes on the offer-terms content they submitted.

---

## 5. Cross-Cutting System Flows

### 5.1 Invite & Onboarding

```
[AC or MB] Send invite, role tag attached
  ⤷ ProjectMember row created {status: INVITED} (TRD §9)
  ⤷ Supabase built-in mailer delivers invite email
    ⇢ recipient is a Supabase team-authorized address → delivered
    ⇢ recipient is not team-authorized → "Email address not authorized," delivery fails
[Invitee] Opens invite link → Auth sign-up/sign-in
  → Accepts invite
  ⤷ ProjectMember.status: INVITED → ACTIVE, joinedAt set
  ⤷ AuditLog row written
  → Lands on role-scoped Dashboard
⤷ [AC, MB] Notified: invite accepted
```

Operational constraint carried into this flow: the mailer's 2-emails/hour cap is project-wide, not per-invite — invites for the six stakeholder roles are batched to respect it, not sent as a single burst immediately before a demo (PRD §6.4, TRD §9).

### 5.2 Document Intake → Knowledge Base

```
[AC/MB] Upload document, category-tagged (PRD §5.6)
  ⤷ Document row created {ocrStatus: pending}
  ⤷ ocr-extract background job runs (TRD §11)
    ⇢ success → Document.ocrExtracted written, ocrStatus: complete
      ⤷ fields mirrored into Knowledge Base, sourceType=ocr, per-field confidence score
      ⇢ confidence below acceptable floor → visibly flagged in UI, not silently accepted as fact
    ⇢ failure → ocrStatus: failed, visibly flagged
  → Gap Detection checklist compared against current Knowledge Base coverage (PRD §5.13)
  → AI Interview question set generated from the delta — covers both OCR failures and low-confidence fields (PRD §5.8)
[AC] Answers each question
  ⤷ Knowledge Base entry written, sourceType=interview — field marked covered, never re-asked
```

### 5.3 Drafting → Compliance → Review → Approval (core build loop)

```
[Editor role for category] Request AI-assisted draft in Documentation Workspace (PRD §5.10)
  ⤷ drafting prompt reads Knowledge Base entries for the project only — no open-ended fact generation (TRD §6.3)
  ⤷ model returns clause + source_refs
    ⇢ any claim with an empty source_refs entry → rejected server-side, missing fact routed into AI Interview queue instead
  → clause rendered with inline source references
[Editor] Refines, then Submits for Review {DRAFT → SUBMITTED_FOR_REVIEW}
  ⤷ gap-detection-run and validation-engine-run fire (TRD §11)
    ⤷ Gap Detection: deterministic presence/absence → GapFlag raised or cleared
    ⤷ Validation Engine: RAG confidence check (TRD §6.4)
      ⇢ confidence ≥ 0.75 → PASS or FAIL, matched regulation reference attached
      ⇢ confidence < 0.75 → FLAGGED_FOR_REVIEW, surfaced as "AI flagged — needs [owning role] review"
[Owning reviewer role] Opens Expert Review Workspace, inspects clause + source_refs + Gap/Validation results
  ⇢ Approve → {APPROVED}, section locked, DRHPSectionVersion snapshot written, AuditLog row written
  ⇢ Request Changes → {CHANGES_REQUESTED}, reviewNotes recorded
    → [Editor] edits directly in this state → Resubmits → reviewRound + 1 → back to SUBMITTED_FOR_REVIEW
```

Post-approval correction path is a single exception, not a loop: only Merchant Banker can reopen an `{APPROVED}` section, which starts a new review round (TRD §7).

### 5.4 Notification Delivery

```
[Any module] Triggering event occurs
  ⤷ Notification row written synchronously in the same request/job (TRD §8)
  ⤷ delivered to connected clients via Supabase Realtime, scoped per-user by RLS
  ⇢ event type = Invite Sent → also delivered via email (Supabase built-in mailer)
  ⇢ every other event type → in-app only
```

Recipient set per event type is fixed by the Notification Trigger Policy (PRD §6.4) and is not configurable per project — this keeps a CA from ever receiving an event outside its owned category, by construction rather than by filter.

### 5.5 AI Copilot Query

```
[Any role] Asks Copilot a status question (PRD §5.11)
  ⤷ query scoped to the asking user's ProjectMember role
  ⤷ Copilot reads project state through the same RBAC layer as direct API calls — no elevated privilege
  → Response returned, or permitted action triggered (e.g. re-run Gap Detection)
```

The Copilot can never approve a section and can never surface data from a category the asking role has no view access to — this is enforced at the same layer as every other read/write, not by prompt instruction alone (TRD §6.6).

### 5.6 Export & Verification

```
[System] Every required DRHPSection across every category reaches {APPROVED}
  ⤷ Export Module control enables — previously disabled, not hidden (PRD §5.16)
[MB] Executes "Approve + Export" — exclusive action
  ⤷ export-generate job assembles the latest APPROVED DRHPSectionVersion per section, never the live draft (TRD §11)
  ⤷ PDF + DOCX generated, stored in Supabase Storage, signed URL returned
  ⤷ all active project members notified: export completed
  ⇢ [Phase 2] export.completed triggers blockchain-hash-register job (PRD §6.5, TRD §10)
    ⤷ SHA-256 hash of each approved version + final export submitted to Polygon Amoy registry contract
    ⤷ BlockchainRecord row written {txHash, blockNumber, status}
```

---

## 6. Exception & Alternate Flows

- **OCR extraction failure:** `ocrStatus: failed` is visibly flagged, never silently treated as extracted; the affected fields fall through into AI Interview question generation exactly as if the document had never been uploaded.
- **Validation Engine abstention:** confidence below 0.75 always resolves to `{FLAGGED_FOR_REVIEW}`, never presented as a confident pass or fail — the owning reviewer role makes the human call, the engine does not guess past its threshold.
- **Changes-requested loop:** the editor revises directly inside `{CHANGES_REQUESTED}` — no separate draft branch is created — and resubmission increments `reviewRound` rather than resetting it, preserving the full review history in `DRHPSectionVersion`.
- **Post-approval reopen:** Merchant Banker–exclusive, the only unlock path on an `{APPROVED}` section in v1; it always starts a fresh review round rather than mutating the locked version.
- **Cross-role access attempt:** a role attempting to edit a category it does not own (e.g. CA editing a Legal/Risk section) is blocked at the RLS/API layer — the UI hiding the control is a convenience, not the enforcement mechanism (TRD §5).
- **Invite delivery to a non-team-authorized address:** fails with "Email address not authorized" rather than a silent drop; the operational fix is pre-adding the six stakeholder test accounts as Supabase team members before sending invites, not a retry loop.
- **Mailer rate-cap exceeded:** invites beyond the 2/hour project-wide bucket queue for the next window; the batching discipline described in §5.1 is what keeps this from being hit during a demo.
- **Export attempted before all sections are Approved:** the Export Module control stays disabled — this is a UI/state precondition, not a failure state to recover from.

---

## 7. Flow-to-Module Cross-Reference

| Flow | Primary PRD Modules | Primary TRD Sections |
|---|---|---|
| End-to-End Lifecycle (§3) | 5.1–5.16 | 1, 7, 11, 15 |
| Applicant Company (§4.1) | 5.2–5.4, 5.6, 5.8, 5.10, 5.15 | 5, 9 |
| Merchant Banker (§4.2) | 5.2, 5.3, 5.10, 5.14, 5.15, 5.16 | 5, 7 |
| CA / CS / Legal Advisor (§4.3–4.5) | 5.10, 5.14 | 5, 7 |
| Underwriter (§4.6) | 5.10 | 5 |
| Invite & Onboarding (§5.1) | 5.2 | 9 |
| Document Intake → Knowledge Base (§5.2) | 5.6, 5.7, 5.8, 5.9, 5.13 | 6.1, 6.2, 11 |
| Drafting → Review → Approval (§5.3) | 5.10, 5.12, 5.13, 5.14 | 6.3, 6.4, 6.5, 7, 11 |
| Notification Delivery (§5.4) | 5.17 | 8 |
| AI Copilot Query (§5.5) | 5.11 | 6.6 |
| Export & Verification (§5.6) | 5.16, 5.18 | 10, 11 |

---

*Companion documents: CONEXUS-PRD.md (product requirements), CONEXUS-TRD.md (technical implementation).*
