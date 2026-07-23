"use client";
import { useState, useEffect } from "react"
import { useParams } from "next/navigation";

import { useForm } from "react-hook-form"
import { Search, Loader2, Sparkles, Building2, Briefcase, FileText, Scale, Users, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useGetKnowledgeBase, useUpdateKnowledgeBase } from "@workspace/api-client-react"
import { Label } from "recharts"

// Map of tab names to their data keys and icons
const SECTIONS = [
  { id: "companyProfile", label: "Company Profile", icon: Building2 },
  { id: "financials", label: "Financials", icon: FileText },
  { id: "management", label: "Management", icon: Users },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "legal", label: "Legal & Regulatory", icon: Scale },
  { id: "riskFactors", label: "Risk Factors", icon: AlertTriangle },
]

export default function KnowledgeBasePage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  
  const { data: kb, isLoading } = useGetKnowledgeBase(projectId)
  const updateMutation = useUpdateKnowledgeBase()
  
  const [activeTab, setActiveTab] = useState("companyProfile")
  
  // Single form holding all data segments
  const form = useForm({
    defaultValues: {
      companyProfile: {},
      financials: {},
      business: {},
      legal: {},
    }
  })

  // Set form data when API loads
  useEffect(() => {
    if (kb) {
      form.reset({
        companyProfile: kb.companyProfile || {},
        financials: kb.financials || {},
        business: kb.business || {},
        legal: kb.legal || {},
      })
    }
  }, [kb, form])

  const onSubmit = (data: any) => {
    // Only send the active section to simulate partial updates
    const updateData = { [activeTab]: data[activeTab] }
    
    updateMutation.mutate({
      projectId,
      data: updateData
    }, {
      onSuccess: () => {
        toast({ title: "Knowledge base updated" })
      },
      onError: () => {
        toast({ title: "Failed to update", variant: "destructive" })
      }
    })
  }

  // Helper to render a field dynamically based on active tab
  const renderField = (name: string, label: string, type = "text") => (
    <FormField
      control={form.control}
      name={`${activeTab}.${name}` as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-slate-500">{label}</FormLabel>
          <FormControl>
            <Input 
              type={type}
              {...field} 
              value={field.value || ""} 
              className="bg-slate-50 focus-visible:bg-white" 
            />
          </FormControl>
        </FormItem>
      )}
    />
  )

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 mt-1">Structured company facts extracted from documents. Feeds the auto-drafter.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search facts..." className="pl-9" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span>Fields highlighted below were automatically updated from recent document uploads.</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6 overflow-x-auto">
          {SECTIONS.map((section) => (
            <TabsTrigger 
              key={section.id} 
              value={section.id}
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 py-3 bg-transparent data-[state=active]:bg-transparent"
            >
              <section.icon className="mr-2 h-4 w-4" />
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <TabsContent value="companyProfile" className="m-0 space-y-6 animate-in fade-in-50">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 text-slate-900">Corporate Identity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      {renderField("cin", "Corporate Identification Number (CIN)")}
                      {renderField("pan", "Permanent Account Number (PAN)")}
                      {renderField("dateOfIncorporation", "Date of Incorporation", "date")}
                      {renderField("email", "Corporate Email")}
                      <div className="md:col-span-2">
                        {renderField("registeredAddress", "Registered Office Address")}
                      </div>
                      <div className="md:col-span-2">
                        {renderField("businessDescription", "Brief Business Description")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financials" className="m-0 space-y-6 animate-in fade-in-50">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 text-slate-900">Key Financial Metrics (Latest FY)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                      {renderField("revenue", "Revenue (₹ Cr)", "number")}
                      {renderField("netProfit", "Net Profit (₹ Cr)", "number")}
                      {renderField("netWorth", "Net Worth (₹ Cr)", "number")}
                      {renderField("totalAssets", "Total Assets (₹ Cr)", "number")}
                      {renderField("debtEquityRatio", "Debt/Equity Ratio", "number")}
                      {renderField("epsBasic", "Basic EPS (₹)", "number")}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="business" className="m-0 space-y-6 animate-in fade-in-50">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 text-slate-900">Business Overview</h3>
                    <div className="grid grid-cols-1 gap-6">
                      {renderField("sector", "Primary Sector")}
                      <div className="space-y-2">
                        <Label className="text-slate-500">Core Products/Services</Label>
                        <Input value={(form.watch("business.products" as any) || []).join(", ")} readOnly className="bg-slate-50" />
                        <p className="text-xs text-slate-400">Comma separated array managed via API</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-500">Key Competitors</Label>
                        <Input value={(form.watch("business.competitors" as any) || []).join(", ")} readOnly className="bg-slate-50" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Legal and other tabs would be similarly structured */}
              <TabsContent value="legal" className="m-0 space-y-6 animate-in fade-in-50">
                 <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 text-slate-900">Legal Status</h3>
                    <div className="grid grid-cols-1 gap-6">
                      {renderField("litigationStatus", "Outstanding Litigation Summary")}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="management" className="m-0 text-center py-12 text-slate-500">
                Management interface to be implemented.
              </TabsContent>
              <TabsContent value="riskFactors" className="m-0 text-center py-12 text-slate-500">
                Risk factors interface to be implemented.
              </TabsContent>

              <div className="flex justify-end gap-4 border-t pt-6">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save {SECTIONS.find(s => s.id === activeTab)?.label}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </Tabs>
    </div>
  )
}