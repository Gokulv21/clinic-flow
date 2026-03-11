import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, CalendarDays, Activity, Pill } from 'lucide-react';

export default function Analytics() {
  const [stats, setStats] = useState({ todayPatients: 0, monthPatients: 0, totalPatients: 0 });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [todayRes, monthRes, totalRes] = await Promise.all([
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('patients').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      todayPatients: todayRes.count || 0,
      monthPatients: monthRes.count || 0,
      totalPatients: totalRes.count || 0,
    });

    // Last 7 days
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const nextDate = new Date(d);
      nextDate.setDate(nextDate.getDate() + 1);
      const { count } = await supabase.from('visits').select('id', { count: 'exact', head: true })
        .gte('created_at', dateStr).lt('created_at', nextDate.toISOString().split('T')[0]);
      days.push({ date: d.toLocaleDateString('en', { weekday: 'short' }), patients: count || 0 });
    }
    setDailyData(days);

    // Diagnosis distribution
    const { data: rxData } = await supabase.from('prescriptions').select('diagnosis').not('diagnosis', 'is', null).limit(100);
    const counts: Record<string, number> = {};
    rxData?.forEach(r => { if (r.diagnosis) counts[r.diagnosis] = (counts[r.diagnosis] || 0) + 1; });
    setDiagnosisData(Object.entries(counts).map(([name, value]) => ({ name, value })).slice(0, 8));
  };

  const COLORS = ['hsl(199,89%,38%)', 'hsl(158,64%,42%)', 'hsl(38,92%,50%)', 'hsl(262,60%,55%)', 'hsl(0,72%,51%)', 'hsl(199,89%,60%)', 'hsl(158,64%,55%)', 'hsl(38,92%,60%)'];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-heading font-bold">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Today's Patients", value: stats.todayPatients, icon: <CalendarDays className="w-5 h-5" />, color: 'text-primary' },
          { label: 'This Month', value: stats.monthPatients, icon: <Activity className="w-5 h-5" />, color: 'text-accent' },
          { label: 'Total Patients', value: stats.totalPatients, icon: <Users className="w-5 h-5" />, color: 'text-warning' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-heading font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Patients This Week</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="patients" fill="hsl(199,89%,38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Common Diagnoses</CardTitle></CardHeader>
          <CardContent>
            {diagnosisData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={diagnosisData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                    {diagnosisData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <p>No diagnosis data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}