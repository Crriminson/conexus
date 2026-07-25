import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { canEdit } from "@/rbac";
import { SectionCategory } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAuth(projectId);

    const sections = await prisma.dRHPSection.findMany({
      where: { projectId },
      orderBy: { sectionOrder: "asc" },
    });

    return NextResponse.json({ sections }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching sections:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { projectId, title, sectionOrder, sectionKey, category, content } = data;

    if (!projectId || !category) {
      return NextResponse.json({ error: "projectId and category are required" }, { status: 400 });
    }

    const { membership } = await requireProjectAuth(projectId);

    if (!canEdit(membership.role, category as SectionCategory)) {
      return NextResponse.json(
        { error: `Forbidden: Your role (${membership.role}) cannot edit the ${category} category.` },
        { status: 403 }
      );
    }

    const section = await prisma.dRHPSection.create({
      data: {
        projectId,
        title: title || "",
        sectionOrder: sectionOrder || 0,
        sectionKey: sectionKey || "",
        category,
        content: content || "",
      },
    });

    return NextResponse.json({ section }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating section:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
