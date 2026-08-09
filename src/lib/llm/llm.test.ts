import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGeminiProvider,
  createLLMProvider,
  createMockProvider,
  type EnvReader,
} from './index'

function fakeEnv(vars: Record<string, string | undefined>): EnvReader {
  return { get: (key: string) => vars[key] }
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createGeminiProvider — text-only prompt', () => {
  it('sends the prompt and returns the model text, using config apiKey/model/baseUrl', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return jsonResponse({ candidates: [{ content: { parts: [{ text: 'hello from model' }] } }] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGeminiProvider({
      apiKey: 'test-key',
      model: 'gemini-custom-model',
      baseUrl: 'https://example.test',
    })

    const result = await provider.generate({ prompt: 'extract facts' })

    expect(result).toBe('hello from model')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      'https://example.test/v1beta/models/gemini-custom-model:generateContent?key=test-key',
    )
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body.contents[0].parts).toEqual([{ text: 'extract facts' }])
  })

  it('defaults model and baseUrl when not provided', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
      }),
    )

    const provider = createGeminiProvider({ apiKey: 'k' })
    await provider.generate({ prompt: 'p' })

    expect(calls[0]).toContain('https://generativelanguage.googleapis.com')
    expect(calls[0]).toContain('gemini-2.5-flash')
  })

  it('sets responseMimeType in generationConfig only when provided', async () => {
    let sentBody: Record<string, unknown> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        sentBody = JSON.parse(init?.body as string)
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
      }),
    )

    const provider = createGeminiProvider({ apiKey: 'k' })
    await provider.generate({ prompt: 'p', responseMimeType: 'application/json' })

    expect(sentBody.generationConfig).toEqual({ responseMimeType: 'application/json' })
  })

  it('throws with the upstream status and body on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'bad key' }, false, 403)))

    const provider = createGeminiProvider({ apiKey: 'k' })

    await expect(provider.generate({ prompt: 'p' })).rejects.toThrow(/Gemini API error \(403\)/)
  })

  it('throws when the response has no text output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ candidates: [] })))

    const provider = createGeminiProvider({ apiKey: 'k' })

    await expect(provider.generate({ prompt: 'p' })).rejects.toThrow(
      'Gemini response did not contain text output',
    )
  })
})

describe('createGeminiProvider — with file', () => {
  function fileUploadSequence(finalState: 'ACTIVE' | 'FAILED' = 'ACTIVE') {
    const urls: string[] = []
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      urls.push(url)
      if (url.includes('/upload/v1beta/files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'x-goog-upload-url': 'https://example.test/upload-session-1' }),
        } as unknown as Response
      }
      if (url === 'https://example.test/upload-session-1') {
        return jsonResponse({ file: { name: 'files/abc', uri: 'files/abc-uri', state: finalState } })
      }
      if (url.includes(':generateContent')) {
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'extracted' }] } }] })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    return { fetchMock, urls }
  }

  it('uploads the file via the Files API then references its uri in generateContent', async () => {
    const { fetchMock, urls } = fileUploadSequence()
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGeminiProvider({ apiKey: 'k', baseUrl: 'https://example.test' })
    const result = await provider.generate({
      prompt: 'extract',
      file: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'application/pdf' },
    })

    expect(result).toBe('extracted')
    expect(urls[0]).toContain('/upload/v1beta/files?key=k')
    expect(urls[1]).toBe('https://example.test/upload-session-1')

    const generateCall = fetchMock.mock.calls[2]
    const body = JSON.parse((generateCall[1] as RequestInit).body as string)
    expect(body.contents[0].parts[1]).toEqual({
      file_data: { mime_type: 'application/pdf', file_uri: 'files/abc-uri' },
    })
  })

  it('throws if the file never becomes ACTIVE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/upload/v1beta/files')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'x-goog-upload-url': 'https://example.test/upload-session-1' }),
          } as unknown as Response
        }
        return jsonResponse({ file: { name: 'files/abc', uri: 'files/abc-uri', state: 'FAILED' } })
      }),
    )

    const provider = createGeminiProvider({ apiKey: 'k', baseUrl: 'https://example.test' })

    await expect(
      provider.generate({ prompt: 'extract', file: { bytes: new Uint8Array(), mimeType: 'application/pdf' } }),
    ).rejects.toThrow('Gemini file did not become ACTIVE in time (state: FAILED)')
  })

  it('throws when the upload init call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'quota' }, false, 429)))

    const provider = createGeminiProvider({ apiKey: 'k' })

    await expect(
      provider.generate({ prompt: 'extract', file: { bytes: new Uint8Array(), mimeType: 'application/pdf' } }),
    ).rejects.toThrow(/Gemini file upload init failed \(429\)/)
  })
})

describe('createMockProvider', () => {
  it('returns a valid-shape default response and records calls', async () => {
    const provider = createMockProvider()

    const result = await provider.generate({ prompt: 'extract facts' })

    expect(JSON.parse(result)).toEqual({
      company: {},
      financials: {},
      capitalStructure: {},
      promoters: [],
      litigation: [],
      relatedParties: [],
    })
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].prompt).toBe('extract facts')
  })

  it('honors a static configured response', async () => {
    const provider = createMockProvider({ response: 'canned text' })
    await expect(provider.generate({ prompt: 'anything' })).resolves.toBe('canned text')
  })

  it('honors a response function computed from the request', async () => {
    const provider = createMockProvider({
      response: (req) => `echo: ${req.prompt}`,
    })
    await expect(provider.generate({ prompt: 'ping' })).resolves.toBe('echo: ping')
  })
})

describe('createLLMProvider (env-driven factory)', () => {
  it('defaults to gemini when LLM_PROVIDER is unset', () => {
    const provider = createLLMProvider(fakeEnv({ GEMINI_API_KEY: 'k' }))
    expect(provider.name).toBe('gemini')
  })

  it('throws a clear error when gemini is selected but GEMINI_API_KEY is missing', () => {
    expect(() => createLLMProvider(fakeEnv({}))).toThrow('GEMINI_API_KEY is not set')
  })

  it('passes GEMINI_MODEL and GEMINI_BASE_URL through to the gemini provider', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toContain('https://alt.example')
        expect(url).toContain('alt-model')
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
      }),
    )

    const provider = createLLMProvider(
      fakeEnv({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'alt-model', GEMINI_BASE_URL: 'https://alt.example' }),
    )
    await provider.generate({ prompt: 'p' })
  })

  it('selects the mock provider when LLM_PROVIDER=mock', () => {
    const provider = createLLMProvider(fakeEnv({ LLM_PROVIDER: 'mock' }))
    expect(provider.name).toBe('mock')
  })

  it('throws on an unknown provider name', () => {
    expect(() => createLLMProvider(fakeEnv({ LLM_PROVIDER: 'openai' }))).toThrow(
      'Unknown LLM_PROVIDER "openai"',
    )
  })
})
