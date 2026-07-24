import fs from 'fs';
import path from 'path';
import { ProjectRole, SectionCategory } from '@prisma/client';
import { PERMISSION_MATRIX } from '../src/rbac/index.js';

const OUTPUT_DIR = path.join(process.cwd(), 'prisma', 'migrations');
const MIGRATION_NAME = '20260724_rls_policies';

// Helper to get roles that have a specific permission for a category
function getRolesWithCategoryPermission(category: SectionCategory, permission: 'view' | 'edit' | 'approve'): ProjectRole[] {
  return (Object.keys(PERMISSION_MATRIX) as ProjectRole[]).filter((role) => {
    return PERMISSION_MATRIX[role].categories[category][permission];
  });
}

function getRolesWithGlobalPermission(permission: 'canInvite' | 'canExport'): ProjectRole[] {
  return (Object.keys(PERMISSION_MATRIX) as ProjectRole[]).filter((role) => {
    return PERMISSION_MATRIX[role].global[permission];
  });
}

function generateInClause(roles: ProjectRole[]): string {
  if (roles.length === 0) return `('NONE')`;
  return '(' + roles.map(r => `'${r}'`).join(', ') + ')';
}

function main() {
  let sql = `-- Migration: Enable RLS and setup policies based on RBAC matrix\n\n`;

  // 1. Enable RLS on all project tables
  const tables = [
    'User',
    'Project',
    'ProjectMember',
    'CompanyProfile',
    'Document',
    'KnowledgeBaseEntry',
    'DRHPSection',
    'DRHPSectionVersion',
    'ValidationResult',
    'GapFlag',
    'Notification',
    'AuditLog',
    'ExportArtifact'
  ];

  sql += `-- Enable RLS\n`;
  for (const table of tables) {
    sql += `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;\n`;
  }
  sql += `\n`;

  const categories = Object.values(SectionCategory);
  
  // 2. DRHPSection Policies (per category)
  sql += `-- DRHPSection Policies\n`;
  for (const category of categories) {
    const viewRoles = getRolesWithCategoryPermission(category, 'view');
    const editRoles = getRolesWithCategoryPermission(category, 'edit');
    // Note: Approve is a business logic state change, but database-wise, it's an update.
    // So anyone who can edit OR approve can UPDATE the row.
    const approveRoles = getRolesWithCategoryPermission(category, 'approve');
    const writeRoles = Array.from(new Set([...editRoles, ...approveRoles]));

    const lowerCat = category.toLowerCase();

    // SELECT
    sql += `CREATE POLICY "${lowerCat}_section_select" ON "DRHPSection" FOR SELECT USING (
  category = '${category}'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ${generateInClause(viewRoles)}
  )
);\n\n`;

    // UPDATE / INSERT / DELETE
    ['UPDATE', 'INSERT', 'DELETE'].forEach(action => {
      const conditionKeyword = action === 'INSERT' ? 'WITH CHECK' : 'USING';
      sql += `CREATE POLICY "${lowerCat}_section_${action.toLowerCase()}" ON "DRHPSection" FOR ${action} ${conditionKeyword} (
  category = '${category}'
  AND EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "DRHPSection"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ${generateInClause(writeRoles)}
  )
);\n\n`;
    });
  }

  // 3. CompanyProfile Policies (Maps to COMPANY_PROFILE category)
  sql += `-- CompanyProfile Policies\n`;
  const cpViewRoles = getRolesWithCategoryPermission('COMPANY_PROFILE', 'view');
  const cpEditRoles = getRolesWithCategoryPermission('COMPANY_PROFILE', 'edit');

  sql += `CREATE POLICY "company_profile_select" ON "CompanyProfile" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "CompanyProfile"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ${generateInClause(cpViewRoles)}
  )
);\n\n`;

  ['UPDATE', 'INSERT', 'DELETE'].forEach(action => {
    const conditionKeyword = action === 'INSERT' ? 'WITH CHECK' : 'USING';
    sql += `CREATE POLICY "company_profile_${action.toLowerCase()}" ON "CompanyProfile" FOR ${action} ${conditionKeyword} (
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "CompanyProfile"."projectId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ${generateInClause(cpEditRoles)}
  )
);\n\n`;
  });

  // 4. Project-Scoped Tables (Document, KnowledgeBaseEntry, GapFlag, ValidationResult, AuditLog, ExportArtifact, DRHPSectionVersion)
  sql += `-- Project-Scoped Tables (Read for all ACTIVE members)\n`;
  const projectScopedTables = [
    'Document',
    'KnowledgeBaseEntry',
    'GapFlag',
    'ValidationResult',
    'AuditLog',
    'ExportArtifact',
    'DRHPSectionVersion',
    'Project'
  ];

  for (const table of projectScopedTables) {
    const idField = table === 'Project' ? 'id' : 'projectId';
    
    // For AuditLog, GapFlag, ValidationResult where projectId might be optional or different, we must check schema.
    // GapFlag has projectId. ValidationResult does NOT have projectId directly, it has sectionId.
    // Let's refine for ValidationResult and others that map differently.
    
    let selectUsing = `
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "${table}"."${idField}"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )`;

    if (table === 'ValidationResult') {
      selectUsing = `
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "ValidationResult"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )`;
    }
    
    if (table === 'DRHPSectionVersion') {
      selectUsing = `
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "DRHPSectionVersion"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
  )`;
    }

    sql += `CREATE POLICY "${table.toLowerCase()}_select" ON "${table}" FOR SELECT USING (${selectUsing}\n);\n\n`;

    // Writes for project-scoped tables:
    let writeRoles = "('MERCHANT_BANKER', 'APPLICANT_COMPANY')"; // Default fallback
    if (table === 'Document' || table === 'KnowledgeBaseEntry') {
      // Allow general project item writes
    } else if (table === 'ExportArtifact') {
      const exportRoles = getRolesWithGlobalPermission('canExport');
      writeRoles = generateInClause(exportRoles);
    } else if (table === 'AuditLog') {
      writeRoles = "('NONE')"; // AuditLog shouldn't be edited/deleted directly from client
    }
    
    let writeUsing = `
  EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."projectId" = "${table}"."${idField}"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ${writeRoles}
  )`;

    if (table === 'ValidationResult' || table === 'DRHPSectionVersion') {
       writeUsing = `
  EXISTS (
    SELECT 1 FROM "DRHPSection" s
    JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
    WHERE s."id" = "${table}"."sectionId"
      AND pm."userId" = auth.uid()::text
      AND pm."status" = 'ACTIVE'
      AND pm."role" IN ${writeRoles}
  )`;
    }
    
    // For AuditLog, we only allow INSERT by active members
    if (table === 'AuditLog') {
      sql += `CREATE POLICY "${table.toLowerCase()}_insert" ON "${table}" FOR INSERT WITH CHECK (${selectUsing}\n);\n\n`;
    } else if (table !== 'Project') {
      ['UPDATE', 'INSERT', 'DELETE'].forEach(action => {
        const conditionKeyword = action === 'INSERT' ? 'WITH CHECK' : 'USING';
        sql += `CREATE POLICY "${table.toLowerCase()}_${action.toLowerCase()}" ON "${table}" FOR ${action} ${conditionKeyword} (${writeUsing}\n);\n\n`;
      });
    }
  }

  // Project Owner overrides
  sql += `CREATE POLICY "project_owner_update" ON "Project" FOR UPDATE USING (
  "ownerId" = auth.uid()::text
);\n\n`;

  sql += `CREATE POLICY "project_owner_delete" ON "Project" FOR DELETE USING (
  "ownerId" = auth.uid()::text
);\n\n`;

  // 5. Notification (user scoped)
  sql += `-- Notification Policies\n`;
  sql += `CREATE POLICY "notification_select" ON "Notification" FOR SELECT USING (
  "userId" = auth.uid()::text
);\n\n`;
  ['UPDATE', 'INSERT', 'DELETE'].forEach(action => {
    const conditionKeyword = action === 'INSERT' ? 'WITH CHECK' : 'USING';
    sql += `CREATE POLICY "notification_${action.toLowerCase()}" ON "Notification" FOR ${action} ${conditionKeyword} (
  "userId" = auth.uid()::text
);\n\n`;
  });

  // 6. ProjectMember Policies
  sql += `-- ProjectMember Policies\n`;
  // Read own memberships and memberships of others in projects they belong to
  sql += `CREATE POLICY "project_member_select" ON "ProjectMember" FOR SELECT USING (
  "userId" = auth.uid()::text OR
  EXISTS (
    SELECT 1 FROM "ProjectMember" my_pm
    WHERE my_pm."projectId" = "ProjectMember"."projectId"
      AND my_pm."userId" = auth.uid()::text
  )
);\n\n`;

  // Write: Cannot edit own role. canInvite permissions apply for modifying others.
  const inviteRoles = getRolesWithGlobalPermission('canInvite');
  ['UPDATE', 'INSERT', 'DELETE'].forEach(action => {
    const conditionKeyword = action === 'INSERT' ? 'WITH CHECK' : 'USING';
    sql += `CREATE POLICY "project_member_${action.toLowerCase()}" ON "ProjectMember" FOR ${action} ${conditionKeyword} (
  "userId" != auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM "ProjectMember" my_pm
    WHERE my_pm."projectId" = "ProjectMember"."projectId"
      AND my_pm."userId" = auth.uid()::text
      AND my_pm."status" = 'ACTIVE'
      AND my_pm."role" IN ${generateInClause(inviteRoles)}
  )
);\n\n`;
  });

  // User table
  sql += `-- User Policies\n`;
  sql += `CREATE POLICY "user_select" ON "User" FOR SELECT USING (true);\n\n`;
  ['UPDATE', 'DELETE'].forEach(action => {
    sql += `CREATE POLICY "user_${action.toLowerCase()}" ON "User" FOR ${action} USING (
  "id" = auth.uid()::text
);\n\n`;
  });

  const dirPath = path.join(OUTPUT_DIR, MIGRATION_NAME);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'migration.sql'), sql);
  
  console.log(`Successfully generated RLS policies to prisma/migrations/${MIGRATION_NAME}/migration.sql`);
}

main();
