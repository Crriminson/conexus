import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { ProgressRail } from './ProgressRail'

const TABS = [
  { path: '/project/documents', label: 'Documents' },
  { path: '/project/review', label: 'Facts Review' },
  { path: '/project/draft', label: 'Draft' },
  { path: '/project/audit', label: 'Audit Log' },
] as const

// Eligibility gets a badge slot here once the Draft screen builds it
// (docs/UI_ARCHITECTURE.md: "a live at-a-glance signal... shell-level
// chrome, not one-tab content") — not added yet, that's a later commit.
export function AppShell({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-paper-raised">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Logo />

          <nav className="flex gap-1 rounded-lg border border-hairline bg-paper p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.path}
                href={tab.path}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  location === tab.path
                    ? 'bg-ink text-paper'
                    : 'text-ink-muted hover:bg-paper-recessed hover:text-ink',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <ProgressRail projectId={projectId} />

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
