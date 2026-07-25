import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { PERMISSION_MATRIX } from "@/rbac";
import { inngest } from "@/lib/inngest";

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { user, membership } = await requireProjectAuth(projectId);

    if (!PERMISSION_MATRIX[membership.role].global.canExport) {
      return NextResponse.json(
        { error: `Forbidden: Your role (${membership.role}) cannot export DRHPs.` },
        { status: 403 }
      );
    }

    // Validate all sections are APPROVED
    const unapprovedSections = await prisma.dRHPSection.findMany({
      where: {
        projectId,
        status: { not: "APPROVED" },
      },
    });

    if (unapprovedSections.length > 0) {
      return NextResponse.json(
        { error: `Cannot export DRHP. There are ${unapprovedSections.length} unapproved section(s).` },
        { status: 400 }
      );
    }

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        projectId,
        userId: user.id,
        action: "EXPORT_DRHP",
        entityType: "Project",
        entityId: projectId,
        details: { requestedFormat: "PDF" }, // Assuming PDF for now
      },
    });

    // Emits export.requested Inngest event
    await inngest.send({
      name: "export.requested",
      data: { projectId, requestedBy: user.id },
    });

    return NextResponse.json({ message: "Export requested successfully" }, { status: 202 });
  } catch (error: any) {
    console.error("Error requesting export:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
