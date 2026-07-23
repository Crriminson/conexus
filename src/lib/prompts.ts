/**
 * Generates the prompt and system instructions for the AI Interview question generation flow.
 * 
 * @param facts - An array of existing KnowledgeBaseFact objects
 * @returns { systemPrompt, userPrompt }
 */
export function getInterviewGenerationPrompt(facts: { category: string; content: string }[]) {
  let factsContext = "The Knowledge Base is currently empty.";
  
  if (facts.length > 0) {
    const groupedFacts = facts.reduce((acc, fact) => {
      if (!acc[fact.category]) acc[fact.category] = [];
      acc[fact.category].push(fact.content);
      return acc;
    }, {} as Record<string, string[]>);

    factsContext = "Current Knowledge Base Facts:\n" + Object.entries(groupedFacts)
      .map(([category, items]) => `[${category}]\n- ${items.join('\n- ')}`)
      .join('\n\n');
  }

  const systemPrompt = `You are an expert IPO Compliance Advisor. 
Your goal is to help a company prepare their Draft Red Herring Prospectus (DRHP). 
Review the facts currently known about the company.
Identify critical missing information required for a DRHP filing (e.g., financials, corporate structure, litigation, promoters, business model).
Generate exactly 3 to 5 highly relevant, specific follow-up questions to ask the founders to fill these gaps.
Respond ONLY with a valid JSON array of strings, where each string is a question. Do NOT wrap it in markdown blocks (\`\`\`json).`;

  const userPrompt = `${factsContext}\n\nBased on the above, generate 3-5 critical follow-up questions.`;

  return { systemPrompt, userPrompt };
}

/**
 * Generates the prompt and system instructions for processing user answers into structured facts.
 * 
 * @param qnaPairs - An array of Question and Answer objects
 * @returns { systemPrompt, userPrompt }
 */
export function getAnswerProcessingPrompt(qnaPairs: { question: string; answer: string }[]) {
  const qnaContext = qnaPairs.map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`).join('\n\n');

  const systemPrompt = `You are an expert IPO Compliance Data Extractor.
You are given a transcript of Q&A with the company founders.
Extract the factual information into distinct, atomic facts.
Categorize each fact into one of the following: "Company Profile", "Financials", "Business", "Management", "Legal & Regulatory", "Risk Factors".
Respond ONLY with a valid JSON array of objects. Each object must have exactly two keys: "category" and "content".
Do NOT wrap the response in markdown blocks (\`\`\`json).`;

  const userPrompt = `Here is the Q&A transcript:\n\n${qnaContext}\n\nExtract and categorize the facts.`;

  return { systemPrompt, userPrompt };
}
