import { inngest } from "@/lib/inngest";
import { prisma } from "@/db";
import { extractOcr } from "@/modules/ocr";
import { notify } from "@/modules/notifications";

export const ocrExtractJob = inngest.createFunction(
  { id: "ocr-extract", triggers: [{ event: "document.uploaded" }] },
  async ({ event, step }) => {
    const { documentId, projectId, uploadedBy } = event.data;

    // Step 1: Update status
    await step.run("update-status-processing", async () => {
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: "processing" },
      });
    });

    // Step 2: Extract details via real OCR provider and insert to KB
    await step.run("ocr-extract", async () => {
      await extractOcr(documentId);
    });

    // Step 3: Notify
    await step.run("send-notification", async () => {
      await notify({
        targetUserId: uploadedBy,
        projectId,
        event: "OCR extraction complete",
        message: "Document processing completed successfully.",
        relatedEntityId: documentId,
      });
    });

    return { documentId, status: "completed" };
  }
);
