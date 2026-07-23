"use client";
import { AppLayout } from '@/components/layout/app-layout';
import UploadPage from '@/features/upload/upload';

export default function Page() {
  return (
    <AppLayout>
      <UploadPage />
    </AppLayout>
  );
}