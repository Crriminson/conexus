"use client";
import { AppLayout } from '@/components/layout/app-layout';
import NewProjectPage from '@/features/dashboard/new-project';

export default function Page() {
  return (
    <AppLayout>
      <NewProjectPage />
    </AppLayout>
  );
}