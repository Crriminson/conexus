// Shared between extract/index.ts and generate-section/index.ts — both ask
// Gemini for responseMimeType: 'application/json' but the model still
// occasionally wraps its output in a ```json fence, so both need the same
// defensive strip-and-parse rather than a bare JSON.parse.
export function parseModelJson(text: string): unknown {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/```$/, '')
      .trim()
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}
