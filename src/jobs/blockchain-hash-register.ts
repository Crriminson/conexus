import { inngest } from "@/lib/inngest";
import { registerDocumentHash } from "@/modules/blockchain";

export const blockchainHashRegisterJob = inngest.createFunction(
  { id: "blockchain-hash-register", triggers: [{ event: "export.completed" }] },
  async ({ event, step }) => {
    const { projectId, exportArtifactId } = event.data;

    const result = await step.run("register-hash", async () => {
      return registerDocumentHash(projectId, exportArtifactId);
    });

    // In a real app we'd save this txHash to BlockchainRecord here
    // but the model is just a stub for now.
    
    return { success: true, txHash: result.txHash };
  }
);
