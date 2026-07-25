import { ProjectRole, SectionCategory } from '@prisma/client'
import { CATEGORY_OWNERS, getRolesWithCategoryPermission } from '@/rbac'
import { prisma } from '@/db'

export type NotificationEvent =
  | 'Document uploaded'
  | 'OCR extraction complete'
  | 'Gap flagged'
  | 'Section submitted for review'
  | 'Validation Engine flags a section'
  | 'Section approved'
  | 'Section changes requested'
  | 'Invite sent'
  | 'Invite accepted'
  | 'All required sections approved (export-ready)'
  | 'Export completed'

interface NotifyOptions {
  event: NotificationEvent
  projectId: string
  message: string
  relatedEntityId?: string
  // Dynamic overrides or additions based on context
  targetUserId?: string
  category?: SectionCategory
}

/**
 * Synchronously writes notifications to the DB based on the event mapping.
 */
export async function notify(options: NotifyOptions) {
  const { event, projectId, message, relatedEntityId, targetUserId, category } = options
  let recipientRoles: ProjectRole[] = []

  switch (event) {
    case 'Document uploaded':
    case 'OCR extraction complete':
    case 'Gap flagged':
    case 'Invite accepted':
      recipientRoles = ['APPLICANT_COMPANY', 'MERCHANT_BANKER']
      break

    case 'Section submitted for review':
    case 'Validation Engine flags a section':
      if (category && CATEGORY_OWNERS[category]) {
        recipientRoles = [CATEGORY_OWNERS[category] as ProjectRole]
      }
      break

    case 'Section approved':
      if (category) {
        recipientRoles = [
          ...getRolesWithCategoryPermission(category, 'edit'),
          'MERCHANT_BANKER'
        ]
      }
      break

    case 'Section changes requested':
      if (category) {
        recipientRoles = getRolesWithCategoryPermission(category, 'edit')
      }
      break

    case 'All required sections approved (export-ready)':
      recipientRoles = ['MERCHANT_BANKER']
      break

    case 'Export completed':
      recipientRoles = [
        'APPLICANT_COMPANY',
        'MERCHANT_BANKER',
        'CHARTERED_ACCOUNTANT',
        'COMPANY_SECRETARY',
        'LEGAL_ADVISOR',
        'UNDERWRITER'
      ]
      break

    case 'Invite sent':
      // Handled directly via targetUserId
      break
  }

  // Deduplicate roles just in case
  recipientRoles = Array.from(new Set(recipientRoles))

  // Find users corresponding to these roles in the project
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      status: 'ACTIVE',
      role: { in: recipientRoles }
    },
    select: { userId: true }
  })

  let userIds = members
    .map(m => m.userId)
    .filter((id): id is string => id !== null)

  // If a specific target user is provided (e.g. Invitee for "Invite sent")
  if (targetUserId) {
    userIds.push(targetUserId)
  }

  // Deduplicate user IDs
  userIds = Array.from(new Set(userIds))

  if (userIds.length === 0) return

  // Write notification rows synchronously
  await prisma.notification.createMany({
    data: userIds.map(userId => ({
      userId,
      projectId,
      type: event,
      message,
      relatedEntityId
    }))
  })
}
