import { useState, useRef } from "react"
import { useParams } from "wouter"
import { UploadCloud, File, FileText, FileSpreadsheet, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
import { useListDocuments, useUploadDocument, useProcessDocument } from "@workspace/api-client-react"
import { DocumentInputFileType } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { getListDocumentsQueryKey } from "@workspace/api-client-react"

export default function UploadPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: documents, isLoading: isDocsLoading } = useListDocuments(projectId)
  const uploadMutation = useUploadDocument()
  const processMutation = useProcessDocument()

  const [dragActive, setDragActive] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)

  // Mock list for visual testing if API empty
  const displayDocs = documents && documents.length > 0 ? documents : [
    { id: 1, projectId, name: "Financial_Statements_FY23.pdf", fileType: "pdf", sizeKb: 2450, status: "processed", uploadedAt: "2023-10-25T10:00:00Z" },
    { id: 2, projectId, name: "MoA_AoA_Executed.pdf", fileType: "pdf", sizeKb: 5120, status: "processed", uploadedAt: "2023-10-25T10:05:00Z" },
    { id: 3, projectId, name: "Shareholding_Pattern.xlsx", fileType: "excel", sizeKb: 450, status: "uploaded", uploadedAt: "2023-10-26T14:30:00Z" },
    { id: 4, projectId, name: "Litigation_Summary.docx", fileType: "docx", sizeKb: 120, status: "failed", uploadedAt: "2023-10-26T15:00:00Z" }
  ] as any[]

  const getFileIcon = (type: string) => {
    switch(type) {
      case 'pdf': return <FileText className="h-8 w-8 text-red-500" />
      case 'excel': return <FileSpreadsheet className="h-8 w-8 text-green-500" />
      case 'docx': return <File className="h-8 w-8 text-blue-500" />
      case 'image': return <ImageIcon className="h-8 w-8 text-purple-500" />
      default: return <File className="h-8 w-8 text-slate-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'processed': return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Processed</Badge>
      case 'processing': return <Badge variant="blue" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Extracting</Badge>
      case 'failed': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>
      case 'uploaded': return <Badge variant="secondary">Ready to process</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = (files: FileList) => {
    // In a real app we'd upload multipart form data.
    // For this API client, we mock the metadata upload
    const file = files[0]
    
    // Determine type
    let fileType: DocumentInputFileType = DocumentInputFileType.pdf
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) fileType = DocumentInputFileType.excel
    else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) fileType = DocumentInputFileType.docx
    else if (file.name.match(/\.(jpg|jpeg|png)$/i)) fileType = DocumentInputFileType.image

    uploadMutation.mutate({
      projectId,
      data: {
        name: file.name,
        fileType,
        sizeKb: Math.round(file.size / 1024)
      }
    }, {
      onSuccess: () => {
        toast({ title: "File uploaded successfully" })
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(projectId) })
      },
      onError: () => {
        toast({ title: "Upload failed", variant: "destructive" })
      }
    })
  }

  const triggerExtraction = (documentId: number) => {
    setProcessingId(documentId)
    processMutation.mutate({
      projectId,
      documentId
    }, {
      onSuccess: () => {
        toast({ title: "Extraction complete", description: "Data added to Knowledge Base." })
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(projectId) })
        setProcessingId(null)
      },
      onError: () => {
        toast({ title: "Extraction failed", variant: "destructive" })
        setProcessingId(null)
      }
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Document Upload</h1>
          <p className="text-slate-500 mt-1">Upload source files. Conexus AI will extract structured data for the Knowledge Base.</p>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <Card 
        className={`border-2 border-dashed transition-all duration-200 ${dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/50'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Click or drag files to this area to upload</h3>
          <p className="text-slate-500 mb-6 max-w-md">
            Support for a single or bulk upload. Strict formatting applies. Supported formats: PDF, DOCX, XLSX. Maximum file size: 50MB.
          </p>
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            onChange={handleChange}
            accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Select Files
          </Button>
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Source Documents</CardTitle>
          <CardDescription>Files available for AI extraction</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayDocs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{getFileIcon(doc.fileType)}</TableCell>
                  <TableCell className="font-medium text-slate-900">{doc.name}</TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {doc.sizeKb ? `${(doc.sizeKb / 1024).toFixed(2)} MB` : '--'}
                  </TableCell>
                  <TableCell>
                    {processingId === doc.id ? getStatusBadge('processing') : getStatusBadge(doc.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    {doc.status === 'uploaded' || doc.status === 'failed' ? (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => triggerExtraction(doc.id)}
                        disabled={processingId !== null}
                      >
                        <Play className="mr-2 h-3 w-3" /> Extract Data
                      </Button>
                    ) : doc.status === 'processed' ? (
                      <Button size="sm" variant="ghost" disabled>Extracted</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {displayDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}