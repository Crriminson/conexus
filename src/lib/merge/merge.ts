import type { Field, IssuerFacts } from '@/types/facts'
import type { CompanyFacts } from '@/types/facts/company'
import type { FinancialsFacts } from '@/types/facts/financials'
import type { CapitalStructureFacts } from '@/types/facts/capitalStructure'
import type { PromoterRecord } from '@/types/facts/promoters'
import type { LitigationRecord } from '@/types/facts/litigation'
import type { RelatedPartyRecord } from '@/types/facts/relatedParties'
import type {
  ExtractedFacts,
  ExtractedLeaf,
  ExtractedLitigationRecord,
  ExtractedPromoterRecord,
  ExtractedRelatedPartyRecord,
  FactConflict,
  MergeEvent,
  MergeResult,
} from './types'

// Optional seams for deterministic unit tests. Real callers can omit these
// and get real timestamps/ids — merge() stays a pure function either way
// (no DB calls, no side effects; these are just injected instead of reached
// for globally).
export interface MergeDeps {
  now?: () => string
  generateId?: () => string
}

interface FieldMergeOutcome<T> {
  field: Field<T>
  written: boolean
  skipped: boolean
  conflict: FactConflict | null
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// The rule that governs everything: extraction proposes, humans dispose.
// Never silently overwrites `confirmed` or `edited` — a differing proposal
// there raises a conflict instead of mutating the fact.
function mergeLeaf<T>(
  fieldPath: string,
  existing: Field<T>,
  extracted: ExtractedLeaf<T> | undefined,
  documentId: string,
  now: string,
  generateId: () => string,
): FieldMergeOutcome<T> {
  if (!extracted || extracted.value === null || extracted.value === undefined) {
    return { field: existing, written: false, skipped: false, conflict: null }
  }

  const proposedConfidence = extracted.confidence ?? 0
  const overwritten: Field<T> = {
    value: extracted.value,
    confidence: extracted.confidence,
    sourceDocId: documentId,
    sourcePage: extracted.sourcePage,
    status: 'ai',
    updatedAt: now,
  }

  switch (existing.status) {
    case 'empty':
      return { field: overwritten, written: true, skipped: false, conflict: null }

    case 'ai': {
      const existingConfidence = existing.confidence ?? 0
      if (proposedConfidence > existingConfidence) {
        return { field: overwritten, written: true, skipped: false, conflict: null }
      }
      return { field: existing, written: false, skipped: true, conflict: null }
    }

    case 'confirmed':
    case 'edited': {
      if (valuesEqual(existing.value, extracted.value)) {
        return { field: existing, written: false, skipped: true, conflict: null }
      }
      const conflict: FactConflict = {
        id: generateId(),
        fieldPath,
        currentValue: existing.value,
        currentStatus: existing.status,
        proposedValue: extracted.value,
        proposedConfidence,
        proposedSourceDocId: documentId,
        proposedSourcePage: extracted.sourcePage ?? 0,
        raisedAt: now,
        resolution: 'pending',
      }
      return { field: existing, written: false, skipped: false, conflict }
    }

    default:
      return { field: existing, written: false, skipped: false, conflict: null }
  }
}

interface DomainMergeResult {
  domain: Record<string, Field<unknown>>
  written: string[]
  skipped: string[]
  conflicts: FactConflict[]
}

function mergeDomain(
  domainName: string,
  existing: Record<string, Field<unknown>>,
  extracted: Record<string, ExtractedLeaf<unknown>>,
  documentId: string,
  now: string,
  generateId: () => string,
): DomainMergeResult {
  const domain: Record<string, Field<unknown>> = { ...existing }
  const written: string[] = []
  const skipped: string[] = []
  const conflicts: FactConflict[] = []

  for (const key of Object.keys(existing)) {
    const fieldPath = `${domainName}.${key}`
    const outcome = mergeLeaf(fieldPath, existing[key], extracted[key], documentId, now, generateId)
    domain[key] = outcome.field
    if (outcome.written) written.push(fieldPath)
    if (outcome.skipped) skipped.push(fieldPath)
    if (outcome.conflict) conflicts.push(outcome.conflict)
  }

  return { domain, written, skipped, conflicts }
}

interface RecordsMergeResult<R> {
  records: R[]
  written: string[]
  skipped: string[]
  conflicts: FactConflict[]
}

function mergePromoters(
  existingRecords: PromoterRecord[],
  extractedRecords: ExtractedPromoterRecord[],
  documentId: string,
  now: string,
  generateId: () => string,
): RecordsMergeResult<PromoterRecord> {
  const written: string[] = []
  const skipped: string[] = []
  const conflicts: FactConflict[] = []

  const keyOf = (name: string | null) => normalize(name)
  const existingByKey = new Map(existingRecords.map((r) => [keyOf(r.name.value), r]))
  const matchedKeys = new Set<string>()

  function track<T>(fieldPath: string, outcome: FieldMergeOutcome<T>): Field<T> {
    if (outcome.written) written.push(fieldPath)
    if (outcome.skipped) skipped.push(fieldPath)
    if (outcome.conflict) conflicts.push(outcome.conflict)
    return outcome.field
  }

  function emptyLeaf<T>(): Field<T> {
    return { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: now }
  }

  function newLeaf<T>(leaf: ExtractedLeaf<T>): Field<T> {
    if (leaf.value === null || leaf.value === undefined) return emptyLeaf<T>()
    return {
      value: leaf.value,
      confidence: leaf.confidence,
      sourceDocId: documentId,
      sourcePage: leaf.sourcePage,
      status: 'ai',
      updatedAt: now,
    }
  }

  const records: PromoterRecord[] = extractedRecords.map((extracted) => {
    const key = keyOf(extracted.name.value)
    const existing = existingByKey.get(key)

    if (existing) {
      matchedKeys.add(key)
      const path = (field: string) => `promoters[${existing.id}].${field}`
      return {
        id: existing.id,
        name: track(path('name'), mergeLeaf(path('name'), existing.name, extracted.name, documentId, now, generateId)),
        panOrId: track(path('panOrId'), mergeLeaf(path('panOrId'), existing.panOrId, extracted.panOrId, documentId, now, generateId)),
        din: track(path('din'), mergeLeaf(path('din'), existing.din, extracted.din, documentId, now, generateId)),
        shareholdingPercent: track(
          path('shareholdingPercent'),
          mergeLeaf(path('shareholdingPercent'), existing.shareholdingPercent, extracted.shareholdingPercent, documentId, now, generateId),
        ),
        category: track(path('category'), mergeLeaf(path('category'), existing.category, extracted.category, documentId, now, generateId)),
      }
    }

    const newId = generateId()
    const path = (field: string) => `promoters[${newId}].${field}`
    const name = newLeaf(extracted.name)
    if (name.status === 'ai') written.push(path('name'))
    const panOrId = newLeaf(extracted.panOrId)
    if (panOrId.status === 'ai') written.push(path('panOrId'))
    const din = newLeaf(extracted.din)
    if (din.status === 'ai') written.push(path('din'))
    const shareholdingPercent = newLeaf(extracted.shareholdingPercent)
    if (shareholdingPercent.status === 'ai') written.push(path('shareholdingPercent'))
    const category = newLeaf(extracted.category)
    if (category.status === 'ai') written.push(path('category'))

    return { id: newId, name, panOrId, din, shareholdingPercent, category }
  })

  const untouched = existingRecords.filter((r) => !matchedKeys.has(keyOf(r.name.value)))

  return { records: [...records, ...untouched], written, skipped, conflicts }
}

function litigationKey(caseNumber: string | null, parties: string | null, nature: string | null): string {
  const normalizedCase = normalize(caseNumber)
  if (normalizedCase) return `case:${normalizedCase}`
  return `hash:${normalize(parties)}|${normalize(nature)}`
}

function mergeLitigation(
  existingRecords: LitigationRecord[],
  extractedRecords: ExtractedLitigationRecord[],
  documentId: string,
  now: string,
  generateId: () => string,
): RecordsMergeResult<LitigationRecord> {
  const written: string[] = []
  const skipped: string[] = []
  const conflicts: FactConflict[] = []

  const keyOf = (r: { caseNumber: { value: string | null }; partiesInvolved: { value: string | null }; natureOfProceeding: { value: string | null } }) =>
    litigationKey(r.caseNumber.value, r.partiesInvolved.value, r.natureOfProceeding.value)

  const existingByKey = new Map(existingRecords.map((r) => [keyOf(r), r]))
  const matchedKeys = new Set<string>()

  function track<T>(fieldPath: string, outcome: FieldMergeOutcome<T>): Field<T> {
    if (outcome.written) written.push(fieldPath)
    if (outcome.skipped) skipped.push(fieldPath)
    if (outcome.conflict) conflicts.push(outcome.conflict)
    return outcome.field
  }

  function emptyLeaf<T>(): Field<T> {
    return { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: now }
  }

  function newLeaf<T>(leaf: ExtractedLeaf<T>): Field<T> {
    if (leaf.value === null || leaf.value === undefined) return emptyLeaf<T>()
    return {
      value: leaf.value,
      confidence: leaf.confidence,
      sourceDocId: documentId,
      sourcePage: leaf.sourcePage,
      status: 'ai',
      updatedAt: now,
    }
  }

  const records: LitigationRecord[] = extractedRecords.map((extracted) => {
    const key = keyOf(extracted)
    const existing = existingByKey.get(key)

    if (existing) {
      matchedKeys.add(key)
      const path = (field: string) => `litigation[${existing.id}].${field}`
      return {
        id: existing.id,
        caseNumber: track(path('caseNumber'), mergeLeaf(path('caseNumber'), existing.caseNumber, extracted.caseNumber, documentId, now, generateId)),
        forum: track(path('forum'), mergeLeaf(path('forum'), existing.forum, extracted.forum, documentId, now, generateId)),
        partiesInvolved: track(
          path('partiesInvolved'),
          mergeLeaf(path('partiesInvolved'), existing.partiesInvolved, extracted.partiesInvolved, documentId, now, generateId),
        ),
        natureOfProceeding: track(
          path('natureOfProceeding'),
          mergeLeaf(path('natureOfProceeding'), existing.natureOfProceeding, extracted.natureOfProceeding, documentId, now, generateId),
        ),
        amountInvolved: track(
          path('amountInvolved'),
          mergeLeaf(path('amountInvolved'), existing.amountInvolved, extracted.amountInvolved, documentId, now, generateId),
        ),
        status: track(path('status'), mergeLeaf(path('status'), existing.status, extracted.status, documentId, now, generateId)),
      }
    }

    const newId = generateId()
    const path = (field: string) => `litigation[${newId}].${field}`
    const caseNumber = newLeaf(extracted.caseNumber)
    if (caseNumber.status === 'ai') written.push(path('caseNumber'))
    const forum = newLeaf(extracted.forum)
    if (forum.status === 'ai') written.push(path('forum'))
    const partiesInvolved = newLeaf(extracted.partiesInvolved)
    if (partiesInvolved.status === 'ai') written.push(path('partiesInvolved'))
    const natureOfProceeding = newLeaf(extracted.natureOfProceeding)
    if (natureOfProceeding.status === 'ai') written.push(path('natureOfProceeding'))
    const amountInvolved = newLeaf(extracted.amountInvolved)
    if (amountInvolved.status === 'ai') written.push(path('amountInvolved'))
    const status = newLeaf(extracted.status)
    if (status.status === 'ai') written.push(path('status'))

    return { id: newId, caseNumber, forum, partiesInvolved, natureOfProceeding, amountInvolved, status }
  })

  const untouched = existingRecords.filter((r) => !matchedKeys.has(keyOf(r)))

  return { records: [...records, ...untouched], written, skipped, conflicts }
}

function mergeRelatedParties(
  existingRecords: RelatedPartyRecord[],
  extractedRecords: ExtractedRelatedPartyRecord[],
  documentId: string,
  now: string,
  generateId: () => string,
): RecordsMergeResult<RelatedPartyRecord> {
  const written: string[] = []
  const skipped: string[] = []
  const conflicts: FactConflict[] = []

  const keyOf = (r: { partyName: { value: string | null }; natureOfTransaction: { value: string | null } }) =>
    `${normalize(r.partyName.value)}|${normalize(r.natureOfTransaction.value)}`

  const existingByKey = new Map(existingRecords.map((r) => [keyOf(r), r]))
  const matchedKeys = new Set<string>()

  function track<T>(fieldPath: string, outcome: FieldMergeOutcome<T>): Field<T> {
    if (outcome.written) written.push(fieldPath)
    if (outcome.skipped) skipped.push(fieldPath)
    if (outcome.conflict) conflicts.push(outcome.conflict)
    return outcome.field
  }

  function emptyLeaf<T>(): Field<T> {
    return { value: null, confidence: null, sourceDocId: null, sourcePage: null, status: 'empty', updatedAt: now }
  }

  function newLeaf<T>(leaf: ExtractedLeaf<T>): Field<T> {
    if (leaf.value === null || leaf.value === undefined) return emptyLeaf<T>()
    return {
      value: leaf.value,
      confidence: leaf.confidence,
      sourceDocId: documentId,
      sourcePage: leaf.sourcePage,
      status: 'ai',
      updatedAt: now,
    }
  }

  const records: RelatedPartyRecord[] = extractedRecords.map((extracted) => {
    const key = keyOf(extracted)
    const existing = existingByKey.get(key)

    if (existing) {
      matchedKeys.add(key)
      const path = (field: string) => `relatedParties[${existing.id}].${field}`
      return {
        id: existing.id,
        partyName: track(path('partyName'), mergeLeaf(path('partyName'), existing.partyName, extracted.partyName, documentId, now, generateId)),
        relationship: track(
          path('relationship'),
          mergeLeaf(path('relationship'), existing.relationship, extracted.relationship, documentId, now, generateId),
        ),
        natureOfTransaction: track(
          path('natureOfTransaction'),
          mergeLeaf(path('natureOfTransaction'), existing.natureOfTransaction, extracted.natureOfTransaction, documentId, now, generateId),
        ),
        amount: track(path('amount'), mergeLeaf(path('amount'), existing.amount, extracted.amount, documentId, now, generateId)),
        transactionDate: track(
          path('transactionDate'),
          mergeLeaf(path('transactionDate'), existing.transactionDate, extracted.transactionDate, documentId, now, generateId),
        ),
      }
    }

    const newId = generateId()
    const path = (field: string) => `relatedParties[${newId}].${field}`
    const partyName = newLeaf(extracted.partyName)
    if (partyName.status === 'ai') written.push(path('partyName'))
    const relationship = newLeaf(extracted.relationship)
    if (relationship.status === 'ai') written.push(path('relationship'))
    const natureOfTransaction = newLeaf(extracted.natureOfTransaction)
    if (natureOfTransaction.status === 'ai') written.push(path('natureOfTransaction'))
    const amount = newLeaf(extracted.amount)
    if (amount.status === 'ai') written.push(path('amount'))
    const transactionDate = newLeaf(extracted.transactionDate)
    if (transactionDate.status === 'ai') written.push(path('transactionDate'))

    return { id: newId, partyName, relationship, natureOfTransaction, amount, transactionDate }
  })

  const untouched = existingRecords.filter((r) => !matchedKeys.has(keyOf(r)))

  return { records: [...records, ...untouched], written, skipped, conflicts }
}

export function merge(existing: IssuerFacts, extracted: ExtractedFacts, deps: MergeDeps = {}): MergeResult {
  const now = deps.now ? deps.now() : new Date().toISOString()
  const generateId = deps.generateId ?? (() => crypto.randomUUID())
  const documentId = extracted.documentId

  const fieldsWritten: string[] = []
  const fieldsSkipped: string[] = []
  const conflicts: FactConflict[] = []

  function collect(result: { written: string[]; skipped: string[]; conflicts: FactConflict[] }) {
    fieldsWritten.push(...result.written)
    fieldsSkipped.push(...result.skipped)
    conflicts.push(...result.conflicts)
  }

  const company = mergeDomain(
    'company',
    existing.company as unknown as Record<string, Field<unknown>>,
    extracted.company as unknown as Record<string, ExtractedLeaf<unknown>>,
    documentId,
    now,
    generateId,
  )
  collect(company)

  const financials = mergeDomain(
    'financials',
    existing.financials as unknown as Record<string, Field<unknown>>,
    extracted.financials as unknown as Record<string, ExtractedLeaf<unknown>>,
    documentId,
    now,
    generateId,
  )
  collect(financials)

  const capitalStructure = mergeDomain(
    'capitalStructure',
    existing.capitalStructure as unknown as Record<string, Field<unknown>>,
    extracted.capitalStructure as unknown as Record<string, ExtractedLeaf<unknown>>,
    documentId,
    now,
    generateId,
  )
  collect(capitalStructure)

  const promoters = mergePromoters(existing.promoters, extracted.promoters, documentId, now, generateId)
  collect(promoters)

  const litigation = mergeLitigation(existing.litigation, extracted.litigation, documentId, now, generateId)
  collect(litigation)

  const relatedParties = mergeRelatedParties(existing.relatedParties, extracted.relatedParties, documentId, now, generateId)
  collect(relatedParties)

  const facts: IssuerFacts = {
    company: company.domain as unknown as CompanyFacts,
    financials: financials.domain as unknown as FinancialsFacts,
    capitalStructure: capitalStructure.domain as unknown as CapitalStructureFacts,
    promoters: promoters.records,
    litigation: litigation.records,
    relatedParties: relatedParties.records,
  }

  const event: MergeEvent = {
    id: generateId(),
    documentId,
    ranAt: now,
    fieldsWritten,
    fieldsSkipped,
    conflictsRaised: conflicts.map((c) => c.id),
  }

  return { facts, conflicts, event }
}

export type {
  ExtractedCapitalStructureFacts,
  ExtractedCompanyFacts,
  ExtractedFacts,
  ExtractedFinancialsFacts,
  ExtractedLeaf,
  ExtractedLitigationRecord,
  ExtractedPromoterRecord,
  ExtractedRelatedPartyRecord,
  FactConflict,
  MergeEvent,
  MergeResult,
} from './types'
