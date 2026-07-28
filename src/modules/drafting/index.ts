import { prisma } from "@/db";
import { generate } from "@/lib/llmClient";

export async function generateDraft(prompt: string, sectionCategory: string, projectId: string) {
  // Grounding enforcement: Fetch only KnowledgeBaseEntry rows belonging to this project
  const facts = await prisma.knowledgeBaseEntry.findMany({
    where: { projectId },
    select: { id: true, fieldKey: true, fieldValue: true },
  });

  const systemPrompt = `
You are an expert legal drafter assisting with a Draft Red Herring Prospectus (DRHP).
You must write a clause based ONLY on the provided factual context.
DO NOT invent, assume, or inject outside world knowledge.

Factual Context:
${JSON.stringify(facts, null, 2)}

Respond with a JSON object in the following format:
{
  "drafted_clause": "The text of the clause...",
  "source_refs": ["array", "of", "fact_ids", "used", "in", "the", "clause"]
}
If there are not enough facts to answer the prompt, leave source_refs empty.
`;

  const result = await generate(prompt, {
    systemPrompt,
    temperature: 0.2,
    maxTokens: 1000,
  });

  let parsed: { drafted_clause?: string; source_refs?: string[] } = {};
  try {
    const cleanedText = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanedText);
  } catch (err) {
    throw new Error("Failed to parse drafting model response.");
  }

  if (!parsed.source_refs || parsed.source_refs.length === 0) {
    throw new Error("UNGROUNDED_DRAFT");
  }

  return {
    clause: parsed.drafted_clause,
    source_refs: parsed.source_refs,
  };
}
