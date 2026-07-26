"use client";
import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { gsap } from "gsap";

import { ShieldCheck, Play, AlertCircle, XCircle, CheckCircle2, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

export interface ValidationIssue {
  id: number;
  projectId: number;
  type: string;
  severity: "error" | "warning" | "suggestion";
  message: string;
  section: string;
  isResolved: boolean;
}

const MOCK_ISSUES: ValidationIssue[] = [
  { id: 1, projectId: 0, type: "missing_field", severity: "error", message: "Promoter DIN is missing in Management section", section: "Management", isResolved: false },
  { id: 2, projectId: 0, type: "financial_mismatch", severity: "error", message: "Net Worth in 'Key Metrics' does not match audited financials upload", section: "Financials", isResolved: false },
  { id: 3, projectId: 0, type: "data_inconsistency", severity: "warning", message: "Registered office address differs slightly from MCA records", section: "Company Profile", isResolved: false },
  { id: 4, projectId: 0, type: "suggestion", severity: "suggestion", message: "Consider adding more detail to competitive landscape", section: "Business", isResolved: true },
];

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  if (severity === "warning") return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
  return <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />;
}

export default function ValidationPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const statsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: issues } = useQuery({
    queryKey: ["validations", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/validation-engine?projectId=${projectId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.results || []).map((r: any) => ({
        id: r.id,
        projectId,
        type: r.status === "FLAGGED_FOR_REVIEW" ? "missing_field" : "success",
        severity: r.status === "FLAGGED_FOR_REVIEW" ? "error" : "success",
        message: r.message || r.explanation || "Validation check",
        section: r.matchedRegulation || "General",
        isResolved: r.status === "PASS"
      }));
    },
  });

  const runMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await fetch("/api/validation-engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
      if (!res.ok) throw new Error("Validation engine failed");
      return res.json();
    },
  });

  const handleRunValidation = () => {
    runMutation.mutate({ projectId }, {
      onSuccess: () => { toast({ title: "Validation complete", description: "Rules engine executed successfully." }); queryClient.invalidateQueries({ queryKey: ["validations", projectId] }); },
      onError: () => toast({ title: "Validation failed", variant: "destructive" }),
    });
  };

  const displayIssues = (issues && (issues as any).length > 0 ? issues : MOCK_ISSUES) as ValidationIssue[];
  const errorCount = displayIssues.filter((i) => i.severity === "error" && !i.isResolved).length;
  const warningCount = displayIssues.filter((i) => i.severity === "warning" && !i.isResolved).length;
  const suggestionCount = displayIssues.filter((i) => i.severity === "suggestion" && !i.isResolved).length;

  // GSAP animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".stat-chip", { y: 20, opacity: 0, duration: 0.4, stagger: 0.07, ease: "power3.out" });
      gsap.from(".issue-card", { y: 16, opacity: 0, duration: 0.35, stagger: 0.06, ease: "power3.out", delay: 0.2 });
    });
    return () => ctx.revert();
  }, []);

  const statCards = [
    { label: "Total Open", value: errorCount + warningCount + suggestionCount, color: "text-slate-900", bg: "bg-slate-50 border-slate-200" },
    { label: "Errors", value: errorCount, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "Warnings", value: warningCount, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { label: "Suggestions", value: suggestionCount, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Validation Engine</h1>
          <p className="text-slate-500 mt-1">Cross-check document content against structural and regulatory rules.</p>
        </div>
        <Button onClick={handleRunValidation} disabled={runMutation.isPending} className="rounded-xl gap-2">
          {runMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><Play className="h-4 w-4" /> Run Validation</>
          )}
        </Button>
      </div>

      {/* Stat chips */}
      <div ref={statsRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className={`stat-chip rounded-2xl border p-5 ${s.bg}`}>
            <p className="text-xs font-medium text-slate-500 mb-1">{s.label}</p>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Issues list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Validation Results</h2>
          <Button variant="outline" size="sm" className="rounded-xl gap-2">
            <Filter className="h-4 w-4" /> Filter
          </Button>
        </div>

        <div ref={listRef} className="divide-y divide-slate-100">
          {displayIssues.map((issue) => (
            <div
              key={issue.id}
              className={`issue-card flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors ${issue.isResolved ? "opacity-50" : ""}`}
            >
              <div className="mt-0.5">
                <SeverityIcon severity={issue.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${issue.isResolved ? "line-through text-slate-400" : "text-slate-900"}`}>
                  {issue.message}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                    {issue.section}
                  </span>
                  <span className="text-xs text-slate-400 capitalize">{issue.type.replace(/_/g, " ")}</span>
                </div>
              </div>
              {!issue.isResolved && (
                <Button variant="outline" size="sm" className="rounded-xl flex-shrink-0">
                  Fix Issue
                </Button>
              )}
              {issue.isResolved && (
                <span className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}