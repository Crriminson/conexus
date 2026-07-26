import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { getUser } from "@/utils/supabase/auth";
import { requireProjectRole } from "@/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gapId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, gapId } = await params;

    // RBAC: Need edit access to something? Gaps are related to sections.
    // We will require Merchant Banker, Legal Advisor, or CS.
    // For now, let's require at least one of these roles.
    await requireProjectRole(user.id, projectId, [
      "MERCHANT_BANKER",
      "LEGAL_ADVISOR",
      "COMPANY_SECRETARY"
    ]);

    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    // Map the status to resolved boolean for GapFlag
    const resolved = status === "resolved";

    const updatedGap = await prisma.gapFlag.update({
      where: { id: gapId, projectId },
      data: {
        status,
        resolved
      }
    });

    return NextResponse.json(updatedGap);

  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/projects/[id]/gaps/[gapId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
