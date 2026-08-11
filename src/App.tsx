import { Redirect, Route, Router, Switch } from 'wouter'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { AppShell } from '@/components/layout/AppShell'
import { DocumentsScreen } from '@/features/documents/DocumentsScreen'
import { FactsReview } from '@/features/review/FactsReview'
import { DocumentView } from '@/features/document/DocumentView'
import { Skeleton } from '@/components/ui/skeleton'
import { Callout } from '@/components/ui/callout'

// Facts Review and Document still render their pre-Phase-3 implementations
// (unstyled, but fully working) — docs/UI_ARCHITECTURE.md's build order is
// Documents -> Facts Review -> Document, one screen restyled per commit.
// They're routed here now so the shell/nav exists for all three from this
// commit on, rather than adding routing again with each later screen.
function ProjectRoutes({ projectId }: { projectId: string }) {
  return (
    <AppShell>
      <Switch>
        <Route path="/project/documents">
          <DocumentsScreen projectId={projectId} />
        </Route>
        <Route path="/project/review">
          <FactsReview projectId={projectId} />
        </Route>
        <Route path="/project/document">
          <DocumentView projectId={projectId} />
        </Route>
      </Switch>
    </AppShell>
  )
}

function ProjectGate() {
  const { data: projectId, isLoading, isError, error } = useEnsureProject()

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError || !projectId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center p-10">
        <Callout tone="signature" title="Failed to load project">
          {(error as Error)?.message}
        </Callout>
      </div>
    )
  }

  return <ProjectRoutes projectId={projectId} />
}

// Vite's BASE_URL is '/' for local dev/preview and the configured subpath
// (e.g. '/conexus/') when built for GitHub Pages; wouter wants it without
// the trailing slash.
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <Router base={ROUTER_BASE}>
      <Switch>
        <Route path="/">
          <Redirect to="/project/documents" />
        </Route>
        <Route path="/project">
          <Redirect to="/project/documents" />
        </Route>
        <Route path="/project/:tab">
          <ProjectGate />
        </Route>
      </Switch>
    </Router>
  )
}
