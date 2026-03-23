import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Users, Calendar, Activity, Clock, ShieldCheck, User, Loader2, 
    UserCheck, BarChart3, PieChart, Settings, Mail, Phone, MapPin, 
    Medal, FileSignature, Save, RefreshCw, Plus, Stethoscope, Printer,
    ArrowRight, CheckCircle2, Circle, PanelLeft, LayoutDashboard,
    Group, Info, Moon, Sun, HeartPulse, TrendingUp, Search, UserPlus, Camera, Trash2, Eye, X
} from 'lucide-react';
import { startOfDay, endOfDay, subDays, format, isSameDay, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import SignaturePad from '@/components/SignaturePad';
import { useTheme } from 'next-themes';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ProfileData = {
    full_name: string;
    email?: string;
    qualifications?: string;
    registration_id?: string;
    clinic_name?: string;
    clinic_address?: string;
    clinic_phone?: string;
    signature_data?: string;
    avatar_url?: string;
    theme?: string;
};

const AVATAR_OPTIONS = [
    { name: 'Dr. Male (Blue)', url: '/prescripto/avatars/doctor_male_1.png' },
    { name: 'Dr. Female (Pink)', url: '/prescripto/avatars/doctor_female_1.png' },
    { name: 'Dr. Male (Emerald)', url: '/prescripto/avatars/doctor_male_2.png' },
    { name: 'Dr. Female (Purple)', url: '/prescripto/avatars/doctor_female_2.png' },
];

const getAvatarUrl = (url?: string) => {
    if (!url) return AVATAR_OPTIONS[0].url;
    // If it's a full URL (Supabase or external)
    if (url.startsWith('http')) return url;
    // If it's a local relative path starting with /avatars/
    if (url.startsWith('/avatars/')) return `/prescripto${url}`;
    // Fallback
    return url;
};

export default function DoctorProfile() {
    const { user, roles, hasRole } = useAuth();
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Stats & Analytics State
    const [stats, setStats] = useState({
        totalPatients: 0,
        todayPatients: 0,
        weeklyData: [] as any[],
        demographics: [] as any[],
        recentActivity: [] as any[]
    });

    const [staff, setStaff] = useState<any[]>([]);
    const [allProfiles, setAllProfiles] = useState<any[]>([]);
    const [showAddStaffDialog, setShowAddStaffDialog] = useState(false);
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [addingStaffId, setAddingStaffId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [user?.id]);

    async function fetchData() {
        if (!user?.id) return;
        setLoading(true);
        try {
            // 1. Fetch Profile
            const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (profData) {
                setProfile({
                    ...profData,
                    email: user.email
                });
            }

            // 2. Fetch Stats
            const todayStart = startOfDay(new Date()).toISOString();
            const { count: totalCount } = await supabase.from('patients').select('*', { count: 'exact', head: true });
            const { count: todayCount } = await supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart);

            // 3. Weekly Traffic (Last 7 days)
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const date = subDays(new Date(), 6 - i);
                return {
                    date: format(date, 'EEE'),
                    fullDate: format(date, 'yyyy-MM-dd'),
                    count: 0
                };
            });

            const { data: weeklyVisits } = await supabase
                .from('visits')
                .select('created_at')
                .gte('created_at', subDays(startOfDay(new Date()), 6).toISOString());

            if (weeklyVisits) {
                weeklyVisits.forEach(v => {
                    const day = format(parseISO(v.created_at), 'yyyy-MM-dd');
                    const dayData = last7Days.find(d => d.fullDate === day);
                    if (dayData) dayData.count++;
                });
            }

            // 4. Demographics (Gender)
            const { data: patients } = await supabase.from('patients').select('sex, age');
            const genderData = [
                { name: 'Male', value: patients?.filter(p => p.sex === 'Male').length || 0, color: '#3b82f6' },
                { name: 'Female', value: patients?.filter(p => p.sex === 'Female').length || 0, color: '#ec4899' },
                { name: 'Other', value: patients?.filter(p => p.sex === 'Other').length || 0, color: '#94a3b8' }
            ].filter(d => d.value > 0);

            // 5. Recent Activity
            const { data: recent } = await supabase
                .from('visits')
                .select('id, created_at, status, patients(name, age, sex)')
                .order('created_at', { ascending: false })
                .limit(8);

            // 6. Staff List (if doctor)
            if (hasRole('doctor')) {
                const { data: staffData } = await supabase
                    .from('user_roles')
                    .select('role, profiles(full_name, user_id)')
                    .neq('role', 'doctor');
                setStaff(staffData || []);
            }

            setStats({
                totalPatients: totalCount || 0,
                todayPatients: todayCount || 0,
                weeklyData: last7Days,
                demographics: genderData,
                recentActivity: recent || []
            });

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    qualifications: profile.qualifications,
                    registration_id: profile.registration_id,
                    clinic_name: profile.clinic_name,
                    clinic_address: profile.clinic_address,
                    clinic_phone: profile.clinic_phone,
                    signature_data: profile.signature_data,
                    avatar_url: profile.avatar_url,
                    theme: theme
                })
                .eq('user_id', user.id);

            if (error) throw error;
            toast.success('Profile updated successfully');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        // Validate file type and size (5MB max)
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase Storage (Assumes 'avatars' bucket exists)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                // If bucket doesn't exist, this might fail. Let's provide a helpful error.
                if (uploadError.message.includes('bucket not found')) {
                    throw new Error('Please create a storage bucket named "avatars" in your Supabase dashboard.');
                }
                throw uploadError;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update Profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
            toast.success('Profile photo updated');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!profile?.avatar_url || !user?.id) return;
        
        // Only delete if it's a custom uploaded photo (contains Supabase storage path)
        const isCustomPhoto = profile.avatar_url.includes('/storage/v1/object/public/avatars/');
        
        if (!isCustomPhoto) {
            // If it's just a default avatar, just reset it
            setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
            return;
        }

        const confirmDelete = window.confirm('Are you sure you want to delete your profile photo?');
        if (!confirmDelete) return;

        setUploading(true);
        try {
            // Extract filename from URL
            const urlParts = profile.avatar_url.split('/');
            const fileName = urlParts[urlParts.length - 1].split('?')[0];

            // 1. Delete from Supabase Storage
            const { error: storageError } = await supabase.storage
                .from('avatars')
                .remove([fileName]);

            if (storageError) console.error('Storage deletion error:', storageError);

            // 2. Update Profile to null/default
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
            toast.success('Profile photo removed');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to delete photo');
        } finally {
            setUploading(false);
        }
    };

    async function fetchAllProfiles() {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('user_id, full_name, email');
            setAllProfiles(data || []);
        } catch (err) {
            console.error(err);
        }
    }

    const handleAddStaff = async (userId: string) => {
        setAddingStaffId(userId);
        try {
            const { data: existingRole } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .single();

            if (existingRole?.role === 'doctor') {
                toast.error('This user is already a doctor');
                return;
            }

            const { error: roleError } = await supabase
                .from('user_roles')
                .upsert({ user_id: userId, role: 'staff' }, { onConflict: 'user_id' });
            
            if (roleError) throw roleError;
            
            toast.success('Staff member added to team');
            fetchData(); 
            setShowAddStaffDialog(false);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setAddingStaffId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 font-jakarta-sans pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="relative group perspective-1000">
                        <div className="w-28 h-36 md:w-32 md:h-44 rounded-[2rem] bg-gradient-to-b from-blue-500 to-blue-700 shadow-2xl overflow-hidden flex items-center justify-center transform transition-all duration-500 group-hover:rotate-y-12 group-hover:scale-105 border-4 border-white dark:border-slate-800">
                                <img src={getAvatarUrl(profile?.avatar_url)} className="w-full h-full object-cover" alt="Profile" />
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                            
                            {/* Upload Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 cursor-pointer p-2 backdrop-blur-sm">
                                <div className="grid grid-cols-2 gap-2 w-full px-4">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImagePreviewUrl(getAvatarUrl(profile?.avatar_url));
                                        }}
                                        className="flex flex-col items-center gap-1 hover:scale-110 transition-transform bg-white/10 hover:bg-white/20 p-2 rounded-xl"
                                    >
                                        <Eye className="w-6 h-6" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Open</span>
                                    </button>
                                    
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        disabled={uploading}
                                        className="flex flex-col items-center gap-1 hover:scale-110 transition-transform bg-white/10 hover:bg-white/20 p-2 rounded-xl"
                                    >
                                        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center">Browse</span>
                                    </button>
                                </div>
                                
                                {profile?.avatar_url?.includes('http') && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePhoto();
                                        }}
                                        disabled={uploading}
                                        className="flex flex-col items-center gap-1 text-red-100 hover:text-white bg-red-500/20 hover:bg-red-500/40 p-2 rounded-xl w-full mx-4 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Remove Photo</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handlePhotoUpload} 
                            className="hidden" 
                            accept="image/*" 
                        />
                        <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-white p-2 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-slate-50 group">
                                {profile?.full_name}
                            </h1>
                            {roles.map(role => (
                                <span key={role} className="bg-slate-900 dark:bg-slate-50 dark:text-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                                    {role}
                                </span>
                            ))}
                        </div>
                        <p className="text-blue-600 font-bold text-lg md:text-xl tracking-tight">
                            {profile?.qualifications || "Update your credentials"}
                        </p>
                        <div className="flex items-center gap-4 text-slate-400 text-sm font-medium pt-2">
                             <div className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user?.email}</div>
                             {profile?.registration_id && <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Reg: {profile.registration_id}</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-2xl border-slate-200 dark:border-slate-800 gap-2 font-bold h-11 px-6 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        Theme
                    </Button>
                    <Button 
                        onClick={() => {
                            fetchData();
                            toast.success('Medical records synchronized');
                        }}
                        className="rounded-2xl bg-blue-600 hover:bg-blue-700 gap-2 font-bold h-11 px-6 shadow-lg shadow-blue-200 text-white border-none"
                    >
                       <RefreshCw className="w-4 h-4" /> Sync Records
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full space-y-8">
                <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur p-1.5 rounded-[2rem] border border-slate-200 dark:border-slate-800 w-full md:w-auto h-auto grid grid-cols-2 md:grid-cols-4 gap-2">
                    <TabsTrigger value="overview" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-50 dark:data-[state=active]:text-slate-900 font-black text-xs uppercase tracking-widest gap-2">
                        <LayoutDashboard className="w-4 h-4" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black text-xs uppercase tracking-widest gap-2">
                        <BarChart3 className="w-4 h-4" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="team" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black text-xs uppercase tracking-widest gap-2">
                        <Group className="w-4 h-4" /> Team
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black text-xs uppercase tracking-widest gap-2">
                        <Settings className="w-4 h-4" /> Settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-none shadow-sm bg-blue-600 text-white overflow-hidden relative group">
                            <CardContent className="p-8 space-y-2">
                                <Users className="w-10 h-10 opacity-20 absolute -right-2 -top-2 group-hover:scale-150 transition-transform duration-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Lifetime Reach</p>
                                <h3 className="text-5xl font-black tracking-tighter">{stats.totalPatients}</h3>
                                <p className="text-xs font-bold bg-white/20 inline-block px-3 py-1 rounded-full">+12% from last month</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-emerald-500 text-white overflow-hidden relative group">
                            <CardContent className="p-8 space-y-2">
                                <Calendar className="w-10 h-10 opacity-20 absolute -right-2 -top-2 group-hover:scale-150 transition-transform duration-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Today's Census</p>
                                <h3 className="text-5xl font-black tracking-tighter">{stats.todayPatients}</h3>
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    <span className="text-[10px] font-bold">Active Consultations</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden p-6 flex flex-col justify-center gap-4">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Quick Actions</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: <Plus className="w-5 h-5" />, label: "Entry", color: "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400", path: "/nurse" },
                                    { icon: <Stethoscope className="w-5 h-5" />, label: "Queue", color: "bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400", path: "/consultation" },
                                    { icon: <Printer className="w-5 h-5" />, label: "Print", color: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400", path: "/print" }
                                ].map(a => (
                                    <button 
                                        key={a.label} 
                                        onClick={() => navigate(a.path)}
                                        className="flex flex-col items-center gap-1 hover:scale-105 transition-transform"
                                    >
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all", a.color)}>
                                            {a.icon}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                         {/* Activity Timeline */}
                         <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                            <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-8 py-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <CardTitle className="text-sm font-black uppercase tracking-widest dark:text-slate-100">Clinic Timeline</CardTitle>
                                    </div>
                                    <Activity className="w-4 h-4 text-slate-200 dark:text-slate-800" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {stats.recentActivity.map((visit, i) => (
                                        <div key={visit.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-400 dark:text-slate-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
                                                        {visit.patients?.name?.charAt(0)}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                                                       {visit.status === 'completed' ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> : <Clock className="w-2.5 h-2.5 text-amber-500" />}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{visit.patients?.name}</p>
                                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                                                        {visit.status === 'completed' ? 'Consultation Finished' : 'Waiting in Queue'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 dark:text-slate-100">
                                                    {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(new Date(visit.created_at))}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600">Just now</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="ghost" className="w-full h-14 rounded-none text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-50 dark:border-slate-800">
                                    See All Activity <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </CardContent>
                         </Card>

                         {/* Mini Analytics */}
                         <Card className="border-slate-100 rounded-[2rem] shadow-sm bg-white overflow-hidden p-8 flex flex-col">
                             <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Weekly Performance</h3>
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                             </div>
                             <div className="h-64 mt-auto">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.weeklyData}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                                        />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                             </div>
                         </Card>
                    </div>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-8 focus-visible:outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl font-black tracking-tight mb-1 dark:text-slate-100">Patient Volume Trend</CardTitle>
                                    <CardDescription className="dark:text-slate-400">Visualizing your clinic flow over the last 7 days.</CardDescription>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-3 rounded-2xl">
                                    <Activity className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10 }} 
                                        />
                                        <Tooltip 
                                            cursor={{ fill: '#f1f5f9', radius: 8 }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                            labelStyle={{ fontWeight: 800 }}
                                        />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm flex flex-col">
                            <div>
                                <CardTitle className="text-2xl font-black tracking-tight mb-1 dark:text-slate-100">Demographics</CardTitle>
                                <CardDescription className="dark:text-slate-400">Patient gender distribution.</CardDescription>
                            </div>
                            <div className="h-64 relative flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={stats.demographics}
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {stats.demographics.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </RePieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-2xl font-black dark:text-slate-100">{stats.totalPatients}</p>
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Total Patients</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {stats.demographics.map(d => (
                                    <div key={d.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.name}</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">{stats.totalPatients > 0 ? Math.round((d.value / stats.totalPatients) * 100) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="team" className="focus-visible:outline-none">
                    <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 bg-white dark:bg-slate-900 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                            <div>
                                <CardTitle className="text-3xl font-black tracking-tighter mb-1 dark:text-slate-100">Clinic Staff members</CardTitle>
                                <CardDescription className="dark:text-slate-400">Manage your nurse and support team access levels.</CardDescription>
                            </div>
                            {hasRole('doctor') && (
                                <Button 
                                    onClick={() => {
                                        fetchAllProfiles();
                                        setShowAddStaffDialog(true);
                                    }}
                                    className="bg-slate-900 dark:bg-slate-50 dark:text-slate-900 text-white font-black uppercase text-[10px] tracking-widest px-8 rounded-full h-auto py-3 shadow-lg"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-2" /> Add Staff Member
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {staff.map((s, i) => (
                                <Card key={i} className="group relative border-slate-100 dark:border-slate-800 rounded-3xl hover:border-blue-200 dark:hover:border-blue-700 transition-all hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-slate-800/50 overflow-hidden">
                                     <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                     <CardContent className="p-6 flex items-center gap-4">
                                         <Avatar className="w-16 h-16 rounded-2xl border-4 border-slate-50 dark:border-slate-700">
                                             <AvatarFallback className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-black text-xl">
                                                {s.profiles?.full_name?.charAt(0)}
                                             </AvatarFallback>
                                         </Avatar>
                                         <div className="space-y-1">
                                             <h4 className="font-black text-slate-900 dark:text-slate-100 leading-tight">{s.profiles?.full_name}</h4>
                                             <div className="flex items-center gap-2">
                                                 <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                                                     {s.role}
                                                 </span>
                                                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                             </div>
                                         </div>
                                     </CardContent>
                                     <div className="border-t border-slate-50 dark:border-slate-700 p-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                         <span>Last Active: Today</span>
                                         <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent hover:text-blue-600 dark:hover:text-blue-400">Permissions <ArrowRight className="w-3 h-3 ml-1" /></Button>
                                     </div>
                                </Card>
                            ))}
                            {staff.length === 0 && (
                                <div className="col-span-full py-20 text-center space-y-4">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                        <Users className="w-8 h-8 text-slate-200" />
                                    </div>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No registered staff found</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="focus-visible:outline-none">
                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             {/* Identity Card */}
                            <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-2xl">
                                        <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight dark:text-slate-100">Professional Identity</h3>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Display Name</Label>
                                        <Input 
                                            value={profile?.full_name} 
                                            onChange={e => setProfile(p => ({ ...p!, full_name: e.target.value }))}
                                            className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold focus:ring-blue-500" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Primary Qualifications</Label>
                                            <Input 
                                                value={profile?.qualifications} 
                                                onChange={e => setProfile(p => ({ ...p!, qualifications: e.target.value }))}
                                                placeholder="MBBS, MD (Cardiology)"
                                                className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Medical Registration ID</Label>
                                            <Input 
                                                value={profile?.registration_id} 
                                                onChange={e => setProfile(p => ({ ...p!, registration_id: e.target.value }))}
                                                placeholder="Reg #12345"
                                                className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold" 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Select Passport Vector Avatar</Label>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner max-h-48 overflow-y-auto">
                                            {AVATAR_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.url}
                                                    type="button"
                                                    onClick={() => setProfile(p => ({ ...p!, avatar_url: opt.url }))}
                                                    className={cn(
                                                        "relative aspect-square rounded-xl overflow-hidden border-4 transition-all hover:scale-105",
                                                        profile?.avatar_url === opt.url ? "border-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/40" : "border-white dark:border-slate-700"
                                                    )}
                                                >
                                                    <img src={opt.url} className="w-full h-full object-cover" alt={opt.name} />
                                                    {profile?.avatar_url === opt.url && (
                                                        <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                                            <CheckCircle2 className="w-6 h-6 text-blue-600" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Clinic Branding */}
                            <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl">
                                        <HeartPulse className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight dark:text-slate-100">Clinic Branding</h3>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Clinic Name</Label>
                                        <Input 
                                            value={profile?.clinic_name} 
                                            onChange={e => setProfile(p => ({ ...p!, clinic_name: e.target.value }))}
                                            placeholder="Lifeline Diagnostic Centre"
                                            className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Clinic Address</Label>
                                        <Input 
                                            value={profile?.clinic_address} 
                                            onChange={e => setProfile(p => ({ ...p!, clinic_address: e.target.value }))}
                                            placeholder="123 Health Street, City"
                                            className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Clinic Contact</Label>
                                        <Input 
                                            value={profile?.clinic_phone} 
                                            onChange={e => setProfile(p => ({ ...p!, clinic_phone: e.target.value }))}
                                            placeholder="+91 00000 00000"
                                            className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold" 
                                        />
                                    </div>
                                </div>
                            </Card>

                            {/* Digital Signature */}
                            <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-6 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/40 rounded-2xl">
                                        <FileSignature className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight dark:text-slate-100">Digital Signature</h3>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Used for validating digital prescriptions</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <SignaturePad 
                                        initialSignature={profile?.signature_data}
                                        onSave={(data) => setProfile(p => ({ ...p!, signature_data: data }))}
                                    />
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[150px]">
                                        {profile?.signature_data ? (
                                            <div className="space-y-4 text-center">
                                                <img src={profile.signature_data} className="max-h-24 mx-auto contrast-125 dark:invert" alt="Preview" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live Signature Active</p>
                                            </div>
                                        ) : (
                                            <div className="text-center space-y-2 opacity-30">
                                                <FileSignature className="w-12 h-12 mx-auto" />
                                                <p className="text-xs font-black uppercase tracking-widest">No signature saved</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="flex justify-end pt-6">
                            <Button 
                                type="submit" 
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[12px] tracking-widest px-12 h-16 rounded-[2rem] shadow-2xl shadow-blue-200"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                Save Complete Profile
                            </Button>
                        </div>
                    </form>
                </TabsContent>
            </Tabs>

            {/* Add Staff Dialog */}
            <Dialog open={showAddStaffDialog} onOpenChange={setShowAddStaffDialog}>
                <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden border-none bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] shadow-2xl">
                    <DialogHeader className="p-8 bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-2xl">
                                <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">System Staff Members</DialogTitle>
                                <DialogDescription className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] mt-1">Select an existing user to add to your clinic team</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="p-6 space-y-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by name or email..." 
                                value={staffSearchQuery}
                                onChange={e => setStaffSearchQuery(e.target.value)}
                                className="h-12 pl-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl font-bold shadow-sm focus:ring-blue-500"
                            />
                        </div>

                        <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                            {allProfiles
                                .filter(p => 
                                    p.full_name?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                                    p.email?.toLowerCase().includes(staffSearchQuery.toLowerCase())
                                )
                                .filter(p => !staff.some(s => s.profiles?.user_id === p.user_id)) // Hide already added
                                .filter(p => p.user_id !== user?.id) // Hide self
                                .map(p => (
                                    <div key={p.user_id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-blue-200 dark:hover:border-blue-700 transition-all shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center font-black text-slate-400 dark:text-slate-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {p.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{p.full_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{p.email || 'No email synced'}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            onClick={() => handleAddStaff(p.user_id)}
                                            disabled={addingStaffId === p.user_id}
                                            className="rounded-full bg-slate-900 dark:bg-slate-50 dark:text-slate-900 text-white font-black text-[9px] uppercase tracking-widest h-9 px-4 border-none shadow-lg shadow-slate-200"
                                        >
                                            {addingStaffId === p.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Activate as Staff'}
                                        </Button>
                                    </div>
                                ))}
                            {allProfiles.length === 0 && (
                                <div className="text-center py-10 space-y-3">
                                    <RefreshCw className="w-8 h-8 text-slate-200 dark:text-slate-800 mx-auto animate-spin" />
                                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Loading profiles...</p>
                                </div>
                            )}
                            {allProfiles.length > 0 && allProfiles.filter(p => p.full_name?.toLowerCase().includes(staffSearchQuery.toLowerCase()) || p.email?.toLowerCase().includes(staffSearchQuery.toLowerCase())).length === 0 && (
                                <p className="text-center py-10 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest italic">No matching users found</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 flex items-center justify-between">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden sm:block">Need to create a new user? Visit User Management.</p>
                        <Button variant="ghost" onClick={() => setShowAddStaffDialog(false)} className="rounded-full font-bold h-11 px-6 uppercase text-[10px] tracking-widest dark:text-slate-300">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Full-Screen Image Preview */}
            <Dialog open={!!imagePreviewUrl} onOpenChange={open => !open && setImagePreviewUrl(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden border-none bg-black/90 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <div className="relative aspect-auto flex items-center justify-center p-4">
                        <img 
                            src={imagePreviewUrl || ''} 
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" 
                            alt="Full Preview" 
                        />
                        <button 
                            onClick={() => setImagePreviewUrl(null)}
                            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-all backdrop-blur-md border border-white/20 group"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
