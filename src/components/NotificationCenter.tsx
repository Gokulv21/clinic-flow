import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Bell, Check, X, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function NotificationCenter() {
  const { user, roles, profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetModal, setResetModal] = useState<{ open: boolean, request: any | null }>({ open: false, request: null });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const isSuper = roles.includes('superadmin');
  const isDoctor = roles.includes('doctor');
  const clinicId = profile?.clinic_id;

  const fetchRequests = async () => {
    if (!isSuper && !isDoctor) return;
    
    let query = supabase.from('password_reset_requests').select('*').eq('status', 'pending');

    if (isSuper && !isDoctor) {
      // App Admin sees all Doctor requests
      query = query.eq('requester_role', 'doctor');
    } else if (isDoctor && !isSuper) {
      // Clinic Owner sees their Staff requests
      if (!clinicId) return;
      query = query.eq('clinic_id', clinicId).eq('requester_role', 'staff');
    } else if (isSuper && isDoctor) {
      // Hybrid: (Doctor requests) OR (Staff requests for their clinic)
      // Supabase JS doesn't support complex OR filters easily with joined conditions, 
      // but we can just fetch all pending and filter in JS for simplicity or use two queries.
      // Given the volume is low, we'll fetch both or use a specialized query.
      const { data: allPending } = await query;
      const filtered = (allPending || []).filter(req => {
        const isTargetDoctor = req.requester_role === 'doctor';
        const isTargetStaff = req.requester_role === 'staff' && req.clinic_id === clinicId;
        return isTargetDoctor || isTargetStaff;
      });
      setRequests(filtered);
      return;
    }

    const { data } = await query.order('created_at', { ascending: false });
    setRequests(data || []);
  };

  useEffect(() => {
    fetchRequests();
    
    // Subscribe to new requests
    const channel = supabase
      .channel('password_resets')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'password_reset_requests'
      }, () => fetchRequests())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, isSuper, isDoctor]);

  const handleApprove = (req: any) => {
    setResetModal({ open: true, request: req });
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('password_reset_requests')
      .update({ status: 'rejected' })
      .eq('id', id);
    
    if (error) toast.error('Failed to reject request');
    else {
      toast.success('Request rejected');
      fetchRequests();
    }
  };

  const submitReset = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          userId: resetModal.request.user_id, 
          newPassword,
          requestId: resetModal.request.id
        }
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setResetModal({ open: false, request: null });
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuper && !isDoctor) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative group hover:bg-primary/5 transition-all rounded-full h-10 w-10">
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
            {requests.length > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] p-2 glass-thick border-primary/20 shadow-2xl rounded-2xl mt-2">
          <div className="px-3 py-2 border-b border-primary/5 mb-2 flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-widest text-slate-500">Notifications</span>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[10px]">{requests.length} pending</Badge>
          </div>
          
          {requests.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground italic">
              No pending notifications
            </div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-auto no-scrollbar">
              {requests.map(req => (
                <div key={req.id} className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/10 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight">{req.email}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Requested Password Reset</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="sm" 
                      onClick={() => handleApprove(req)}
                      className="h-7 text-[10px] px-3 bg-primary/10 text-primary hover:bg-primary hover:text-white border-none shadow-none font-black uppercase tracking-wider"
                    >
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleReject(req.id)}
                      className="h-7 text-[10px] px-3 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 font-black uppercase tracking-wider"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetModal.open} onOpenChange={(open) => !open && setResetModal({ open: false, request: null })}>
        <DialogContent className="sm:max-w-[400px] glass-thick border-primary/20 rounded-3xl overflow-hidden p-0">
          <div className="bg-primary/5 p-6 border-b border-primary/10 flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-xl font-black tracking-tight">Security Review</DialogTitle>
                <DialogDescription>Reset password for {resetModal.request?.email}</DialogDescription>
             </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest font-black text-slate-500">New Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10 h-11 border-primary/10 focus-visible:ring-primary/20 bg-background/50"
                  placeholder="Enter new password"
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest font-black text-slate-500">Confirm Password</Label>
              <Input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 border-primary/10 focus-visible:ring-primary/20 bg-background/50"
                placeholder="Repeat password"
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50/50 dark:bg-white/5 gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setResetModal({ open: false, request: null })} className="font-bold">Cancel</Button>
            <Button 
               onClick={submitReset} 
               disabled={saving || !newPassword || newPassword !== confirmPassword}
               className="font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
