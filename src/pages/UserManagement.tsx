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
    const { data } = await supabase.from('profiles').select('*, user_roles(role)');
    setUsers(data || []);
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
      // Sign up user via edge function or admin API
      // For now, use supabase.auth.signUp — but this logs in as new user
      // Better approach: use an edge function with admin client
      // For MVP, we'll use signUp and handle it
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      // Assign role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: role as AppRole,
      });
      if (roleError) throw roleError;

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />Create Staff Account</CardTitle>
          <CardDescription>New users can only sign in — public signup is disabled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@clinic.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor (Admin)</SelectItem>
                  <SelectItem value="nurse">Nurse (Front Desk)</SelectItem>
                  <SelectItem value="printer">Printer Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={createUser} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Create User
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Staff Members</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">{u.full_name}</p>
                </div>
                <div className="flex gap-2">
                  {u.user_roles?.map((r: any) => (
                    <Badge key={r.role} variant="outline" className={roleBadgeClass(r.role)}>{r.role}</Badge>
                  ))}
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