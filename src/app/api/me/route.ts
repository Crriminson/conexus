import { NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth';
import { prisma } from '@/db';

export async function GET() {
  try {
    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) {
      // Fallback if Prisma record doesn't exist but Supabase auth does
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'User',
        role: user.user_metadata?.role || 'ApplicantCompany',
        avatarUrl: null,
      });
    }

    return NextResponse.json(dbUser);
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
