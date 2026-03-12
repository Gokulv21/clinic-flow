import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import NotFound from "./pages/NotFound.tsx";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // Case: User is logged in but has no roles assigned yet
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-4 max-w-sm">
          <h1 className="text-xl font-bold">Access Pending</h1>
          <p className="text-muted-foreground text-sm">Your account is created, but no role has been assigned. Please contact the administrator.</p>
          <Button variant="outline" onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/clinic-flow/login';
          }}>Back to Login</Button>
        </div>
      </div>
    );
  }

  // Strict role redirection for Dashboard access
  if (location.pathname === '/' && roles.includes('nurse') && !roles.includes('doctor')) {
    return <Navigate to="/nurse" replace />;
  }

  if (allowedRoles && !allowedRoles.some(r => roles.includes(r as any))) {
    // Redirect to home or specific entry point based on role
    const fallbackPath = roles.includes('nurse') ? '/nurse' : (roles.includes('printer') ? '/print' : '/');
    return <Navigate to={fallbackPath} replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/clinic-flow">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/nurse" element={<ProtectedRoute allowedRoles={['nurse', 'doctor']}><NurseEntry /></ProtectedRoute>} />
            <Route path="/consultation" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorConsultation /></ProtectedRoute>} />
            <Route path="/print" element={<ProtectedRoute allowedRoles={['printer', 'doctor']}><PrintQueue /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute allowedRoles={['doctor']}><PatientList /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['doctor']}><Analytics /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorProfile /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['doctor']}><UserManagement /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;