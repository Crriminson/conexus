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
    ]); // Everyone can view

    const eligibility = await prisma.eligibilityAssessment.findUnique({
      where: { projectId },
    });

    return NextResponse.json({ 
      answers: eligibility?.answers ? JSON.parse(eligibility.answers as string) : [] 
    });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/projects/[id]/eligibility error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    // Applicant Company and Merchant Banker can edit
    await requireProjectRole(user.id, projectId, [
      "APPLICANT_COMPANY",
      "MERCHANT_BANKER",
    ]);

    const body = await req.json();
    const { answers } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const eligibility = await prisma.eligibilityAssessment.upsert({
      where: { projectId },
      update: {
        answers: JSON.stringify(answers),
      },
      create: {
        projectId,
        answers: JSON.stringify(answers),
      },
    });

    return NextResponse.json({ success: true, id: eligibility.id });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/projects/[id]/eligibility error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
