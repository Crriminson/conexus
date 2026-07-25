import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { generate } from "@/lib/llmClient";
import { SectionCategory } from "@prisma/client";
import { canView } from "@/rbac";
import { getCopilotSystemPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { projectId, message } = await request.json();

    if (!projectId || !message) {
      return NextResponse.json({ error: "projectId and message are required" }, { status: 400 });
    }

    const { membership } = await requireProjectAuth(projectId);

    // Fetch context scoped to what the user can view
    const allCategories: SectionCategory[] = [
      "COMPANY_PROFILE",
      "FINANCIAL",
      "LEGAL_RISK",
      "SECRETARIAL_COMPLIANCE",
      "BUSINESS_OFFER",
    ];

    const allowedCategories = allCategories.filter((cat) => canView(membership.role, cat));

    const facts = await prisma.knowledgeBaseEntry.findMany({
      where: {
        projectId,
        category: { in: allowedCategories },
      },
      select: { category: true, fieldKey: true, fieldValue: true, content: true },
    });

    const systemPrompt = getCopilotSystemPrompt(facts as any);

    const result = await generate(message, {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 1500,
      // SECURITY BOUNDARY: No tools are provided to this model.
      // It is structurally impossible for the Copilot to mark a section APPROVED
      // or mutate state, enforcing the TRD rule against AI-driven approvals.
    });

    return NextResponse.json({ reply: result.text }, { status: 200 });
  } catch (error: any) {
    console.error("Copilot error:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
