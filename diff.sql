-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY', 'LEGAL_ADVISOR', 'UNDERWRITER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "SectionCategory" AS ENUM ('COMPANY_PROFILE', 'FINANCIAL', 'LEGAL_RISK', 'SECRETARIAL_COMPLIANCE', 'BUSINESS_OFFER');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('DRAFT', 'SUBMITTED_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ValidationSource" AS ENUM ('GAP_DETECTION', 'VALIDATION_ENGINE');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PASS', 'FAIL', 'FLAGGED_FOR_REVIEW');

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_projectId_fkey";

-- DropForeignKey
ALTER TABLE "drhp_sections" DROP CONSTRAINT "drhp_sections_projectId_fkey";

-- DropForeignKey
ALTER TABLE "export_artifacts" DROP CONSTRAINT "export_artifacts_projectId_fkey";

-- DropForeignKey
ALTER TABLE "gap_flags" DROP CONSTRAINT "gap_flags_projectId_fkey";

-- DropForeignKey
ALTER TABLE "gap_flags" DROP CONSTRAINT "gap_flags_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_base_facts" DROP CONSTRAINT "knowledge_base_facts_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "review_comments" DROP CONSTRAINT "review_comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "review_comments" DROP CONSTRAINT "review_comments_projectId_fkey";

-- DropForeignKey
ALTER TABLE "validation_results" DROP CONSTRAINT "validation_results_projectId_fkey";

-- DropForeignKey
ALTER TABLE "validation_results" DROP CONSTRAINT "validation_results_sectionId_fkey";

-- DropTable
DROP TABLE "documents";

-- DropTable
DROP TABLE "drhp_sections";

-- DropTable
DROP TABLE "export_artifacts";

-- DropTable
DROP TABLE "gap_flags";

-- DropTable
DROP TABLE "knowledge_base_facts";

-- DropTable
DROP TABLE "project_members";

-- DropTable
DROP TABLE "projects";

-- DropTable
DROP TABLE "review_comments";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "validation_results";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "incorporationDate" TIMESTAMP(3) NOT NULL,
    "registeredOffice" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "promoters" JSONB NOT NULL,
    "capitalStructure" JSONB NOT NULL,
    "pan" TEXT NOT NULL,
    "gstin" TEXT,
    "fiscalYearEnd" TEXT NOT NULL,
    "website" TEXT,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "category" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'Draft',
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "ocrExtracted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "category" TEXT,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DRHPSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "category" "SectionCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SectionStatus" NOT NULL DEFAULT 'DRAFT',
    "assignedReviewerRole" "ProjectRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DRHPSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DRHPSectionVersion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SectionStatus" NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewRound" INTEGER NOT NULL,
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DRHPSectionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT,
    "source" "ValidationSource" NOT NULL,
    "status" "ValidationStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "matchedRegulation" TEXT,
    "explanation" TEXT,
    "rule" TEXT,
    "passed" BOOLEAN,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapFlag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "missingItem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT,
    "description" TEXT,
    "severity" "GapSeverity" NOT NULL DEFAULT 'Medium',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sectionId" TEXT,

    CONSTRAINT "GapFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedEntityId" TEXT,
    "readStatus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainRecord" (
    "id" TEXT NOT NULL,
    "sectionVersionId" TEXT,
    "documentHash" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportArtifact" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_role_key" ON "ProjectMember"("projectId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_projectId_key" ON "CompanyProfile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DRHPSection_projectId_sectionKey_key" ON "DRHPSection"("projectId", "sectionKey");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseEntry" ADD CONSTRAINT "KnowledgeBaseEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRHPSection" ADD CONSTRAINT "DRHPSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRHPSectionVersion" ADD CONSTRAINT "DRHPSectionVersion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DRHPSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DRHPSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapFlag" ADD CONSTRAINT "GapFlag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapFlag" ADD CONSTRAINT "GapFlag_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DRHPSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
