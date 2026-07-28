import { OcrProvider, OcrField, MockOcrProvider } from "./provider";
const pdfParse = require("pdf-parse");
import { generate } from "@/lib/llmClient";

export class SmartOcrProvider implements OcrProvider {
  async extract(fileUrl: string, fileType: string): Promise<{ fields: OcrField[] }> {
    try {
      // If it's a PDF, attempt native text extraction first
      if (fileType === "application/pdf" || fileUrl.toLowerCase().endsWith(".pdf")) {
        console.log(`[SmartOcrProvider] Fetching PDF from ${fileUrl}`);
        const response = await fetch(fileUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log(`[SmartOcrProvider] Parsing PDF...`);
          const pdfData = await pdfParse(buffer);
          
          const text = pdfData.text.trim();
          console.log(`[SmartOcrProvider] Extracted ${text.length} characters of native text.`);
          
          // If we got a decent amount of text, it's a text-based PDF
          if (text.length > 100) {
            console.log(`[SmartOcrProvider] Using LLM to extract fields from native text...`);
            const fields = await this.extractFieldsWithLlm(text);
            return { fields };
          } else {
            console.log(`[SmartOcrProvider] Not enough text extracted (likely a scanned PDF). Falling back to OCR.`);
          }
        }
      } else {
         console.log(`[SmartOcrProvider] Not a PDF (type: ${fileType}). Proceeding to OCR.`);
      }
    } catch (error) {
      console.error("[SmartOcrProvider] Error in native extraction, falling back to OCR:", error);
    }
    
    // Fallback to "OCR" (for now, MockOcrProvider simulates Vision OCR)
    console.log(`[SmartOcrProvider] Falling back to Mock OCR Provider.`);
    const fallbackProvider = new MockOcrProvider();
    return fallbackProvider.extract(fileUrl, fileType);
  }

  private async extractFieldsWithLlm(text: string): Promise<OcrField[]> {
    const prompt = `You are an expert data extractor for corporate documents.
Extract all key business entities and facts you can find in the provided document text.
Respond with a strict JSON array of objects, where each object has:
- "key": A camelCase identifier for the data point (e.g., "companyName", "cin", "incorporationDate", "panNumber", "registeredAddress")
- "value": The extracted value as a string
- "confidence": A float between 0.0 and 1.0 representing your confidence in this extraction.

Document text:
"""
${text.substring(0, 15000)} // Truncate if too long
"""

OUTPUT ONLY VALID JSON. Example:
[
  { "key": "companyName", "value": "Acme Corp", "confidence": 0.95 }
]`;

    try {
      const response = await generate(prompt, { temperature: 0.1, maxTokens: 1000 });
      let cleaned = response.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const extracted = JSON.parse(cleaned);
      
      if (Array.isArray(extracted)) {
        return extracted.map((item: any) => ({
          key: item.key || "unknown",
          value: String(item.value || ""),
          confidence: Number(item.confidence) || 0.8,
        }));
      }
      return [];
    } catch (error) {
      console.error("[SmartOcrProvider] Failed to parse LLM response:", error);
      return [];
    }
  }
}
