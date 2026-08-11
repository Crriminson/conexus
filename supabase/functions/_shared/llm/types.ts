// Provider-agnostic seam for all LLM calls. Concrete providers (Gemini,
// mock, a future paid tier or alternate vendor) implement this interface;
// everything upstream (the extract Edge Function, generate-section later)
// depends only on it, never on a specific provider's request/response shape.

export interface LLMFile {
  bytes: Uint8Array<ArrayBuffer> // raw file bytes — each provider decides how to transmit them
  mimeType: string
}

export interface LLMRequest {
  prompt: string
  file?: LLMFile
  responseMimeType?: string
}

export interface LLMProvider {
  readonly name: string
  generate(request: LLMRequest): Promise<string>
}
