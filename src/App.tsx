import { lazy, Suspense } from 'react'
import { Redirect, Route, Router, Switch } from 'wouter'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { AppShell } from '@/components/layout/AppShell'
import { DocumentsScreen } from '@/features/documents/DocumentsScreen'
import { Skeleton } from '@/components/ui/skeleton'
import { Callout } from '@/components/ui/callout'

// Route-level code splitting (docs/DESIGN_SYSTEM.md, "Performance") for
// every route except Documents, which stays eager since it's what a fresh
// visit lands on — lazy-loading the first screen would add a network
// waterfall instead of removing one.
const FactsReviewScreen = lazy(() =>
  import('@/features/review/FactsReviewScreen').then((m) => ({ default: m.FactsReviewScreen })),
)
// Document view (eligibility, narrative sections, citations, export) still
// renders its pre-Phase-3 implementation — docs/UI_ARCHITECTURE.md's build
// order is Documents -> Facts Review -> Document, one screen restyled per
// commit. Routed and split here now so the shell/nav/perf treatment is
// consistent across all three from this commit on.
const DocumentView = lazy(() => import('@/features/document/DocumentView').then((m) => ({ default: m.DocumentView })))

function RouteSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function ProjectRoutes({ projectId }: { projectId: string }) {
  return (
    <AppShell>
      <Switch>
        <Route path="/project/documents">
          <DocumentsScreen projectId={projectId} />
        </Route>
        <Route path="/project/review">
          <Suspense fallback={<RouteSkeleton />}>
            <FactsReviewScreen projectId={projectId} />
          </Suspense>
        </Route>
        <Route path="/project/document">
          <Suspense fallback={<RouteSkeleton />}>
            <DocumentView projectId={projectId} />
          </Suspense>
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
