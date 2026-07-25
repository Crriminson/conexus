import { prisma } from '../src/db/index';

async function main() {
  const users = await prisma.user.findMany();

  if (users.length === 0) {
    console.error("No users found in the database. Please sign up first in the UI before running this seed.");
    process.exit(1);
  }

  const userId = users[0].id;
  console.log(`Seeding projects for user: ${users[0].name} (${users[0].email})`);

  const project1 = await prisma.project.create({
    data: {
      name: "TechNova IPO",
      companyName: "TechNova Solutions Ltd",
      description: "Initial Public Offering for TechNova Solutions",
      status: "DRAFT",
      ownerId: userId,
      members: {
        create: { userId, role: "APPLICANT_COMPANY" }
      }
    }
  });

  const project2 = await prisma.project.create({
    data: {
      name: "GreenEnergy Solar IPO",
      companyName: "GreenEnergy Solar Inc",
      description: "Raising capital for solar farm expansion",
      status: "IN_PROGRESS",
      ownerId: userId,
      members: {
        create: { userId, role: "MERCHANT_BANKER" }
      }
    }
  });

  const project3 = await prisma.project.create({
    data: {
      name: "MediCare Pharma IPO",
      companyName: "MediCare Pharmaceuticals",
      description: "Pharma expansion and public listing",
      status: "IN_PROGRESS",
      ownerId: userId,
      members: {
        create: { userId, role: "LEGAL_ADVISOR" }
      }
    }
  });

  console.log("\n✅ Successfully seeded 3 projects!");
  console.log("  - " + project1.name + " (Your role: Applicant Company) — status: DRAFT");
  console.log("  - " + project2.name + " (Your role: Merchant Banker) — status: IN_PROGRESS");
  console.log("  - " + project3.name + " (Your role: Legal Advisor) — status: IN_PROGRESS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
