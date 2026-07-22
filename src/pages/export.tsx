import { useState } from "react"
import { useParams } from "wouter"
import { FileDown, FileText, CheckCircle2, Loader2, LayoutList, Layers } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useExportDocument, ExportInputFormat } from "@workspace/api-client-react"

export default function ExportPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  
  const exportMutation = useExportDocument()
  
  const [format, setFormat] = useState<ExportInputFormat>(ExportInputFormat.pdf)
  const [includeCover, setIncludeCover] = useState(true)
  const [includeToc, setIncludeToc] = useState(true)

  const handleExport = () => {
    exportMutation.mutate({
      projectId,
      data: {
        format,
        includeCoverPage: includeCover,
        includeTableOfContents: includeToc
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Export Generated", description: "Your file is ready to download." })
        // In a real app, we'd trigger the download here via the URL
        if (data.downloadUrl) {
          window.open(data.downloadUrl, '_blank')
        }
      },
      onError: () => {
        toast({ title: "Export Failed", variant: "destructive" })
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Generate Export</h1>
          <p className="text-slate-500 mt-1">Compile the Offer Document into its final deliverable format.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Format Options</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={format} 
                onValueChange={(v) => setFormat(v as ExportInputFormat)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value={ExportInputFormat.pdf} id="pdf" />
                  <Label htmlFor="pdf" className="flex-1 cursor-pointer flex items-center justify-between">
                    <span className="font-medium">PDF Document</span>
                    <Badge variant="secondary">Standard</Badge>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value={ExportInputFormat.docx} id="docx" />
                  <Label htmlFor="docx" className="flex-1 cursor-pointer font-medium">
                    Word Document (DOCX)
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="cover" 
                  checked={includeCover}
                  onCheckedChange={(c) => setIncludeCover(c === true)}
                />
                <Label htmlFor="cover" className="cursor-pointer font-medium text-slate-700">Include Standard Cover Page</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="toc" 
                  checked={includeToc}
                  onCheckedChange={(c) => setIncludeToc(c === true)}
                />
                <Label htmlFor="toc" className="cursor-pointer font-medium text-slate-700">Generate Table of Contents</Label>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-12 text-lg gap-2" 
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileDown className="h-5 w-5" />
            )}
            Generate & Download {format.toUpperCase()}
          </Button>
        </div>

        {/* Preview Panel */}
        <Card className="bg-slate-50/50 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LayoutList className="h-5 w-5 text-slate-400" /> Document Structure Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-slate-600">
              {includeCover && (
                <div className="flex items-center gap-3 p-2 bg-white rounded border">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">1. Cover Page</span>
                </div>
              )}
              {includeToc && (
                <div className="flex items-center gap-3 p-2 bg-white rounded border">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-medium">{includeCover ? '2' : '1'}. Table of Contents</span>
                </div>
              )}
              <div className="flex items-center gap-3 p-2 bg-white rounded border border-l-4 border-l-primary">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Summary</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-white rounded border border-l-4 border-l-primary">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Risk Factors</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-white rounded border border-l-4 border-l-primary">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Business Description</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-white rounded border border-l-4 border-l-primary opacity-60">
                <CheckCircle2 className="h-4 w-4 text-slate-300" />
                <span>Financial Statements (Partial)</span>
              </div>
            </div>
            
            {exportMutation.isSuccess && (
              <div className="mt-8 p-4 bg-green-50 text-green-800 rounded-md border border-green-200 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Export Complete</h4>
                  <p className="text-sm mt-1">If the download didn't start automatically, click the button again.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Ensure Badge is imported in local scope
function Badge({ className, variant, children }: any) {
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</div>
}