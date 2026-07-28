import { icdrChecklist } from "@/compliance/icdr-checklist";
import { generate } from "@/lib/llmClient";

export async function runGapDetection(sectionContent: string, category: string): Promise<any[]> {
  if (!sectionContent || sectionContent.trim().length === 0) {
    return icdrChecklist; // Flag all if empty
  }

  // Filter checklist by category (for now we check all rules to ensure exhaustive checking)
  const relevantRules = icdrChecklist;

  const prompt = `You are a compliance auditor. Given a section of a company's DRHP document, determine if it satisfies the following ICDR regulatory checklist rules.

Document Content:
${sectionContent}

Checklist:
${JSON.stringify(relevantRules, null, 2)}

For each rule in the checklist, determine if the Document Content satisfies it. If it is NOT satisfied, it is a gap.
Return a JSON array containing ONLY the keys of the rules that are NOT satisfied.
Example output: ["reg_7_1_a", "reg_7_1_c"]
Do not return any markdown formatting, just the raw JSON array string.`;

  try {
    const response = await generate(prompt, { temperature: 0.1 });
    let text = response.text.trim();
    if (text.startsWith("\`\`\`json")) text = text.slice(7);
    if (text.startsWith("\`\`\`")) text = text.slice(3);
    if (text.endsWith("\`\`\`")) text = text.slice(0, -3);
    text = text.trim();

    const missingKeys = JSON.parse(text);
    if (!Array.isArray(missingKeys)) throw new Error("Output is not an array");

    return relevantRules.filter(rule => missingKeys.includes(rule.key));
  } catch (e: any) {
    console.error("Gap Detection AI Error:", e);
    // Fallback: flag all rules if AI fails
    return relevantRules;
  }
}
