import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/db';
import { requireProjectAuth } from '@/utils/supabase/auth';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify the caller has access to this project
    await requireProjectAuth(document.projectId);

    // Delete from Supabase Storage if we have a fileUrl
    if (document.fileUrl) {
      try {
        const supabase = await createClient();
        // Extract the storage path from the public URL
        const url = new URL(document.fileUrl);
        const pathParts = url.pathname.split('/object/public/documents/');
        if (pathParts.length === 2) {
          const storagePath = decodeURIComponent(pathParts[1]);
          await supabase.storage.from('documents').remove([storagePath]);
        }
      } catch {
        // Non-fatal: log but don't fail the delete if storage cleanup fails
        console.warn('Could not delete from storage, continuing with DB delete');
      }
    }

    await prisma.document.delete({ where: { id: documentId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
