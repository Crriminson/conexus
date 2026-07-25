import { prisma } from "@/db";

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

  for (const reg of regulations) {
    // Generate a mock embedding for seeding if an API key isn't provided
    // In a real environment, you would call `text-embedding-3-small` here
    const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
    const formattedEmbedding = `[${mockEmbedding.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO "ICDRCorpus" ("id", "regulationNumber", "subClause", "title", "content", "embedding")
      VALUES (gen_random_uuid(), ${reg.regulationNumber}, ${reg.subClause}, ${reg.title}, ${reg.content}, ${formattedEmbedding}::vector)
    `;
  }

  console.log("Seeded ICDR corpus with mock vectors.");
}
