import { useState, ReactNode, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, WifiOff, RefreshCw, ShieldAlert, Building2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NurseEntry from "@/pages/NurseEntry";
import DoctorConsultation from "@/pages/DoctorConsultation";
import PrintQueue from "@/pages/PrintQueue";
import PatientList from "@/pages/PatientList";
import Analytics from "@/pages/Analytics";
import UserManagement from "@/pages/UserManagement";
import DoctorProfile from "@/pages/DoctorProfile";
import Help from "@/pages/Help";
import Calls from "@/pages/Calls.tsx";
import ClinicSelection from "@/pages/ClinicSelection";
import SaaSManagement from "@/pages/SaaSManagement";
import PublicPrescription from "@/pages/PublicPrescription";
import NotFound from "./pages/NotFound.tsx";
import { CommunicationProvider } from "@/lib/communication";
import CallOverlay from "@/components/CallOverlay";
import { ThemeProvider } from "@/components/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Provides clinic logic context to nested components
function ClinicWrapper() {
  const { slug } = useParams();
  const { data: clinic, isLoading, error } = useQuery({
    queryKey: ['clinic', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase.from('clinics').select('*').eq('slug', slug).single();
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8"/></div>;
  if (error || !clinic) return <div className="flex justify-center items-center h-screen">Clinic not found</div>;

  // We expose clinic to the window for older queries just in case, but robustly we should use Context
  (window as any).__ACTIVE_CLINIC_ID = clinic.id;

  return (
    <AppLayout>
       <Outlet context={{ clinic }} />
    </AppLayout>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, roles, loading, error, refresh, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="relative">
        <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
      </div>
    </div>
  );

  if (error && roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-6 max-w-sm">
          <WifiOff className="w-8 h-8 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Network Issue</h1>
          <Button onClick={refresh} className="w-full gap-2 font-bold bg-primary text-white">Retry Connection</Button>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <ShieldAlert className="w-8 h-8 mx-auto" />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.some(r => roles.includes(r as any))) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}



// -----------------------------------------------------
// APP ROOT ROUTING
// -----------------------------------------------------
function RootRouter() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (user) {
     return <ClinicSelection />;
  }

  return <Navigate to="/login" />;
}

import { logSecurityEvent } from "@/lib/security";

// Monitering for suspicious behavior and API errors
function SecuritySentinel() {
  const { user } = useAuth();
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logSecurityEvent('API_ERROR', { 
        message: event.message,
        filename: event.filename,
        lineno: event.lineno
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (error?.message?.includes('JWT') || error?.message?.includes('permission denied')) {
        logSecurityEvent('SUSPICIOUS_TRAFFIC', { 
          reason: 'Unauthorized Database Attempt',
          details: error.message 
        });
      } else {
        logSecurityEvent('API_ERROR', { 
          message: error?.message || 'Unhandle Promise Rejection',
          stack: error?.stack 
        });
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="prescripto-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/prescripto">
          <AuthProvider>
            <SecuritySentinel />
            <CommunicationProvider>
              <CallOverlay />
              <Routes>
                {/* 1. Public Routes */}
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/rx/:visitId" element={<PublicPrescription />} />

                {/* 2. Root Redirector & Global Pages */}
                <Route path="/" element={<RootRouter />} />
                <Route path="/help" element={<ProtectedRoute><AppLayout><Help /></AppLayout></ProtectedRoute>} />

                {/* 3. Multi-Clinic Scoped Routes */}
                <Route path="/:slug" element={<ProtectedRoute><ClinicWrapper /></ProtectedRoute>}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="nurse" element={<ProtectedRoute allowedRoles={['staff', 'doctor', 'superadmin', 'owner']}><NurseEntry /></ProtectedRoute>} />
                  <Route path="consultation" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><DoctorConsultation /></ProtectedRoute>} />
                  <Route path="print" element={<ProtectedRoute allowedRoles={['staff', 'doctor', 'superadmin', 'owner']}><PrintQueue /></ProtectedRoute>} />
                  <Route path="patients" element={<ProtectedRoute allowedRoles={['staff', 'doctor', 'superadmin', 'owner']}><PatientList /></ProtectedRoute>} />
                  <Route path="analytics" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><Analytics /></ProtectedRoute>} />
                  <Route path="profile" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><DoctorProfile /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><UserManagement /></ProtectedRoute>} />
                  <Route path="saas" element={<ProtectedRoute allowedRoles={['superadmin']}><SaaSManagement /></ProtectedRoute>} />
                  <Route path="calls" element={<Calls />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </CommunicationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;