"use client";
import { useState, useEffect } from "react"
import { useParams } from "next/navigation";

import { Search, Loader2, Sparkles, CheckCircle2, Circle, ChevronRight, FileText, FileSignature, Save, Lock, ArrowUpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"
import { SectionCategory, ProjectRole, SectionStatus } from "@prisma/client"

type DRHPSection = {
  id: string;
  title: string;
  category: SectionCategory;
  content: string;
  status: SectionStatus;
}

const CATEGORY_OWNERS: Record<SectionCategory, ProjectRole | null> = {
  COMPANY_PROFILE: null,
  FINANCIAL: 'CHARTERED_ACCOUNTANT',
  LEGAL_RISK: 'LEGAL_ADVISOR',
  SECRETARIAL_COMPLIANCE: 'COMPANY_SECRETARY',
  BUSINESS_OFFER: 'MERCHANT_BANKER',
};

// Roles that can edit each category
const CATEGORY_EDITORS: Record<SectionCategory, ProjectRole[]> = {
  COMPANY_PROFILE: ['APPLICANT_COMPANY', 'MERCHANT_BANKER'],
  FINANCIAL: ['MERCHANT_BANKER', 'CHARTERED_ACCOUNTANT'],
  LEGAL_RISK: ['MERCHANT_BANKER', 'LEGAL_ADVISOR'],
  SECRETARIAL_COMPLIANCE: ['MERCHANT_BANKER', 'COMPANY_SECRETARY'],
  BUSINESS_OFFER: ['APPLICANT_COMPANY', 'MERCHANT_BANKER', 'UNDERWRITER'], // Underwriter can edit offer terms
};

function PreviewDocument({ activeSection }: { activeSection: DRHPSection | undefined }) {
  if (!activeSection) {
    return <div className="h-full flex items-center justify-center text-slate-400">Select a section to preview</div>
  }

  const content = activeSection.content || "Drafting in progress... Use the editor panel to add content to this section."

  return (
    <div className="prose prose-slate prose-h2:font-serif prose-h2:border-b prose-h2:pb-2 max-w-none">
      <h2 className="text-3xl tracking-tight">{activeSection.title}</h2>
      {content.split('\n\n').map((paragraph, i) => (
        <p key={i} className="text-slate-800 leading-relaxed text-justify">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

export default function DocumentationPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await fetch('/api/me')).json()
  });

  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => (await fetch(`/api/projects/${projectId}`)).json()
  });

  const { data: sectionsRes, isLoading } = useQuery({
    queryKey: ['sections', projectId],
    queryFn: async () => (await fetch(`/api/drhp-sections?projectId=${projectId}`)).json()
  });

  const myMembership = projectRes?.project?.members?.find((m: any) => m.userId === me?.id);
  const myRole = myMembership?.role as ProjectRole | undefined;

  const sections: DRHPSection[] = sectionsRes?.sections || [];

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  
  // Local edit state to avoid saving every keystroke
  const [draftContent, setDraftContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  // Initialize draft when active section changes
  useEffect(() => {
    if (sections.length > 0 && activeSectionId) {
      const sec = sections.find((s) => s.id === activeSectionId)
      if (sec && !isDirty) { // Only overwrite if we haven't dirtied the editor
        setDraftContent(sec.content || "")
      }
    }
  }, [activeSectionId, sections, isDirty])

  // Fallback section selection
  useEffect(() => {
    if (sections.length > 0 && !activeSectionId) {
      setActiveSectionId(sections[0].id)
    }
  }, [sections, activeSectionId])

  const activeSection = sections.find(s => s.id === activeSectionId)

  const updateMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const res = await fetch(`/api/drhp-sections/${activeSectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', content })
      })
      if (!res.ok) throw new Error("Update failed")
      return res.json()
    },
    onSuccess: () => {
      setIsDirty(false)
      queryClient.invalidateQueries({ queryKey: ['sections', projectId] })
    },
    onError: () => {
      toast({ title: "Failed to save draft", variant: "destructive" })
    }
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/drhp-sections/${activeSectionId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Section submitted for review" })
      queryClient.invalidateQueries({ queryKey: ['sections', projectId] })
      queryClient.invalidateQueries({ queryKey: ['section', activeSectionId] })
    },
    onError: (error: any) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" })
    }
  })

  const handleSave = () => {
    if (!activeSectionId) return
    updateMutation.mutate({ content: draftContent })
  }

  const handleSubmitForReview = async () => {
    if (!activeSectionId) return
    // Save draft first if dirty
    if (isDirty) {
      await updateMutation.mutateAsync({ content: draftContent })
    }
    submitMutation.mutate()
  }

  // Calculate overall progress
  const totalSections = sections.length || 0
  const completedSections = sections.filter(s => s.status === 'APPROVED').length || 0
  const progressPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-800" /></div>
  }

  const canEdit = activeSection && myRole && CATEGORY_EDITORS[activeSection.category]?.includes(myRole);
  const isLocked = activeSection?.status === 'APPROVED' || activeSection?.status === 'SUBMITTED_FOR_REVIEW';
  const canEditCurrently = canEdit && !isLocked;

  const renderNavList = () => {
    return sections.map((section) => (
      <button
        key={section.id}
        onClick={() => {
          setActiveSectionId(section.id)
          setIsDirty(false)
        }}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left transition-colors border-l-2 ${
          activeSectionId === section.id 
            ? "border-slate-800 bg-slate-100 font-medium text-slate-900" 
            : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <div className="flex items-center gap-3 truncate">
          {section.status === 'APPROVED' ? (
            <CheckCircle2 className={`h-4 w-4 shrink-0 ${activeSectionId === section.id ? 'text-slate-800' : 'text-green-500'}`} />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-slate-300" />
          )}
          <span className="truncate">{section.title}</span>
        </div>
        
        {/* Status Indicators */}
        {section.status === 'SUBMITTED_FOR_REVIEW' && <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="In Review" />}
        {section.status === 'CHANGES_REQUESTED' && <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Changes Requested" />}
      </button>
    ))
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full -mx-4 -my-8 px-0 sm:-mx-6 lg:-mx-8">
      
      {/* Left Sidebar - Navigation */}
      <div className="w-64 border-r bg-slate-50 flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Offer Document
          </h2>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Overall Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-2">
            {renderNavList()}
          </div>
        </ScrollArea>
      </div>

      {/* Middle Panel - Editor */}
      <div className="flex-1 flex flex-col border-r bg-white min-w-[400px]">
        <div className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-slate-50">
          <div className="font-medium text-slate-900 truncate flex items-center gap-2">
            {activeSection?.title || "Editor"}
            {activeSection?.status === 'APPROVED' && <Lock className="h-3 w-3 text-slate-400" />}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="h-8" 
              onClick={handleSave}
              disabled={!canEditCurrently || !isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
              Save Draft
            </Button>
            <Button 
              size="sm" 
              className="h-8 bg-slate-800 hover:bg-slate-900"
              onClick={handleSubmitForReview}
              disabled={!canEditCurrently || submitMutation.isPending || (activeSection?.status === 'SUBMITTED_FOR_REVIEW')}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ArrowUpCircle className="mr-2 h-3 w-3" />}
              Submit for Review
            </Button>
          </div>
        </div>
        
        <div className="flex-1 p-4 flex flex-col bg-slate-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
              Draft Content
              {activeSection?.status === 'CHANGES_REQUESTED' && <span className="text-red-600 normal-case tracking-normal font-normal">— Changes Requested</span>}
              {activeSection?.status === 'SUBMITTED_FOR_REVIEW' && <span className="text-amber-600 normal-case tracking-normal font-normal">— Locked for Review</span>}
            </span>
            {isDirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
          </div>
          {!canEdit ? (
            <div className="flex-1 border rounded-md border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500">
              You do not have permission to edit this category ({activeSection?.category})
            </div>
          ) : (
            <Textarea 
              className="flex-1 resize-none font-mono text-sm leading-relaxed p-4 border-slate-200 focus-visible:ring-1"
              placeholder="Start drafting here..."
              value={draftContent}
              onChange={(e) => {
                setDraftContent(e.target.value)
                setIsDirty(true)
              }}
              disabled={!canEditCurrently}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="w-[45%] flex flex-col bg-slate-100 hidden lg:flex shrink-0">
        <div className="h-14 border-b bg-white flex items-center px-6 shrink-0">
          <span className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4" /> Live Document Preview
          </span>
        </div>
        <ScrollArea className="flex-1 p-8">
          <div className="bg-white mx-auto shadow-sm border border-slate-200 min-h-full p-12 w-full max-w-[800px]">
            <PreviewDocument activeSection={activeSection} />
          </div>
        </ScrollArea>
      </div>

    </div>
  )
}