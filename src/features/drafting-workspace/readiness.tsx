"use client";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import { Rocket, ShieldAlert, CheckCircle2, CircleDashed, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"

interface ReadinessDashboard {
  projectId: string
  overallScore: number
  sectionScores: { section: string; score: number; maxScore: number; status: string }[]
  validationPassed: number
  pendingGaps: number
  readyForReview: boolean
  timeline: { id: number; title: string; date: string; status: string }[]
}

export default function ReadinessPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const { data: readiness, isLoading } = useQuery({
    queryKey: ['readiness', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/readiness`);
      if (!res.ok) throw new Error("Failed to fetch readiness");
      return res.json();
    }
  })

  // Mock data fallback
  const displayData: ReadinessDashboard = readiness || {
    projectId,
    overallScore: 78,
    sectionScores: [
      { section: "Company Profile", score: 100, maxScore: 100, status: "complete" },
      { section: "Financials", score: 90, maxScore: 100, status: "partial" },
      { section: "Management", score: 60, maxScore: 100, status: "partial" },
      { section: "Business", score: 85, maxScore: 100, status: "partial" },
      { section: "Legal", score: 40, maxScore: 100, status: "missing" },
    ],
    validationPassed: 85,
    pendingGaps: 3,
    readyForReview: false,
    timeline: [
      { id: 1, title: "Kickoff", date: "Oct 1", status: "completed" },
      { id: 2, title: "Data Collection", date: "Oct 15", status: "completed" },
      { id: 3, title: "Drafting", date: "Nov 1", status: "current" },
      { id: 4, title: "Filing", date: "Dec 1", status: "upcoming" },
    ]
  }

  // Circular progress data
  const pieData = [
    { name: 'Complete', value: displayData.overallScore },
    { name: 'Remaining', value: 100 - displayData.overallScore },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--slate-100))'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">IPO Readiness</h1>
          <p className="text-slate-500 mt-1">High-level executive summary of project status.</p>
        </div>
        {displayData.overallScore > 80 ? (
          <Badge className="bg-green-100 text-green-800 text-sm px-4 py-1.5 border-green-200 gap-2">
            <Rocket className="h-4 w-4" /> Ready for Final Review
          </Badge>
        ) : (
          <Badge variant="outline" className="text-sm px-4 py-1.5 gap-2 bg-white">
            <CircleDashed className="h-4 w-4 text-amber-500" /> In Progress
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Score Card */}
        <Card className="md:col-span-1 border-t-4 border-t-primary flex flex-col justify-between">
          <CardHeader className="pb-0 text-center">
            <CardTitle>Overall Readiness</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1">
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-slate-900">{displayData.overallScore}%</span>
              </div>
            </div>
            <div className="text-center space-y-1 mt-4">
              <p className="text-sm font-medium text-slate-700">Target Score: 100%</p>
              <p className="text-xs text-slate-500">Based on documentation, validations, and gaps.</p>
            </div>
          </CardContent>
        </Card>

        {/* Section Completion Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Section Completion</CardTitle>
            <CardDescription>Drafting progress by major document section</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayData.sectionScores} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="section" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
                    {displayData.sectionScores.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.status === 'complete' ? '#22c55e' : entry.status === 'partial' ? '#3b82f6' : '#cbd5e1'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Compliance Blockers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription className="mt-1">Remaining hurdles</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex flex-col items-center text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <div className="text-2xl font-bold text-slate-900">{displayData.validationPassed}%</div>
                <div className="text-xs text-slate-500 mt-1">Validations Passed</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-100 flex flex-col items-center text-center">
                <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
                <div className="text-2xl font-bold text-red-600">{displayData.pendingGaps}</div>
                <div className="text-xs text-red-500 mt-1">Pending Critical Gaps</div>
              </div>
            </div>
            <div className="mt-6 flex justify-center">
              <Link href={`/projects/${projectId}/gaps`}>
                <Button variant="outline" className="w-full">Resolve Gaps <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>IPO Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative border-l border-slate-200 ml-3 space-y-6 pb-4">
              {displayData.timeline.map((event, i) => (
                <div key={event.id} className="relative pl-6">
                  <div className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 bg-white ${
                    event.status === 'completed' ? 'border-green-500 bg-green-500' :
                    event.status === 'current' ? 'border-primary bg-primary' : 'border-slate-300'
                  }`} />
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${event.status === 'upcoming' ? 'text-slate-500' : 'text-slate-900'}`}>
                      {event.title}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5">{event.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}