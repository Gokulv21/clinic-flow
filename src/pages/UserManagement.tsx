import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Loader2, Shield, RefreshCw } from 'lucide-react';
import type { AppRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { registerClient } from '@/lib/supabase-auth-admin';
import { useOutletContext } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';



export default function UserManagement() {
  const { clinic } = useOutletContext<{ clinic: any }>();
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('staff');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      const [{ data: profilesData, error: profError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('clinic_id', clinic?.id)
      ]);

      if (profError) throw profError;

      console.log("Raw Profiles Data:", profilesData);

      // Base the list on profiles to show everyone, even if they lack a role
      const merged = (profilesData || []).map(p => {
        const displayName = (p?.full_name && p.full_name !== 'Staff Member')
          ? p.full_name
          : (p?.email || 'Staff Member');

        return {
          id: p.user_id,
          registration_id: p.id || 'NO-ROLE',
          full_name: displayName,
          email: p?.email || 'No email synced',
          role: p?.role || null // Use the role from profiles
        };
      });

      setUsers(merged);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      toast.error("Failed to load staff list");
    }
  };

  useEffect(() => { 
    if (clinic?.id) fetchUsers(); 
  }, [clinic?.id]);

  const createUser = async () => {
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      toast.error('All fields are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setCreating(true);
    try {
      // Sign up user via the non-persistent registerClient 
      const { data, error } = await registerClient.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      // Assign role (using the main supabase client to affect the DB)
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: role as AppRole,
      });
      if (roleError) throw roleError;

      // Manually insert into profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        id: data.user.id,
        role: role as AppRole,
        clinic_id: clinic?.id
      });
      if (profileError) {
        console.error("Profile Error:", profileError);
        // Don't throw yet, verify if role assigned
      }

      toast.success(`User ${fullName} created with role: ${role}`);
      setEmail('');
      setPassword('');
      setFullName('');
      fetchUsers();
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        toast.warning("This user already exists in Auth. Check the list below to 'Activate' them if they are missing a role.");
        fetchUsers();
      } else {
        toast.error(err.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const assignMissingRole = async (userId: string, name: string) => {
    const loadingToast = toast.loading(`Assigning role to ${name}...`);
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'staff' as AppRole
      });
      if (error) throw error;
      toast.success(`Role assigned to ${name}`);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(`Database Error: ${err.message}. Make sure you ran BOTH SQL migration steps!`);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const roleBadgeClass = (r: string) => {
    if (r === 'doctor') return 'bg-doctor/10 text-doctor';
    return 'bg-secondary text-secondary-foreground';
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-heading font-bold">User Management</h1>

      <Card className="border-primary/20 bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <UserPlus className="w-5 h-5" />Register Staff Account
          </CardTitle>
          <CardDescription>Only Administrators can create accounts for clinic staff.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Full Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Dr. John Smith"
                className="h-11 border-primary/10 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Username (Email)</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="staff@clinic.com"
                className="h-11 border-primary/10 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Initial Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="h-11 border-primary/10 shadow-sm"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assigned Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-11 border-primary/10 shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor (Full Access)</SelectItem>
                  <SelectItem value="staff">Clinic Staff (Entry, Print, Directory)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={createUser} disabled={creating} className="w-full md:w-auto px-8 h-11 font-semibold shadow-lg shadow-primary/10 transition-transform active:scale-[0.98]">
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Register Staff
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />Staff Members
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchUsers} className="h-8 gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((u, i) => (
              <div key={u.id || i} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">{u.full_name || 'Staff Member'}</p>
                  <p className="text-xs text-muted-foreground font-medium">{u.email || 'No email provided'}</p>
                </div>
                <div className="flex gap-2">
                  {u.role ? (
                    <Badge variant="outline" className={roleBadgeClass(u.role)}>{u.role}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="animate-pulse font-bold h-8"
                      onClick={() => assignMissingRole(u.id, u.full_name)}
                    >
                      Activate Account
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-center text-muted-foreground py-4">No staff members yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}