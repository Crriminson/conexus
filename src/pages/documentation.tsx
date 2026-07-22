import { useState, useEffect, useRef } from "react"
import { useParams } from "wouter"
import { Search, Loader2, Sparkles, CheckCircle2, Circle, ChevronRight, FileText, FileSignature, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useGetDocumentation, useUpdateDocumentation, DocSection } from "@workspace/api-client-react"
import { getGetDocumentationQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"

// Safe wrapper around document preview content
function PreviewDocument({ activeSection }: { activeSection: DocSection | undefined }) {
  if (!activeSection) {
    return <div className="h-full flex items-center justify-center text-slate-400">Select a section to preview</div>
  }

  // Fallback content if empty
  const content = activeSection.content || "Drafting in progress... Use the editor panel to add content to this section."

  return (
    <div className="prose prose-slate prose-h2:font-serif prose-h2:border-b prose-h2:pb-2 max-w-none">
      <h2 className="text-3xl tracking-tight">{activeSection.title}</h2>
      
      {/* Simulating document format - in reality would render markdown/html */}
      {content.split('\n\n').map((paragraph, i) => (
        <p key={i} className="text-slate-800 leading-relaxed text-justify">
          {paragraph}
        </p>
      ))}

      {activeSection.formData && Object.keys(activeSection.formData).length > 0 && (
        <div className="mt-8 bg-slate-50 p-4 border border-slate-200">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Structured Data</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {Object.entries(activeSection.formData).map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium text-slate-900">{k}</dt>
                <dd className="text-slate-600">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

export default function DocumentationPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: documentation, isLoading } = useGetDocumentation(projectId)
  const updateMutation = useUpdateDocumentation()

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  
  // Local edit state to avoid saving every keystroke
  const [draftContent, setDraftContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  // Initialize draft when active section changes
  useEffect(() => {
    if (documentation && activeSectionId) {
      const sec = documentation.sections.find((s) => s.id === activeSectionId)
      if (sec) {
        setDraftContent(sec.content || "")
        setIsDirty(false)
      }
    }
  }, [activeSectionId, documentation])

  // Fallback section selection
  useEffect(() => {
    if (documentation && documentation.sections.length > 0 && !activeSectionId) {
      setActiveSectionId(documentation.sections[0].id)
    }
  }, [documentation, activeSectionId])

  const activeSection = documentation?.sections.find(s => s.id === activeSectionId)

  const handleSave = () => {
    if (!activeSectionId) return

    updateMutation.mutate({
      projectId,
      data: {
        sectionId: activeSectionId,
        content: draftContent,
      }
    }, {
      onSuccess: () => {
        setIsDirty(false)
        // Optimistic update of local cache
        queryClient.setQueryData(getGetDocumentationQueryKey(projectId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            sections: old.sections.map((s: DocSection) => 
              s.id === activeSectionId ? { ...s, content: draftContent } : s
            )
          }
        })
      },
      onError: () => {
        toast({ title: "Failed to save draft", variant: "destructive" })
      }
    })
  }

  // Calculate overall progress
  const totalSections = documentation?.sections.length || 0
  const completedSections = documentation?.sections.filter(s => s.completed).length || 0
  const progressPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  // Group sections by assumed chapters for navigation hierarchy
  const renderNavList = () => {
    if (!documentation) return null;
    return documentation.sections.map((section) => (
      <button
        key={section.id}
        onClick={() => setActiveSectionId(section.id)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-l-2 ${
          activeSectionId === section.id 
            ? "border-primary bg-primary/5 font-medium text-primary" 
            : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        {section.completed ? (
          <CheckCircle2 className={`h-4 w-4 shrink-0 ${activeSectionId === section.id ? 'text-primary' : 'text-green-500'}`} />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-slate-300" />
        )}
        <span className="truncate">{section.title}</span>
      </button>
    ))
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full -mx-4 -my-8 px-0 sm:-mx-6 lg:-mx-8">
      
      {/* Left Sidebar - Navigation */}
      <div className="w-64 border-r bg-slate-50/50 flex flex-col shrink-0">
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
        <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
          <div className="font-medium text-slate-900 truncate">
            {activeSection?.title || "Editor"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
              <Sparkles className="mr-2 h-3 w-3" /> AI Assist
            </Button>
            <Button 
              size="sm" 
              className="h-8" 
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
              Save Draft
            </Button>
          </div>
        </div>
        
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Draft Content</span>
            {isDirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
          </div>
          <Textarea 
            className="flex-1 resize-none font-mono text-sm leading-relaxed p-4 border-slate-200 focus-visible:ring-1"
            placeholder="Start drafting here..."
            value={draftContent}
            onChange={(e) => {
              setDraftContent(e.target.value)
              setIsDirty(true)
            }}
          />
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