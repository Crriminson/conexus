"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { gsap } from "gsap";
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ShieldCheck,
  Upload,
  FileText,
  ActivitySquare,
  TrendingUp,
  Building2,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const statsRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);

  const { data: projectsRes, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const projects = projectsRes?.projects || [];

  const activeProjects = projects.filter(
    (p: any) => p.status !== "draft" && p.status !== "approved"
  ).length;
  const avgCompletion =
    projects.length > 0
      ? Math.round(
          projects.reduce(
            (acc: number, p: any) => acc + (p.completionPercentage ?? 0),
            0
          ) / projects.length
        )
      : 0;

  // GSAP entry animations
  useEffect(() => {
    if (!statsRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".stat-card", {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.1,
      });
      gsap.from(".project-card", {
        y: 20,
        opacity: 0,
        duration: 0.45,
        stagger: 0.07,
        ease: "power3.out",
        delay: 0.35,
      });
    });
    return () => ctx.revert();
  }, [projectsLoading]);

  function getStatusConfig(status: string) {
    switch (status?.toLowerCase()) {
      case "approved":
        return {
          label: "Approved",
          className: "bg-green-100 text-green-700 border-green-200",
        };
      case "under_review":
        return {
          label: "Under Review",
          className: "bg-amber-100 text-amber-700 border-amber-200",
        };
      case "in_progress":
        return {
          label: "In Progress",
          className: "bg-blue-100 text-blue-700 border-blue-200",
        };
      case "draft":
        return {
          label: "Draft",
          className: "bg-slate-100 text-slate-600 border-slate-200",
        };
      default:
        return {
          label: status?.replace(/_/g, " ") ?? "Unknown",
          className: "bg-slate-100 text-slate-600 border-slate-200",
        };
    }
  }

  function getRoleLabel(role: string) {
    const map: Record<string, string> = {
      APPLICANT_COMPANY: "Applicant",
      MERCHANT_BANKER: "Merchant Banker",
      CHARTERED_ACCOUNTANT: "CA",
      COMPANY_SECRETARY: "CS",
      LEGAL_ADVISOR: "Legal Advisor",
      UNDERWRITER: "Underwriter",
    };
    return map[role] ?? role;
  }

  const stats = [
    {
      label: "Active Projects",
      value: projectsLoading ? "—" : activeProjects,
      icon: FolderKanban,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-50",
      sub: "Currently in progress",
    },
    {
      label: "Avg Completion",
      value: projectsLoading ? "—" : `${avgCompletion}%`,
      icon: TrendingUp,
      iconColor: "text-green-500",
      iconBg: "bg-green-50",
      sub: "Across all projects",
      progress: avgCompletion,
    },
    {
      label: "Validation Alerts",
      value: projectsLoading
        ? "—"
        : projects.reduce(
            (a: number, p: any) => a + (p.validationAlerts ?? 0),
            0
          ),
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50",
      sub: "Needs attention",
    },
    {
      label: "Pending Tasks",
      value: "0",
      icon: Clock,
      iconColor: "text-purple-500",
      iconBg: "bg-purple-50",
      sub: "No pending tasks",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Overview of your IPO projects and compliance status.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/projects">
            <Button variant="outline" className="rounded-xl">
              View All
            </Button>
          </Link>
          <Link href="/projects/new">
            <Button className="rounded-xl shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> New IPO
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div ref={statsRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {stat.value}
            </div>
            {stat.progress !== undefined ? (
              <Progress
                value={stat.progress}
                className="h-1 mt-3 rounded-full"
              />
            ) : (
              <p className="text-xs text-slate-400">{stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Projects Section */}
      <div ref={projectsRef}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-slate-900">
            Recent Projects
          </h2>
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {projectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse"
              >
                <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
                <div className="h-2 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center">
            <Building2 className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-5">
              Create your first IPO project to get started.
            </p>
            <Link href="/projects/new">
              <Button className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> New IPO Project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((project: any) => {
              const statusConfig = getStatusConfig(project.status);
              const completion = project.completionPercentage ?? 0;
              const userRole = project.members?.[0]?.role;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/eligibility`}
                >
                  <div className="project-card group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
                    {/* Top */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Name */}
                    <h3 className="font-semibold text-slate-900 text-base leading-snug group-hover:text-primary transition-colors mb-1">
                      {project.companyName || project.name}
                    </h3>
                    {project.industry && (
                      <p className="text-xs text-slate-400 mb-4">
                        {project.industry}
                      </p>
                    )}

                    {/* Progress */}
                    <div className="mt-auto space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Progress</span>
                        <span className="font-medium">{completion}%</span>
                      </div>
                      <Progress
                        value={completion}
                        className="h-1.5 rounded-full"
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      {userRole && (
                        <span className="text-xs font-medium text-primary bg-primary/8 px-2.5 py-1 rounded-full">
                          {getRoleLabel(userRole)}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(project.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}