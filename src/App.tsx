import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, WifiOff, RefreshCw, ShieldAlert } from "lucide-react";
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
import NotFound from "./pages/NotFound.tsx";
import { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false, // Prevent lag when switching tabs
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, roles, loading, error, refresh, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="relative">
        <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-primary rounded-full" />
        </div>
      </div>
    </div>
  );

  // Only show the full-page blocking error if we HAVE NO ROLES IN CACHE. 
  // If we have roles, we let the user in "Offline Mode".
  if (error && roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-6 max-w-sm animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Network Connectivity Issue</h1>
            <p className="text-muted-foreground text-sm">We're unable to reach the security server (DNS/CORS Block). This happens during high traffic or local network issues.</p>
            <p className="text-[10px] font-mono text-destructive/70 bg-destructive/5 p-2 rounded border border-destructive/10 leading-tight break-all">{error}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={refresh} className="w-full gap-2 font-bold bg-primary text-white">
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              await signOut();
              window.location.reload();
            }} className="text-xs">
              Deep Reset & Clear Cache
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Case: User is logged in but has no roles assigned yet
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-4 max-w-sm animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Access Pending</h1>
            <p className="text-muted-foreground text-sm">Your account is created, but no role has been assigned yet. Please contact the clinic administrator to activate your access.</p>
          </div>
          <Button variant="outline" className="w-full font-bold" onClick={async () => {
            await signOut();
            navigate('/login');
          }}>Back to Login</Button>
        </div>
      </div>
    );
  }

  // Strict role redirection for Dashboard access
  if (location.pathname === '/' && roles.includes('staff') && !roles.includes('doctor')) {
    return <Navigate to="/nurse" replace />;
  }

  if (allowedRoles && !allowedRoles.some(r => roles.includes(r as any))) {
    // Redirect to home or specific entry point based on role
    const fallbackPath = roles.includes('staff') ? '/nurse' : '/';
    return <Navigate to={fallbackPath} replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/prescripto">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/nurse" element={<ProtectedRoute allowedRoles={['staff', 'doctor']}><NurseEntry /></ProtectedRoute>} />
            <Route path="/consultation" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorConsultation /></ProtectedRoute>} />
            <Route path="/print" element={<ProtectedRoute allowedRoles={['staff', 'doctor']}><PrintQueue /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute allowedRoles={['staff', 'doctor']}><PatientList /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['doctor']}><Analytics /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorProfile /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['doctor']}><UserManagement /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;