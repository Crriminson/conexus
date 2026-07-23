"use client";
import { AppLayout } from '@/components/layout/app-layout';
import ProjectsPage from '@/features/dashboard/projects-list';

export default function Page() {
  return (
    <AppLayout>
      <ProjectsPage />
    </AppLayout>
  );
}