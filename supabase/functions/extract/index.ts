import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { callLLM } from '../_shared/callLLM.ts'
import { merge } from '../_shared/merge/merge.ts'
import type { ExtractedFacts } from '../_shared/merge/types.ts'
import type { IssuerFacts } from '../_shared/factsTypes.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STORAGE_BUCKET = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'documents'
const MAX_MERGE_RETRIES = 5

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildExtractionPrompt(filename: string): string {
  return `You are extracting structured facts from an IPO prospectus (DRHP) document titled "${filename}" for regulatory compliance review.

Extract ONLY facts that are explicitly present in the document. Never guess, infer, or fabricate a value that is not clearly stated. If a fact cannot be found, set its "value" to null and its "confidence" to null.

Output strict JSON only — no markdown, no commentary — matching exactly this structure. Every leaf field must be an object of the form { "value": <extracted value or null>, "confidence": <0 to 1, or null if not found>, "sourcePage": <page number where the fact was found, or null> }.

{
  "company": {
    "legalName": <leaf: string>, "cin": <leaf: string>, "incorporationDate": <leaf: string>,
    "registeredOfficeAddress": <leaf: string>, "industry": <leaf: string>, "businessDescription": <leaf: string>
  },
  "financials": {
    "fiscalYearEnd": <leaf: string>, "revenue": <leaf: number>, "ebitda": <leaf: number>,
    "netProfit": <leaf: number>, "totalAssets": <leaf: number>, "totalLiabilities": <leaf: number>, "netWorth": <leaf: number>
  },
  "capitalStructure": {
    "authorizedCapital": <leaf: number>, "issuedCapital": <leaf: number>, "paidUpCapital": <leaf: number>,
    "faceValuePerShare": <leaf: number>, "totalSharesOutstanding": <leaf: number>
  },
  "promoters": [
    { "name": <leaf: string>, "panOrId": <leaf: string>, "din": <leaf: string>, "shareholdingPercent": <leaf: number>, "category": <leaf: string> }
  ],
  "litigation": [
    { "caseNumber": <leaf: string>, "forum": <leaf: string>, "partiesInvolved": <leaf: string>, "natureOfProceeding": <leaf: string>, "amountInvolved": <leaf: number>, "status": <leaf: string> }
  ],
  "relatedParties": [
    { "partyName": <leaf: string>, "relationship": <leaf: string>, "natureOfTransaction": <leaf: string>, "amount": <leaf: number>, "transactionDate": <leaf: string> }
  ]
}

"promoters", "litigation", and "relatedParties" are repeating groups — include one array entry per distinct promoter, litigation matter, or related-party transaction found in the document. Return an empty array if none are found.`
}

interface ExtractedLeaf {
  value: unknown
  confidence: number | null
  sourcePage: number | null
}

function leaf(source: unknown, key: string): ExtractedLeaf {
  const raw = (source as Record<string, unknown> | null | undefined)?.[key]
  if (raw && typeof raw === 'object' && 'value' in (raw as object)) {
    const r = raw as { value?: unknown; confidence?: unknown; sourcePage?: unknown }
    return {
      value: r.value ?? null,
      confidence: typeof r.confidence === 'number' ? r.confidence : null,
      sourcePage: typeof r.sourcePage === 'number' ? r.sourcePage : null,
    }
  }
  return { value: null, confidence: null, sourcePage: null }
}

function records(source: unknown, key: string, fields: string[]): Record<string, ExtractedLeaf>[] {
  const raw = (source as Record<string, unknown> | null | undefined)?.[key]
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const record: Record<string, ExtractedLeaf> = {}
    for (const field of fields) {
      record[field] = leaf(item, field)
    }
    return record
  })
}

function coerceExtractedFacts(raw: unknown): Omit<ExtractedFacts, 'documentId'> {
  const r = raw as Record<string, unknown> | null | undefined

  return {
    company: {
      legalName: leaf(r?.company, 'legalName'),
      cin: leaf(r?.company, 'cin'),
      incorporationDate: leaf(r?.company, 'incorporationDate'),
      registeredOfficeAddress: leaf(r?.company, 'registeredOfficeAddress'),
      industry: leaf(r?.company, 'industry'),
      businessDescription: leaf(r?.company, 'businessDescription'),
    },
    financials: {
      fiscalYearEnd: leaf(r?.financials, 'fiscalYearEnd'),
      revenue: leaf(r?.financials, 'revenue'),
      ebitda: leaf(r?.financials, 'ebitda'),
      netProfit: leaf(r?.financials, 'netProfit'),
      totalAssets: leaf(r?.financials, 'totalAssets'),
      totalLiabilities: leaf(r?.financials, 'totalLiabilities'),
      netWorth: leaf(r?.financials, 'netWorth'),
    },
    capitalStructure: {
      authorizedCapital: leaf(r?.capitalStructure, 'authorizedCapital'),
      issuedCapital: leaf(r?.capitalStructure, 'issuedCapital'),
      paidUpCapital: leaf(r?.capitalStructure, 'paidUpCapital'),
      faceValuePerShare: leaf(r?.capitalStructure, 'faceValuePerShare'),
      totalSharesOutstanding: leaf(r?.capitalStructure, 'totalSharesOutstanding'),
    },
    promoters: records(r, 'promoters', ['name', 'panOrId', 'din', 'shareholdingPercent', 'category']),
    litigation: records(r, 'litigation', [
      'caseNumber',
      'forum',
      'partiesInvolved',
      'natureOfProceeding',
      'amountInvolved',
      'status',
    ]),
    relatedParties: records(r, 'relatedParties', [
      'partyName',
      'relationship',
      'natureOfTransaction',
      'amount',
      'transactionDate',
    ]),
  } as Omit<ExtractedFacts, 'documentId'>
}

