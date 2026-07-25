"use client";
import { useEffect, useState, useRef, useCallback } from "react";

import {
  UploadCloud,
  Loader2,
  Trash2,
  FileText,
  FileSpreadsheet,
  Image,
  File,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface DocumentRecord {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  projectId: string;
}

interface UploadPageProps {
  projectId: string;
}

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File className="h-5 w-5 text-slate-400" />;
  if (mimeType === "application/pdf")
    return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (mimeType.startsWith("image/"))
    return <Image className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-violet-500" />;
}

export default function UploadPage({ projectId }: UploadPageProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentUploadName, setCurrentUploadName] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Fetch documents ───────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch (err: any) {
      toast({
        title: "Failed to load documents",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  // Bug fix: was useState(() => ...) which never ran as a side-effect
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ─── File helpers ──────────────────────────────────────────────────────────
  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
      handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0)
      handleFiles(e.target.files);
  };

  // ─── Upload logic ─────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentUploadName(file.name);
      setUploadProgress(Math.round((i / files.length) * 100));
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      
      try {
        const res = await fetch("/api/documents", { method: "POST", body: formData });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
        }
        toast({ title: `✓ Uploaded ${file.name}` });
      } catch (err: any) {
        toast({ title: `Failed to upload ${file.name}`, description: err.message, variant: "destructive" });
      }
    }
    
    setUploadProgress(100);
    setIsUploading(false);
    setCurrentUploadName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocuments();
  };

  // ─── Delete logic ─────────────────────────────────────────────────────────
  const handleDelete = async (docId: string, docTitle: string) => {
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: `Deleted ${docTitle}` });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Document Upload</h1>
        <p className="text-slate-500 mt-1">
          Upload source files. Conexus AI will extract structured data for the Knowledge Base.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed
          cursor-pointer transition-all duration-500 py-24 text-center overflow-hidden group/dropzone
          ${dragActive
            ? "border-primary bg-primary/[0.02] scale-[1.02] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border-solid ring-4 ring-primary/20"
            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:scale-[1.01] hover:border-slate-300 hover:shadow-xl"
          }
        `}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none" />
        <div className={`
          relative z-10 rounded-full p-6 mb-6 transition-all duration-500
          ${dragActive ? "bg-primary/10 scale-110 shadow-inner rotate-3" : "bg-white shadow-sm group-hover/dropzone:scale-105 group-hover/dropzone:shadow-md"}
        `}>
          <UploadCloud className={`h-12 w-12 transition-colors duration-500 ${dragActive ? "text-primary" : "text-slate-400 group-hover/dropzone:text-slate-600"}`} />
        </div>

        <h3 className="text-xl font-semibold text-slate-800 mb-2">
          {isUploading ? `Uploading ${currentUploadName}...` : dragActive ? "Drop files to upload" : "Click or drag files here"}
        </h3>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">
          PDF, DOCX, XLSX, JPG, PNG · Max 50 MB per file
        </p>

        {isUploading ? (
          <div className="w-full max-w-xs space-y-3">
            <Progress value={uploadProgress} className="h-2 w-full bg-primary/10" />
            <div className="flex items-center justify-center gap-2 text-primary text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress}%
            </div>
          </div>
        ) : (
          <div className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
            Select Files
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
          multiple
        />
      </div>

      {/* Documents Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Uploaded Documents
            <span className="ml-2 text-sm font-normal text-slate-400">({documents.length})</span>
          </h2>
          {documents.length > 0 && (
            <button onClick={fetchDocuments} className="text-xs text-primary hover:underline">
              Refresh
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
            <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No documents yet. Upload files above to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 project-card-container">
            {documents.map((doc, i) => (
              <div
                key={doc.id}
                style={{ animationDelay: `${i * 100}ms` }}
                className="group flex items-start gap-4 rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
              >
                <div className="flex-shrink-0 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors group-hover:bg-white group-hover:border-slate-200 shadow-sm">
                  <FileTypeIcon mimeType={doc.mimeType} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[15px] font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">{doc.title}</p>
                  <p className="text-xs font-medium text-slate-500 mt-1">{formatSize(doc.sizeBytes)}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <StatusBadge status={doc.status} />
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id, doc.title)}
                  disabled={deletingId === doc.id}
                  className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 hover:shadow-sm"
                >
                  {deletingId === doc.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}