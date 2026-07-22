import { Link, useLocation } from "wouter"
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
import { useGetMe } from "@workspace/api-client-react"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  const [location] = useLocation()
  const { data: user } = useGetMe()

  // Match current path to highlight active nav item
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location === path
    }
    return location.startsWith(path)
  }

  // Determine current project id from URL if we are in a project route
  const projectIdMatch = location.match(/^\/projects\/(\d+)/)
  const projectId = projectIdMatch ? projectIdMatch[1] : null

  const globalNavItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Projects", path: "/projects", icon: FolderKanban },
    { name: "Settings", path: "/settings", icon: Settings },
  ]

  const projectNavItems = projectId ? [
    { name: "Eligibility", path: `/projects/${projectId}/eligibility`, icon: CheckSquare },
    { name: "Upload", path: `/projects/${projectId}/upload`, icon: Upload },
    { name: "Knowledge Base", path: `/projects/${projectId}/knowledge-base`, icon: BookOpen },
    { name: "Documentation", path: `/projects/${projectId}/documentation`, icon: FileText },
    { name: "Validation", path: `/projects/${projectId}/validation`, icon: ShieldAlert },
    { name: "Gaps", path: `/projects/${projectId}/gaps`, icon: ShieldAlert }, // Reusing icon, maybe change later
    { name: "Readiness", path: `/projects/${projectId}/readiness`, icon: ActivitySquare },
    { name: "Review", path: `/projects/${projectId}/review`, icon: Eye },
  ] : []

  return (
    <div className={cn("flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border", className)} {...props}>
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
            <ActivitySquare className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">CONEXUS</span>
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
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/60 capitalize">{user.role.replace('_', ' ')}</span>
            </div>
            <Link href="/login" className="text-sidebar-foreground/50 hover:text-white transition-colors" title="Log out">
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="animate-pulse flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-sidebar-accent" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 rounded bg-sidebar-accent" />
              <div className="h-2 w-16 rounded bg-sidebar-accent" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}