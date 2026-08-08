import type { Field, IssuerFacts } from '@/types/facts'
import { useProject } from '@/hooks/useProject'
import { useDocuments } from '@/hooks/useDocuments'
import { useUpdateFacts } from '@/hooks/useUpdateFacts'
import { useResolveConflict } from '@/hooks/useResolveConflict'
import { useOpenSource } from '@/hooks/useOpenSource'
import { FieldRow } from './FieldRow'

// Field ordering and labels are declared rather than derived from
// Object.keys, so the screen reads in a sensible order instead of whatever
// order the type happens to be written in.
const FLAT_DOMAINS = [
  {
    key: 'company' as const,
    title: 'Company',
    fields: [
      ['legalName', 'Legal name'],
      ['cin', 'CIN'],
      ['incorporationDate', 'Incorporation date'],
      ['registeredOfficeAddress', 'Registered office'],
      ['industry', 'Industry'],
      ['businessDescription', 'Business description'],
    ],
  },
  {
    key: 'financials' as const,
    title: 'Financials',
    fields: [
      ['fiscalYearEnd', 'Fiscal year end'],
      ['revenue', 'Revenue'],
      ['ebitda', 'EBITDA'],
      ['netProfit', 'Net profit'],
      ['totalAssets', 'Total assets'],
      ['totalLiabilities', 'Total liabilities'],
      ['netWorth', 'Net worth'],
    ],
  },
  {
    key: 'capitalStructure' as const,
    title: 'Capital structure',
    fields: [
      ['authorizedCapital', 'Authorized capital'],
      ['issuedCapital', 'Issued capital'],
      ['paidUpCapital', 'Paid-up capital'],
      ['faceValuePerShare', 'Face value per share'],
      ['totalSharesOutstanding', 'Shares outstanding'],
    ],
  },
]

const ARRAY_DOMAINS = [
  {
    key: 'promoters' as const,
    title: 'Promoters',
    labelField: 'name',
    fields: [
      ['name', 'Name'],
      ['panOrId', 'PAN / ID'],
      ['din', 'DIN'],
      ['shareholdingPercent', 'Shareholding %'],
      ['category', 'Category'],
    ],
  },
  {
    key: 'litigation' as const,
    title: 'Litigation',
    labelField: 'caseNumber',
    fields: [
      ['caseNumber', 'Case number'],
      ['forum', 'Forum'],
      ['partiesInvolved', 'Parties'],
      ['natureOfProceeding', 'Nature'],
      ['amountInvolved', 'Amount'],
      ['status', 'Status'],
    ],
  },
  {
    key: 'relatedParties' as const,
    title: 'Related parties',
    labelField: 'partyName',
    fields: [
      ['partyName', 'Party'],
      ['relationship', 'Relationship'],
      ['natureOfTransaction', 'Transaction'],
      ['amount', 'Amount'],
      ['transactionDate', 'Date'],
    ],
  },
]

function countByStatus(facts: IssuerFacts) {
  const counts = { empty: 0, ai: 0, confirmed: 0, edited: 0 }
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if ('status' in node && 'value' in node) {
      const status = (node as Field<unknown>).status
      counts[status] = (counts[status] ?? 0) + 1
      return
    }
    if (Array.isArray(node)) node.forEach(walk)
    else Object.values(node as Record<string, unknown>).forEach(walk)
  }
  walk(facts)
  return counts
}

export function FactsReview({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error } = useProject(projectId)
  const { data: documents } = useDocuments(projectId)
  const updateFacts = useUpdateFacts(projectId)
  const resolveConflict = useResolveConflict(projectId)
  const openSource = useOpenSource()

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading facts…</p>
  if (isError || !project) {
    return <p className="text-sm text-destructive">Failed to load facts: {(error as Error)?.message}</p>
  }

  const docs = documents ?? []
  const counts = countByStatus(project.facts)
  const pendingConflicts = project.conflicts.filter((c) => c.resolution === 'pending')
  const isBusy = updateFacts.isPending || resolveConflict.isPending

  const conflictsFor = (path: string) => project.conflicts.filter((c) => c.fieldPath === path)

  const rowProps = {
    events: project.merge_events,
    documents: docs,
    isBusy,
    onConfirm: (path: string) => updateFacts.mutate({ path, status: 'confirmed' }),
    onEdit: (path: string, value: unknown) => updateFacts.mutate({ path, status: 'edited', value }),
    onResolve: (conflictId: string, resolution: 'kept_current' | 'accepted_proposed') =>
      resolveConflict.mutate({ conflictId, resolution }),
    onOpenSource: (storagePath: string, page: number | null) => {
      openSource(storagePath, page).catch(() => {})
    },
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
          {counts.confirmed} confirmed
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
          {counts.edited} edited
        </span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
          {counts.ai} from AI
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
          {counts.empty} empty
        </span>
        {pendingConflicts.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">
            {pendingConflicts.length} unresolved conflict{pendingConflicts.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {(updateFacts.isError || resolveConflict.isError) && (
        <p className="text-sm text-destructive">
          {((updateFacts.error ?? resolveConflict.error) as Error)?.message}
        </p>
      )}

      {FLAT_DOMAINS.map((domain) => (
        <section key={domain.key} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{domain.title}</h2>
          <div className="rounded-lg border px-3">
            {domain.fields.map(([fieldKey, label]) => {
              const path = `${domain.key}.${fieldKey}`
              // The domain interfaces have no index signature (deliberately —
              // they're exact shapes), so reaching them by a string key needs
              // the `unknown` hop. Field existence is re-checked below.
              const field = (project.facts[domain.key] as unknown as Record<string, Field<unknown>>)[
                fieldKey
              ]
              if (!field) return null
              return (
                <FieldRow
                  key={path}
                  path={path}
                  label={label}
                  field={field}
                  conflicts={conflictsFor(path)}
                  {...rowProps}
                />
              )
            })}
          </div>
        </section>
      ))}

      {ARRAY_DOMAINS.map((domain) => {
        const records = (project.facts[domain.key] ?? []) as unknown as Array<Record<string, unknown>>
        return (
          <section key={domain.key} className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">
              {domain.title} <span className="text-muted-foreground">({records.length})</span>
            </h2>

            {records.length === 0 && (
              <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                None extracted.
              </p>
            )}

            {records.map((record, index) => {
              const recordId = record.id as string
              const heading = (record[domain.labelField] as Field<unknown> | undefined)?.value
              return (
                <div key={recordId} className="rounded-lg border px-3 py-1">
                  <p className="border-b py-1 text-xs font-medium">
                    {heading ? String(heading) : `${domain.title} ${index + 1}`}
                  </p>
                  {domain.fields.map(([fieldKey, label]) => {
                    const path = `${domain.key}[${recordId}].${fieldKey}`
                    const field = record[fieldKey] as Field<unknown> | undefined
                    if (!field) return null
                    return (
                      <FieldRow
                        key={path}
                        path={path}
                        label={label}
                        field={field}
                        conflicts={conflictsFor(path)}
                        {...rowProps}
                      />
                    )
                  })}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
