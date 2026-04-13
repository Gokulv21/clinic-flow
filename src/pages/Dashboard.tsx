import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ClipboardPlus, Stethoscope, Printer, BarChart3, Users, Activity, TrendingUp, CalendarDays, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { profile, roles, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: stats = { total: 0, today: 0, completed: 0 }, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [totalPatients, todayVisits, completedToday] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lte('created_at', todayEnd),
        supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'completed')
      ]);

      return {
        total: totalPatients.count || 0,
        today: todayVisits.count || 0,
        completed: completedToday.count || 0
      };
    },
    staleTime: 30000, // Stats can be slightly stale
  });

  useEffect(() => {
    let debounceTimer: any;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }, 5000); // Drastically increased for resource relief
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }, 5000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const modules = [
    { label: 'Patient Entry', desc: 'Register & record vitals', icon: <ClipboardPlus className="w-6 h-6" />, path: '/nurse', roles: ['staff', 'doctor'] as const, color: 'from-blue-500 to-cyan-500' },
    { label: 'Consultation', desc: 'Queue & prescriptions', icon: <Stethoscope className="w-6 h-6" />, path: '/consultation', roles: ['doctor'] as const, color: 'from-indigo-500 to-purple-500' },
    { label: 'Print Queue', desc: 'Print records', icon: <Printer className="w-6 h-6" />, path: '/print', roles: ['staff', 'doctor'] as const, color: 'from-emerald-500 to-teal-500' },
    { label: 'Patient Records', desc: 'Manage health data', icon: <Users className="w-6 h-6" />, path: '/patients', roles: ['doctor', 'staff'] as const, color: 'from-slate-700 to-slate-900' },
  ];

  const visibleModules = modules.filter(m => m.roles.some(r => hasRole(r)));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10 font-jakarta-sans pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Welcome, <span className="text-blue-600">{(profile?.full_name ?? 'Doctor')}</span>
          </h1>
          <p className="text-muted-foreground font-medium mt-1 text-lg">
            {roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' & ')} Overview
          </p>
        </div>
        <div className="flex items-center gap-3 glass-thick px-5 py-2.5 rounded-full shadow-2xl border border-white/20">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Clinic Live</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Today's Visits", val: stats.today, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: "Completed", val: stats.completed, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: "Total Patients", val: stats.total, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' }
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-none shadow-2xl overflow-hidden group glass-regular rounded-[2.5rem] border border-white/10">
              <CardContent className="p-7 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">{s.label}</p>
                  <p className="text-4xl font-black text-slate-900 dark:text-white group-hover:scale-110 transition-all duration-500 origin-left drop-shadow-sm">{s.val}</p>
                </div>
                <div className={cn("p-4 rounded-3xl transition-all duration-500 group-hover:rotate-12 shadow-inner", s.bg)}>
                  <s.icon className={cn("w-7 h-7", s.color)} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-[13px] font-black tracking-[0.2em] text-muted-foreground uppercase">Core Operations</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleModules.map((m, i) => (
            <motion.button
              key={m.path}
              whileHover={{ y: -10, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => navigate(m.path)}
              className="group relative flex flex-col p-8 glass-thick rounded-[3rem] border border-white/20 transition-all duration-500 text-left shadow-2xl overflow-hidden active:scale-90"
            >
              <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 bg-gradient-to-br shadow-2xl group-hover:rotate-6 transition-all duration-500", m.color)}>
                <div className="text-white drop-shadow-md">{m.icon}</div>
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-xl text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors tracking-tight">{m.label}</h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
              <div className="absolute top-6 right-6 text-blue-500/5 group-hover:text-blue-500/10 transition-all duration-700">
                 <Activity className="w-16 h-16" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}