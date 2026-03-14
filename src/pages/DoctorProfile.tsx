import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, Activity, Clock, ShieldCheck, User, Loader2 } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type ProfileData = {
    full_name: string;
    email?: string;
};

export default function DoctorProfile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [totalPatients, setTotalPatients] = useState<number>(0);
    const [todayPatients, setTodayPatients] = useState<number>(0);
    const [recentVisits, setRecentVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDoctorStats() {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            try {
                // Fetch basic profile
                const { data: profData } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('user_id', user.id)
                    .single();

                if (profData) {
                    setProfile({ 
                        full_name: profData.full_name,
                        email: user.email 
                    });
                }

                // 1. Get TOTAL visits
                const { count: totalCount } = await supabase
                    .from('visits')
                    .select('*', { count: 'exact', head: true });
                setTotalPatients(totalCount || 0);

                // 2. Get TODAY'S visits
                const todayStart = startOfDay(new Date()).toISOString();
                const todayEnd = endOfDay(new Date()).toISOString();

                const { count: todayCount } = await supabase
                    .from('visits')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', todayStart)
                    .lte('created_at', todayEnd);

                setTodayPatients(todayCount || 0);

                // 3. Get the 5 most recent visits
                const { data: recent } = await supabase
                    .from('visits')
                    .select(`
                        id, created_at, status,
                        patients (name, age, sex)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (recent) {
                    setRecentVisits(recent);
                }

            } catch (err) {
                console.error("Error fetching doctor stats:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchDoctorStats();
    }, [user?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Health Professional Profile</h1>
                    <p className="text-muted-foreground mt-1 text-lg">Your clinical activity and account summary.</p>
                </div>
            </div>

            <Card className="bg-gradient-to-br from-slate-50 to-blue-50/30 border-slate-200 shadow-sm relative overflow-hidden">
                <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8">
                    <Avatar className="w-24 h-24 border-4 border-white shadow-md">
                        <AvatarFallback className="bg-blue-600 text-white text-3xl font-bold uppercase">
                            {profile?.full_name?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-3xl font-bold text-slate-900">{profile?.full_name}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                            <span className="bg-slate-900 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Clinic Staff
                            </span>
                            <span className="text-slate-500 text-sm font-medium">{profile?.email}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hover:shadow-md transition-shadow border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Career Reach
                        </CardTitle>
                        <Users className="w-5 h-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900">{totalPatients}</div>
                        <p className="text-sm text-slate-500 mt-1">Total visits recorded in clinic</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Today's Impact
                        </CardTitle>
                        <Calendar className="w-5 h-5 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900">{todayPatients}</div>
                        <p className="text-sm text-slate-500 mt-1">Consultations completed today</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="w-5 h-5 text-slate-400" />
                        Recent Clinic Activity
                    </CardTitle>
                    <CardDescription>Feed of the latest sessions across the clinic.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentVisits.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                                <Users className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                                <span className="font-medium">No recent consultations found.</span>
                            </div>
                        ) : (
                            recentVisits.map((visit) => (
                                <div key={visit.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                            {visit.patients?.name?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900">{visit.patients?.name || 'Unknown Patient'}</span>
                                            <span className="text-xs text-slate-500 font-medium">
                                                {visit.patients?.age} yrs • {visit.patients?.sex}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-tight">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
