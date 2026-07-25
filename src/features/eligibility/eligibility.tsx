"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Save, Loader2, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";

const QUESTIONNAIRE = [
  { id: "q1", title: "Net Tangible Assets", question: "Does the company have net tangible assets of at least ₹3 Crores in each of the preceding 3 full years?", category: "Financial" },
  { id: "q2", title: "Average Operating Profit", question: "Does the company have an average operating profit of at least ₹15 Crores during the preceding 3 years?", category: "Financial" },
  { id: "q3", title: "Net Worth", question: "Does the company have a net worth of at least ₹1 Crore in each of the preceding 3 full years?", category: "Financial" },
  { id: "q4", title: "Name Change", question: "If the company changed its name in the last year, is at least 50% of revenue from activity suggested by the new name?", category: "Corporate" },
  { id: "q5", title: "Promoter Background", question: "Are any promoters or directors currently debarred from accessing capital markets by SEBI?", category: "Legal", reverseLogic: true },
  { id: "q6", title: "Wilful Defaulters", question: "Is the company, its promoters, or directors classified as wilful defaulters by RBI?", category: "Legal", reverseLogic: true },
];

const CATEGORY_COLORS: Record<string, string> = {
  Financial: "bg-blue-50 text-blue-700 border-blue-200",
  Corporate: "bg-purple-50 text-purple-700 border-purple-200",
  Legal: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function EligibilityPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { toast } = useToast();

  const { data: projectRes } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => { const res = await fetch(`/api/projects/${projectId}`); if (!res.ok) throw new Error("Failed"); return res.json(); },
    enabled: !!projectId,
  });
  const project = projectRes?.project;

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["eligibility", projectId],
    queryFn: async () => { const res = await fetch(`/api/projects/${projectId}/eligibility`); if (!res.ok) throw new Error("Failed"); return res.json(); },
    enabled: !!projectId,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: any }) => {
      const res = await fetch(`/api/projects/${projectId}/eligibility`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: data }) });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (eligibility?.answers) {
      const initial: Record<string, string> = {};
      eligibility.answers.forEach((a: any) => { initial[a.questionId] = a.answer; });
      setAnswers(initial);
      
      const count = Object.keys(initial).length;
      // Set active index to the first unanswered question, or the last question if all answered
      setActiveIndex(Math.min(count, QUESTIONNAIRE.length - 1));
    }
  }, [eligibility]);

  const handleAnswer = (questionId: string, value: string) => {
    const qIndex = QUESTIONNAIRE.findIndex((q) => q.id === questionId);
    
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      return next;
    });

    // Auto-advance logic
    setTimeout(() => {
      setActiveIndex((currentActive) => {
        // Only advance if they answered the currently focused question
        if (currentActive === qIndex && qIndex < QUESTIONNAIRE.length - 1) {
          const nextIndex = qIndex + 1;
          setTimeout(() => {
            scrollToCenter(QUESTIONNAIRE[nextIndex].id);
          }, 50);
          return nextIndex;
        }
        return currentActive;
      });
    }, 400); // Wait a bit so the user sees their selection register
  };

  const scrollToCenter = (id: string) => {
    const container = document.getElementById("questions-container");
    const el = document.getElementById(`question-${id}`);
    if (container && el) {
      const containerHeight = container.clientHeight;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      // We add 80px to shift the scroll target slightly upwards, 
      // making it feel more centered relative to the whole screen
      container.scrollTo({
        top: elTop - (containerHeight / 2) + (elHeight / 2) + 80,
        behavior: 'smooth'
      });
    }
  };

  const handleSave = (submitAll = false) => {
    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    submitMutation.mutate({ projectId, data: { answers: formattedAnswers } }, {
      onSuccess: () => toast({ title: submitAll ? "Assessment submitted!" : "Draft saved" }),
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  };

  const answeredCount = Object.keys(answers).length;
  const totalCount = QUESTIONNAIRE.length;
  const progress = Math.round((answeredCount / totalCount) * 100);

  // Auto-center the active question when the component mounts or activeIndex changes
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (QUESTIONNAIRE[activeIndex]?.id) {
        scrollToCenter(QUESTIONNAIRE[activeIndex].id);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeIndex, isLoading]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center animate-in fade-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Results view
  if (eligibility?.status && eligibility.status !== "pending") {
    const isEligible = eligibility.status === "eligible";
    const isConditional = eligibility.status === "conditional";

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Eligibility Results</h1>
            <p className="text-slate-500 mt-1">{project?.companyName || "Project"} · IPO Readiness Assessment</p>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => setAnswers({})}>Retake</Button>
        </div>

        {/* Score card */}
        <div className={`rounded-2xl border-2 p-8 text-center ${isEligible ? "border-green-200 bg-green-50" : isConditional ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex justify-center mb-4">
            {isEligible && <CheckCircle2 className="h-12 w-12 text-green-500" />}
            {isConditional && <AlertCircle className="h-12 w-12 text-amber-500" />}
            {!isEligible && !isConditional && <XCircle className="h-12 w-12 text-red-500" />}
          </div>
          <div className="text-5xl font-bold text-slate-900 mb-2">{eligibility.score}<span className="text-2xl text-slate-400 font-normal">/100</span></div>
          <p className={`text-xl font-semibold ${isEligible ? "text-green-700" : isConditional ? "text-amber-700" : "text-red-700"}`}>
            {isEligible ? "Eligible for Main Board" : isConditional ? "Conditionally Eligible" : "Not Currently Eligible"}
          </p>
        </div>

        {eligibility.recommendations?.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Recommendations & Gaps</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {eligibility.recommendations.map((rec: any, i: number) => (
                <li key={i} className="flex gap-3 px-6 py-4">
                  {rec.priority === "high" ? <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                  <span className="text-sm text-slate-700">{rec.text}</span>
                </li>
              ))}
            </ul>
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
              <Link href={`/projects/${projectId}/upload`}>
                <Button className="rounded-xl">Continue to Upload <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Which questions to render?
  // We render up to the answeredCount + 1 (the next unanswered question).
  // But we also limit it by totalCount.
  const visibleQuestions = QUESTIONNAIRE.slice(0, answeredCount + 1);

  // Assessment form
  return (
    <div className="relative max-w-3xl mx-auto flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-500 overflow-hidden">
      <div className="shrink-0 mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Eligibility Assessment</h1>
        <p className="text-slate-500 mt-1">Determine exchange fit for {project?.companyName || "the company"}.</p>
      </div>

      {/* Sticky progress bar */}
      <div className="shrink-0 z-30 bg-background/95 backdrop-blur pt-2 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-500">{answeredCount} of {totalCount} answered</span>
          <span className="text-sm font-semibold text-slate-700">{progress}%</span>
        </div>
        <div className="relative">
          <Progress value={progress} className="h-2 rounded-full overflow-hidden bg-slate-100" indicatorClassName="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl -z-10" />
        </div>
      </div>

      {/* Question cards container (scrollable with 3D perspective) */}
      <div id="questions-container" className="flex-1 overflow-y-auto px-6 space-y-6 pb-[50vh] pt-[40vh] scroll-smooth hide-scrollbar perspective-[1500px] relative">
        {visibleQuestions.map((q, index) => {
          const value = answers[q.id];
          const reverse = !!q.reverseLogic;
          const isGood = value === "yes" ? !reverse : value === "no" ? reverse : false;
          const isBad = value === "yes" ? reverse : value === "no" ? !reverse : false;

          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const isFuture = index > activeIndex;

          return (
            <div
              key={q.id}
              id={`question-${q.id}`}
              onClick={() => {
                if (isPast) {
                  setActiveIndex(index);
                  setTimeout(() => {
                    scrollToCenter(q.id);
                  }, 50);
                }
              }}
              className={`
                group relative rounded-3xl border p-6 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform-gpu
                ${isActive ? "scale-100 opacity-100 bg-white border-primary shadow-xl ring-4 ring-primary/10 z-20 rotate-x-0 translate-y-0" : ""}
                ${isPast ? "scale-[0.85] opacity-40 bg-slate-50 border-slate-200 cursor-pointer hover:opacity-80 hover:scale-[0.88] z-10 -translate-y-8 -rotate-x-[25deg] blur-[1px]" : ""}
                ${isFuture ? "scale-[0.85] opacity-40 bg-slate-50 border-slate-200 pointer-events-none z-0 translate-y-8 rotate-x-[25deg] blur-[1px]" : ""}
              `}
            >
              {isPast && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/40 backdrop-blur-[1px] rounded-3xl z-30">
                  <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm text-sm font-medium text-slate-700 border">
                    <MousePointerClick className="h-4 w-4" /> Click to edit
                  </span>
                </div>
              )}

              <div className="flex gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-slate-200 text-slate-500"
                }`}>
                  {index + 1}
                </div>
                
                <div className="flex-1 space-y-5">
                  <div>
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border mb-3 ${CATEGORY_COLORS[q.category] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {q.category}
                    </span>
                    <h3 className={`font-semibold text-slate-900 leading-snug transition-all ${
                      isActive ? "text-2xl" : "text-lg"
                    }`}>
                      {q.question}
                    </h3>
                  </div>

                  <RadioGroup value={value ?? ''} onValueChange={(val) => handleAnswer(q.id, val)} className="flex flex-col sm:flex-row gap-3">
                    {[{ val: "yes", label: "Yes" }, { val: "no", label: "No" }, { val: "not_applicable", label: "Not Applicable" }].map(({ val, label }) => (
                      <label
                        key={val}
                        htmlFor={`${q.id}-${val}`}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border-2 cursor-pointer text-base font-medium transition-all ${
                          value === val 
                            ? "bg-primary text-white border-primary shadow-md" 
                            : "bg-white text-slate-700 border-slate-200 hover:border-primary/40 hover:bg-slate-50"
                        }`}
                      >
                        <RadioGroupItem value={val} id={`${q.id}-${val}`} className="hidden" />
                        {label}
                      </label>
                    ))}
                  </RadioGroup>

                  {/* Feedback and Continue action */}
                  <div className="flex items-center justify-between mt-4 h-10">
                    <div className="flex-1">
                      {isGood && value !== "not_applicable" && <p className="text-sm font-medium text-green-600 flex items-center gap-1.5 animate-in slide-in-from-left-2 fade-in"><CheckCircle2 className="h-4 w-4" /> Meets requirement</p>}
                      {isBad && value !== "not_applicable" && <p className="text-sm font-medium text-red-600 flex items-center gap-1.5 animate-in slide-in-from-left-2 fade-in"><XCircle className="h-4 w-4" /> May not meet requirement</p>}
                    </div>
                    {isActive && value && index < QUESTIONNAIRE.length - 1 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="animate-in fade-in slide-in-from-bottom-2 shrink-0 rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveIndex(index + 1);
                          setTimeout(() => {
                            const el = document.getElementById(`question-${QUESTIONNAIRE[index + 1].id}`);
                            if (el) {
                              // Auto scroll behavior inside the scrollable container
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 50);
                        }}
                      >
                        Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Bar (only visible when all questions answered or saving draft) */}
      <div className={`shrink-0 border-t bg-white/95 backdrop-blur shadow-lg p-4 flex justify-between items-center z-40 transition-all duration-500 transform absolute bottom-0 left-0 right-0 ${answeredCount === totalCount ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}>
        <span className="text-sm font-medium text-slate-500">{answeredCount} of {totalCount} answered</span>
        <div className="flex gap-3 pointer-events-auto">
          <Button variant="outline" className="rounded-xl" onClick={() => handleSave(false)} disabled={submitMutation.isPending || answeredCount === 0}>
            {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Draft
          </Button>
          {answeredCount === totalCount && (
            <Button className="rounded-xl" onClick={() => handleSave(true)} disabled={submitMutation.isPending}>
              Submit Assessment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}