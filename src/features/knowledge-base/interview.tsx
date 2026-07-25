"use client";
import { useState } from "react";
import { Loader2, Bot, Sparkles, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AIInterviewProps {
  projectId: string;
  onFactsUpdated: () => void;
}

export function AIInterview({ projectId, onFactsUpdated }: AIInterviewProps) {
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSuccessCount(null);
    try {
      const res = await fetch(`/api/interview?projectId=${projectId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate questions");
      }

      const data = await res.json();
      setQuestions(data.questions);
      setAnswers({});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    // Validate that all questions have answers
    for (let i = 0; i < questions.length; i++) {
      if (!answers[i] || !answers[i].trim()) {
        toast({ title: "Missing answers", description: "Please answer all questions before submitting.", variant: "destructive" });
        return;
      }
    }

    setIsProcessing(true);
    try {
      const qnaPairs = questions.map((q, i) => ({
        question: q,
        answer: answers[i],
      }));

      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, qnaPairs }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process answers");
      }

      const data = await res.json();
      setSuccessCount(data.count);
      setQuestions([]);
      onFactsUpdated(); // Notify parent to refresh Knowledge Base
      
      toast({ title: "Success", description: `Extracted ${data.count} new facts into the Knowledge Base.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!questions.length && successCount === null && (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-blue-100 p-4 mb-4">
              <Bot className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Fill Knowledge Base Gaps</h3>
            <p className="text-slate-500 mb-6 max-w-lg">
              Conexus AI will analyze your current Knowledge Base, identify missing critical information required for a DRHP, and generate targeted interview questions for the founders.
            </p>
            <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="bg-blue-600 hover:bg-blue-700">
              {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              {isGenerating ? "Analyzing Database..." : "Generate Interview Questions"}
            </Button>
          </CardContent>
        </Card>
      )}

      {successCount !== null && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Interview Complete</h3>
            <p className="text-slate-600 mb-6">
              Successfully extracted {successCount} structured facts from your answers and categorized them in the Knowledge Base.
            </p>
            <Button onClick={handleGenerate} variant="outline" className="border-green-600 text-green-700 hover:bg-green-100">
              Run Another Interview
            </Button>
          </CardContent>
        </Card>
      )}

      {questions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 p-4">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <p className="text-sm text-blue-900">
              Based on the current gaps in your Knowledge Base, please answer the following questions to build a stronger DRHP.
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((q, i) => (
              <Card key={i} className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-medium text-slate-800 flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {i + 1}
                    </span>
                    {q}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Textarea 
                    placeholder="Provide a detailed answer here..."
                    className="min-h-[120px] resize-y"
                    value={answers[i] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-6">
            <Button size="lg" onClick={handleSubmit} disabled={isProcessing} className="w-full sm:w-auto">
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              {isProcessing ? "Extracting Facts..." : "Submit Answers & Extract Facts"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
