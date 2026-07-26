import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireAuth } from "@/utils/supabase/auth";
import { inngest } from "@/lib/inngest";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
    }

    const member = await prisma.projectMember.findUnique({
      where: { id: inviteId },
    });

    if (!member) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (member.status !== "INVITED") {
      return NextResponse.json({ error: "Invite already accepted or invalid" }, { status: 400 });
    }

    // Update to ACTIVE and tie to userId
    const updatedMember = await prisma.projectMember.update({
      where: { id: inviteId },
      data: {
        userId: user.id,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        projectId: member.projectId,
        actorId: user.id,
        action: "ACCEPT_INVITE",
        entityType: "ProjectMember",
        entityId: inviteId,
        details: { from: "INVITED", to: "ACTIVE" },
      },
    });

    // Emit Inngest event
    await inngest.send({
      name: "invite.accepted",
      data: { inviteId, projectId: member.projectId, userId: user.id },
    });

    return NextResponse.json({ message: "Invite accepted successfully", member: updatedMember }, { status: 200 });
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    if (error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
