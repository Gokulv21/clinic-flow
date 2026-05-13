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
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { data: clinic, isLoading, error, refetch } = useQuery({
    queryKey: ['clinic', slug],
    staleTime: 0, // Always fetch fresh clinic status to ensure immediate blocking
    queryFn: async () => {
      if (!slug) return null;
      console.log("[ClinicWrapper] Fetching clinic for slug:", slug);
      const { data, error } = await supabase.from('clinics').select('*').eq('slug', slug).single();
      if (error) {
        console.error("[ClinicWrapper] Fetch error:", error);
        throw error;
      }
      console.log("[ClinicWrapper] Clinic found:", data);
      return data;
    }
  });

  // Add real-time listener for clinic status changes
  useEffect(() => {
    if (!slug) return;
    
    const channel = supabase
      .channel(`clinic_status_${slug}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'clinics',
        filter: `slug=eq.${slug}`
      }, (payload) => {
        console.log("[ClinicWrapper] Clinic status updated via Realtime:", payload.new);
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, refetch]);


  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;

  if (error || !clinic) {
    console.error("[ClinicWrapper] Access Denied or Clinic Not Found:", { slug, error, user: user?.id, roles });
    return (
      <div className="flex flex-col justify-center items-center h-screen space-y-4">
        <h1 className="text-2xl font-bold">Clinic not found</h1>
        <p className="text-muted-foreground">Slug: <span className="font-mono">{slug}</span></p>
        {error && <p className="text-red-500 text-sm">Error: {(error as any).message}</p>}
        <Button onClick={() => navigate('/')}>Back to Selection</Button>
      </div>
    );
  }

  if (clinic.is_blocked && !roles.includes('superadmin')) {
    return (
      <div className="flex flex-col justify-center items-center h-screen space-y-8 p-8 text-center bg-slate-50 dark:bg-slate-950 font-jakarta-sans">
        <div className="relative">
           <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse" />
           <div className="relative w-24 h-24 bg-white dark:bg-slate-900 border border-red-500/30 text-red-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
              <ShieldAlert className="w-12 h-12" />
           </div>
        </div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Clinic <span className="text-red-600">Suspended</span></h1>
          <p className="text-slate-500 font-medium">
            Access to this clinical environment has been temporarily suspended by the system administrator.
          </p>
          {clinic.block_reason && (
            <div className="mt-6 p-6 rounded-[2rem] bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 shadow-inner">
               <p className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-2 flex items-center justify-center gap-2">
                  <Building2 className="w-3 h-3" /> Administrative Notice
               </p>
               <p className="text-sm font-bold text-red-900 dark:text-red-200 italic leading-relaxed">
                  "{clinic.block_reason}"
               </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
           <Button 
              onClick={() => navigate('/')} 
              className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-xl"
           >
              Back to Clinical Network
           </Button>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">
              Prescripto Security Operations
           </p>
        </div>
      </div>
    );
  }


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
                  <Route path="users" element={<ProtectedRoute allowedRoles={['superadmin', 'owner']}><UserManagement /></ProtectedRoute>} />
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