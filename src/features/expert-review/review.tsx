"use client";
import { useState } from "react"
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { MessageSquare, Check, X, Send, Eye, Clock, FileText, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { SectionCategory, ProjectRole, SectionStatus, DRHPSectionVersion, ValidationResult } from "@prisma/client"

type DRHPSection = {
  id: string;
  title: string;
  category: SectionCategory;
  content: string;
  status: SectionStatus;
  versions?: DRHPSectionVersion[];
  validationResults?: ValidationResult[];
}

const CATEGORY_OWNERS: Record<SectionCategory, ProjectRole | null> = {
  COMPANY_PROFILE: null,
  FINANCIAL: 'CHARTERED_ACCOUNTANT',
  LEGAL_RISK: 'LEGAL_ADVISOR',
  SECRETARIAL_COMPLIANCE: 'COMPANY_SECRETARY',
  BUSINESS_OFFER: 'MERCHANT_BANKER',
};

export default function ReviewPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await fetch('/api/me')).json()
  });

  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => (await fetch(`/api/projects/${projectId}`)).json()
  });

  const { data: sectionsRes, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', projectId],
    queryFn: async () => (await fetch(`/api/drhp-sections?projectId=${projectId}`)).json()
  });

  const myMembership = projectRes?.project?.members?.find((m: any) => m.userId === me?.id);
  const myRole = myMembership?.role as ProjectRole | undefined;

  // Filter sections to only those owned by the current role
  let allSections: DRHPSection[] = sectionsRes?.sections || [];
  const ownedCategories = (Object.keys(CATEGORY_OWNERS) as SectionCategory[]).filter(cat => CATEGORY_OWNERS[cat] === myRole);
  
  const sections = myRole === 'MERCHANT_BANKER' 
    ? allSections // Merchant Bankers can view all (but only approve their own or reopen)
    : allSections.filter(s => ownedCategories.includes(s.category));

  // Auto-select first section
  if (sections.length > 0 && !activeSectionId) {
    setActiveSectionId(sections[0].id)
  }

  // Fetch details for the active section (includes versions and validations)
  const { data: activeSectionRes, isLoading: sectionLoading } = useQuery({
    queryKey: ['section', activeSectionId],
    queryFn: async () => (await fetch(`/api/drhp-sections/${activeSectionId}`)).json(),
    enabled: !!activeSectionId
  });

  const activeSection: DRHPSection | undefined = activeSectionRes?.section;

  const transitionMutation = useMutation({
    mutationFn: async ({ action, reviewNotes }: { action: string, reviewNotes?: string }) => {
      const res = await fetch(`/api/drhp-sections/${activeSectionId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNotes })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit review")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Review submitted successfully" })
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['section', activeSectionId] })
      queryClient.invalidateQueries({ queryKey: ['sections', projectId] })
    },
    onError: (error: Error) => {
      toast({ title: "Review failed", description: error.message, variant: "destructive" })
    }
  })

  const form = useForm({
    defaultValues: { comment: "" }
  })

  const submitReview = (action: string) => {
    const comment = form.getValues().comment
    
    if (action === 'request-changes' && !comment.trim()) {
      toast({ title: "Comment required", description: "Please provide review notes when requesting changes.", variant: "destructive" })
      return
    }

    transitionMutation.mutate({ action, reviewNotes: comment })
  }

  if (sectionsLoading) return <div className="p-8 text-slate-500">Loading queue...</div>

  const isOwner = activeSection && CATEGORY_OWNERS[activeSection.category] === myRole;
  const isMerchantBanker = myRole === 'MERCHANT_BANKER';
  
  const canApprove = isOwner && activeSection?.status === 'SUBMITTED_FOR_REVIEW';
  const canReopen = isMerchantBanker && activeSection?.status === 'APPROVED';

  const flaggedValidation = activeSection?.validationResults?.find(v => v.status === 'FLAGGED_FOR_REVIEW');

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full -mx-4 -my-8 px-0 sm:-mx-6 lg:-mx-8">
      {/* Left Panel - Queue & Document Viewer */}
      <div className="flex-1 flex flex-col border-r bg-white min-w-[500px]">
        <div className="h-14 border-b flex items-center px-4 bg-slate-50 gap-4 shrink-0 overflow-x-auto">
          <Eye className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="font-medium text-slate-700 shrink-0">Review Queue</span>
          <div className="flex gap-2 ml-4">
            {sections.length === 0 && <span className="text-sm text-slate-500">No sections in your queue.</span>}
            {sections.map(s => (
              <Button 
                key={s.id} 
                variant={activeSectionId === s.id ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setActiveSectionId(s.id)}
                className="h-8 shrink-0"
              >
                {s.title}
                {s.status === 'APPROVED' && <Check className="ml-2 h-3 w-3 text-green-600" />}
                {s.status === 'CHANGES_REQUESTED' && <X className="ml-2 h-3 w-3 text-red-600" />}
                {s.status === 'SUBMITTED_FOR_REVIEW' && <Clock className="ml-2 h-3 w-3 text-amber-600" />}
              </Button>
            ))}
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-8 bg-slate-100">
          {sectionLoading ? (
            <div className="text-center text-slate-500 py-12">Loading section...</div>
          ) : activeSection ? (
            <div className="bg-white shadow-sm border border-slate-200 p-12 max-w-[800px] mx-auto min-h-full">
              {flaggedValidation && (
                <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900">AI flagged — needs {CATEGORY_OWNERS[activeSection.category]} review</h4>
                    <p className="text-sm text-amber-800 mt-1">{flaggedValidation.message}</p>
                    {flaggedValidation.explanation && <p className="text-xs text-amber-700 mt-1">{flaggedValidation.explanation}</p>}
                  </div>
                </div>
              )}

              <div className="prose prose-slate max-w-none">
                <h2 className="border-b pb-2">{activeSection.title}</h2>
                <div className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-6">
                  {activeSection.content || <em className="text-slate-400">Section is empty</em>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">Select a section to review</div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Review Tools */}
      <div className="w-96 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b shrink-0 bg-slate-50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Review Notes
          </h3>
          <p className="text-xs text-slate-500 mt-1">Status: <strong className="text-slate-700">{activeSection?.status}</strong></p>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {activeSection?.versions && activeSection.versions.length > 0 ? (
              activeSection.versions.map(version => (
                <div key={version.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                      R{version.reviewRound}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">Reviewer (ID: {version.reviewerId?.slice(-4) || "Auto"})</span>
                      <span className="text-xs text-slate-400">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {version.status === 'APPROVED' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">Approved Section</Badge>
                    )}
                    {version.status === 'CHANGES_REQUESTED' && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 mt-1">Changes Requested</Badge>
                    )}
                    
                    {version.reviewNotes && (
                      <div className="bg-slate-50 p-3 rounded-md border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
                        {version.reviewNotes}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                No review history for this section.
              </div>
            )}
          </div>
        </ScrollArea>

        {(canApprove || canReopen) && (
          <div className="p-4 border-t bg-slate-50 shrink-0 space-y-4">
            <Form {...form}>
              <form className="space-y-3">
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea 
                          placeholder={canApprove ? "Add mandatory notes if requesting changes..." : "Reason for reopening..."}
                          className="resize-none min-h-[80px] text-sm bg-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  {canApprove && (
                    <>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200"
                        onClick={() => submitReview('request-changes')}
                        disabled={transitionMutation.isPending}
                      >
                        <X className="mr-2 h-4 w-4" /> Request Changes
                      </Button>
                      <Button 
                        type="button" 
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                        onClick={() => submitReview('approve')}
                        disabled={transitionMutation.isPending}
                      >
                        <Check className="mr-2 h-4 w-4" /> Approve
                      </Button>
                    </>
                  )}
                  {canReopen && (
                    <Button 
                      type="button" 
                      variant="outline"
                      className="col-span-2 w-full text-amber-700 hover:bg-amber-50 border-amber-200"
                      onClick={() => submitReview('reopen')}
                      disabled={transitionMutation.isPending}
                    >
                      <Clock className="mr-2 h-4 w-4" /> Reopen for Review
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  )
}