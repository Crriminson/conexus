import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { generate } from "@/lib/llmClient";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { getInterviewGenerationPrompt } from "@/lib/prompts";
import { icdrChecklist } from "@/compliance/icdr-checklist";

const HIGH_CONFIDENCE_THRESHOLD = 0.8;
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAuth(projectId);

    // Fetch current facts with high confidence
    const facts = await prisma.knowledgeBaseEntry.findMany({
      where: {
        projectId,
        confidence: { gte: HIGH_CONFIDENCE_THRESHOLD },
      },
      select: { fieldKey: true },
    });

    const coveredKeys = new Set(facts.map(f => f.fieldKey));
    const missingRequirements = icdrChecklist.filter(req => !coveredKeys.has(req.key));

    if (missingRequirements.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const { systemPrompt, userPrompt } = getInterviewGenerationPrompt(missingRequirements as any);

    const result = await generate(userPrompt, {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    let questions: string[] = [];
    try {
      const cleanedText = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse LLM response as JSON:", result.text);
      throw new Error("LLM returned an invalid response format.");
    }

    return NextResponse.json({ questions });
  } catch (err: any) {
    console.error("Generate questions error:", err);
    if (err.message.includes("Forbidden") || err.message === "Unauthorized") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, qnaPairs } = await request.json();

    if (!projectId || !qnaPairs || !Array.isArray(qnaPairs)) {
      return NextResponse.json({ error: "projectId and qnaPairs array are required" }, { status: 400 });
    }

    await requireProjectAuth(projectId);

    // Create entries for all qnaPairs
    const entries = await Promise.all(
      qnaPairs.map(async (pair: any) => {
        return prisma.knowledgeBaseEntry.create({
          data: {
            projectId,
            sourceType: "interview",
            sourceRefId: pair.question,
            fieldKey: "interview_answer",
            fieldValue: pair.answer,
            confidence: 0.9,
          },
        });
      })
    );

    return NextResponse.json({ count: entries.length, entries }, { status: 201 });
  } catch (err: any) {
    console.error("Process answers error:", err);
    if (err.message.includes("Forbidden") || err.message === "Unauthorized") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
