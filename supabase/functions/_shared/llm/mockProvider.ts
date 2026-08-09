// Test/dev double for LLMProvider. No network calls. Used by this module's
// own tests, and reused as-is by Task 12 (generate-section) so that work can
// be written and verified without spending Gemini quota. Selectable at
// runtime too (LLM_PROVIDER=mock) for local dev against the extraction
// pipeline without touching the real API.

import type { LLMProvider, LLMRequest } from './types.ts'

// Valid-shape empty extraction result — lets the mock stand in for Gemini in
// the extract Edge Function's pipeline (parseModelJson/coerceExtractedFacts)
// without every caller having to supply its own canned JSON.
const DEFAULT_MOCK_RESPONSE = JSON.stringify({
  company: {},
  financials: {},
  capitalStructure: {},
  promoters: [],
  litigation: [],
  relatedParties: [],
})

export interface MockProviderConfig {
  response?: string | ((request: LLMRequest) => string)
}

export interface MockLLMProvider extends LLMProvider {
  readonly calls: LLMRequest[]
}

export function createMockProvider(config: MockProviderConfig = {}): MockLLMProvider {
  const calls: LLMRequest[] = []

  return {
    name: 'mock',
    calls,
    async generate(request: LLMRequest): Promise<string> {
      calls.push(request)
      if (typeof config.response === 'function') {
        return config.response(request)
      }
      return config.response ?? DEFAULT_MOCK_RESPONSE
    },
  }
}
