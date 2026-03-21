import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ClipboardPlus, Stethoscope, Printer, BarChart3, Users, Activity, TrendingUp, CalendarDays, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            Welcome, <span className="text-blue-600">{(profile?.full_name ?? 'Doctor')}</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-lg">
            {roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' & ')} Overview
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clinic Live</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Today's Visits", val: stats.today, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: "Completed", val: stats.completed, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: "Total Patients", val: stats.total, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' }
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm overflow-hidden group">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-3xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">{s.val}</p>
              </div>
              <div className={cn("p-3 rounded-2xl transition-all group-hover:rotate-12", s.bg)}>
                <s.icon className={cn("w-6 h-6", s.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-slate-400" />
          <h2 className="text-[13px] font-black tracking-[0.2em] text-slate-400 uppercase">Core Operations</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleModules.map(m => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className="group relative flex flex-col p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-blue-200 transition-all text-left shadow-sm hover:shadow-xl hover:-translate-y-2 overflow-hidden"
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform", m.color)}>
                <div className="text-white">{m.icon}</div>
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-black text-lg text-slate-900 group-hover:text-blue-600 transition-colors">{m.label}</h3>
                <p className="text-xs font-medium text-slate-400 line-clamp-2">{m.desc}</p>
              </div>
              <div className="absolute top-4 right-4 text-slate-200 group-hover:text-blue-100 transition-colors">
                 <Activity className="w-12 h-12 opacity-20" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}