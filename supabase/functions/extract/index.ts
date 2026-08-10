import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { callLLM } from '../_shared/callLLM.ts'
import { merge } from '../_shared/merge/merge.ts'
import type { ExtractedFacts } from '../_shared/merge/types.ts'
import type { IssuerFacts } from '../_shared/factsTypes.ts'
import { parseModelJson } from '../_shared/parseModelJson.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STORAGE_BUCKET = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'documents'
const MAX_MERGE_RETRIES = 5

// Per-chunk retry for transient model-side failures (rate limit / upstream
// 5xx). Deliberately small: a genuinely exhausted daily quota won't clear
// within any backoff we can afford inside an edge function, so the point is
// to survive a brief 429 burst, not to wait out a quota reset. When the
// retries are used up the document fails with the real upstream message and
// keeps every chunk merged so far — a later retry resumes from there.
const MAX_CHUNK_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 20_000

function isTransientLLMError(message: string): boolean {
  return /\((429|500|502|503|504)\)/.test(message)
}

// Chunk plan is computed and the PDF physically split entirely client-side
// at upload time (see src/hooks/useUploadDocument.ts) — NOT here. First
// attempt did the splitting in this function via pdf-lib and it died in
// ~2s, not from the ~150s wall-clock ceiling we'd spent effort verifying,
// but from a separate, much stricter CPU-time budget (~2000ms, confirmed
// via function_logs: `"reason": "CPUTime"`). Just loading an 8MB/
// several-hundred-page PDF to read its page count blew that budget before
// a single Gemini call was even made — true regardless of chunk count,
// since chunk 0 still needs the full source parsed once. The browser has
// no such budget, so this function now never touches PDF structure: it
// downloads an already-chunk-sized file and forwards its bytes to Gemini.
interface ChunkPlanEntry {
  index: number
  startPage: number
  endPage: number
  storagePath: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildExtractionPrompt(filename: string, range: { startPage: number; endPage: number; totalPages: number }): string {
  const scopeNote =
    range.totalPages > range.endPage - range.startPage + 1
      ? `\n\nThis is a PARTIAL EXCERPT — pages ${range.startPage}-${range.endPage} of a larger ${range.totalPages}-page document, re-paginated to start at page 1. When reporting "sourcePage", use the page number AS IT APPEARS IN THIS EXCERPT (1 to ${range.endPage - range.startPage + 1}), not the original document's page number — the caller remaps it. Facts about promoters, litigation, or related parties may be introduced in a different excerpt than this one; only report what's visible here. Do not treat absence in this excerpt as evidence a fact doesn't exist elsewhere in the document.`
      : ''

  return `You are extracting structured facts from an IPO prospectus (DRHP) document titled "${filename}" for regulatory compliance review.${scopeNote}

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

// Chunked excerpts are re-paginated starting at 1 (see buildExtractionPrompt),
// so the model's sourcePage is relative to the excerpt, not the original
// document. Shift every non-null sourcePage back into the original
// document's page numbers before this chunk's facts ever reach merge() —
// provenance ("source: p.14") would otherwise point at the wrong page for
// every chunk after the first.
function shiftSourcePages(facts: Omit<ExtractedFacts, 'documentId'>, offset: number): Omit<ExtractedFacts, 'documentId'> {
  if (offset === 0) return facts

  const shiftLeaf = (l: ExtractedLeaf): ExtractedLeaf =>
    l.sourcePage === null ? l : { ...l, sourcePage: l.sourcePage + offset }

  const shiftGroup = (group: Record<string, ExtractedLeaf>): Record<string, ExtractedLeaf> => {
    const out: Record<string, ExtractedLeaf> = {}
    for (const key of Object.keys(group)) out[key] = shiftLeaf(group[key])
    return out
  }

  // Same loose-cast-at-the-boundary style as coerceExtractedFacts above:
  // the named domain interfaces (ExtractedCompanyFacts etc.) are
  // structurally just string-keyed ExtractedLeaf records, but TypeScript
  // won't infer that without an index signature they deliberately don't have.
  const asGroup = (value: unknown) => shiftGroup(value as Record<string, ExtractedLeaf>)

  return {
    company: asGroup(facts.company),
    financials: asGroup(facts.financials),
    capitalStructure: asGroup(facts.capitalStructure),
    promoters: facts.promoters.map((p) => asGroup(p)),
    litigation: facts.litigation.map((l) => asGroup(l)),
    relatedParties: facts.relatedParties.map((p) => asGroup(p)),
  } as Omit<ExtractedFacts, 'documentId'>
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
        extraction_error: 'Edge function terminated (wall clock or CPU time exceeded)',
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

async function markComplete(supabase: SupabaseClient, documentId: string) {
  await supabase
    .from('documents')
    .update({ extraction_status: 'complete', extraction_error: null })
    .eq('id', documentId)
}

// One read-merge-write attempt per loop iteration, retried on optimistic-
// concurrency conflict. Each chunk of each document calls this immediately
// after its own Gemini call returns (human call: merge per chunk, not
// batched — a failed chunk shouldn't cost the document its already-merged
// work, and it gives real progress to show). A failed attempt writes
// nothing; there is no partial merge.
async function persistChunkFacts(
  supabase: SupabaseClient,
  projectId: string,
  extracted: ExtractedFacts,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < MAX_MERGE_RETRIES; attempt++) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, facts, conflicts, merge_events, version')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return { ok: false, error: `Project not found: ${projectError?.message ?? projectId}` }
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
      return { ok: false, error: `Failed to persist merged facts: ${updateError.message}` }
    }

    if (updated && updated.length > 0) {
      return { ok: true }
    }
    // version mismatch: another writer updated the project row concurrently.
    // Loop and retry the merge against a fresh read rather than overwriting it.
  }

  return { ok: false, error: 'Exceeded retries resolving concurrent project updates' }
}

function selfExtractUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  return `${supabaseUrl}/functions/v1/extract`
}

// Fires the next chunk as a brand-new HTTP invocation rather than looping
// in-process, so each chunk's Gemini call gets a fresh wall-clock budget
// (the ~150s ceiling applies per invocation — confirmed by direct
// measurement). Awaited only long enough to get the 202 acknowledging the
// next invocation started, not that chunk's own completion.
async function triggerContinuation(
  documentId: string,
  chunkIndex: number,
  attempt = 0,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not set, cannot trigger continuation' }

  try {
    const res = await fetch(selfExtractUrl(), {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId, _continuation: { chunkIndex, attempt } }),
    })
    if (res.status !== 202) {
      return { ok: false, error: `Continuation call returned ${res.status}: ${await res.text()}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `Continuation call failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// Processes exactly one chunk: download its already-page-range-sized PDF
// (split client-side at upload time, see the module comment above — this
// function never parses PDF structure), one Gemini call, merge immediately,
// then either trigger the next chunk's invocation or mark the document
// complete. Used identically for the first chunk and every continuation —
// there is no separate "entry" processing path anymore, since there's
// nothing left to compute server-side before chunk 0 that isn't already
// true for every other chunk.
async function processChunk(
  supabase: SupabaseClient,
  documentId: string,
  projectId: string,
  filename: string,
  chunkPlan: ChunkPlanEntry[],
  chunkIndex: number,
  attempt = 0,
) {
  inFlight.add(documentId)
  try {
    // Backoff for a retried chunk. Sleeping here rather than before the
    // requeue keeps each wait inside its own fresh invocation, so the delay
    // can't eat the wall-clock budget of the invocation that scheduled it.
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(RETRY_BASE_DELAY_MS * attempt, 60_000)))
    }

    if (chunkIndex >= chunkPlan.length) {
      // Shouldn't happen (continuation only fires while chunks remain) but
      // don't fail an otherwise-fully-merged document over it.
      await markComplete(supabase, documentId)
      return
    }

    const info = chunkPlan[chunkIndex]
    const totalPages = chunkPlan[chunkPlan.length - 1].endPage

    const { data: fileBlob, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(info.storagePath)
    if (downloadError || !fileBlob) {
      await markFailed(
        supabase,
        documentId,
        `Chunk ${chunkIndex + 1}/${chunkPlan.length}: failed to download ${info.storagePath}: ${downloadError?.message}`,
      )
      return
    }
    const chunkBytes = new Uint8Array(await fileBlob.arrayBuffer())

    let rawText: string
    try {
      rawText = await callLLM({
        prompt: buildExtractionPrompt(filename, { startPage: info.startPage, endPage: info.endPage, totalPages }),
        file: { bytes: chunkBytes, mimeType: 'application/pdf' },
        responseMimeType: 'application/json',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Rate limits and upstream 5xx are transient — requeue this same
      // chunk in a fresh invocation rather than failing the document and
      // throwing away every chunk already merged. Quota exhaustion (429)
      // is the case that actually bit us: a real run died at chunk 19/26
      // and a plain retry would have re-run all 19 from scratch.
      if (isTransientLLMError(message) && attempt + 1 < MAX_CHUNK_ATTEMPTS) {
        const requeued = await triggerContinuation(documentId, chunkIndex, attempt + 1)
        if (requeued.ok) return
      }
      await markFailed(
        supabase,
        documentId,
        `Chunk ${chunkIndex + 1}/${chunkPlan.length} (pages ${info.startPage}-${info.endPage}) failed after ${attempt + 1} attempt(s): ${message}`,
      )
      return
    }

    const parsed = parseModelJson(rawText)
    if (parsed === null) {
      await markFailed(
        supabase,
        documentId,
        `Chunk ${chunkIndex + 1}/${chunkPlan.length} (pages ${info.startPage}-${info.endPage}): failed to parse model output as JSON: ${rawText.slice(0, 500)}`,
      )
      return
    }

    const shifted = shiftSourcePages(coerceExtractedFacts(parsed), info.startPage - 1)
    const extracted: ExtractedFacts = { documentId, ...shifted }

    const persisted = await persistChunkFacts(supabase, projectId, extracted)
    if (!persisted.ok) {
      await markFailed(
        supabase,
        documentId,
        `Chunk ${chunkIndex + 1}/${chunkPlan.length} (pages ${info.startPage}-${info.endPage}): ${persisted.error}`,
      )
      return
    }

    // extraction_started_at doubles as "last progress" for the pg_cron
    // reaper's staleness check (documents.processing past 5 minutes with no
    // update gets reaped). It's only set once at claim time otherwise — a
    // legitimate multi-chunk document can easily run past 5 minutes total,
    // so each chunk boundary has to refresh it or the reaper would kill an
    // actively-progressing extraction, not just a genuinely stuck one.
    await supabase
      .from('documents')
      .update({ extraction_completed_chunks: chunkIndex + 1, extraction_started_at: new Date().toISOString() })
      .eq('id', documentId)

    if (chunkIndex + 1 >= chunkPlan.length) {
      await markComplete(supabase, documentId)
      return
    }

    const continued = await triggerContinuation(documentId, chunkIndex + 1)
    if (!continued.ok) {
      await markFailed(
        supabase,
        documentId,
        `Chunk ${chunkIndex + 1}/${chunkPlan.length} merged, but failed to start chunk ${chunkIndex + 2}/${chunkPlan.length}: ${continued.error}`,
      )
    }
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
  let continuation: { chunkIndex: number; attempt?: number } | undefined
  try {
    const body = await req.json()
    documentId = body?.documentId
    continuation = body?._continuation
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

  // Internal continuation call (self-triggered from processChunk, see
  // triggerContinuation) — the document is already `processing` from the
  // entry call's atomic claim, so there's nothing to (re-)claim here, just
  // the next chunk's worth of work.
  if (continuation) {
    const { data: document } = await supabase
      .from('documents')
      .select('id, project_id, filename, chunk_plan')
      .eq('id', documentId)
      .maybeSingle()

    if (!document) {
      return jsonResponse({ error: 'Document not found' }, 404)
    }

    // deno-lint-ignore no-undef
    EdgeRuntime.waitUntil(
      processChunk(
        supabase,
        documentId,
        document.project_id,
        document.filename,
        document.chunk_plan as ChunkPlanEntry[],
        continuation.chunkIndex,
        continuation.attempt ?? 0,
      ),
    )

    return jsonResponse(
      {
        documentId,
        status: 'processing',
        chunk: continuation.chunkIndex + 1,
        attempt: (continuation.attempt ?? 0) + 1,
      },
      202,
    )
  }

  // External entry call. Single conditional update, not read-then-write:
  // two near-simultaneous requests for the same document could otherwise
  // both pass a separate status check before either wrote `processing`,
  // and both would kick off background tasks. The `.neq()` filter makes
  // claiming atomic. extraction_completed_chunks is deliberately NOT reset:
  // a retry resumes from the last merged chunk instead of restarting at 0.
  // Re-running merged chunks would be near-harmless factually (merge() is
  // idempotent for equal values) but would burn the whole document's model
  // quota again — which is exactly what exhausted it at chunk 19/26 on a
  // real run. chunk_plan and extraction_total_chunks are set at upload time
  // and untouched here.
  const { data: claimed, error: claimError } = await supabase
    .from('documents')
    .update({
      extraction_status: 'processing',
      extraction_started_at: new Date().toISOString(),
      extraction_error: null,
    })
    .eq('id', documentId)
    .neq('extraction_status', 'processing')
    .select('id, project_id, filename, chunk_plan, extraction_completed_chunks')

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

  const chunkPlan = document.chunk_plan as ChunkPlanEntry[] | null
  if (!chunkPlan || chunkPlan.length === 0) {
    await markFailed(supabase, documentId, 'Document has no chunk_plan — it was uploaded before client-side chunking landed, or upload-time splitting failed. Re-upload to fix.')
    return jsonResponse({ documentId, status: 'processing' }, 202)
  }

  const resumeFrom = Math.max(0, Math.min(document.extraction_completed_chunks ?? 0, chunkPlan.length))
  if (resumeFrom >= chunkPlan.length) {
    await markComplete(supabase, documentId)
    return jsonResponse({ documentId, status: 'complete', resumedFrom: resumeFrom }, 202)
  }

  // deno-lint-ignore no-undef
  EdgeRuntime.waitUntil(
    processChunk(supabase, documentId, document.project_id, document.filename, chunkPlan, resumeFrom),
  )

  return jsonResponse({ documentId, status: 'processing', resumedFrom: resumeFrom }, 202)
})
