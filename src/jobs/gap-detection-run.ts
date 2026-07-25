import { inngest } from "@/lib/inngest";
import { prisma } from "@/db";
import { runGapDetection } from "@/modules/gap-detection";
import { notify } from "@/modules/notifications";

export const gapDetectionRunJob = inngest.createFunction(
  { id: "gap-detection-run", triggers: [{ event: "section.submitted-for-review" }, { event: "gap-detection.manual-run" }] },
  async ({ event, step }) => {
    const { projectId, sectionId, sectionKey, category } = event.data;

    const sectionContent = await step.run("fetch-section-content", async () => {
      const section = await prisma.dRHPSection.findUnique({ where: { id: sectionId } });
      if (!section) throw new Error("Section not found");
      return section.content;
    });

    // Step 1: Run ICDR checklist
    const flaggedRules = await step.run("evaluate-rules", async () => {
      return runGapDetection(sectionContent, category);
    });

    // Step 2: Write GapFlags
    await step.run("sync-gap-flags", async () => {
      // Clear existing unresolved GapFlag rows for this section
      await prisma.gapFlag.deleteMany({
        where: {
          sectionId,
          resolved: false
        }
      });

      // Write new GapFlag rows
      if (flaggedRules.length > 0) {
        await prisma.gapFlag.createMany({
          data: flaggedRules.map(rule => ({
            projectId,
            sectionId,
            sectionKey,
            missingItem: rule.missingItemDescription,
            status: "open",
            severity: rule.severity,
            title: `Missing: ${rule.missingItemDescription}`,
            description: `Required by ICDR rule ${rule.id}`,
            resolved: false
          }))
        });
      }
    });

    // Step 3: Notification
    if (flaggedRules.length > 0) {
      await step.run("notify-stakeholders", async () => {
        await notify({
          event: "Gap flagged",
          projectId,
          message: `Gap detection identified ${flaggedRules.length} missing items in section ${sectionKey}.`,
          relatedEntityId: sectionId
        });
      });
    }

    return { success: true, flagsFound: flaggedRules.length };
  }
);
