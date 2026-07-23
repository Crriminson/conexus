import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { generate } from '@/lib/llmClient';
import { requireProjectAuth } from '@/utils/supabase/auth';
import { getInterviewGenerationPrompt } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    await requireProjectAuth(projectId);

    // 1. Fetch current facts
    const facts = await prisma.knowledgeBaseFact.findMany({
      where: { projectId },
      select: { category: true, content: true }
    });

    // 2. Construct the prompt using our new library
    const { systemPrompt, userPrompt } = getInterviewGenerationPrompt(facts);

    // 3. Call LLM
    const result = await generate(userPrompt, {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    // 4. Parse response safely
    let questions: string[] = [];
    try {
      const cleanedText = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse LLM response as JSON:", result.text);
      throw new Error("LLM returned an invalid response format.");
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("LLM did not return an array of questions.");
    }

    return NextResponse.json({ questions });
  } catch (err: any) {
    console.error("Generate questions error:", err);
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
