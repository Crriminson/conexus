import { File, FileText, FileSpreadsheet, Image as ImageIcon } from "lucide-react";

interface FileIconProps {
  mimeType: string | null;
  className?: string;
}

export function FileIcon({ mimeType, className = "h-8 w-8" }: FileIconProps) {
  if (!mimeType) return <File className={`${className} text-slate-500`} />;
  if (mimeType.includes("pdf")) return <FileText className={`${className} text-red-500`} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className={`${className} text-green-500`} />;
  if (mimeType.includes("word")) return <File className={`${className} text-blue-500`} />;
  if (mimeType.startsWith("image/")) return <ImageIcon className={`${className} text-purple-500`} />;
  return <File className={`${className} text-slate-500`} />;
}
