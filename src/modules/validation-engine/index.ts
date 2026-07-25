import { SectionCategory } from "@prisma/client";
import { prisma } from "@/db";

const VALIDATION_CONFIDENCE_THRESHOLD = 0.75;

export async function runValidationEngine(sectionContent: string, category: SectionCategory) {
  // Generate embedding for the section content
  // In a real environment, you would call `text-embedding-3-small` here
  const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
  const formattedEmbedding = `[${mockEmbedding.join(",")}]`;

  // Retrieve top 1 chunk from ICDRCorpus using cosine similarity
  // <=> is cosine distance in pgvector
  const nearestChunks = await prisma.$queryRaw<any[]>`
    SELECT id, "regulationNumber", "subClause", title, content, 
           1 - (embedding <=> ${formattedEmbedding}::vector) as similarity
    FROM "ICDRCorpus"
    ORDER BY embedding <=> ${formattedEmbedding}::vector
    LIMIT 1
  `;

  if (nearestChunks.length === 0) {
    return {
      source: "VALIDATION_ENGINE" as const,
      status: "FLAGGED_FOR_REVIEW" as const,
      confidenceScore: 0,
      message: "No related ICDR regulation found for validation.",
      explanation: "Unable to ground this section against the ICDR corpus.",
      matchedRegulation: null
    };
  }

  const chunk = nearestChunks[0];
  const similarity = chunk.similarity;
  
  const matchedRegulation = `${chunk.regulationNumber} ${chunk.subClause || ""}`;

  if (similarity >= VALIDATION_CONFIDENCE_THRESHOLD) {
    // We would typically use an LLM here to decide pass/fail based on the matching chunk.
    // For now we mock the LLM decision to PASS.
    return {
      source: "VALIDATION_ENGINE" as const,
      status: "PASS" as const,
      confidenceScore: similarity,
      message: `Section complies with ${matchedRegulation}.`,
      explanation: `Matched against: ${chunk.title}`,
      matchedRegulation
    };
  } else {
    return {
      source: "VALIDATION_ENGINE" as const,
      status: "FLAGGED_FOR_REVIEW" as const,
      confidenceScore: similarity,
      message: `Low confidence match for ICDR regulations (score: ${similarity.toFixed(2)}).`,
      explanation: "The section does not strongly align with any specific ICDR regulation.",
      matchedRegulation: null
    };
  }
}
