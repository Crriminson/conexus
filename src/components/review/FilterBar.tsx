import type { FieldStatus } from '@/types/facts'
import type { FactStatusCounts } from '@/lib/facts/factList'
import { cn } from '@/lib/utils'

export type StatusFilter = 'all' | FieldStatus

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI-proposed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'edited', label: 'Edited' },
  { key: 'empty', label: 'Empty' },
]

export interface FilterBarProps {
  counts: FactStatusCounts
  activeFilter: StatusFilter
  onFilterChange: (filter: StatusFilter) => void
  domains: { key: string; title: string }[]
}

/**
 * Isolates "just the AI-proposed fields still needing a look" out of 37,
 * instead of scrolling a flat list (docs/UI_ARCHITECTURE.md's density
 * handling) — plus jump links straight to any domain section.
 */
export function FilterBar({ counts, activeFilter, onFilterChange, domains }: FilterBarProps) {
  const total = counts.empty + counts.ai + counts.confirmed + counts.edited

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const count = filter.key === 'all' ? total : counts[filter.key]
          const isActive = activeFilter === filter.key
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => onFilterChange(filter.key)}
              aria-pressed={isActive}
              className={cn(
                'interactive rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out',
                isActive
                  ? 'border-ink bg-ink text-paper'
                  : 'border-hairline bg-paper-raised text-ink-muted hover:text-ink',
              )}
            >
              {filter.label} <span className="font-data tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
        {domains.map((domain) => (
          <a
            key={domain.key}
            href={`#domain-${domain.key}`}
            className="interactive rounded-sm underline-offset-2 hover:text-ink hover:underline"
          >
            {domain.title}
          </a>
        ))}
      </div>
    </div>
  )
}
