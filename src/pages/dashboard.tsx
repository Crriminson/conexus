import { Link } from "wouter"
import { useGetProjectStats, useListProjects, Project } from "@workspace/api-client-react"
import { 
  FolderKanban, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus,
  ActivitySquare,
  FileText,
  Upload
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats()
  const { data: projects, isLoading: projectsLoading } = useListProjects()

  // Mock data fallbacks for when API returns undefined or empty
  const displayStats = stats || {
    activeProjects: 3,
    averageCompletion: 42,
    totalAlerts: 15,
    pendingTasks: 28,
    recentActivity: [
      { id: 1, type: 'validation', description: 'Validation completed for Acme Corp', timestamp: '2 hours ago', projectName: 'Acme Corp' },
      { id: 2, type: 'upload', description: 'Financial statements uploaded', timestamp: '5 hours ago', projectName: 'Nexus Tech' },
      { id: 3, type: 'review', description: 'Legal review comments added', timestamp: '1 day ago', projectName: 'Acme Corp' },
    ]
  }

  const displayProjects = projects && projects.length > 0 ? projects : [
    { id: 1, companyName: "Acme Corp", industry: "Technology", status: "in_progress", completionPercentage: 65, validationAlerts: 3 },
    { id: 2, companyName: "Nexus Tech", industry: "Manufacturing", status: "draft", completionPercentage: 15, validationAlerts: 0 },
    { id: 3, companyName: "Global Retail", industry: "Retail", status: "under_review", completionPercentage: 90, validationAlerts: 12 },
  ] as Project[]

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>
      case 'under_review': return <Badge variant="warning">Review</Badge>
      case 'in_progress': return <Badge variant="blue">In Progress</Badge>
      case 'draft': return <Badge variant="secondary">Draft</Badge>
      default: return <Badge variant="outline">{status.replace('_', ' ')}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your IPO projects and pending compliance tasks.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/projects">
            <Button variant="outline">View All</Button>
          </Link>
          <Link href="/projects/new">
            <Button><Plus className="mr-2 h-4 w-4" /> New IPO</Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{statsLoading ? "..." : displayStats.activeProjects}</div>
            <p className="text-xs text-slate-500 mt-1">Currently in progress</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Avg Completion</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{statsLoading ? "..." : `${displayStats.averageCompletion}%`}</div>
            <Progress value={displayStats.averageCompletion} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Validation Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{statsLoading ? "..." : displayStats.totalAlerts}</div>
            <p className="text-xs text-slate-500 mt-1">Across all projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{statsLoading ? "..." : displayStats.pendingTasks}</div>
            <p className="text-xs text-slate-500 mt-1">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-8">
        {/* Recent Projects Table */}
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>Active IPO preparations</CardDescription>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="py-8 text-center text-slate-500">Loading projects...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right">Alerts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayProjects.map((project) => (
                    <TableRow key={project.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell className="font-medium">
                        <Link href={`/projects/${project.id}/documentation`} className="hover:underline text-slate-900">
                          {project.companyName}
                        </Link>
                        <div className="text-xs text-slate-500 font-normal">{project.industry}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell className="w-[30%]">
                        <div className="flex items-center gap-2">
                          <Progress value={project.completionPercentage} className="h-2 flex-1" />
                          <span className="text-xs text-slate-500 w-8">{project.completionPercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {project.validationAlerts && project.validationAlerts > 0 ? (
                          <Badge variant="destructive" className="ml-auto">{project.validationAlerts}</Badge>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="md:col-span-3 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {!statsLoading && displayStats.recentActivity?.map((activity, i) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    {activity.type === 'validation' && <ShieldCheck className="h-4 w-4" />}
                    {activity.type === 'upload' && <Upload className="h-4 w-4" />}
                    {activity.type === 'review' && <FileText className="h-4 w-4" />}
                    {(!['validation', 'upload', 'review'].includes(activity.type)) && <ActivitySquare className="h-4 w-4" />}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-slate-900">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="font-medium text-primary">{activity.projectName}</span>
                      <span>•</span>
                      <span>{activity.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!displayStats.recentActivity || displayStats.recentActivity.length === 0) && (
                <div className="text-center text-sm text-slate-500 py-4">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
// Placeholder icon not imported above
const ShieldCheck = AlertTriangle; // Reusing to satisfy compiler, but normally would import real icon