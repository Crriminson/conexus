import { SectionCategory } from "@prisma/client";
import { prisma } from "@/db";
import { generateEmbedding, generate } from "@/lib/llmClient";

const VALIDATION_CONFIDENCE_THRESHOLD = 0.65; // lowered slightly for better matching with 3072 dims

export async function runValidationEngine(sectionContent: string, category: SectionCategory) {
  if (!sectionContent || sectionContent.trim().length === 0) {
    return {
      source: "VALIDATION_ENGINE" as const,
      status: "FLAGGED_FOR_REVIEW" as const,
      confidenceScore: 0,
      message: "Section content is empty.",
      explanation: "Cannot validate an empty section.",
      matchedRegulation: null
    };
  }

  // Generate embedding for the section content using Gemini
  const embedding = await generateEmbedding(sectionContent);
  const formattedEmbedding = `[${embedding.join(",")}]`;

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
    // We use an LLM here to decide pass/fail based on the matching chunk.
    const prompt = `You are a strict compliance validation engine for IPO documents.
Evaluate whether the user's section content complies with the specified regulation.
Regulation: ${chunk.title} (${matchedRegulation})
Regulation Text: ${chunk.content}

Section Content:
${sectionContent}

Does the section content satisfy the regulation? If it satisfies the core requirement, output PASS. If it is missing key information, contradicts the regulation, or fails to address the regulation, output FLAGGED_FOR_REVIEW. 
Then, on the second line, provide a short 1-sentence explanation of why.

Output format:
STATUS
EXPLANATION`;

    let status = "FLAGGED_FOR_REVIEW";
    let explanation = "Failed to evaluate via LLM.";

    try {
      const llmResponse = await generate(prompt, { temperature: 0.1 });
      const lines = llmResponse.text.split("\n").filter((l: string) => l.trim() !== "");
      const statusText = lines[0]?.trim().toUpperCase() || "FLAGGED_FOR_REVIEW";
      explanation = lines.slice(1).join(" ").trim() || "No explanation provided by LLM.";
      status = statusText.includes("PASS") ? "PASS" : "FLAGGED_FOR_REVIEW";
    } catch (e: any) {
      console.error("LLM Validation Error:", e);
    }

    return {
      source: "VALIDATION_ENGINE" as const,
      status: status as any,
      confidenceScore: similarity,
      message: status === "PASS" ? `Section complies with ${matchedRegulation}.` : `Section may violate ${matchedRegulation}.`,
      explanation,
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
