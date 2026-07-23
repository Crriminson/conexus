"use client";
import { AppLayout } from '@/components/layout/app-layout';
import SettingsPage from '@/features/dashboard/settings';

export default function Page() {
  return (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  );
}