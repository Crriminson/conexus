import { Redirect, Route, Switch } from 'wouter'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { UploadPanel } from '@/features/upload/UploadPanel'

function ProjectPage() {
  const { data: projectId, isLoading, isError, error } = useEnsureProject()

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
      <UploadPanel projectId={projectId} />
    </div>
  )
}

export default function App() {
  return (
    <Switch>
      <Route path="/project" component={ProjectPage} />
      <Route path="/">
        <Redirect to="/project" />
      </Route>
    </Switch>
  )
}
