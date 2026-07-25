"use client";
import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { gsap } from "gsap";

import { AlertCircle, Clock, CheckCircle2, Circle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

type GapStatus = "open" | "in_progress" | "resolved";
interface GapFlag {
  id: string;
  projectId: string;
  sectionId?: string;
  sectionKey: string;
  missingItem: string;
  title?: string;
  description?: string;
  status: string;
  severity: string;
  resolved: boolean;
  dueDate?: string;
}

function SeverityBadge({ severity }: { severity: string }) {
  const config = {
    Critical: "bg-red-100 text-red-700 border-red-200",
    High: "bg-red-50 text-red-600 border-red-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-blue-50 text-blue-700 border-blue-200",
  }[severity] ?? "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config}`}>
      {severity}
    </span>
  );
}

export default function GapsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);

  const { data: gaps, isLoading } = useQuery({
    queryKey: ["gaps", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/gaps`);
      if (!res.ok) throw new Error("Failed to fetch gaps");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ projectId, gapId, status }: { projectId: string; gapId: string; status: string }) => {
      const res = await fetch(`/api/projects/${projectId}/gaps/${gapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update gap");
      return res.json();
    },
  });

  // GSAP entry animation
  useEffect(() => {
    if (!listRef.current || isLoading) return;
    const ctx = gsap.context(() => {
      gsap.from(".gap-card", { y: 20, opacity: 0, duration: 0.4, stagger: 0.07, ease: "power3.out", delay: 0.1 });
    }, listRef);
    return () => ctx.revert();
  }, [isLoading]);

  const displayGaps: GapFlag[] = gaps && gaps.length > 0 ? gaps : [];

  const openCount = displayGaps.filter((g) => g.status === "open").length;
  const inProgressCount = displayGaps.filter((g) => g.status === "in_progress").length;
  const resolvedCount = displayGaps.filter((g) => g.status === "resolved" || g.resolved).length;

  const handleStatusChange = (gapId: string, newStatus: string) => {
    updateMutation.mutate({ projectId, gapId, status: newStatus }, {
      onSuccess: () => { toast({ title: "Status updated" }); queryClient.invalidateQueries({ queryKey: ["gaps", projectId] }); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Compliance Gaps</h1>
          <p className="text-slate-500 mt-1">Track and resolve regulatory hurdles before filing.</p>
        </div>
        <Button className="rounded-xl">Add Manual Gap</Button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200">
          <Circle className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">{openCount} Open</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-sm font-medium text-blue-700">{inProgressCount} In Progress</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="text-sm font-medium text-green-700">{resolvedCount} Resolved</span>
        </div>
      </div>

      {/* Gaps list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : displayGaps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No gaps detected</p>
          <p className="text-slate-400 text-sm mt-1">Run the AI gap analysis or add gaps manually.</p>
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {displayGaps.map((gap) => {
            const isResolved = gap.status === "resolved" || gap.resolved;

            return (
              <div
                key={gap.id}
                className={`gap-card rounded-2xl border bg-white shadow-sm p-5 transition-all duration-200 ${isResolved ? "opacity-60" : "hover:shadow-md"}`}
              >
                <div className="flex items-start gap-4">
                  {/* Severity indicator */}
                  <div className={`mt-0.5 flex-shrink-0 h-2 w-2 rounded-full ${
                    gap.severity === "Critical" || gap.severity === "High" ? "bg-red-500" :
                    gap.severity === "Medium" ? "bg-amber-400" : "bg-blue-400"
                  }`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <h3 className={`font-semibold text-sm ${isResolved ? "line-through text-slate-400" : "text-slate-900"}`}>
                        {gap.missingItem}
                      </h3>
                      <SeverityBadge severity={gap.severity} />
                    </div>
                    {gap.description && <p className="text-sm text-slate-500 mt-1">{gap.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border">
                        {gap.sectionKey || "Global"}
                      </span>
                      {gap.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="h-3 w-3" /> Due {gap.dueDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="flex-shrink-0 w-40">
                    <Select
                      defaultValue={gap.status}
                      onValueChange={(val) => handleStatusChange(gap.id, val)}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="open">
                          <span className="flex items-center gap-2 text-slate-600">
                            <Circle className="h-3 w-3" /> Open
                          </span>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <span className="flex items-center gap-2 text-blue-600">
                            <AlertCircle className="h-3 w-3" /> In Progress
                          </span>
                        </SelectItem>
                        <SelectItem value="resolved">
                          <span className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> Resolved
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}