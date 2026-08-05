"use client";
import { useParams } from "next/navigation";
import UploadPage from "@/features/upload/upload";

export default function Page() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <>
<UploadPage projectId={projectId} />
    </>
);
}