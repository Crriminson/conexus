import { ProjectRole, SectionCategory, ProjectMember } from '@prisma/client';
import { requireProjectAuth } from '@/utils/supabase/auth';

export type CategoryPermissions = {
  view: boolean;
  edit: boolean;
  approve: boolean;
};

export type GlobalPermissions = {
  canInvite: boolean;
  canExport: boolean;
};

export type RolePermissions = {
  global: GlobalPermissions;
  categories: Record<SectionCategory, CategoryPermissions>;
};

export const PERMISSION_MATRIX: Record<ProjectRole, RolePermissions> = {
  APPLICANT_COMPANY: {
    global: { canInvite: true, canExport: false },
    categories: {
      COMPANY_PROFILE: { view: true, edit: true, approve: false },
      FINANCIAL: { view: true, edit: false, approve: false },
      LEGAL_RISK: { view: true, edit: false, approve: false },
      SECRETARIAL_COMPLIANCE: { view: true, edit: false, approve: false },
      BUSINESS_OFFER: { view: true, edit: true, approve: false },
    },
  },
  MERCHANT_BANKER: {
    global: { canInvite: true, canExport: true },
    categories: {
      COMPANY_PROFILE: { view: true, edit: true, approve: false },
      FINANCIAL: { view: true, edit: true, approve: false },
      LEGAL_RISK: { view: true, edit: true, approve: false },
      SECRETARIAL_COMPLIANCE: { view: true, edit: true, approve: false },
      BUSINESS_OFFER: { view: true, edit: true, approve: true },
    },
  },
  CHARTERED_ACCOUNTANT: {
    global: { canInvite: false, canExport: false },
    categories: {
      COMPANY_PROFILE: { view: true, edit: false, approve: false },
      FINANCIAL: { view: true, edit: true, approve: true },
      LEGAL_RISK: { view: true, edit: false, approve: false },
      SECRETARIAL_COMPLIANCE: { view: true, edit: false, approve: false },
      BUSINESS_OFFER: { view: true, edit: false, approve: false },
    },
  },
  COMPANY_SECRETARY: {
    global: { canInvite: false, canExport: false },
    categories: {
      COMPANY_PROFILE: { view: true, edit: false, approve: false },
      FINANCIAL: { view: true, edit: false, approve: false },
      LEGAL_RISK: { view: true, edit: false, approve: false },
      SECRETARIAL_COMPLIANCE: { view: true, edit: true, approve: true },
      BUSINESS_OFFER: { view: true, edit: false, approve: false },
    },
  },
  LEGAL_ADVISOR: {
    global: { canInvite: false, canExport: false },
    categories: {
      COMPANY_PROFILE: { view: true, edit: false, approve: false },
      FINANCIAL: { view: true, edit: false, approve: false },
      LEGAL_RISK: { view: true, edit: true, approve: true },
      SECRETARIAL_COMPLIANCE: { view: true, edit: false, approve: false },
      BUSINESS_OFFER: { view: true, edit: false, approve: false },
    },
  },
  UNDERWRITER: {
    global: { canInvite: false, canExport: false },
    categories: {
      COMPANY_PROFILE: { view: true, edit: false, approve: false },
      FINANCIAL: { view: true, edit: false, approve: false },
      LEGAL_RISK: { view: true, edit: false, approve: false },
      SECRETARIAL_COMPLIANCE: { view: true, edit: false, approve: false },
      BUSINESS_OFFER: { view: true, edit: true, approve: false },
    },
  },
};

export const CATEGORY_OWNERS: Record<SectionCategory, ProjectRole | null> = {
  COMPANY_PROFILE: null,
  FINANCIAL: 'CHARTERED_ACCOUNTANT',
  LEGAL_RISK: 'LEGAL_ADVISOR',
  SECRETARIAL_COMPLIANCE: 'COMPANY_SECRETARY',
  BUSINESS_OFFER: 'MERCHANT_BANKER',
};

// --- Helper Functions ---

export function canView(role: ProjectRole, category: SectionCategory): boolean {
  return PERMISSION_MATRIX[role].categories[category].view;
}

export function canEdit(role: ProjectRole, category: SectionCategory): boolean {
  return PERMISSION_MATRIX[role].categories[category].edit;
}

export function canApprove(role: ProjectRole, category: SectionCategory): boolean {
  return PERMISSION_MATRIX[role].categories[category].approve;
}

export function canInvite(role: ProjectRole): boolean {
  return PERMISSION_MATRIX[role].global.canInvite;
}

export function canExport(role: ProjectRole): boolean {
  return PERMISSION_MATRIX[role].global.canExport;
}

export function getRolesWithGlobalPermission(permission: keyof GlobalPermissions): ProjectRole[] {
  return (Object.keys(PERMISSION_MATRIX) as ProjectRole[]).filter(role => 
    PERMISSION_MATRIX[role].global[permission]
  );
}

export function getRolesWithCategoryPermission(category: SectionCategory, permission: keyof CategoryPermissions): ProjectRole[] {
  return (Object.keys(PERMISSION_MATRIX) as ProjectRole[]).filter(role => 
    PERMISSION_MATRIX[role].categories[category][permission]
  );
}

export async function requireProjectRole(userId: string, projectId: string, allowedRoles: ProjectRole[]): Promise<ProjectMember> {
  const { membership } = await requireProjectAuth(projectId);
  if (membership.userId !== userId || !allowedRoles.includes(membership.role)) {
    throw new Error('Forbidden');
  }
  return membership;
}
