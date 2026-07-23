import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { requireAuth } from '@/utils/supabase/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const facts = await prisma.knowledgeBaseFact.findMany({
      where: { projectId },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ facts });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const json = await request.json();
    const { projectId, category, content, source } = json;

    if (!projectId || !category || !content) {
      return NextResponse.json({ error: 'projectId, category, and content are required' }, { status: 400 });
    }

    const fact = await prisma.knowledgeBaseFact.create({
      data: {
        projectId,
        category,
        content,
        source: source || null,
      },
    });

    return NextResponse.json({ fact }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
