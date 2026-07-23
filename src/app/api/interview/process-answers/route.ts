import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { generate } from '@/lib/llmClient';
import { requireAuth } from '@/utils/supabase/auth';
import { getAnswerProcessingPrompt } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { projectId, qnaPairs } = await request.json();

    if (!projectId || !Array.isArray(qnaPairs) || qnaPairs.length === 0) {
      return NextResponse.json({ error: 'projectId and an array of qnaPairs are required' }, { status: 400 });
    }

    // 1. Construct prompt
    const { systemPrompt, userPrompt } = getAnswerProcessingPrompt(qnaPairs);

    // 2. Call LLM
    const result = await generate(userPrompt, {
      systemPrompt,
      temperature: 0.1,
      maxTokens: 2000,
    });

    // 3. Parse response safely
    let extractedFacts: { category: string, content: string }[] = [];
    try {
      const cleanedText = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedFacts = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse LLM response as JSON:", result.text);
      throw new Error("LLM returned an invalid response format.");
    }

    if (!Array.isArray(extractedFacts)) {
      throw new Error("LLM did not return an array of facts.");
    }

    // 4. Bulk insert to Prisma
    const dataToInsert = extractedFacts.map(fact => ({
      projectId,
      category: fact.category,
      content: fact.content,
      source: 'AI Interview (Founder)',
    }));

    if (dataToInsert.length > 0) {
      await prisma.knowledgeBaseFact.createMany({
        data: dataToInsert,
      });
    }

    return NextResponse.json({ message: "Facts successfully extracted and saved", count: dataToInsert.length });
  } catch (err: any) {
    console.error("Process answers error:", err);
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
