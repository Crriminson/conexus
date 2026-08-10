// Shared by every hook that invokes a Supabase Edge Function and wants the
// function's own { error: "..." } body surfaced instead of a generic
// FunctionsHttpError message.
export async function describeFunctionError(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json()
        if (body?.error) return String(body.error)
      } catch {
        // fall through to generic message below
      }
    }
  }
  return error instanceof Error ? error.message : fallback
}
