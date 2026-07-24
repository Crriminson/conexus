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
ALTER TABLE "ValidationResult" DROP CONSTRAINT "validation_results_projectId_fkey";

-- DropForeignKey
ALTER TABLE "review_comments" DROP CONSTRAINT "review_comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "review_comments" DROP CONSTRAINT "review_comments_projectId_fkey";

-- DropIndex
DROP INDEX "project_members_userId_projectId_key";

-- AlterTable
ALTER TABLE "DRHPSection" ADD COLUMN     "assignedReviewerRole" "ProjectRole",
ADD COLUMN     "category" "SectionCategory" NOT NULL,
ADD COLUMN     "sectionKey" TEXT NOT NULL,
ADD COLUMN     "status" "SectionStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "DRHPSection" RENAME CONSTRAINT "drhp_sections_pkey" TO "DRHPSection_pkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "fileType" TEXT NOT NULL,
ADD COLUMN     "ocrExtracted" JSONB,
ADD COLUMN     "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "uploadedById" TEXT NOT NULL;
ALTER TABLE "Document" RENAME CONSTRAINT "documents_pkey" TO "Document_pkey";

-- AlterTable
ALTER TABLE "ExportArtifact" RENAME CONSTRAINT "export_artifacts_pkey" TO "ExportArtifact_pkey";

-- AlterTable
ALTER TABLE "GapFlag" ADD COLUMN     "missingItem" TEXT NOT NULL,
ADD COLUMN     "sectionKey" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'open',
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "GapFlag" RENAME CONSTRAINT "gap_flags_pkey" TO "GapFlag_pkey";

-- AlterTable
ALTER TABLE "KnowledgeBaseEntry" DROP COLUMN "source",
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "fieldKey" TEXT NOT NULL,
ADD COLUMN     "fieldValue" TEXT NOT NULL,
ADD COLUMN     "sourceRefId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "KnowledgeBaseEntry" RENAME CONSTRAINT "knowledge_base_facts_pkey" TO "KnowledgeBaseEntry_pkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Project" RENAME CONSTRAINT "projects_pkey" TO "Project_pkey";

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'INVITED',
ALTER COLUMN "joinedAt" DROP NOT NULL,
ALTER COLUMN "joinedAt" DROP DEFAULT;
ALTER TABLE "ProjectMember" RENAME CONSTRAINT "project_members_pkey" TO "ProjectMember_pkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME CONSTRAINT "users_pkey" TO "User_pkey";

-- AlterTable
ALTER TABLE "ValidationResult" DROP COLUMN "projectId",
ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "matchedRegulation" TEXT,
ADD COLUMN     "source" "ValidationSource" NOT NULL,
ADD COLUMN     "status" "ValidationStatus" NOT NULL,
ALTER COLUMN "rule" DROP NOT NULL,
ALTER COLUMN "passed" DROP NOT NULL;
ALTER TABLE "ValidationResult" RENAME CONSTRAINT "validation_results_pkey" TO "ValidationResult_pkey";

-- DropTable
DROP TABLE "review_comments";

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

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_projectId_key" ON "CompanyProfile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DRHPSection_projectId_sectionKey_key" ON "DRHPSection"("projectId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_role_key" ON "ProjectMember"("projectId", "userId", "role");

-- RenameForeignKey
ALTER TABLE "DRHPSection" RENAME CONSTRAINT "drhp_sections_projectId_fkey" TO "DRHPSection_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "Document" RENAME CONSTRAINT "documents_projectId_fkey" TO "Document_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "ExportArtifact" RENAME CONSTRAINT "export_artifacts_projectId_fkey" TO "ExportArtifact_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "GapFlag" RENAME CONSTRAINT "gap_flags_projectId_fkey" TO "GapFlag_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "GapFlag" RENAME CONSTRAINT "gap_flags_sectionId_fkey" TO "GapFlag_sectionId_fkey";

-- RenameForeignKey
ALTER TABLE "KnowledgeBaseEntry" RENAME CONSTRAINT "knowledge_base_facts_projectId_fkey" TO "KnowledgeBaseEntry_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "ProjectMember" RENAME CONSTRAINT "project_members_projectId_fkey" TO "ProjectMember_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "ProjectMember" RENAME CONSTRAINT "project_members_userId_fkey" TO "ProjectMember_userId_fkey";

-- RenameForeignKey
ALTER TABLE "ValidationResult" RENAME CONSTRAINT "validation_results_sectionId_fkey" TO "ValidationResult_sectionId_fkey";

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRHPSectionVersion" ADD CONSTRAINT "DRHPSectionVersion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DRHPSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "users_email_key" RENAME TO "User_email_key";

