"use client";
import { AppLayout } from '@/components/layout/app-layout';
import EligibilityPage from '@/features/eligibility/eligibility';

export default function Page() {
  return (
    <AppLayout>
      <EligibilityPage />
    </AppLayout>
  );
}