function parseModelJson(text: string): unknown {
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

// documentId -> best-effort marker so a killed worker's `beforeunload` can
// at least try to flag which in-flight documents it was holding. Opportunistic
// only (Layer 2) — the reaper (pg_cron, Layer 3) is the actual guarantee.
const inFlight = new Set<string>()

addEventListener('beforeunload', () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return

  for (const documentId of inFlight) {
    fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${documentId}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        extraction_status: 'failed',
        extraction_error: 'Edge function terminated (wall clock exceeded)',
      }),
    }).catch(() => {})
  }
})

async function markFailed(supabase: SupabaseClient, documentId: string, message: string) {
  await supabase
    .from('documents')
    .update({ extraction_status: 'failed', extraction_error: message })
    .eq('id', documentId)
}

// The actual work, run in the background after the request has already
// returned 202. Persists facts/conflicts/merge_events under optimistic
// concurrency (`version` column) since concurrent extractions — background
// tasks today, chunked sub-extractions once that lands — can race on the
// same project row. A failed run only ever marks the document `failed`;
// it never partially writes to the project row (each attempt's persist is
// one .update() call, conditioned on the version it read).
async function runExtraction(
  supabase: SupabaseClient,
  documentId: string,
  projectId: string,
  filename: string,
  storagePath: string,
) {
  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)

    if (downloadError || !fileBlob) {
      await markFailed(supabase, documentId, `Failed to download document: ${downloadError?.message}`)
      return
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer())

    const rawText = await callLLM({
      prompt: buildExtractionPrompt(filename),
      file: { bytes: fileBytes, mimeType: fileBlob.type || 'application/pdf' },
      responseMimeType: 'application/json',
    })

    const parsed = parseModelJson(rawText)
    if (parsed === null) {
      await markFailed(supabase, documentId, `Failed to parse model output as JSON: ${rawText.slice(0, 500)}`)
      return
    }

    const extracted: ExtractedFacts = { documentId, ...coerceExtractedFacts(parsed) }

    for (let attempt = 0; attempt < MAX_MERGE_RETRIES; attempt++) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, facts, conflicts, merge_events, version')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        await markFailed(supabase, documentId, `Project not found: ${projectError?.message ?? projectId}`)
        return
      }

      const result = merge(project.facts as IssuerFacts, extracted)

      const { data: updated, error: updateError } = await supabase
        .from('projects')
        .update({
          facts: result.facts,
          conflicts: [...project.conflicts, ...result.conflicts],
          merge_events: [...project.merge_events, result.event],
          version: project.version + 1,
        })
        .eq('id', projectId)
        .eq('version', project.version)
        .select('id')

      if (updateError) {
        await markFailed(supabase, documentId, `Failed to persist merged facts: ${updateError.message}`)
        return
      }

      if (updated && updated.length > 0) {
        await supabase
          .from('documents')
          .update({ extraction_status: 'complete', extraction_error: null })
          .eq('id', documentId)
        return
      }
      // version mismatch: another writer updated the project row concurrently.
      // Loop and retry the merge against a fresh read rather than overwriting it.
    }

    await markFailed(supabase, documentId, 'Exceeded retries resolving concurrent project updates')
  } catch (err) {
    await markFailed(supabase, documentId, err instanceof Error ? err.message : String(err))
  } finally {
    inFlight.delete(documentId)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let documentId: string | undefined
  try {
    const body = await req.json()
    documentId = body?.documentId
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (!documentId) {
    return jsonResponse({ error: 'documentId is required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Single conditional update, not read-then-write: two near-simultaneous
  // requests for the same document could otherwise both pass a separate
  // status check before either wrote `processing`, and both would kick off
  // background tasks. The `.neq()` filter makes claiming atomic.
  const { data: claimed, error: claimError } = await supabase
    .from('documents')
    .update({
      extraction_status: 'processing',
      extraction_started_at: new Date().toISOString(),
      extraction_error: null,
    })
    .eq('id', documentId)
    .neq('extraction_status', 'processing')
    .select('id, project_id, filename, storage_path')

  if (claimError) {
    return jsonResponse({ error: `Failed to claim document: ${claimError.message}` }, 500)
  }

  const document = claimed?.[0]
  if (!document) {
    const { data: existing } = await supabase.from('documents').select('id').eq('id', documentId).maybeSingle()
    return existing
      ? jsonResponse({ error: 'Document is already processing' }, 409)
      : jsonResponse({ error: 'Document not found' }, 404)
  }

  inFlight.add(documentId)

  // deno-lint-ignore no-undef
  EdgeRuntime.waitUntil(
    runExtraction(supabase, documentId, document.project_id, document.filename, document.storage_path),
  )

  return jsonResponse({ documentId, status: 'processing' }, 202)
})
