"use client";
import { AppLayout } from '@/components/layout/app-layout';
import ExportPage from '@/features/export/export';

export default function Page() {
  return (
    <AppLayout>
      <ExportPage />
    </AppLayout>
  );
}