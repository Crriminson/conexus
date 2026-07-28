"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationTray } from "./notification-tray";

import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Upload,
  BookOpen,
  FileText,
  ShieldAlert,
  ActivitySquare,
  Eye,
  Settings,
  LogOut,
} from "lucide-react"

import { cn } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  const location = usePathname()
  const queryClient = useQueryClient()
  
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me')
      if (!res.ok) throw new Error("Failed to fetch user")
      return res.json()
    },
    // Always re-fetch fresh on mount — prevents stale name/role after switching accounts
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Match current path to highlight active nav item
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location === path
    }
    return location.startsWith(path)
  }

  // Determine current project id from URL if we are in a project route
  const projectIdMatch = location.match(/^\/projects\/([a-zA-Z0-9_-]+)/)
  const projectId = projectIdMatch ? projectIdMatch[1] : null

  const globalNavItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Projects", path: "/projects", icon: FolderKanban },
    { name: "Settings", path: "/settings", icon: Settings },
  ]

  // Fetch projects to get current project role
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error("Failed to fetch projects")
      return res.json()
    }
  })

  const currentProject = projectsRes?.projects?.find((p: any) => p.id === projectId);
  const userRole = currentProject?.members?.[0]?.role;

  const projectNavItems = projectId ? [
    { name: "Eligibility", path: `/projects/${projectId}/eligibility`, icon: CheckSquare, roles: ['APPLICANT_COMPANY', 'MERCHANT_BANKER'] },
    { name: "Upload", path: `/projects/${projectId}/upload`, icon: Upload, roles: ['APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CA'] },
    { name: "Knowledge Base", path: `/projects/${projectId}/knowledge-base`, icon: BookOpen, roles: ['APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CA', 'CS', 'LEGAL_ADVISOR', 'UNDERWRITER'] },
    { name: "Documentation", path: `/projects/${projectId}/documentation`, icon: FileText, roles: ['APPLICANT_COMPANY', 'MERCHANT_BANKER', 'CA', 'CS', 'LEGAL_ADVISOR', 'UNDERWRITER'] },
    { name: "Validation", path: `/projects/${projectId}/validation`, icon: ShieldAlert, roles: ['MERCHANT_BANKER', 'LEGAL_ADVISOR'] },
    { name: "Gaps", path: `/projects/${projectId}/gaps`, icon: ShieldAlert, roles: ['MERCHANT_BANKER', 'LEGAL_ADVISOR'] },
    { name: "Readiness", path: `/projects/${projectId}/readiness`, icon: ActivitySquare, roles: ['MERCHANT_BANKER'] },
    { name: "Review", path: `/projects/${projectId}/review`, icon: Eye, roles: ['MERCHANT_BANKER', 'CA', 'CS', 'LEGAL_ADVISOR', 'UNDERWRITER'] },
    { name: "Export", path: `/projects/${projectId}/export`, icon: FileText, roles: ['APPLICANT_COMPANY', 'MERCHANT_BANKER'] },
  ].filter(item => !userRole || item.roles.includes(userRole)) : []

  return (
    <div className={cn("flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border", className)} {...props}>
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image
            src="/conexus-logo.svg"
            alt="Conexus logo"
            width={160}
            height={32}
            className="h-8 w-auto"
          />
        </Link>
      </div>
      
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-3">
          <div className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Platform
          </div>
          {globalNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.path) && !projectId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
          
          {projectId && (
            <>
              <div className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mt-6 mb-2">
                Project Workflow
              </div>
              {projectNavItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </>
          )}
        </nav>
      </div>

      <div className="mt-auto border-t border-sidebar-border p-4">
        {isLoading ? (
          <div className="animate-pulse flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-sidebar-accent" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 rounded bg-sidebar-accent" />
              <div className="h-2 w-16 rounded bg-sidebar-accent" />
            </div>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {/* Always use the global role from Supabase metadata — not per-project role */}
                {(user.role || 'User')
                  .replace(/_/g, ' ')
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            </div>
            <NotificationTray userId={user.id} />
            <button
              onClick={async () => {
                // Clear all cached queries before logging out
                // so the next login sees fresh data immediately
                queryClient.clear();
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="text-sidebar-foreground/50 hover:text-white transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-red-400">Failed to load</span>
              <span className="truncate text-xs text-sidebar-foreground/60">Please log out</span>
            </div>
            <button
              onClick={async () => {
                queryClient.clear();
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="text-sidebar-foreground/50 hover:text-white transition-colors" title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}