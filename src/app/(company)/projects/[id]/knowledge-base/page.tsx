"use client";
import { AppLayout } from '@/components/layout/app-layout';
import KnowledgeBasePage from '@/features/knowledge-base/knowledge-base';

export default function Page() {
  return (
    <AppLayout>
      <KnowledgeBasePage />
    </AppLayout>
  );
}