import { useState } from "react"
import { useParams } from "wouter"
import { ShieldCheck, Play, AlertCircle, XCircle, CheckCircle2, ChevronDown, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useListValidations, useRunValidation, ValidationIssue } from "@workspace/api-client-react"
import { getListValidationsQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"

export default function ValidationPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: issues, isLoading } = useListValidations(projectId)
  const runMutation = useRunValidation()

  const handleRunValidation = () => {
    runMutation.mutate({ projectId }, {
      onSuccess: () => {
        toast({ title: "Validation Engine Complete", description: "Rules engine executed successfully." })
        queryClient.invalidateQueries({ queryKey: getListValidationsQueryKey(projectId) })
      },
      onError: () => {
        toast({ title: "Validation Failed", variant: "destructive" })
      }
    })
  }

  // Mock data fallback if API is empty
  const displayIssues = issues && issues.length > 0 ? issues : [
    { id: 1, projectId, type: "missing_field", severity: "error", message: "Promoter DIN is missing in Management section", section: "Management", isResolved: false },
    { id: 2, projectId, type: "financial_mismatch", severity: "error", message: "Net Worth in 'Key Metrics' does not match audited financials upload", section: "Financials", isResolved: false },
    { id: 3, projectId, type: "data_inconsistency", severity: "warning", message: "Registered office address differs slightly from MCA records", section: "Company Profile", isResolved: false },
    { id: 4, projectId, type: "suggestion", severity: "suggestion", message: "Consider adding more detail to competitive landscape", section: "Business", isResolved: true }
  ] as ValidationIssue[]

  const errorCount = displayIssues.filter(i => i.severity === 'error' && !i.isResolved).length
  const warningCount = displayIssues.filter(i => i.severity === 'warning' && !i.isResolved).length
  const suggestionCount = displayIssues.filter(i => i.severity === 'suggestion' && !i.isResolved).length

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-500" />
      case 'suggestion': return <CheckCircle2 className="h-5 w-5 text-blue-500" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Validation Engine</h1>
          <p className="text-slate-500 mt-1">Cross-check document content against structural and regulatory rules.</p>
        </div>
        <Button 
          onClick={handleRunValidation} 
          disabled={runMutation.isPending}
          className="gap-2"
        >
          {runMutation.isPending ? (
             <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Running Engine...</span>
          ) : (
            <><Play className="h-4 w-4" /> Run Validation</>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Open Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{errorCount + warningCount + suggestionCount}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Critical Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{errorCount}</div>
            <p className="text-xs text-red-500 mt-1">Must fix before filing</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{warningCount}</div>
            <p className="text-xs text-amber-500 mt-1">Inconsistencies detected</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{suggestionCount}</div>
            <p className="text-xs text-blue-500 mt-1">Best practices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription className="mt-1">Last run: Just now</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" /> Filter
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Issue Description</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayIssues.map((issue) => (
                <TableRow key={issue.id} className={issue.isResolved ? "opacity-50" : ""}>
                  <TableCell>{getSeverityIcon(issue.severity)}</TableCell>
                  <TableCell>
                    <span className={`font-medium ${issue.isResolved ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                      {issue.message}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{issue.section}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500 capitalize">{issue.type.replace('_', ' ')}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {!issue.isResolved && (
                      <Button variant="secondary" size="sm">Fix Issue</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}