"use client";
import { AppLayout } from '@/components/layout/app-layout';
import ReviewPage from '@/features/expert-review/review';

export default function Page() {
  return (
    <AppLayout>
      <ReviewPage />
    </AppLayout>
  );
}