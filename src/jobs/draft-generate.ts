import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest";
import { generateDraft } from "@/modules/drafting";
import { prisma } from "@/db";

export const draftGenerateJob = inngest.createFunction(
  { id: "draft-generate", triggers: [{ event: "draft.generate.requested" }] },
  async ({ event, step }) => {
    const { prompt, sectionId } = event.data;

    const section = await step.run("fetch-section", async () => {
      return prisma.dRHPSection.findUnique({ where: { id: sectionId } });
    });

    if (!section) {
      throw new NonRetriableError("Section not found");
    }

    // Step 1: Call drafting module
    let draftResult;
    try {
      draftResult = await step.run("call-claude", async () => {
        return generateDraft(prompt, section.category, section.projectId);
      });
    } catch (error: any) {
      if (error.message === "UNGROUNDED_DRAFT") {
        await step.run("route-to-interview", async () => {
          await prisma.gapFlag.create({
            data: {
              projectId: section.projectId,
              sectionKey: section.sectionKey,
              sectionId: section.id,
              missingItem: `Missing facts for draft prompt: "${prompt}"`,
              title: "Drafting Facts Missing",
              description: "The AI drafting assistant did not have enough verified facts to complete this section.",
            }
          });
        });
        throw new NonRetriableError("Drafting rejected: Ungrounded draft routed to AI Interview queue.");
      }
      throw error;
    }

    // Returning it to be handled by the caller or a subsequent workflow
    return draftResult;
  }
);
