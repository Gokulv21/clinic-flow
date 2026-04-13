import { ReactNode, useState, useRef, useEffect } from 'react';
import { useAuth, AppRole } from '@/lib/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Stethoscope, ClipboardPlus, Printer, BarChart3, Users, LogOut, Home, Menu, HelpCircle, Sun, Moon, Monitor, ChevronUp, Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from '@/components/ThemeProvider';
import logo from '@/assets/logo.png';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Home className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Consult Staff', path: '/calls', icon: <Phone className="w-5 h-5" />, roles: ['staff', 'doctor'] },
  { label: 'Patient Entry', path: '/nurse', icon: <ClipboardPlus className="w-5 h-5" />, roles: ['staff', 'doctor'] },
  { label: 'Consultation', path: '/consultation', icon: <Stethoscope className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Print Queue', path: '/print', icon: <Printer className="w-5 h-5" />, roles: ['staff', 'doctor'] },
  { label: 'Patients', path: '/patients', icon: <Users className="w-5 h-5" />, roles: ['doctor', 'staff'] },
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Profile', path: '/profile', icon: <Users className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'User Mgmt', path: '/users', icon: <Users className="w-5 h-5" />, roles: ['doctor'] },
  { label: 'Help', path: '/help', icon: <HelpCircle className="w-5 h-5" />, roles: ['staff', 'doctor'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isDockVisible, setIsDockVisible] = useState(true);

  const { scrollY } = useScroll({ container: scrollRef });

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 60) {
      setIsDockVisible(false); // Hide when scrolling down
    } else {
      setIsDockVisible(true);  // Show when scrolling up
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  const handleMobileNav = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const visibleItems = navItems.filter(item => item.roles.some(r => roles.includes(r)));

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#000000] font-jakarta-sans relative overflow-hidden">
      {/* Decorative Background Elements for Glass effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/20 blur-[100px] rounded-full" />
      </div>

      {/* ── Desktop Fluid Sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarExpanded ? 260 : 88 }}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className="hidden md:flex flex-col glass-regular sticky top-0 h-screen z-50 border-r border-white/20 select-none overflow-hidden"
      >
        <div className={cn(
          "border-b border-white/10 flex h-[90px] mb-4 transition-all duration-300",
          isSidebarExpanded ? "p-6 items-center" : "justify-center items-center"
        )}>
           <motion.div 
             animate={{ x: isSidebarExpanded ? 0 : 0 }}
             className="flex items-center gap-4 shrink-0"
           >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-2xl flex items-center justify-center border border-white/50 overflow-hidden">
                <img src={logo} className="w-9 h-9 object-contain" alt="Logo" />
              </div>
              <AnimatePresence>
                {isSidebarExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="whitespace-nowrap"
                  >
                    <h2 className="font-black text-slate-900 dark:text-white text-lg tracking-tighter">PreScripto</h2>
                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{profile?.full_name}</p>
                  </motion.div>
                )}
              </AnimatePresence>
           </motion.div>
        </div>

        <nav className="flex-1 px-4 space-y-2 relative">
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-4 px-3 py-3 rounded-2xl text-sm transition-all duration-300 relative z-10",
                  isActive ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {/* Active/Hover Highlight Pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-blue-600 shadow-xl shadow-blue-500/30 rounded-2xl -z-10"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                
                <div className="shrink-0 w-6 flex justify-center drop-shadow-sm">{item.icon}</div>
                
                <AnimatePresence>
                  {isSidebarExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="whitespace-nowrap font-bold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10 space-y-4">
            {/* Theme Toggle Capsule */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl relative">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 rounded-xl transition-all relative z-10",
                    theme === 'light' ? "text-blue-600 font-black" : "text-slate-500"
                  )}
                >
                  {theme === 'light' && <motion.div layoutId="theme-active" className="absolute inset-0 bg-white shadow-sm rounded-xl" />}
                  <Sun className="w-5 h-5 relative z-10" />
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 rounded-xl transition-all relative z-10",
                    theme === 'dark' ? "text-blue-400 font-black" : "text-slate-500"
                  )}
                >
                  {theme === 'dark' && <motion.div layoutId="theme-active" className="absolute inset-0 bg-slate-800 shadow-sm rounded-xl" />}
                  <Moon className="w-5 h-5 relative z-10" />
                </button>
            </div>

            <button
                onClick={signOut}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-2xl text-sm text-red-500 font-black hover:bg-red-500/10 transition-all overflow-hidden"
            >
                <div className="shrink-0 w-6 flex justify-center"><LogOut className="w-5 h-5" /></div>
                {isSidebarExpanded && <span className="whitespace-nowrap uppercase tracking-widest text-[10px]">Sign Out</span>}
            </button>
        </div>
      </motion.aside>

      {/* ── Dynamic Mobile Dock (iOS style) ── */}
      <motion.nav
        initial={{ x: "-50%", y: 0 }}
        animate={{ 
          x: "-50%",
          y: isMobileMenuOpen ? 120 : (isDockVisible ? 0 : 120), 
          opacity: isMobileMenuOpen ? 0 : (isDockVisible ? 1 : 0),
          scale: isMobileMenuOpen ? 0.9 : 1
        }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="fixed bottom-6 left-1/2 z-[100] glass-thick flex md:hidden h-16 px-4 rounded-full items-center gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/30 max-w-[95vw] w-fit"
      >
        {visibleItems.slice(0, 4).map(item => {
           const isActive = location.pathname === item.path;
           return (
            <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                    "flex-1 min-w-[60px] flex flex-col items-center justify-center gap-1 transition-all relative px-2 h-12 rounded-full",
                    isActive ? "text-blue-600" : "text-slate-950 dark:text-white"
                )}
            >
                {isActive && (
                    <motion.div 
                        layoutId="dock-active"
                        className="absolute inset-0 bg-blue-600/10 rounded-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}
                <div className="drop-shadow-sm font-bold">{item.icon}</div>
                <span className="text-[10px] font-black uppercase tracking-tighter opacity-100 leading-none">{item.label}</span>
            </button>
           );
        })}
        <div className="w-[1px] h-6 bg-white/20 mx-1" />
        
        {/* Mobile menu trigger */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <button className="h-12 w-12 rounded-full flex items-center justify-center bg-white/5 active:scale-90">
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-0 rounded-t-[3.5rem] glass-water border-t-0 shadow-[0_-20px_80px_rgba(0,0,0,0.5)] h-[80vh] overflow-hidden flex flex-col transition-transform duration-700">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">Menu</h3>
                <p className="text-[9px] text-blue-600 font-black uppercase tracking-[0.2em]">{profile?.full_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full bg-white/5 active:scale-75 transition-all">
                <ChevronUp className="w-4 h-4 rotate-180" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-auto p-5 grid grid-cols-4 gap-3 pb-8">
              {visibleItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleMobileNav(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-[2.5rem] transition-all active:scale-90 glass-droplet",
                      isActive ? "text-blue-600 border-blue-500/30 scale-105 shadow-[0_20px_40px_rgba(59,130,246,0.3)]" : "text-white"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center shadow-inner transition-transform relative overflow-hidden",
                      isActive ? "bg-blue-600 text-white" : "bg-white/20 dark:bg-black/40"
                    )}>
                      {/* Internal Liquid Shimmer */}
                      {isActive && <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent animate-pulse" />}
                      <div className="relative z-10 drop-shadow-lg">{item.icon}</div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-tight text-center drop-shadow-xl leading-tight text-white">{item.label}</span>
                  </button>
                );
              })}
              
              <button
                onClick={signOut}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-[2.5rem] text-red-500 glass-droplet border-red-500/10 active:scale-95 transition-all font-black"
              >
                <div className="w-11 h-11 rounded-full bg-red-600/10 flex items-center justify-center shadow-inner border border-red-500/5">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight">Logout</span>
              </button>
            </div>
            
            <div className="p-6 bg-blue-600/[0.02] border-t border-white/5 shrink-0">
               <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                  {['light', 'dark', 'system'].map(v => (
                    <button
                        key={v}
                        onClick={() => setTheme(v as any)}
                        className={cn(
                            "flex-1 py-1.5 items-center justify-center flex rounded-[0.9rem] transition-all text-[9px] font-black uppercase tracking-widest active:scale-95",
                            theme === v ? "bg-white dark:bg-slate-800 text-blue-600 shadow-md" : "text-slate-500"
                        )}
                    >
                        {v}
                    </button>
                  ))}
               </div>
            </div>
          </SheetContent>
        </Sheet>
      </motion.nav>

      {/* ── Main Canvas (Fluid integration) ── */}
      <main ref={scrollRef} className="flex-1 overflow-auto bg-transparent relative h-screen">
          <div className="min-h-full md:p-8 p-3 pb-36">
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="min-h-full glass-thick md:rounded-[3rem] rounded-[2rem] border border-white/30 p-4 md:p-10 shadow-[0_40px_100px_rgba(0,0,0,0.3)] overflow-hidden relative"
              >
                  {/* Atmospheric Glow inside the sheet */}
                  <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
                  {children}
              </motion.div>
          </div>
      </main>
    </div>
  );
}
