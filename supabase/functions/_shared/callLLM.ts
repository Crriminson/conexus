// Single seam for all model calls. Gemini is the first implementation —
// swapping providers later means changing only what's inside this function.

export interface CallLLMFile {
  data: string // base64-encoded file content
  mimeType: string
}

export interface CallLLMInput {
  prompt: string
  file?: CallLLMFile
  responseMimeType?: string
}

const GEMINI_MODEL = 'gemini-2.5-flash'

export async function callLLM({ prompt, file, responseMimeType }: CallLLMInput): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const parts: Record<string, unknown>[] = [{ text: prompt }]
  if (file) {
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.data } })
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: responseMimeType ? { responseMimeType } : undefined,
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  const result = await response.json()
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text !== 'string') {
    throw new Error('Gemini response did not contain text output')
  }

  return text
}
