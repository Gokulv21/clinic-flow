import { useState, useEffect, useMemo } from 'react';
import { startOfDay, endOfDay, isWithinInterval, startOfHour, endOfHour, setHours, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Users, CalendarDays, Activity, Pill, Filter, Lightbulb, Sparkles, TrendingUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageBanner from '@/components/PageBanner';
import analyticsBanner from '@/assets/analytics.jpg';
import Lottie from "lottie-react";
import analyticsAnimation from "@/assets/animations/analytics.json";

type TimeRange = 'today' | 'week' | 'month' | 'year';

export default function Analytics() {
  const [stats, setStats] = useState({ todayPatients: 0, monthPatients: 0, totalPatients: 0 });
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [trends, setTrends] = useState({ today: '', month: '' });
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [seasonalityData, setSeasonalityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartInsight, setSmartInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchGeneralStats();
    fetchSeasonalityData();
  }, []);

  useEffect(() => {
    fetchVolumeData();
  }, [timeRange]);

  const fetchGeneralStats = async () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);

    const [todayRes, yesterdayRes, monthRes, lastMonthRes, totalRes] = await Promise.all([
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', lastMonthStart.toISOString()).lte('created_at', lastMonthEnd.toISOString()),
      supabase.from('patients').select('id', { count: 'exact', head: true }),
    ]);

    const todayCount = todayRes.count || 0;
    const yesterdayCount = yesterdayRes.count || 0;
    const monthCount = monthRes.count || 0;
    const lastMonthCount = lastMonthRes.count || 0;

    // Calculate Today Trend
    let todayTrend = 'No change';
    if (yesterdayCount > 0) {
      const diff = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
      todayTrend = `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}% from yesterday`;
    } else if (todayCount > 0) {
      todayTrend = '+100% from yesterday';
    }

    // Calculate Month Trend
    let monthTrend = 'Stable';
    if (lastMonthCount > 0) {
      const diff = ((monthCount - lastMonthCount) / lastMonthCount) * 100;
      monthTrend = diff > 0 ? 'Growing' : 'Slight dip';
    }

    setStats({
      todayPatients: todayCount,
      monthPatients: monthCount,
      totalPatients: totalRes.count || 0,
    });
    setTrends({ today: todayTrend, month: monthTrend });

    // Diagnosis distribution
    const { data: rxData } = await supabase.from('prescriptions').select('diagnosis').not('diagnosis', 'is', null).limit(200);
    const counts: Record<string, number> = {};
    rxData?.forEach(r => { if (r.diagnosis) counts[r.diagnosis] = (counts[r.diagnosis] || 0) + 1; });
    setDiagnosisData(Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6));
  };

  const fetchVolumeData = async () => {
    let daysCount = 7;
    let formatType: 'day' | 'month' = 'day';
    
    if (timeRange === 'today') daysCount = 1;
    else if (timeRange === 'month') daysCount = 30;
    else if (timeRange === 'year') {
      daysCount = 12;
      formatType = 'month';
    }

    const startDate = new Date();
    if (formatType === 'day') {
      startDate.setDate(startDate.getDate() - (daysCount - 1));
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setMonth(startDate.getMonth() - 11, 1);
      startDate.setHours(0, 0, 0, 0);
    }

    const { data: visits } = await supabase
      .from('visits')
      .select('created_at')
      .gte('created_at', startDate.toISOString());

    const resultData: any[] = [];
    
    if (timeRange === 'today') {
      for (let h = 0; h < 24; h++) {
        const d = setHours(startOfDay(new Date()), h);
        const hStart = startOfHour(d);
        const hEnd = endOfHour(d);
        
        const countVal = visits?.filter(v => {
          const vDate = new Date(v.created_at);
          return isWithinInterval(vDate, { start: hStart, end: hEnd });
        }).length || 0;

        resultData.push({ 
          name: format(d, 'ha'), 
          patients: countVal,
          color: '#3b82f6' // Unified blue for today's hourly breakdown
        });
      }
    } else if (formatType === 'day') {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = startOfDay(d);
        const dayEnd = endOfDay(d);
        
        const countVal = visits?.filter(v => {
          const vDate = new Date(v.created_at);
          return isWithinInterval(vDate, { start: dayStart, end: dayEnd });
        }).length || 0;
        
        const prevCount = resultData.length > 0 ? resultData[resultData.length - 1].patients : 0;
        
        resultData.push({ 
          name: d.toLocaleDateString('en', { weekday: i < 7 ? 'short' : undefined, day: 'numeric', month: 'short' }), 
          patients: countVal,
          color: countVal >= prevCount ? '#22c55e' : '#ef4444' // Green for up, red for down
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        const mStart = startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
        const mEnd = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        
        const countVal = visits?.filter(v => {
          const vDate = new Date(v.created_at);
          return isWithinInterval(vDate, { start: mStart, end: mEnd });
        }).length || 0;
        
        const prevCount = resultData.length > 0 ? resultData[resultData.length - 1].patients : 0;

        resultData.push({ 
          name: d.toLocaleDateString('en', { month: 'short' }), 
          patients: countVal,
          color: countVal >= prevCount ? '#22c55e' : '#ef4444'
        });
      }
    }
    setVolumeData(resultData);
  };

  const fetchSeasonalityData = async () => {
    // Fetch last 6 months of prescriptions to see trends
    const { data: rxData } = await supabase
      .from('prescriptions')
      .select('diagnosis, created_at')
      .not('diagnosis', 'is', null)
      .order('created_at', { ascending: true });

    if (!rxData) return;

    const topDiagnoses = ['Fever', 'Cough', 'Diabetes', 'Hypertension', 'Gastritis']; // Common ones
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return d.toLocaleDateString('en', { month: 'short' });
    });

    const trendData = months.map(m => {
      const entry: any = { month: m };
      topDiagnoses.forEach(d => entry[d] = 0);
      return entry;
    });

    rxData.forEach(rx => {
      const monthStr = new Date(rx.created_at).toLocaleDateString('en', { month: 'short' });
      const trendIndex = trendData.findIndex(t => t.month === monthStr);
      if (trendIndex > -1) {
        topDiagnoses.forEach(d => {
          if (rx.diagnosis?.toLowerCase().includes(d.toLowerCase())) {
            trendData[trendIndex][d]++;
          }
        });
      }
    });

    setSeasonalityData(trendData);
    setLoading(false);
  };

  const generateInsight = () => {
    setIsAnalyzing(true);
    // Simulate thinking/calculating
    setTimeout(() => {
        let insight = "";
        
        // Find busiest time/day
        const maxVolume = [...volumeData].sort((a,b) => b.patients - a.patients)[0];
        const topDiag = diagnosisData[0]?.name || "general conditions";

        if (timeRange === 'today') {
            insight = `Peak traffic detected today at ${maxVolume?.name}. Ensure staff coverage.`;
        } else {
            insight = `Trend Alert: ${topDiag} represents your highest patient volume this ${timeRange}.`;
        }

        setSmartInsight(insight);
        setIsAnalyzing(false);
        fetchGeneralStats();
        fetchVolumeData();
        fetchSeasonalityData();
    }, 1200);
  };

  const COLORS = ['hsl(199,89%,38%)', 'hsl(158,64%,42%)', 'hsl(38,92%,50%)', 'hsl(262,60%,55%)', 'hsl(0,72%,51%)', 'hsl(199,89%,60%)'];

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="Clinic Analytics"
        description="Real-time insights and patient volume trends for informed clinical decisions."
        imageSrc={analyticsBanner}
      >
        <div className="w-24 h-24 md:w-32 md:h-32 -ml-4">
          <Lottie animationData={analyticsAnimation} loop={true} />
        </div>
      </PageBanner>

        <div className="px-4 md:px-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <AnimatePresence mode="wait">
                {smartInsight ? (
                    <motion.div 
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="glass-droplet px-6 py-4 rounded-[1.5rem] border-blue-500/30 flex items-center gap-4 shadow-xl w-full md:max-w-xl"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                        </div>
                        <p className="text-sm font-bold text-foreground leading-snug">{smartInsight}</p>
                        <button onClick={() => setSmartInsight(null)} className="ml-2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </motion.div>
                ) : (
                    <div />
                )}
            </AnimatePresence>

            <div className="bg-card p-1.5 rounded-2xl shadow-sm border border-border flex items-center gap-2">
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("rounded-xl text-xs font-black uppercase tracking-widest gap-2 bg-blue-500/5 text-blue-600 hover:bg-blue-500/10 transition-all btn-liquid-pop overflow-hidden", isAnalyzing && "opacity-50")}
                onClick={generateInsight}
                disabled={isAnalyzing}
                asChild
            >
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 600, damping: 30 }}
                >
                    {isAnalyzing ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                            <TrendingUp className="w-4 h-4" />
                        </motion.div>
                    ) : (
                        <Lightbulb className="w-4 h-4" />
                    )}
                    {isAnalyzing ? "Analyzing Trends..." : "Generate Smart Insight"}
                </motion.button>
            </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { label: "Today's Patients", value: stats.todayPatients, icon: <CalendarDays className="w-5 h-5" />, color: 'bg-blue-500/10 text-blue-500', trend: trends.today },
            { label: 'Monthly Volume', value: stats.monthPatients, icon: <Activity className="w-5 h-5" />, color: 'bg-emerald-500/10 text-emerald-500', trend: trends.month },
            { label: 'Total Database', value: stats.totalPatients, icon: <Users className="w-5 h-5" />, color: 'bg-amber-500/10 text-amber-500', trend: 'Lifetime records' },
          ].map(s => (
            <Card key={s.label} className="border-none shadow-sm hover:shadow-md transition-shadow bg-card overflow-hidden group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${s.color}`}>{s.icon}</div>
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.trend}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground">{s.label}</p>
                  <p className="text-4xl font-extrabold text-foreground tracking-tighter mt-1">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm bg-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b border-border">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Patient Traffic</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">Visualization of visit frequency</p>
              </div>
              <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
                <SelectTrigger className="w-[130px] h-9 bg-muted border-none font-bold text-xs rounded-lg">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="year">Past Year</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                      dy={10}
                      interval={timeRange === 'today' ? 1 : 0}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="patients" radius={[6, 6, 0, 0]} barSize={timeRange === 'today' ? 12 : (timeRange === 'year' ? 30 : 20)}>
                      {volumeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-2 border-b border-border mb-4">
              <CardTitle className="text-lg font-bold text-foreground">Disease Distribution</CardTitle>
              <p className="text-xs text-muted-foreground font-medium">Most frequent diagnoses</p>
            </CardHeader>
            <CardContent>
              {diagnosisData.length > 0 ? (
                <div className="space-y-6">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={diagnosisData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {diagnosisData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {diagnosisData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                         <span className="text-[11px] font-bold text-foreground truncate">{d.name}</span>
                         <span className="text-[10px] font-medium text-muted-foreground ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground italic text-sm">
                  No diagnosis data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disease Seasonality Chart */}
          <Card className="lg:col-span-3 border-none shadow-sm bg-card overflow-hidden">
            <CardHeader className="pb-6 border-b border-border">
              <div className="flex items-center gap-2">
                 <div className="p-1.5 bg-primary/10 rounded-lg">
                   <Activity className="w-4 h-4 text-primary" />
                 </div>
                 <div>
                    <CardTitle className="text-lg font-bold text-foreground">Disease Seasonality</CardTitle>
                    <p className="text-xs text-muted-foreground font-medium">Trends for common conditions over the last 6 months</p>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 px-2 md:px-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={seasonalityData}>
                    <defs>
                      {COLORS.map((color, i) => (
                        <linearGradient key={i} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.1}/>
                          <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="Fever" stroke={COLORS[0]} fillOpacity={1} fill="url(#color0)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Cough" stroke={COLORS[1]} fillOpacity={1} fill="url(#color1)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Diabetes" stroke={COLORS[2]} fillOpacity={1} fill="url(#color2)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Hypertension" stroke={COLORS[3]} fillOpacity={1} fill="url(#color3)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Gastritis" stroke={COLORS[4]} fillOpacity={1} fill="url(#color4)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}