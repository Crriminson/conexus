import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { canEdit } from "@/rbac";
import { SectionCategory } from "@prisma/client";
import { inngest } from "@/lib/inngest";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sectionId = params.id;
    
    // We just fetch it to see if it exists
    const section = await prisma.dRHPSection.findUnique({
      where: { id: sectionId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
        },
        validationResults: true
      }
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    await requireProjectAuth(section.projectId);

    return NextResponse.json({ section }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching section:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sectionId = params.id;
    const data = await request.json();
    const { action, content } = data;

    const section = await prisma.dRHPSection.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const { user, membership } = await requireProjectAuth(section.projectId);

    if (!canEdit(membership.role, section.category)) {
      return NextResponse.json(
        { error: `Forbidden: Your role (${membership.role}) cannot edit the ${section.category} category.` },
        { status: 403 }
      );
    }

    if (section.status === 'APPROVED') {
      return NextResponse.json(
        { error: `Forbidden: Section is APPROVED and locked. Reopen to edit.` },
        { status: 403 }
      );
    }

    if (action === "submit-for-review") {
      // Legacy path: recommend using /transition endpoint instead
      return NextResponse.json({ error: "Use /api/drhp-sections/[id]/transition for state changes" }, { status: 400 });
    } else {
      // Normal update
      const updatedSection = await prisma.dRHPSection.update({
        where: { id: sectionId },
        data: {
          content: content !== undefined ? content : section.content,
        },
      });

      return NextResponse.json({ section: updatedSection }, { status: 200 });
    }
  } catch (error: any) {
    console.error("Error updating section:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
