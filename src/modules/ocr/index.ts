import { prisma } from "@/db";
import { OcrProvider } from "./provider";
import { SmartOcrProvider } from "./smart-provider";

export const extractOcr = async (documentId: string): Promise<void> => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Use SmartOcrProvider which falls back to MockOcrProvider
  const ocrProvider: OcrProvider = new SmartOcrProvider();

  // 1. Extract data
  const { fields } = await ocrProvider.extract(document.fileUrl, document.fileType);

  // 2. Validate extracted fields for confidence scores
  const extractedJson: Record<string, any> = {};
  for (const field of fields) {
    if (field.confidence === undefined || field.confidence === null) {
      console.warn(`OCR Extraction: Missing confidence for key ${field.key}. Skipping.`);
      continue;
    }
    extractedJson[field.key] = {
      value: field.value,
      confidence: field.confidence,
    };
  }

  // 3. Update Document
  await prisma.document.update({
    where: { id: documentId },
    data: {
      ocrStatus: "completed",
      ocrExtracted: extractedJson,
    },
  });

  // 4. Mirror to KnowledgeBaseEntry
  const kbEntries = Object.entries(extractedJson).map(([key, data]) => ({
    projectId: document.projectId,
    sourceType: "ocr",
    sourceRefId: documentId,
    fieldKey: key,
    fieldValue: data.value,
    confidence: data.confidence,
  }));

  if (kbEntries.length > 0) {
    await prisma.knowledgeBaseEntry.createMany({
      data: kbEntries,
    });
  }
};
