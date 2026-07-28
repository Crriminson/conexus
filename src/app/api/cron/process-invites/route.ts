import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Use the service role key since we need admin auth to invite users
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    // We throttle to 2 per hour project-wide.
    // For safety, let's just process up to 2 queued items right now.
    // In a real robust system, we would check how many were sent in the last hour.
    
    // Check how many we sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sentCount = await prisma.pendingInvite.count({
      where: {
        status: 'SENT',
        createdAt: { gte: oneHourAgo }
      }
    });

    const availableQuota = 2 - sentCount;

    if (availableQuota <= 0) {
      return NextResponse.json({ success: true, processed: 0, reason: 'Hourly quota reached' });
    }

    const pending = await prisma.pendingInvite.findMany({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take: availableQuota
    });

    let processedCount = 0;

    for (const invite of pending) {
      // Send invite via Supabase Admin API
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(invite.email, {
        data: {
          role: invite.role, // Attach role to user metadata for context
          projectId: invite.projectId
        }
      });

      if (error) {
        console.error(`Failed to invite ${invite.email}:`, error);
        await prisma.pendingInvite.update({
          where: { id: invite.id },
          data: { status: 'FAILED' }
        });
      } else {
        await prisma.pendingInvite.update({
          where: { id: invite.id },
          data: { status: 'SENT' }
        });

        // The user is now created in Supabase Auth.
        // We can update the ProjectMember with the new userId if we want, 
        // but it's usually synced back via webhook.
        // For now, we wait for them to accept.
        processedCount++;
      }
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (err) {
    console.error('Cron Process Invites Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
