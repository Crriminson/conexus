"use client";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import UploadPage from "@/features/upload/upload";

export default function Page() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <AppLayout>
      <UploadPage projectId={projectId} />
    </AppLayout>
  );
}