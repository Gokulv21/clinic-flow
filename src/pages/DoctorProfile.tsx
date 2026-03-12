import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, Activity, Clock } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';

export default function DoctorProfile() {
    const { profile } = useAuth();
    const [totalPatients, setTotalPatients] = useState<number>(0);
    const [todayPatients, setTodayPatients] = useState<number>(0);
    const [recentVisits, setRecentVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDoctorStats() {
            if (!profile?.id) return;

            try {
                // 1. Get TOTAL distinct patients seen by this doctor
                // We do this by grabbing all visits for this doctor and counting unique patient_ids
                const { data: allVisitsData, error: allVisitsError } = await supabase
                    .from('visits')
                    .select('patient_id')
                    .eq('doctor_id', profile.id);

                if (!allVisitsError && allVisitsData) {
                    const uniquePatients = new Set(allVisitsData.map(v => v.patient_id));
                    setTotalPatients(uniquePatients.size);
                }

                // 2. Get TODAY'S visits handled by this doctor
                const todayStart = startOfDay(new Date()).toISOString();
                const todayEnd = endOfDay(new Date()).toISOString();

                const { count: todayCount, error: todayError } = await supabase
                    .from('visits')
                    .select('*', { count: 'exact', head: true })
                    .eq('doctor_id', profile.id)
                    .gte('created_at', todayStart)
                    .lte('created_at', todayEnd);

                if (!todayError) {
                    setTodayPatients(todayCount || 0);
                }

                // 3. Get the 5 most recent patients seen by this doctor to populate a mini-feed
                const { data: recent, error: recentError } = await supabase
                    .from('visits')
                    .select(`
            id, created_at, status,
            patients (name, age, sex)
          `)
                    .eq('doctor_id', profile.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!recentError && recent) {
                    setRecentVisits(recent);
                }

            } catch (err) {
                console.error("Error fetching doctor stats:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchDoctorStats();
    }, [profile?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── HEADER ── */}
            <div>
                <h1 className="text-3xl font-heading font-bold tracking-tight text-slate-900">Doctor Profile</h1>
                <p className="text-muted-foreground mt-1 text-lg">Your personal consultation statistics and summary.</p>
            </div>

            {/* ── PROFILE INFO CARD ── */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-100 shadow-sm">
                <CardContent className="p-8 flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-white shadow-sm border border-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-3xl font-bold text-blue-600">
                            {profile?.full_name?.charAt(0)?.toUpperCase() || 'D'}
                        </span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{profile?.full_name}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Doctor
                            </span>
                            <span className="text-slate-500 text-sm">{profile?.email}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── STATS GRID ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Total Patients Consulted
                        </CardTitle>
                        <Users className="w-5 h-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900">{totalPatients}</div>
                        <p className="text-sm text-slate-500 mt-1">Unique patients handled by you</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Patients Seen Today
                        </CardTitle>
                        <Calendar className="w-5 h-5 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900">{todayPatients}</div>
                        <p className="text-sm text-slate-500 mt-1">Consultations completed today</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── RECENT ACTIVITY ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="w-5 h-5 text-slate-400" />
                        Your Recent Consultations
                    </CardTitle>
                    <CardDescription>The last 5 patients you have consulted with.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentVisits.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
                                No recent consultations found.
                            </div>
                        ) : (
                            recentVisits.map((visit) => (
                                <div key={visit.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-900">{visit.patients?.name || 'Unknown Patient'}</span>
                                        <span className="text-sm text-slate-500">
                                            {visit.patients?.age} yrs • {visit.patients?.sex}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Clock className="w-4 h-4" />
                                        {new Date(visit.created_at).toLocaleDateString()} at {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
