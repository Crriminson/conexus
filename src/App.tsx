import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

import LandingPage from '@/pages/landing';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import ForgotPasswordPage from '@/pages/forgot-password';

import { AppLayout } from '@/components/layout/app-layout';
import Dashboard from '@/pages/dashboard';
import ProjectsPage from '@/pages/projects-list';
import NewProjectPage from '@/pages/new-project';
import EligibilityPage from '@/pages/eligibility';
import UploadPage from '@/pages/upload';
import KnowledgeBasePage from '@/pages/knowledge-base';
import DocumentationPage from '@/pages/documentation';
import ValidationPage from '@/pages/validation';
import GapsPage from '@/pages/gaps';
import ReadinessPage from '@/pages/readiness';
import ReviewPage from '@/pages/review';
import ExportPage from '@/pages/export';
import SettingsPage from '@/pages/settings';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public routes without sidebar */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      {/* Authenticated routes wrapped in AppLayout */}
      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/projects">
        <AppLayout><ProjectsPage /></AppLayout>
      </Route>
      <Route path="/projects/new">
        <AppLayout><NewProjectPage /></AppLayout>
      </Route>
      
      {/* Project-specific workflow routes */}
      <Route path="/projects/:id/eligibility">
        <AppLayout><EligibilityPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/upload">
        <AppLayout><UploadPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/knowledge-base">
        <AppLayout><KnowledgeBasePage /></AppLayout>
      </Route>
      <Route path="/projects/:id/documentation">
        <AppLayout><DocumentationPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/validation">
        <AppLayout><ValidationPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/gaps">
        <AppLayout><GapsPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/readiness">
        <AppLayout><ReadinessPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/review">
        <AppLayout><ReviewPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/export">
        <AppLayout><ExportPage /></AppLayout>
      </Route>

      <Route path="/settings">
        <AppLayout><SettingsPage /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;