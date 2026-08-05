// Single seam for all model calls. Gemini is the first implementation —
// swapping providers later means changing only what's inside this function.

export interface CallLLMFile {
  bytes: Uint8Array // raw file bytes — uploaded via Files API, never inlined as base64
  mimeType: string
}

export interface CallLLMInput {
  prompt: string
  file?: CallLLMFile
  responseMimeType?: string
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com'

interface GeminiFile {
  name: string
  uri: string
  state: string
}

// Files API: raw-byte upload + poll-until-ACTIVE. Avoids ever holding a
// base64-inflated copy of the document in memory (that's what blew the
// worker's resource limit on a 13.6MB PDF) and raises the size ceiling
// from ~20MB (inline_data) to 2GB.
async function uploadFile(apiKey: string, file: CallLLMFile): Promise<string> {
  const startResponse = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': file.mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'document' } }),
  })

  if (!startResponse.ok) {
    throw new Error(
      `Gemini file upload init failed (${startResponse.status}): ${await startResponse.text()}`,
    )
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url')
  if (!uploadUrl) {
    throw new Error('Gemini file upload did not return an upload URL')
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(file.bytes.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file.bytes,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Gemini file upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`)
  }

  const uploaded = await uploadResponse.json()
  let fileInfo = uploaded.file as GeminiFile

  const deadline = Date.now() + 60_000
  while (fileInfo.state === 'PROCESSING' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const statusResponse = await fetch(`${GEMINI_BASE}/v1beta/${fileInfo.name}?key=${apiKey}`)
    const statusBody = await statusResponse.json()
    fileInfo = statusBody as GeminiFile
  }

  if (fileInfo.state !== 'ACTIVE') {
    throw new Error(`Gemini file did not become ACTIVE in time (state: ${fileInfo.state})`)
  }

  return fileInfo.uri
}

export async function callLLM({ prompt, file, responseMimeType }: CallLLMInput): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const parts: Record<string, unknown>[] = [{ text: prompt }]
  if (file) {
    const fileUri = await uploadFile(apiKey, file)
    parts.push({ file_data: { mime_type: file.mimeType, file_uri: fileUri } })
  }

  const response = await fetch(
    `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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
