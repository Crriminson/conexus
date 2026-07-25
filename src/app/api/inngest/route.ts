import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import {
  ocrExtractJob,
  draftGenerateJob,
  gapDetectionRunJob,
  validationEngineRunJob,
  exportGenerateJob,
  blockchainHashRegisterJob
} from "@/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ocrExtractJob,
    draftGenerateJob,
    gapDetectionRunJob,
    validationEngineRunJob,
    exportGenerateJob,
    blockchainHashRegisterJob
  ],
});
