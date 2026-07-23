import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { requireProjectAuth } from '@/utils/supabase/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const factCheck = await prisma.knowledgeBaseFact.findUnique({ where: { id }, select: { projectId: true } });
    if (!factCheck) return NextResponse.json({ error: 'Fact not found' }, { status: 404 });
    await requireProjectAuth(factCheck.projectId);

    const json = await request.json();
    const { content } = json;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const fact = await prisma.knowledgeBaseFact.update({
      where: { id },
      data: { content },
    });

    return NextResponse.json({ fact });
  } catch (err: any) {
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const factCheck = await prisma.knowledgeBaseFact.findUnique({ where: { id }, select: { projectId: true } });
    if (!factCheck) return NextResponse.json({ error: 'Fact not found' }, { status: 404 });
    await requireProjectAuth(factCheck.projectId);

    await prisma.knowledgeBaseFact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
