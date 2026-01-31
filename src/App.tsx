// Main App Component with React Router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Layout
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Pages
import { Dashboard } from './pages/Dashboard';
import { CasesList } from './pages/CasesList';
import { CaseDetail } from './pages/CaseDetail';
import { CaseNew } from './pages/CaseNew';
import { PaymentsConsole } from './pages/PaymentsConsole';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { FinanceReport } from './pages/FinanceReport';
import { ManualIntake } from './pages/ManualIntake';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Protected Route wrapper - useAuth handles redirect to login portal
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  // Show loading while checking auth - useAuth will redirect if no session
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }
  
  return <>{children}</>;
}

// Main App
function AppRoutes() {
  return (
    <Routes>
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="cases" element={<CasesList />} />
        <Route path="cases/new" element={<CaseNew />} />
        <Route path="cases/:caseId" element={<CaseDetail />} />
        <Route path="payments" element={<PaymentsConsole />} />
        <Route path="payments/:caseId" element={<PaymentsConsole />} />
        <Route path="approvals" element={<ApprovalQueue />} />
        <Route path="finance" element={<FinanceReport />} />
        <Route path="intake" element={<ManualIntake />} />
      </Route>
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
