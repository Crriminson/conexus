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

    const sections = await prisma.dRHPSection.findMany({
      where: { projectId },
    });

    // Compute mock scores based on actual sections
    const sectionScores = sections.map(sec => {
      let score = 0;
      switch (sec.status) {
        case "APPROVED": score = 100; break;
        case "SUBMITTED_FOR_REVIEW": score = 80; break;
        case "CHANGES_REQUESTED": score = 50; break;
        case "DRAFT": score = 20; break;
      }
      return {
        section: sec.title,
        score,
        maxScore: 100,
        status: sec.status
      };
    });

    const totalScore = sectionScores.reduce((acc, s) => acc + s.score, 0);
    const overallScore = sectionScores.length > 0 ? Math.round(totalScore / sectionScores.length) : 0;

    return NextResponse.json({
      projectId,
      overallScore,
      sectionScores
    });

  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/projects/[id]/readiness error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
