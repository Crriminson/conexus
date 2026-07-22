import { useState } from "react"
import { useParams } from "wouter"
import { useForm } from "react-hook-form"
import { MessageSquare, Check, X, Send, Eye, Clock, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useListReviews, useCreateReview, Review, ReviewInputAction } from "@workspace/api-client-react"
import { getListReviewsQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"

export default function ReviewPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: reviews, isLoading } = useListReviews(projectId)
  const createMutation = useCreateReview()

  // Mock document sections for the left panel
  const sections = [
    { id: "s1", title: "Summary", status: "approved" },
    { id: "s2", title: "Risk Factors", status: "pending_review" },
    { id: "s3", title: "Business Description", status: "sent_back" },
  ]
  const [activeSection, setActiveSection] = useState(sections[1])

  // Mock comments fallback
  const displayReviews = reviews && reviews.length > 0 ? reviews : [
    { id: 1, projectId, reviewerName: "Sarah Jenkins", reviewerRole: "Lead Counsel", action: "commented", comment: "We need to expand on the regulatory risks in section 3.4.", section: "Risk Factors", createdAt: "2023-10-25T14:30:00Z" },
    { id: 2, projectId, reviewerName: "Michael Chang", reviewerRole: "Auditor", action: "approved", section: "Summary", createdAt: "2023-10-24T09:15:00Z" },
  ] as Review[]

  const sectionReviews = displayReviews.filter(r => !r.section || r.section === activeSection.title)

  const form = useForm({
    defaultValues: { comment: "" }
  })

  const submitReview = (action: ReviewInputAction) => {
    const comment = form.getValues().comment
    
    if (action !== ReviewInputAction.approved && !comment) {
      toast({ title: "Comment required", description: "Please add a comment for this action.", variant: "destructive" })
      return
    }

    createMutation.mutate({
      projectId,
      data: {
        action,
        comment,
        section: activeSection.title
      }
    }, {
      onSuccess: () => {
        toast({ title: "Review submitted" })
        form.reset()
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey(projectId) })
      }
    })
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full -mx-4 -my-8 px-0 sm:-mx-6 lg:-mx-8">
      
      {/* Left Panel - Document Viewer */}
      <div className="flex-1 flex flex-col border-r bg-white min-w-[500px]">
        <div className="h-14 border-b flex items-center px-4 bg-slate-50 gap-4 shrink-0">
          <Eye className="h-4 w-4 text-slate-500" />
          <span className="font-medium text-slate-700">Document Review Mode</span>
          <div className="ml-auto flex gap-2">
            {sections.map(s => (
              <Button 
                key={s.id} 
                variant={activeSection.id === s.id ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setActiveSection(s)}
                className="h-8"
              >
                {s.title}
                {s.status === 'approved' && <Check className="ml-2 h-3 w-3 text-green-500" />}
                {s.status === 'sent_back' && <X className="ml-2 h-3 w-3 text-red-500" />}
              </Button>
            ))}
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-8 bg-slate-100">
          <div className="bg-white shadow-sm border border-slate-200 p-12 max-w-[800px] mx-auto min-h-full prose prose-slate">
            <h2>{activeSection.title}</h2>
            <p>
              This section contains the drafted text for <strong>{activeSection.title}</strong>. In a full implementation, this text would be selectable, allowing reviewers to highlight specific sentences and attach comments directly to the text ranges.
            </p>
            <p>
              The company operates in a highly regulated environment. Changes in regulations could materially impact operations...
            </p>
            {/* Fake highlighted text */}
            <p>
              Management believes that <mark className="bg-yellow-200 px-1 rounded cursor-pointer">current capital reserves are sufficient for the next 24 months</mark> of projected operations.
            </p>
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Review Tools */}
      <div className="w-96 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b shrink-0">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Review Panel
          </h3>
          <p className="text-xs text-slate-500 mt-1">Actions apply to: {activeSection.title}</p>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {sectionReviews.map(review => (
              <div key={review.id} className="flex gap-3">
                <Avatar className="h-8 w-8 mt-0.5">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {review.reviewerName.split(' ').map(n=>n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">{review.reviewerName}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {review.action === 'approved' && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">Approved Section</Badge>
                  )}
                  {review.action === 'sent_back' && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 mt-1">Sent Back for Edits</Badge>
                  )}
                  
                  {review.comment && (
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100 text-sm text-slate-700">
                      {review.comment}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sectionReviews.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No comments yet on this section.
              </div>
            )}
          </div>
        </ScrollArea>

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
                        placeholder="Add a comment or feedback..." 
                        className="resize-none min-h-[80px] text-sm bg-white"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => submitReview(ReviewInputAction.sent_back)}
                  disabled={createMutation.isPending}
                >
                  <X className="mr-2 h-4 w-4" /> Send Back
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  className="w-full text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                  onClick={() => submitReview(ReviewInputAction.approved)}
                  disabled={createMutation.isPending}
                >
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button 
                  type="button" 
                  className="col-span-2 w-full"
                  onClick={() => submitReview(ReviewInputAction.commented)}
                  disabled={createMutation.isPending}
                >
                  <Send className="mr-2 h-4 w-4" /> Add Comment
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}