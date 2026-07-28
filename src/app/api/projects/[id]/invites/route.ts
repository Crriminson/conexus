import { NextRequest, NextResponse } from 'next/server';
import { ProjectRole } from '@prisma/client';
import { createClient } from '@/utils/supabase/server';
import { canInvite } from '@/rbac';
import { notify } from '@/modules/notifications';
import { prisma } from '@/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { email, role } = await request.json() as { email: string; role: ProjectRole };

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller has invite permissions for this project
    const callerMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
        status: 'ACTIVE'
      }
    });

    if (!callerMember || !canInvite(callerMember.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to invite' }, { status: 403 });
    }

    // Prevent duplicate active invites for the exact same role
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        inviteEmail: email,
        role,
        status: 'INVITED'
      }
    });

    if (existingMember) {
      return NextResponse.json({ error: 'User is already invited for this role' }, { status: 400 });
    }

    // Create ProjectMember
    const member = await prisma.projectMember.create({
      data: {
        projectId,
        inviteEmail: email,
        role,
        status: 'INVITED'
      }
    });

    // Add to PendingInvite Queue
    await prisma.pendingInvite.create({
      data: {
        email,
        projectId,
        role,
        status: 'QUEUED'
      }
    });

    // We don't have a userId yet for the invitee, but they get the notification in-app once they log in if we somehow map it later.
    // However, since they don't have a userId yet, we cannot target them in `notify()` with targetUserId right now unless we use the email.
    // The TRD says: Invite sent -> Email + In-app for Invitee. 
    // In-app notification for invitee can only be created upon them joining/accepting, or we query notifications by email? 
    // `Notification` requires `userId`. So we skip the in-app `notify` until they exist.

    return NextResponse.json({ success: true, memberId: member.id });
  } catch (err) {
    console.error('Invite Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
