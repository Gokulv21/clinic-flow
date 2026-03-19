import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Loader2, Shield } from 'lucide-react';
import type { AppRole } from '@/lib/auth';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('nurse');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      const [{ data: profilesData, error: profError }, { data: rolesData, error: rolesError }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*')
      ]);

      if (profError) throw profError;
      if (rolesError) throw rolesError;

      // Base the list on user_roles to ensure all staff are visible
      const merged = (rolesData || []).map(r => {
        const p = profilesData?.find(prof => prof.user_id === r.user_id);
        
        // Better name fallback: Use full_name if it's not the generic default, 
        // otherwise try toExtract name from email or just use email.
        const displayName = (p?.full_name && p.full_name !== 'Staff Member') 
          ? p.full_name 
          : (p?.email || 'Staff Member');

        return {
          id: r.user_id,
          registration_id: r.id, 
          full_name: displayName,
          email: p?.email || 'No email synced',
          role: r.role
        };
      });

      setUsers(merged);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      toast.error("Failed to load staff list");
    }
  };

  useEffect(() => { fetchUsers(); }, []);

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
      // Keep track of the current admin session so we know who is logged in
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      // Sign up user via supabase.auth.signUp 
      // WARNING: In Supabase v2, if email confirmation is OFF, signUp() automatically 
      // mutates the local session to the NEW user.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      // Assign role (can still do this because we have the explicit user ID)
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: role as AppRole,
      });
      if (roleError) throw roleError;

      // Manually insert into profiles to ensure visibility in the staff list
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        id: data.user.id
      });
      // We don't throw for profileError because the user is already created in auth,
      // and we want to allow the process to continue even if profile exists.

      // If the admin's session was overwritten by the new user's session
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession?.user?.id === data.user.id) {
        // We got auto-logged in as the NEW user!
        await supabase.auth.signOut();
        toast.success(`User ${fullName} created successfully!`, { duration: 5000 });
        toast.info(`Security Notice: You have been signed out. Please log back in.`, { duration: 8000 });

        // Force reload to dump the state and go to login
        setTimeout(() => {
          window.location.href = '/clinic-flow/login';
        }, 1500);
        return;
      }

      toast.success(`User ${fullName} created with role: ${role}`);
      setEmail('');
      setPassword('');
      setFullName('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const roleBadgeClass = (r: string) => {
    if (r === 'doctor') return 'bg-doctor/10 text-doctor';
    if (r === 'nurse') return 'bg-nurse/10 text-nurse';
    return 'bg-printer/10 text-printer';
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
                  <SelectItem value="nurse">Nurse (Patient Entry Only)</SelectItem>
                  <SelectItem value="printer">Printer Staff</SelectItem>
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
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Staff Members</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((u, i) => (
              <div key={u.id || i} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">{u.full_name || 'Staff Member'}</p>
                  <p className="text-xs text-muted-foreground font-medium">{u.email || 'No email provided'}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={roleBadgeClass(u.role || u.user_roles?.[0]?.role)}>{u.role || u.user_roles?.[0]?.role}</Badge>
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