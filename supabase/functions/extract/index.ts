import { createClient } from 'npm:@supabase/supabase-js@2'
import { callLLM } from '../_shared/callLLM.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STORAGE_BUCKET = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'documents'

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

function coerceExtractedFacts(raw: unknown) {
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
  }
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

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id, filename, storage_path')
    .eq('id', documentId)
    .single()

  if (documentError || !document) {
    return jsonResponse({ error: 'Document not found' }, 404)
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(document.storage_path)

  if (downloadError || !fileBlob) {
    return jsonResponse({ error: `Failed to download document: ${downloadError?.message}` }, 500)
  }

  const fileBytes = new Uint8Array(await fileBlob.arrayBuffer())

  let rawText: string
  try {
    rawText = await callLLM({
      prompt: buildExtractionPrompt(document.filename),
      file: { bytes: fileBytes, mimeType: fileBlob.type || 'application/pdf' },
      responseMimeType: 'application/json',
    })
  } catch (err) {
    return jsonResponse({ error: `LLM call failed: ${(err as Error).message}` }, 502)
  }

  const parsed = parseModelJson(rawText)
  if (parsed === null) {
    return jsonResponse({ error: 'Failed to parse model output as JSON', raw: rawText }, 502)
  }

  const extracted = coerceExtractedFacts(parsed)
  return jsonResponse({ documentId, extracted }, 200)
})
