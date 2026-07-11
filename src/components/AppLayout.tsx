import { ReactNode, useState, useRef, useEffect } from 'react';
import { useAuth, AppRole } from '@/lib/auth';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Stethoscope, ClipboardPlus, Printer, BarChart3, Users, LogOut, Home, Menu, HelpCircle, Sun, Moon, Monitor, ChevronUp, Info
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
import NotificationCenter from './NotificationCenter';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Home className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'Patient Entry', path: '/nurse', icon: <ClipboardPlus className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'Consultation', path: '/consultation', icon: <Stethoscope className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'Print Queue', path: '/print', icon: <Printer className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'Patients', path: '/patients', icon: <Users className="w-5 h-5" />, roles: ['doctor', 'staff', 'superadmin', 'owner'] },
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'Profile', path: '/profile', icon: <Users className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'User Mgmt', path: '/users', icon: <Users className="w-5 h-5" />, roles: ['superadmin', 'owner'] },
  { label: 'About', path: '/about', icon: <Info className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'Help', path: '/help', icon: <HelpCircle className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
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

  const { slug } = useParams();

  const handleMobileNav = (path: string) => {
    const isGlobal = path === '/help';
    const fullPath = (slug && !isGlobal) ? `/${slug}${path === '/' ? '/dashboard' : path}` : path;
    navigate(fullPath);
    setIsMobileMenuOpen(false);
  };

  const visibleItems = navItems.filter(item => item.roles.some(r => roles.includes(r)));

  const getFullPath = (itemPath: string) => {
    if (!slug || itemPath === '/help') return itemPath;
    if (itemPath === '/') return `/${slug}/dashboard`;
    return `/${slug}${itemPath}`;
  };

  const navigateNext = () => {
    const currentIndex = visibleItems.findIndex(item => location.pathname === getFullPath(item.path) || (item.path === '/' && location.pathname.endsWith('/dashboard')));
    if (currentIndex >= 0 && currentIndex < visibleItems.length - 1) {
      navigate(getFullPath(visibleItems[currentIndex + 1].path));
    }
  };

  const navigatePrev = () => {
    const currentIndex = visibleItems.findIndex(item => location.pathname === getFullPath(item.path) || (item.path === '/' && location.pathname.endsWith('/dashboard')));
    if (currentIndex > 0) {
      navigate(getFullPath(visibleItems[currentIndex - 1].path));
    }
  };

  // Native swipe implementation
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth > 768) return;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (window.innerWidth > 768) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'CANVAS' || target.isContentEditable)) {
      return;
    }

    const distanceX = touchStartX.current - touchEndX;
    const distanceY = touchStartY.current - touchEndY;

    // Must be mostly horizontal and exceed threshold
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > 60) {
      if (distanceX > 0) {
        navigateNext(); // Swiped left
      } else {
        navigatePrev(); // Swiped right
      }
    }
  };

  return (
    <div
      className="min-h-screen flex bg-slate-50 dark:bg-[#000000] font-jakarta-sans relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
        <div
          className={cn(
            "border-b border-white/10 flex transition-all duration-300 overflow-hidden relative px-4 py-4",
            isSidebarExpanded ? "h-[100px] flex-row items-center justify-between" : "h-[140px] flex-col items-center justify-center gap-4"
          )}
        >
          <motion.div
            animate={{ x: 0 }}
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

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(!isSidebarExpanded && "mt-1")}
          >
            <NotificationCenter />
          </motion.div>
        </div>

        {/* Sidebar Nav - Scrollable section */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar py-2">
          {visibleItems.map((item) => {
            const fullPath = getFullPath(item.path);
            const isActive = location.pathname === fullPath || (item.path === '/' && location.pathname.endsWith('/dashboard'));

            return (
              <button
                key={item.path}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => navigate(fullPath)}
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
                      className="font-bold tracking-tight"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {hoveredItem === item.path && !isActive && (
                  <motion.div
                    layoutId="sidebar-hover"
                    className="absolute inset-0 bg-slate-100 dark:bg-white/5 rounded-2xl -z-20"
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10 space-y-4 shrink-0">
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
        className="fixed bottom-6 left-1/2 z-[100] flex md:hidden items-center gap-2 max-w-[95vw]"
      >
        {/* Nav pills */}
        <div className="glass-thick h-[60px] px-3 rounded-full flex items-center gap-0.5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-white/30">
          {visibleItems.slice(0, 4).map(item => {
            const fullPath = getFullPath(item.path);
            const isActive = location.pathname === fullPath || (item.path === '/' && location.pathname.endsWith('/dashboard'));
            return (
              <button
                key={item.path}
                onClick={() => navigate(fullPath)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-all relative px-2.5 h-11 rounded-full shrink-0 select-none",
                  isActive ? "text-blue-600" : "text-slate-600 dark:text-slate-400"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="dock-active"
                    className="absolute inset-0 bg-blue-600/10 dark:bg-blue-500/15 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <div className="relative z-10 w-5 h-5 flex items-center justify-center">{item.icon}</div>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-tighter leading-none relative z-10 whitespace-nowrap",
                  isActive ? "text-blue-600" : "text-slate-500 dark:text-slate-400"
                )}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* More button — gradient pill */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              className="h-[60px] px-5 rounded-full flex items-center gap-2 shrink-0 select-none bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_8px_30px_rgba(59,130,246,0.5)] border border-blue-400/30"
            >
              <Menu className="w-5 h-5 text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">More</span>
            </motion.button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="p-0 border-0 bg-transparent shadow-none overflow-visible"
            style={{ height: 'auto', maxHeight: '72vh' }}
          >
            {/* True glassmorphic panel */}
            <div
              className="mx-3 mb-4 rounded-[2rem] overflow-hidden border border-white/25 dark:border-white/10 shadow-[0_-30px_80px_rgba(0,0,0,0.4)]"
              style={{
                background: 'linear-gradient(160deg,rgba(255,255,255,0.82) 0%,rgba(235,242,255,0.80) 100%)',
                backdropFilter: 'blur(50px) saturate(220%)',
                WebkitBackdropFilter: 'blur(50px) saturate(220%)',
              }}
            >
              <div className="dark:[background:linear-gradient(160deg,rgba(12,16,36,0.90)_0%,rgba(8,12,30,0.94)_100%)] rounded-[2rem]">

                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06]">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Navigation</h3>
                    <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.2em] mt-0.5">{profile?.full_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <NotificationCenter />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="rounded-full w-8 h-8 bg-black/[0.06] dark:bg-white/10 active:scale-75 transition-all"
                    >
                      <ChevronUp className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </Button>
                  </div>
                </div>

                {/* Nav grid */}
                <div className="p-4 grid grid-cols-5 gap-2">
                  {visibleItems.map(item => {
                    const fullPath = getFullPath(item.path);
                    const isActive = location.pathname === fullPath || (item.path === '/' && location.pathname.endsWith('/dashboard'));
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleMobileNav(item.path)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl transition-all active:scale-90 select-none",
                          isActive
                            ? "bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/30"
                            : "bg-black/[0.04] dark:bg-white/[0.08] border border-transparent"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0",
                          isActive
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                            : "bg-slate-200 dark:bg-white/15 text-slate-600 dark:text-slate-300"
                        )}>
                          <div className="w-4 h-4">{item.icon}</div>
                        </div>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-tight text-center leading-tight",
                          isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
                        )}>{item.label}</span>
                      </button>
                    );
                  })}
                  {/* Logout tile */}
                  <button
                    onClick={signOut}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl bg-red-50/80 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/30 active:scale-90 transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-tight text-center leading-tight text-red-500">Logout</span>
                  </button>
                </div>

                {/* Theme toggle */}
                <div className="px-4 pb-5">
                  <div className="flex bg-black/[0.05] dark:bg-white/[0.08] p-1 rounded-xl border border-black/[0.05] dark:border-white/[0.05]">
                    {[
                      { v: 'light', icon: <Sun className="w-3 h-3" /> },
                      { v: 'dark', icon: <Moon className="w-3 h-3" /> },
                      { v: 'system', icon: <Monitor className="w-3 h-3" /> },
                    ].map(({ v, icon }) => (
                      <button
                        key={v}
                        onClick={() => setTheme(v as any)}
                        className={cn(
                          "flex-1 py-1.5 items-center justify-center flex gap-1 rounded-[0.6rem] transition-all text-[9px] font-black uppercase tracking-widest active:scale-95",
                          theme === v
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-slate-500 dark:text-slate-500"
                        )}
                      >
                        {icon}{v}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </SheetContent>
        </Sheet>
      </motion.nav>

      <main ref={scrollRef} className="flex-1 overflow-auto bg-transparent relative h-screen">
        <div className="min-h-full lg:p-10 md:p-6 p-3 pb-44">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "min-h-full md:rounded-[3rem] rounded-[2rem] p-4 md:p-10 overflow-hidden relative transition-all duration-700",
              "glass-thick border border-white/30 shadow-[0_40px_100px_rgba(0,0,0,0.3)]",
              "dark:glass3d dark:border-none dark:shadow-none"
            )}
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
