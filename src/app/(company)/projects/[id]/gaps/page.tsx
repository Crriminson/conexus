"use client";
import { AppLayout } from '@/components/layout/app-layout';
import GapsPage from '@/features/gap-detection/gaps';

export default function Page() {
  return (
    <AppLayout>
      <GapsPage />
    </AppLayout>
  );
}