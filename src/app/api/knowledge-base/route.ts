import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { requireProjectAuth } from '@/utils/supabase/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const { user } = await requireProjectAuth(projectId);

    const facts = await prisma.knowledgeBaseEntry.findMany({
      where: { projectId },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ facts });
  } catch (err: any) {
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { projectId, category, content, source } = json;

    if (!projectId || !category || !content) {
      return NextResponse.json({ error: 'projectId, category, and content are required' }, { status: 400 });
    }

    const { user } = await requireProjectAuth(projectId);

    const fact = await prisma.knowledgeBaseEntry.create({
      data: {
        projectId,
        sourceType: source || 'manual',
        fieldKey: category,
        fieldValue: content,
        category,
        content,
      },
    });

    return NextResponse.json({ fact }, { status: 201 });
  } catch (err: any) {
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
