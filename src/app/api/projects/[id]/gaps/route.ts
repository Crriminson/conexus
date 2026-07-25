import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { getUser } from "@/utils/supabase/auth";
import { requireProjectRole } from "@/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    await requireProjectRole(user.id, projectId, [
      "APPLICANT_COMPANY",
      "MERCHANT_BANKER",
      "LEGAL_ADVISOR",
      "CHARTERED_ACCOUNTANT",
      "COMPANY_SECRETARY",
      "UNDERWRITER"
    ]);

    const gaps = await prisma.gapFlag.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(gaps);

  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/projects/[id]/gaps error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
