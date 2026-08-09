import { useState } from 'react'
import { Redirect, Route, Router, Switch } from 'wouter'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { UploadPanel } from '@/features/upload/UploadPanel'
import { FactsReview } from '@/features/review/FactsReview'
import { DocumentView } from '@/features/document/DocumentView'

const TABS = [
  { id: 'documents', label: 'Documents' },
  { id: 'review', label: 'Facts Review' },
  { id: 'document', label: 'Document' },
] as const

type TabId = (typeof TABS)[number]['id']

function ProjectPage() {
  const { data: projectId, isLoading, isError, error } = useEnsureProject()
  const [tab, setTab] = useState<TabId>('documents')

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </div>
    )
  }

  if (isError || !projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">
          Failed to load project: {(error as Error)?.message}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 p-10">
      <h1 className="text-2xl font-semibold">Project</h1>

      <div className="flex gap-1 rounded-lg border p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              tab === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'documents' && <UploadPanel projectId={projectId} />}
      {tab === 'review' && <FactsReview projectId={projectId} />}
      {tab === 'document' && <DocumentView projectId={projectId} />}
    </div>
  )
}

// Vite's BASE_URL is '/' for local dev/preview and the configured subpath
// (e.g. '/conexus/') when built for GitHub Pages; wouter wants it without
// the trailing slash.
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <Router base={ROUTER_BASE}>
      <Switch>
        <Route path="/project" component={ProjectPage} />
        <Route path="/">
          <Redirect to="/project" />
        </Route>
      </Switch>
    </Router>
  )
}
