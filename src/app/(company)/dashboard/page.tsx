"use client";
import { AppLayout } from '@/components/layout/app-layout';
import Dashboard from '@/features/dashboard/dashboard';

export default function Page() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}