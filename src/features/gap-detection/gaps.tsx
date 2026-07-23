"use client";
import { useParams } from "next/navigation";

import { AlertCircle, Clock, CheckCircle2, Circle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useListGaps, useUpdateGap, ComplianceGap } from "@workspace/api-client-react"
import { GapUpdateStatus } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { getListGapsQueryKey } from "@workspace/api-client-react"

export default function GapsPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: gaps, isLoading } = useListGaps(projectId)
  const updateMutation = useUpdateGap()

  // Mock data fallback
  const displayGaps = gaps && gaps.length > 0 ? gaps : [
    { id: 1, projectId, gap: "Missing independent director", reason: "Board composition does not meet SEBI LODR requirements for unlisted turning listed.", priority: "critical", recommendedAction: "Appoint 1 Independent Director", responsibleStakeholder: "Promoters", status: "open", dueDate: "2023-11-15" },
    { id: 2, projectId, gap: "Pending environment clearance", reason: "Factory unit 3 operating without renewed clearance.", priority: "high", recommendedAction: "File for expedited renewal", responsibleStakeholder: "Legal Team", status: "in_progress", dueDate: "2023-11-01" },
    { id: 3, projectId, gap: "Related party transactions unapproved", reason: "3 transactions in FY23 missing audit committee approval.", priority: "medium", recommendedAction: "Ratify in next board meeting", responsibleStakeholder: "Company Secretary", status: "open" },
    { id: 4, projectId, gap: "Website missing policies", reason: "Mandatory investor policies not published on corporate website.", priority: "low", recommendedAction: "Publish policies", responsibleStakeholder: "IT / Legal", status: "resolved" },
  ] as ComplianceGap[]

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Critical</Badge>
      case 'high': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">High</Badge>
      case 'medium': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Medium</Badge>
      case 'low': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Low</Badge>
      default: return <Badge variant="outline">{priority}</Badge>
    }
  }

  const handleStatusChange = (gapId: number, status: string) => {
    updateMutation.mutate({
      projectId,
      data: { gapId, status: status as GapUpdateStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Status updated" })
        queryClient.invalidateQueries({ queryKey: getListGapsQueryKey(projectId) })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compliance Gaps</h1>
          <p className="text-slate-500 mt-1">Track and resolve substantive regulatory hurdles before filing.</p>
        </div>
        <Button>Add Manual Gap</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Gap Description & Reason</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Action Required</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="w-[180px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayGaps.map((gap) => (
              <TableRow key={gap.id}>
                <TableCell>
                  <div className="font-medium text-slate-900">{gap.gap}</div>
                  <div className="text-xs text-slate-500 mt-1">{gap.reason}</div>
                  {gap.dueDate && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                      <Clock className="h-3 w-3" /> Due: {gap.dueDate}
                    </div>
                  )}
                </TableCell>
                <TableCell>{getPriorityBadge(gap.priority)}</TableCell>
                <TableCell className="text-sm text-slate-700">{gap.recommendedAction}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-slate-50">{gap.responsibleStakeholder || 'Unassigned'}</Badge>
                </TableCell>
                <TableCell>
                  <Select 
                    defaultValue={gap.status} 
                    onValueChange={(val) => handleStatusChange(gap.id, val)}
                    disabled={updateMutation.isPending}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        <span className="flex items-center gap-2 text-slate-600"><Circle className="h-3 w-3" /> Open</span>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <span className="flex items-center gap-2 text-blue-600"><AlertCircle className="h-3 w-3" /> In Progress</span>
                      </SelectItem>
                      <SelectItem value="resolved">
                        <span className="flex items-center gap-2 text-green-600"><CheckCircle2 className="h-3 w-3" /> Resolved</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}