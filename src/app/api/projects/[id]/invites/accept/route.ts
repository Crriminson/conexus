import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { notify } from '@/modules/notifications';
import { prisma } from '@/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the pending invite for this user
    // They could be invited by email
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        inviteEmail: user.email,
        status: 'INVITED'
      }
    });

    if (!member) {
      return NextResponse.json({ error: 'Invite not found or already accepted' }, { status: 404 });
    }

    // Update member to ACTIVE
    await prisma.projectMember.update({
      where: { id: member.id },
      data: {
        userId: user.id,
        status: 'ACTIVE',
        joinedAt: new Date()
      }
    });

    // We notify Applicant Company & Merchant Banker
    await notify({
      event: 'Invite accepted',
      projectId,
      message: `${user.email} has accepted their invite to join as ${member.role.replace('_', ' ')}.`
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Accept Invite Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
