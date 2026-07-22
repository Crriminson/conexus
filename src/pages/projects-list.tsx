import { Link } from "wouter"
import { useListProjects, useDeleteProject, Project } from "@workspace/api-client-react"
import { Plus, Search, MoreHorizontal, Trash2, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { getListProjectsQueryKey } from "@workspace/api-client-react"

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteId, setDeleteId] = useState<number | null>(null)
  
  const { data: projects, isLoading } = useListProjects()
  const deleteProject = useDeleteProject()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Mock data fallback
  const displayProjects = projects && projects.length > 0 ? projects : [
    { id: 1, companyName: "Acme Corp", industry: "Technology", status: "in_progress", completionPercentage: 65, validationAlerts: 3, incorporationYear: 2015, createdAt: "2023-10-01" },
    { id: 2, companyName: "Nexus Tech", industry: "Manufacturing", status: "draft", completionPercentage: 15, validationAlerts: 0, incorporationYear: 2018, createdAt: "2023-10-15" },
    { id: 3, companyName: "Global Retail", industry: "Retail", status: "under_review", completionPercentage: 90, validationAlerts: 12, incorporationYear: 2010, createdAt: "2023-09-20" },
    { id: 4, companyName: "HealthPlus", industry: "Healthcare", status: "approved", completionPercentage: 100, validationAlerts: 0, incorporationYear: 2005, createdAt: "2023-08-10" },
  ] as Project[]

  const filteredProjects = displayProjects.filter(p => 
    p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.industry.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>
      case 'under_review': return <Badge variant="warning">Review</Badge>
      case 'in_progress': return <Badge variant="blue">In Progress</Badge>
      case 'draft': return <Badge variant="secondary">Draft</Badge>
      default: return <Badge variant="outline">{status.replace('_', ' ')}</Badge>
    }
  }

  function handleDelete() {
    if (!deleteId) return
    
    deleteProject.mutate({ projectId: deleteId }, {
      onSuccess: () => {
        toast({ title: "Project deleted" })
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        setDeleteId(null)
      },
      onError: (err) => {
        toast({ 
          title: "Error deleting project", 
          description: err.message || "Failed to delete",
          variant: "destructive"
        })
        setDeleteId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Manage IPO preparations across all client companies.</p>
        </div>
        <Link href="/projects/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New IPO Project</Button>
        </Link>
      </div>

      <div className="flex items-center max-w-sm relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input 
          placeholder="Search by company or industry..." 
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">Loading projects...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    No projects found matching "{searchTerm}"
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <Link href={`/projects/${project.id}/documentation`} className="text-primary hover:underline">
                        {project.companyName}
                      </Link>
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="w-1/4">
                      <div className="flex items-center gap-2">
                        <Progress value={project.completionPercentage} className="h-2 flex-1" />
                        <span className="text-xs text-slate-500 w-8">{project.completionPercentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{project.industry}</TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {new Date(project.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/projects/${project.id}/documentation`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" /> Open Workspace
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator />
                          <Dialog open={deleteId === project.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                            <DialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive focus:bg-destructive/10 cursor-pointer"
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setDeleteId(project.id)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                              </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Project</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to delete {project.companyName}? This action cannot be undone and will remove all associated documents.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteProject.isPending}>
                                  Delete
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}