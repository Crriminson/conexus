import { inngest } from "@/lib/inngest";
import { generateExport } from "@/modules/export";
import { notify } from "@/modules/notifications";

export const exportGenerateJob = inngest.createFunction(
  { id: "export-generate", triggers: [{ event: "export.generate.requested" }] },
  async ({ event, step }) => {
    const { projectId, userId } = event.data;

    // Step 1: Generate Export
    const exportResult = await step.run("generate-pdf-docx", async () => {
      return generateExport(projectId);
    });

    // Step 2: Fire export.completed event
    await step.sendEvent("emit-export-completed", {
      name: "export.completed",
      data: {
        projectId,
        exportArtifactId: exportResult.exportArtifactId
      }
    });

    // Step 3: Notification
    await step.run("notify-stakeholders", async () => {
      await notify({
        event: "Export completed",
        projectId,
        message: "A new DRHP export has been generated successfully.",
        targetUserId: userId
      });
    });

    return { success: true, fileUrl: exportResult.fileUrl };
  }
);
