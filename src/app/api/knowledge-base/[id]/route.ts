import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { requireAuth } from '@/utils/supabase/auth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

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
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    await prisma.knowledgeBaseFact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
