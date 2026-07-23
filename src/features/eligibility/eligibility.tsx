"use client";
import { useEffect, useState } from "react"
import Link from "next/link";
import { useParams } from "next/navigation";

import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Save, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useGetEligibility, useSubmitEligibility, useGetProject } from "@workspace/api-client-react"

// Hardcoded questionnaire definition since it drives the UI structure
const QUESTIONNAIRE = [
  {
    id: "q1",
    title: "Net Tangible Assets",
    question: "Does the company have net tangible assets of at least ₹3 Crores in each of the preceding 3 full years?",
    category: "Financial",
  },
  {
    id: "q2",
    title: "Average Operating Profit",
    question: "Does the company have an average operating profit of at least ₹15 Crores during the preceding 3 years?",
    category: "Financial",
  },
  {
    id: "q3",
    title: "Net Worth",
    question: "Does the company have a net worth of at least ₹1 Crore in each of the preceding 3 full years?",
    category: "Financial",
  },
  {
    id: "q4",
    title: "Name Change",
    question: "If the company changed its name in the last year, is at least 50% of revenue from activity suggested by the new name?",
    category: "Corporate",
  },
  {
    id: "q5",
    title: "Promoter Background",
    question: "Are any promoters or directors currently debarred from accessing capital markets by SEBI?",
    category: "Legal",
    reverseLogic: true, // "Yes" is bad here
  },
  {
    id: "q6",
    title: "Wilful Defaulters",
    question: "Is the company, its promoters, or directors classified as wilful defaulters by RBI?",
    category: "Legal",
    reverseLogic: true,
  }
]

export default function EligibilityPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()

  const { data: project } = useGetProject(projectId)
  const { data: eligibility, isLoading } = useGetEligibility(projectId)
  const submitMutation = useSubmitEligibility()

  // Local state for answers
  const [answers, setAnswers] = useState<Record<string, string>>({})
  
  // Initialize from server data
  useEffect(() => {
    if (eligibility?.answers) {
      const initial: Record<string, string> = {}
      eligibility.answers.forEach(a => {
        initial[a.questionId] = a.answer
      })
      setAnswers(initial)
    }
  }, [eligibility])

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSave = () => {
    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer
    }))

    submitMutation.mutate({
      projectId,
      data: { answers: formattedAnswers }
    }, {
      onSuccess: () => {
        toast({ title: "Assessment saved successfully" })
      },
      onError: () => {
        toast({ title: "Failed to save", variant: "destructive" })
      }
    })
  }

  const answeredCount = Object.keys(answers).length
  const totalCount = QUESTIONNAIRE.length
  const progress = Math.round((answeredCount / totalCount) * 100)

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  // If already submitted and has score, show results view instead of active form
  if (eligibility?.status && eligibility.status !== 'pending') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Eligibility Results</h1>
            <p className="text-slate-500 mt-1">{project?.companyName || "Project"} IPO Readiness Assessment</p>
          </div>
          <Button variant="outline" onClick={() => setAnswers({})}>Retake Assessment</Button>
        </div>

        <Card className="border-t-4 border-t-primary">
          <CardHeader className="text-center pb-2">
            <CardTitle>Assessment Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-8 border-slate-100">
              {/* Fake circular progress */}
              <div 
                className="absolute inset-0 rounded-full border-8 border-primary border-r-transparent border-b-transparent rotate-45"
              />
              <div className="text-center">
                <span className="text-4xl font-bold text-slate-900">{eligibility.score}</span>
                <span className="text-sm text-slate-500 block">/ 100</span>
              </div>
            </div>
            
            <div className="mt-8 flex items-center gap-2">
              {eligibility.status === 'eligible' && (
                <><CheckCircle2 className="h-6 w-6 text-green-500" /><span className="text-xl font-semibold text-green-700">Eligible for Main Board</span></>
              )}
              {eligibility.status === 'conditional' && (
                <><AlertCircle className="h-6 w-6 text-amber-500" /><span className="text-xl font-semibold text-amber-700">Conditionally Eligible</span></>
              )}
              {eligibility.status === 'not_eligible' && (
                <><XCircle className="h-6 w-6 text-red-500" /><span className="text-xl font-semibold text-red-700">Not Currently Eligible</span></>
              )}
            </div>
          </CardContent>
        </Card>

        {eligibility.recommendations && eligibility.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recommendations & Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {eligibility.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-3 bg-slate-50 p-4 rounded-md border">
                    {rec.priority === 'high' ? (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <span className="text-sm text-slate-700">{rec.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t justify-end">
              <Link href={`/projects/${projectId}/upload`}>
                <Button>Continue to Document Upload <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </CardFooter>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Eligibility Assessment</h1>
          <p className="text-slate-500 mt-1">Determine exchange fit and regulatory hurdles for {project?.companyName || "the company"}.</p>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background pt-4 pb-6 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="space-y-6 pb-20">
        {QUESTIONNAIRE.map((q, index) => {
          const value = answers[q.id]
          // Determine if answer is "good" or "bad" for styling
          let isGood = false;
          let isBad = false;
          const reverse = !!q.reverseLogic;
          if (value === "yes") {
            isGood = !reverse;
            isBad = reverse;
          } else if (value === "no") {
            isGood = reverse;
            isBad = !reverse;
          }

          return (
            <Card key={q.id} className={`transition-colors ${isGood ? 'border-green-200 bg-green-50/30' : isBad ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{q.category}</div>
                      <h3 className="text-lg font-medium text-slate-900 leading-snug">{q.question}</h3>
                    </div>
                    
                    <RadioGroup 
                      value={value} 
                      onValueChange={(val) => handleAnswer(q.id, val)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                        <Label htmlFor={`${q.id}-yes`} className="cursor-pointer text-base">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${q.id}-no`} />
                        <Label htmlFor={`${q.id}-no`} className="cursor-pointer text-base">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="not_applicable" id={`${q.id}-na`} />
                        <Label htmlFor={`${q.id}-na`} className="cursor-pointer text-base">Not Applicable</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-64 right-0 border-t bg-background/95 backdrop-blur p-4 flex justify-between items-center z-20">
        <span className="text-sm text-slate-500">
          {answeredCount} of {totalCount} answered
        </span>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleSave} disabled={submitMutation.isPending || answeredCount === 0}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={submitMutation.isPending || answeredCount < totalCount}
          >
            {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Assessment"}
          </Button>
        </div>
      </div>
    </div>
  )
}