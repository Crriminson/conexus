import { CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "Approved":
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      );
    case "Validated":
      return (
        <Badge className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
          <CheckCircle2 className="h-3 w-3" /> Validated
        </Badge>
      );
    case "Rejected":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Rejected
        </Badge>
      );
    case "Uploaded":
      return <Badge variant="secondary">Uploaded</Badge>;
    case "Draft":
      return <Badge variant="outline">Draft</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
