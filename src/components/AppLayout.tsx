import { ReactNode, useState } from 'react';
import { useAuth, AppRole } from '@/lib/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Stethoscope, ClipboardPlus, Printer, BarChart3, Users, LogOut, Home, Menu, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import logo from '@/assets/logo.png';

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
  { label: 'Help', path: '/help', icon: <HelpCircle className="w-5 h-5" />, roles: ['nurse', 'doctor', 'printer'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMobileNav = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const visibleItems = navItems.filter(item => item.roles.some(r => roles.includes(r)));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - Hover to expand */}
      <aside 
        className={cn(
          "gradient-sidebar flex flex-col shrink-0 hidden md:flex h-screen sticky top-0 transition-all duration-300 ease-in-out group z-50",
          "w-20 hover:w-64"
        )}
      >
        <div className="p-4 border-b border-sidebar-border relative min-h-[85px] flex items-center mb-2">
          <div className="flex items-center gap-3 overflow-hidden w-full transition-all">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-sidebar-border overflow-hidden">
              <img src={logo} className="w-8 h-8 object-contain" alt="Logo" />
            </div>
            <div className={cn(
              "transition-all duration-300 whitespace-nowrap opacity-0 group-hover:opacity-100"
            )}>
              <h2 className="font-heading font-bold text-sidebar-foreground text-sm uppercase tracking-wider">Prescripto</h2>
              <p className="text-[10px] text-sidebar-foreground/60 truncate max-w-[140px] uppercase font-medium">{profile?.full_name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {visibleItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent relative group/item",
                location.pathname === item.path && "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-inner"
              )}
            >
              <div className="shrink-0 w-6 flex justify-center">{item.icon}</div>
              <span className={cn(
                "transition-all duration-300 whitespace-nowrap opacity-0 group-hover:opacity-100"
              )}>
                {item.label}
              </span>
              
              {/* Tooltip for when collapsed (if needed, but group-hover handles it now) */}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border mt-auto">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/60 hover:text-white hover:bg-destructive/20 transition-all overflow-hidden"
          >
            <div className="shrink-0 w-6 flex justify-center">
              <LogOut className="w-5 h-5" />
            </div>
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap opacity-0 group-hover:opacity-100"
            )}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex md:hidden h-16 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {visibleItems.slice(0, 4).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground transition-colors",
              location.pathname === item.path && "text-primary font-bold"
            )}
          >
            <div className={cn(
              "p-1 rounded-md transition-colors",
              location.pathname === item.path && "bg-primary/10"
            )}>
              {item.icon}
            </div>
            <span className="truncate w-full text-center px-1 font-medium">{item.label}</span>
          </button>
        ))}
        
        {/* More Menu for Mobile */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground group">
              <div className="p-1 rounded-md group-hover:bg-secondary transition-colors">
                <Menu className="w-5 h-5" />
              </div>
              <span className="font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-0 rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col border-t-0 shadow-2xl">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-heading font-bold text-xl">Quick Menu</h3>
              <div className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">{profile?.full_name}</div>
            </div>
            <div className="flex-1 overflow-auto p-4 grid grid-cols-3 gap-3">
              {visibleItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleMobileNav(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl text-xs transition-all active:scale-95",
                    location.pathname === item.path ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-transform",
                    location.pathname === item.path ? "bg-primary text-white scale-110" : "bg-muted"
                  )}>
                    {item.icon}
                  </div>
                  <span className="text-center truncate w-full">{item.label}</span>
                </button>
              ))}
              <button
                onClick={signOut}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl text-xs text-destructive hover:bg-destructive/10 transition-all active:scale-95"
              >
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shadow-sm">
                  <LogOut className="w-5 h-5" />
                </div>
                <span>Sign Out</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 bg-slate-50/50">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
