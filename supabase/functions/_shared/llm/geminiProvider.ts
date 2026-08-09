// Gemini implementation of LLMProvider. Config (API key, model, base URL) is
// passed in rather than read from Deno.env here, so this file has no runtime
// dependency and can be unit-tested with a mocked fetch under Vitest/Node —
// env resolution lives in ./config.ts, the one piece that actually needs Deno.

import type { LLMFile, LLMProvider, LLMRequest } from './types.ts'

export interface GeminiProviderConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

const DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

interface GeminiFile {
  name: string
  uri: string
  state: string
}

export function createGeminiProvider(config: GeminiProviderConfig): LLMProvider {
  const apiKey = config.apiKey
  const model = config.model || DEFAULT_MODEL
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL

  // Files API: raw-byte upload + poll-until-ACTIVE. Avoids ever holding a
  // base64-inflated copy of the document in memory (that's what blew the
  // worker's resource limit on a 13.6MB PDF) and raises the size ceiling
  // from ~20MB (inline_data) to 2GB.
  async function uploadFile(file: LLMFile): Promise<string> {
    const startResponse = await fetch(`${baseUrl}/upload/v1beta/files?key=${apiKey}`, {
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
      const statusResponse = await fetch(`${baseUrl}/v1beta/${fileInfo.name}?key=${apiKey}`)
      const statusBody = await statusResponse.json()
      fileInfo = statusBody as GeminiFile
    }

    if (fileInfo.state !== 'ACTIVE') {
      throw new Error(`Gemini file did not become ACTIVE in time (state: ${fileInfo.state})`)
    }

    return fileInfo.uri
  }

  return {
    name: 'gemini',
    async generate({ prompt, file, responseMimeType }: LLMRequest): Promise<string> {
      const parts: Record<string, unknown>[] = [{ text: prompt }]
      if (file) {
        const fileUri = await uploadFile(file)
        parts.push({ file_data: { mime_type: file.mimeType, file_uri: fileUri } })
      }

      const response = await fetch(
        `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    },
  }
}
