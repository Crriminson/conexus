import { NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth';
import { prisma } from '@/db';

export async function GET() {
  try {
    const user = await requireAuth();

    // Pull name from metadata — prefer full_name, then name, then email prefix
    const metaName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User';

    // Pull role from metadata — this is set at registration and never changes
    const metaRole = user.user_metadata?.role || 'ApplicantCompany';

    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        // Keep name in sync with Supabase metadata
        name: metaName,
        email: user.email || '',
      },
      create: {
        id: user.id,
        email: user.email || '',
        name: metaName,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...dbUser,
      // Always expose the registration-time global role from Supabase metadata
      role: metaRole,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
