"use client";
import Link from "next/link";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, MoreHorizontal, Trash2, ExternalLink, Building2, TrendingUp, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  // Bug fix: was number|null — project IDs are CUID strings
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: projectsRes, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  })

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Bug fix: was a console.warn stub — now calls real DELETE endpoint
  const deleteProject = useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete project");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Project deleted" })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteId(null)
    },
    onError: (err: any) => {
      toast({ title: "Error deleting project", description: err.message || "Failed to delete", variant: "destructive" })
      setDeleteId(null)
    }
  })

  const projects = projectsRes?.projects ?? [];

  // Bug fix: p.industry may not exist on seeded projects — use optional chaining
  const filteredProjects = projects.filter((p: any) =>
    (p.companyName?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) ||
    (p.industry?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) ||
    (p.name?.toLowerCase() ?? "").includes(searchTerm.toLowerCase())
  )

  function getStatusConfig(status: string) {
    switch (status?.toLowerCase()) {
      case 'approved': return { label: 'Approved', className: 'bg-green-100 text-green-700 border-green-200' }
      case 'under_review': return { label: 'Under Review', className: 'bg-amber-100 text-amber-700 border-amber-200' }
      case 'in_progress': return { label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-200' }
      case 'draft': return { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' }
      default: return { label: status?.replace(/_/g, ' ') ?? 'Unknown', className: 'bg-slate-100 text-slate-600 border-slate-200' }
    }
  }

  function getRoleLabel(role: string) {
    const map: Record<string, string> = {
      APPLICANT_COMPANY: 'Applicant', MERCHANT_BANKER: 'M. Banker',
      CHARTERED_ACCOUNTANT: 'CA', COMPANY_SECRETARY: 'CS',
      LEGAL_ADVISOR: 'Legal', UNDERWRITER: 'Underwriter'
    }
    return map[role] ?? role
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Manage IPO preparations across all client companies.</p>
        </div>
        <Link href="/projects/new">
          <Button className="rounded-xl shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> New IPO Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center max-w-sm relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search projects…"
          className="pl-9 rounded-xl border-slate-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Project Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
              <div className="h-2 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <Building2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No projects found</p>
          <p className="text-slate-400 text-sm mt-1">
            {searchTerm ? `No results for "${searchTerm}"` : "Create your first IPO project to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project: any) => {
            const statusConfig = getStatusConfig(project.status)
            const completion = project.completionPercentage ?? 0
            const userRole = project.members?.[0]?.role

            return (
              <div
                key={project.id}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.className}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions menu */}
                  <Dialog open={deleteId === project.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <Link href={`/projects/${project.id}/eligibility`}>
                          <DropdownMenuItem className="cursor-pointer rounded-lg">
                            <ExternalLink className="mr-2 h-4 w-4" /> Open Project
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        <DialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg"
                            onSelect={(e) => { e.preventDefault(); setDeleteId(project.id) }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                          </DropdownMenuItem>
                        </DialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Delete Project</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete <strong>{project.companyName || project.name}</strong>? This cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" className="rounded-xl" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button
                          variant="destructive"
                          className="rounded-xl"
                          onClick={() => deleteProject.mutate({ projectId: project.id })}
                          disabled={deleteProject.isPending}
                        >
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Company name */}
                <Link href={`/projects/${project.id}/eligibility`}>
                  <h3 className="font-semibold text-slate-900 text-lg leading-snug hover:text-primary transition-colors mb-1">
                    {project.companyName || project.name}
                  </h3>
                </Link>
                {project.industry && (
                  <p className="text-sm text-slate-500 mb-4">{project.industry}</p>
                )}

                {/* Progress */}
                <div className="mt-auto space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Progress</span>
                    <span className="font-medium">{completion}%</span>
                  </div>
                  <Progress value={completion} className="h-1.5 rounded-full" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  {userRole && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      {getRoleLabel(userRole)}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}