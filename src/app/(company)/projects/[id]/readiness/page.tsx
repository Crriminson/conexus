"use client";
import { AppLayout } from '@/components/layout/app-layout';
import ReadinessPage from '@/features/drafting-workspace/readiness';

export default function Page() {
  return (
    <AppLayout>
      <ReadinessPage />
    </AppLayout>
  );
}