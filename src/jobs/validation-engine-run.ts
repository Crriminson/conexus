import { inngest } from "@/lib/inngest";
import { prisma } from "@/db";
import { runValidationEngine } from "@/modules/validation-engine";
import { notify } from "@/modules/notifications";

export const validationEngineRunJob = inngest.createFunction(
  { id: "validation-engine-run", triggers: [{ event: "section.submitted-for-review" }] },
  async ({ event, step }) => {
    const { projectId, sectionId, category, sectionKey } = event.data;

    const sectionContent = await step.run("fetch-section", async () => {
      const section = await prisma.dRHPSection.findUnique({ where: { id: sectionId } });
      if (!section) throw new Error("Section not found");
      return section.content;
    });

    // Step 1: Run RAG pipeline
    const validationResultData = await step.run("run-validation-engine", async () => {
      return runValidationEngine(sectionContent, category);
    });

    // Step 2: Write ValidationResult
    await step.run("write-validation-result", async () => {
      await prisma.validationResult.create({
        data: {
          sectionId,
          source: validationResultData.source,
          status: validationResultData.status,
          confidenceScore: validationResultData.confidenceScore,
          message: validationResultData.message,
          explanation: validationResultData.explanation
        }
      });
    });

    // Step 3: Notification
    if (validationResultData.status === "FLAGGED_FOR_REVIEW") {
      await step.run("notify-stakeholders", async () => {
        await notify({
          event: "Validation Engine flags a section",
          projectId,
          category,
          message: `Validation Engine flagged section ${sectionKey} for review.`,
          relatedEntityId: sectionId
        });
      });
    }

    return { success: true };
  }
);
