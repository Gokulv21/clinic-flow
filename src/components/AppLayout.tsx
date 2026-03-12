import { ReactNode } from 'react';
import { useAuth, AppRole } from '@/lib/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Stethoscope, ClipboardPlus, Printer, BarChart3, Users, LogOut, Home
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Home className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Patient Entry', path: '/nurse', icon: <ClipboardPlus className="w-5 h-5" />, roles: ['nurse', 'doctor'] },
  { label: 'Consultation', path: '/consultation', icon: <Stethoscope className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Print Queue', path: '/print', icon: <Printer className="w-5 h-5" />, roles: ['printer', 'doctor'] },
  { label: 'Patients', path: '/patients', icon: <Users className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Profile', path: '/profile', icon: <Users className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'User Mgmt', path: '/users', icon: <Users className="w-5 h-5" />, roles: ['doctor'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = navItems.filter(item => item.roles.some(r => roles.includes(r)));

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 gradient-sidebar flex flex-col shrink-0 hidden md:flex">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-sidebar-foreground text-sm">Clinic Manager</h2>
              <p className="text-xs text-sidebar-foreground/60">{profile?.full_name}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                location.pathname === item.path && "bg-sidebar-accent text-sidebar-foreground font-medium"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex md:hidden">
        {visibleItems.slice(0, 5).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground",
              location.pathname === item.path && "text-primary font-medium"
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}