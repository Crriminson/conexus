-- Migration: Enable RLS and setup policies based on RBAC matrix

-- Enable RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeBaseEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DRHPSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DRHPSectionVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ValidationResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GapFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportArtifact" ENABLE ROW LEVEL SECURITY;

-- DRHPSection Policies
CREATE POLICY "company_profile_section_select" ON "DRHPSection" FOR SELECT USING (
  category = 'COMPANY_PROFILE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER')
  )
);

CREATE POLICY "company_profile_section_update" ON "DRHPSection" FOR UPDATE USING (
  category = 'COMPANY_PROFILE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "company_profile_section_insert" ON "DRHPSection" FOR INSERT WITH CHECK (
  category = 'COMPANY_PROFILE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "company_profile_section_delete" ON "DRHPSection" FOR DELETE USING (
  category = 'COMPANY_PROFILE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "financial_section_select" ON "DRHPSection" FOR SELECT USING (
  category = 'FINANCIAL'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER')
  )
);

CREATE POLICY "financial_section_update" ON "DRHPSection" FOR UPDATE USING (
  category = 'FINANCIAL'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT')
  )
);

CREATE POLICY "financial_section_insert" ON "DRHPSection" FOR INSERT WITH CHECK (
  category = 'FINANCIAL'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT')
  )
);

CREATE POLICY "financial_section_delete" ON "DRHPSection" FOR DELETE USING (
  category = 'FINANCIAL'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT')
  )
);

CREATE POLICY "legal_risk_section_select" ON "DRHPSection" FOR SELECT USING (
  category = 'LEGAL_RISK'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER')
  )
);

CREATE POLICY "legal_risk_section_update" ON "DRHPSection" FOR UPDATE USING (
  category = 'LEGAL_RISK'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'LEGAL_ADVISOR')
  )
);

CREATE POLICY "legal_risk_section_insert" ON "DRHPSection" FOR INSERT WITH CHECK (
  category = 'LEGAL_RISK'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'LEGAL_ADVISOR')
  )
);

CREATE POLICY "legal_risk_section_delete" ON "DRHPSection" FOR DELETE USING (
  category = 'LEGAL_RISK'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'LEGAL_ADVISOR')
  )
);

CREATE POLICY "secretarial_compliance_section_select" ON "DRHPSection" FOR SELECT USING (
  category = 'SECRETARIAL_COMPLIANCE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER')
  )
);

CREATE POLICY "secretarial_compliance_section_update" ON "DRHPSection" FOR UPDATE USING (
  category = 'SECRETARIAL_COMPLIANCE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'COMPANY_SECRETARY')
  )
);

CREATE POLICY "secretarial_compliance_section_insert" ON "DRHPSection" FOR INSERT WITH CHECK (
  category = 'SECRETARIAL_COMPLIANCE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'COMPANY_SECRETARY')
  )
);

CREATE POLICY "secretarial_compliance_section_delete" ON "DRHPSection" FOR DELETE USING (
  category = 'SECRETARIAL_COMPLIANCE'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'COMPANY_SECRETARY')
  )
);

CREATE POLICY "business_offer_section_select" ON "DRHPSection" FOR SELECT USING (
  category = 'BUSINESS_OFFER'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER')
  )
);

CREATE POLICY "business_offer_section_update" ON "DRHPSection" FOR UPDATE USING (
  category = 'BUSINESS_OFFER'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'UNDERWRITER')
  )
);

CREATE POLICY "business_offer_section_insert" ON "DRHPSection" FOR INSERT WITH CHECK (
  category = 'BUSINESS_OFFER'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'UNDERWRITER')
  )
);

CREATE POLICY "business_offer_section_delete" ON "DRHPSection" FOR DELETE USING (
  category = 'BUSINESS_OFFER'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'UNDERWRITER')
  )
);

-- CompanyProfile Policies
CREATE POLICY "company_profile_select" ON "CompanyProfile" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "CompanyProfile"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER')
  )
);

CREATE POLICY "company_profile_update" ON "CompanyProfile" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "CompanyProfile"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "company_profile_insert" ON "CompanyProfile" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "CompanyProfile"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "company_profile_delete" ON "CompanyProfile" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "CompanyProfile"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

