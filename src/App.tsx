import { Redirect, Route, Switch } from 'wouter'

function ProjectPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">Project</h1>
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
