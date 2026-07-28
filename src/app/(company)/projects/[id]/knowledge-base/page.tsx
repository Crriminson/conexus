"use client";
import { useParams } from "next/navigation";
import KnowledgeBasePage from "@/features/knowledge-base/knowledge-base";

export default function Page() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <>
<KnowledgeBasePage projectId={projectId} />
    </>
);
}