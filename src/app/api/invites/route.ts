import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { PERMISSION_MATRIX } from "@/rbac";
import { ProjectRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { projectId, email, role } = await request.json();

    if (!projectId || !email || !role) {
      return NextResponse.json({ error: "projectId, email, and role are required" }, { status: 400 });
    }

    const { user, membership } = await requireProjectAuth(projectId);

    // Check RBAC: canInvite
    if (!PERMISSION_MATRIX[membership.role].global.canInvite) {
      return NextResponse.json(
        { error: `Forbidden: Your role (${membership.role}) cannot invite users.` },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const newMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId: existingUser ? existingUser.id : null,
        inviteEmail: email,
        role: role as ProjectRole,
        status: "INVITED",
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId,
        actorId: user.id,
        action: "INVITE_MEMBER",
        entityType: "ProjectMember",
        entityId: newMember.id,
        details: { email, role },
      },
    });

    await prisma.pendingInvite.create({
      data: {
        projectId,
        email,
        role: role as ProjectRole,
        status: "QUEUED",
      },
    });

    return NextResponse.json({ message: "Invite queued successfully", member: newMember }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating invite:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
