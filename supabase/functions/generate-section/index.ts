import { createClient } from 'npm:@supabase/supabase-js@2'
import { callLLM } from '../_shared/callLLM.ts'
import { parseModelJson } from '../_shared/parseModelJson.ts'
import type { IssuerFacts } from '../_shared/factsTypes.ts'
import {
  buildGenerationPrompt,
  collectConfirmedFacts,
  resolveGeneratedSections,
  type GeneratedSections,
} from '../_shared/generatedSections/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_WRITE_RETRIES = 5

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// One Gemini call over a short list of confirmed facts, not a multi-hundred-
// page document — this comfortably fits the ~150s wall-clock ceiling that
// forced extract/index.ts into async+chunking, so this function is
// deliberately synchronous: no 202/background-task/reaper apparatus, just a
// single request/response. Persists with the same version-CAS retry loop
// everything else on `projects` uses, but as a plain overwrite (not a
// merge() — generated_sections is regenerated wholesale on demand, it has
// no proposed-vs-confirmed history to reconcile).
async function persistGeneratedSections(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  projectId: string,
  generatedSections: GeneratedSections,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
    const { data: project, error: readError } = await supabase
      .from('projects')
      .select('id, generated_sections, version')
      .eq('id', projectId)
      .single()

    if (readError || !project) {
      return { ok: false, error: `Project not found: ${readError?.message ?? projectId}` }
    }

    const merged = { ...(project.generated_sections ?? {}), ...generatedSections }

    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({ generated_sections: merged, version: project.version + 1 })
      .eq('id', projectId)
      .eq('version', project.version)
      .select('id, generated_sections')

    if (updateError) {
      return { ok: false, error: `Failed to persist generated sections: ${updateError.message}` }
    }
    if (updated && updated.length > 0) {
      return { ok: true }
    }
    // version mismatch — someone else wrote to this project concurrently. Loop and retry.
  }

  return { ok: false, error: 'Exceeded retries resolving concurrent project updates' }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let projectId: string | undefined
  try {
    const body = await req.json()
    projectId = body?.projectId
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  if (!projectId) {
    return jsonResponse({ error: 'projectId is required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, facts')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) {
    return jsonResponse({ error: `Failed to load project: ${projectError.message}` }, 500)
  }
  if (!project) {
    return jsonResponse({ error: 'Project not found' }, 404)
  }

  const entries = collectConfirmedFacts(project.facts as IssuerFacts)
  if (entries.length === 0) {
    return jsonResponse(
      { error: 'No confirmed, citable facts yet — nothing to generate narrative sections from.' },
      400,
    )
  }

  let rawText: string
  try {
    rawText = await callLLM({
      prompt: buildGenerationPrompt(entries),
      responseMimeType: 'application/json',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse({ error: `Generation failed: ${message}` }, 502)
  }

  const parsed = parseModelJson(rawText)
  if (parsed === null) {
    return jsonResponse(
      { error: `Failed to parse model output as JSON: ${rawText.slice(0, 500)}` },
      502,
    )
  }

  const generatedSections = resolveGeneratedSections(parsed, entries, new Date().toISOString())
  if (Object.keys(generatedSections).length === 0) {
    return jsonResponse({ error: 'Model did not return any usable narrative sections.' }, 502)
  }

  const persisted = await persistGeneratedSections(supabase, projectId, generatedSections)
  if (!persisted.ok) {
    return jsonResponse({ error: persisted.error }, 500)
  }

  return jsonResponse({ projectId, generatedSections }, 200)
})
