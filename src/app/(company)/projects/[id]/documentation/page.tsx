"use client";
import { AppLayout } from '@/components/layout/app-layout';
import DocumentationPage from '@/features/drafting-workspace/documentation';

export default function Page() {
  return (
    <AppLayout>
      <DocumentationPage />
    </AppLayout>
  );
}