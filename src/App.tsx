import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
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
import NotFound from "./pages/NotFound.tsx";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, roles, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.some(r => roles.includes(r as any))) {
    return <Navigate to="/" replace />;
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
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/nurse" element={<ProtectedRoute allowedRoles={['nurse', 'doctor']}><NurseEntry /></ProtectedRoute>} />
            <Route path="/consultation" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorConsultation /></ProtectedRoute>} />
            <Route path="/print" element={<ProtectedRoute allowedRoles={['printer', 'doctor']}><PrintQueue /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute allowedRoles={['doctor']}><PatientList /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['doctor']}><Analytics /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['doctor']}><UserManagement /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;