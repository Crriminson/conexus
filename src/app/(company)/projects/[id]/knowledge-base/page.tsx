"use client";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import KnowledgeBasePage from "@/features/knowledge-base/knowledge-base";

export default function Page() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <AppLayout>
      <KnowledgeBasePage projectId={projectId} />
    </AppLayout>
  );
}