-- Project-Scoped Tables (Read for all ACTIVE members)
CREATE POLICY "document_select" ON "Document" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "Document"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "document_update" ON "Document" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "Document"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "document_insert" ON "Document" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "Document"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "document_delete" ON "Document" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "Document"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "knowledgebaseentry_select" ON "KnowledgeBaseEntry" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "KnowledgeBaseEntry"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "knowledgebaseentry_update" ON "KnowledgeBaseEntry" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "KnowledgeBaseEntry"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "knowledgebaseentry_insert" ON "KnowledgeBaseEntry" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "KnowledgeBaseEntry"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "knowledgebaseentry_delete" ON "KnowledgeBaseEntry" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "KnowledgeBaseEntry"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "gapflag_select" ON "GapFlag" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "GapFlag"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "gapflag_update" ON "GapFlag" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "GapFlag"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "gapflag_insert" ON "GapFlag" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "GapFlag"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "gapflag_delete" ON "GapFlag" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "GapFlag"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "validationresult_select" ON "ValidationResult" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "ValidationResult"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "validationresult_update" ON "ValidationResult" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "ValidationResult"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "validationresult_insert" ON "ValidationResult" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "ValidationResult"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "validationresult_delete" ON "ValidationResult" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "ValidationResult"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "auditlog_select" ON "AuditLog" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "AuditLog"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "auditlog_insert" ON "AuditLog" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "AuditLog"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "exportartifact_select" ON "ExportArtifact" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "ExportArtifact"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "exportartifact_update" ON "ExportArtifact" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "ExportArtifact"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER')
  )
);

CREATE POLICY "exportartifact_insert" ON "ExportArtifact" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "ExportArtifact"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER')
  )
);

CREATE POLICY "exportartifact_delete" ON "ExportArtifact" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "ExportArtifact"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER')
  )
);

CREATE POLICY "drhpsectionversion_select" ON "DRHPSectionVersion" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "DRHPSectionVersion"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "drhpsectionversion_update" ON "DRHPSectionVersion" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "DRHPSectionVersion"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "drhpsectionversion_insert" ON "DRHPSectionVersion" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "DRHPSectionVersion"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "drhpsectionversion_delete" ON "DRHPSectionVersion" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "DRHPSectionVersion"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ('MERCHANT_BANKER', 'APPLICANT_COMPANY')
  )
);

CREATE POLICY "project_select" ON "Project" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "Project"."id"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )
);

CREATE POLICY "project_owner_update" ON "Project" FOR UPDATE USING (
  "ownerId" = auth.uid()::text
);

CREATE POLICY "project_owner_delete" ON "Project" FOR DELETE USING (
  "ownerId" = auth.uid()::text
);

-- Notification Policies
CREATE POLICY "notification_select" ON "Notification" FOR SELECT USING (
  "userId" = auth.uid()::text
);

CREATE POLICY "notification_update" ON "Notification" FOR UPDATE USING (
  "userId" = auth.uid()::text
);

CREATE POLICY "notification_insert" ON "Notification" FOR INSERT WITH CHECK (
  "userId" = auth.uid()::text
);

CREATE POLICY "notification_delete" ON "Notification" FOR DELETE USING (
  "userId" = auth.uid()::text
);

-- ProjectMember Policies
CREATE POLICY "project_member_select" ON "ProjectMember" FOR SELECT USING (
  "userId" = auth.uid()::text OR
  EXISTS (
    SELECT 1 FROM "ProjectMember" my_pm
    WHERE my_pm."projectId" = "ProjectMember"."projectId"
      AND my_pm."userId" = auth.uid()::text
  )
);

CREATE POLICY "project_member_update" ON "ProjectMember" FOR UPDATE USING (
  "userId" != auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM "ProjectMember" my_pm
    WHERE my_pm."projectId" = "ProjectMember"."projectId"
      AND my_pm."userId" = auth.uid()::text
      AND my_pm."status" = 'ACTIVE'
      AND my_pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "project_member_insert" ON "ProjectMember" FOR INSERT WITH CHECK (
  "userId" != auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM "ProjectMember" my_pm
    WHERE my_pm."projectId" = "ProjectMember"."projectId"
      AND my_pm."userId" = auth.uid()::text
      AND my_pm."status" = 'ACTIVE'
      AND my_pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

CREATE POLICY "project_member_delete" ON "ProjectMember" FOR DELETE USING (
  "userId" != auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM "ProjectMember" my_pm
    WHERE my_pm."projectId" = "ProjectMember"."projectId"
      AND my_pm."userId" = auth.uid()::text
      AND my_pm."status" = 'ACTIVE'
      AND my_pm."role" IN ('APPLICANT_COMPANY', 'MERCHANT_BANKER')
  )
);

-- User Policies
CREATE POLICY "user_select" ON "User" FOR SELECT USING (true);

CREATE POLICY "user_update" ON "User" FOR UPDATE USING (
  "id" = auth.uid()::text
);

CREATE POLICY "user_delete" ON "User" FOR DELETE USING (
  "id" = auth.uid()::text
);

