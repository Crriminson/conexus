import { prisma } from "@/db";
import { generateEmbedding } from "@/lib/llmClient";

export async function seedIcdrCorpus() {
  const regulations = [
    {
      regulationNumber: "Reg 7",
      subClause: "1(a)",
      title: "Eligibility for Initial Public Offer",
      content: "An issuer shall be eligible to make an initial public offer only if it has net tangible assets of at least three crore rupees in each of the preceding three full years (of twelve months each).",
    },
    {
      regulationNumber: "Reg 7",
      subClause: "1(b)",
      title: "Eligibility for Initial Public Offer - Operating Profit",
      content: "An issuer shall be eligible to make an initial public offer only if it has an average operating profit of at least fifteen crore rupees, calculated on a restated and consolidated basis, during the preceding three years (of twelve months each).",
    },
    {
      regulationNumber: "Reg 7",
      subClause: "1(c)",
      title: "Eligibility for Initial Public Offer - Net Worth",
      content: "An issuer shall be eligible to make an initial public offer only if it has a net worth of at least one crore rupees in each of the preceding three full years (of twelve months each).",
    },
  ];

  // Clear existing to avoid duplicates when reseeding
  await prisma.$executeRaw`ALTER TABLE "ICDRCorpus" ALTER COLUMN embedding TYPE vector(3072);`;
  await prisma.$executeRaw`TRUNCATE TABLE "ICDRCorpus" RESTART IDENTITY;`;

  for (const reg of regulations) {
    console.log(`Generating embedding for ${reg.regulationNumber} ${reg.subClause || ""}...`);
    const embedding = await generateEmbedding(reg.content);
    const formattedEmbedding = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO "ICDRCorpus" ("id", "regulationNumber", "subClause", "title", "content", "embedding")
      VALUES (gen_random_uuid(), ${reg.regulationNumber}, ${reg.subClause}, ${reg.title}, ${reg.content}, ${formattedEmbedding}::vector)
    `;
  }

  console.log("Seeded ICDR corpus with mock vectors.");
}
