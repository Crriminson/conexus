"use client";
import { useState, useRef, useCallback } from "react";

import {
  UploadCloud,
  Loader2,
  Trash2,
} from "lucide-react";

import { FileIcon } from "@/components/ui/file-icon";
import { StatusBadge } from "@/components/ui/status-badge";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function UploadPage({ projectId }: UploadPageProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

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

  // Fetch on first render
  useState(() => {
    fetchDocuments();
  });

  // ─── File helpers ──────────────────────────────────────────────────────────

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // ─── Upload logic ─────────────────────────────────────────────────────────

  const handleFiles = async (files: FileList) => {
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})...`);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
        }

        toast({ title: `Uploaded ${file.name}` });
      } catch (err: any) {
        toast({
          title: `Failed to upload ${file.name}`,
          description: err.message,
          variant: "destructive",
        });
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    // Reset the file input
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Refresh document list
    fetchDocuments();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Document Upload
          </h1>
          <p className="text-slate-500 mt-1">
            Upload source files. Conexus AI will extract structured data for the
            Knowledge Base.
          </p>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <Card
        className={`border-2 border-dashed transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-slate-200 bg-slate-50/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {isUploading
              ? uploadProgress
              : "Click or drag files to this area to upload"}
          </h3>
          <p className="text-slate-500 mb-6 max-w-md">
            Support for a single or bulk upload. Supported formats: PDF, DOCX,
            XLSX, JPG, PNG. Maximum file size: 50MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleChange}
            accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
            multiple
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Select Files
          </Button>
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Source Documents</CardTitle>
          <CardDescription>
            {documents.length} file{documents.length !== 1 ? "s" : ""} uploaded
            to this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell><FileIcon mimeType={doc.mimeType} /></TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {doc.title}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {formatSize(doc.sizeBytes)}
                    </TableCell>
                    <TableCell><StatusBadge status={doc.status} /></TableCell>
                    <TableCell className="text-right text-slate-500 text-sm">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {documents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-slate-500"
                    >
                      No documents uploaded yet. Drag files above to get
                      started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}