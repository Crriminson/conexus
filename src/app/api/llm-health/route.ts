import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/llmClient';

export async function GET() {
  const result = await healthCheck();

  const allOk = result.gemini.ok && result.groq.ok;

  return NextResponse.json(result, { status: allOk ? 200 : 503 });
}
