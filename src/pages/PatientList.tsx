import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, User, History, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', age: '', phone: '', address: '' });

  const fetchPatients = async () => {
    let query = supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      // Check if search looks like a UUID for ID search
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.trim());
      if (isUuid) {
        query = query.or(`id.eq.${search.trim()},name.ilike.%${search}%,phone.ilike.%${search}%`);
      } else {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
    }
    const { data } = await query; // Removed limit(50) to show all
    setPatients(data || []);
  };

  useEffect(() => { fetchPatients(); }, [search]);

  const viewPatient = async (p: any) => {
    setSelectedPatient(p);
    setEditForm({ name: p.name, age: String(p.age), phone: p.phone, address: p.address || '' });
    const { data } = await supabase
      .from('visits')
      .select('*, prescriptions(*)')
      .eq('patient_id', p.id)
      .order('created_at', { ascending: false });
    setVisits(data || []);
  };

  const saveEdit = async () => {
    if (!selectedPatient) return;
    const { error } = await supabase.from('patients').update({
      name: editForm.name,
      age: parseInt(editForm.age),
      phone: editForm.phone,
      address: editForm.address || null,
    }).eq('id', selectedPatient.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Patient updated');
      setEditing(false);
      fetchPatients();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Patient Database</h1>
        <p className="text-muted-foreground">Search and manage patient records</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone or ID..." className="pl-10" />
      </div>

      <div className="grid gap-3">
        {patients.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => viewPatient(p)}>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.phone} · {p.age}y · {p.sex}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">ID: {p.id}</p>
                </div>
              </div>
              <History className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Patient detail dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={open => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedPatient?.name}</span>
              <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
                <Edit className="w-4 h-4 mr-1" />{editing ? 'Cancel' : 'Edit'}
              </Button>
            </DialogTitle>
          </DialogHeader>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Age</Label><Input type="number" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
              </div>
              <Button onClick={saveEdit}>Save Changes</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Age:</span> {selectedPatient?.age}y</div>
                <div><span className="text-muted-foreground">Sex:</span> {selectedPatient?.sex}</div>
                <div><span className="text-muted-foreground">Phone:</span> {selectedPatient?.phone}</div>
                <div><span className="text-muted-foreground">Address:</span> {selectedPatient?.address || '—'}</div>
              </div>

              <h3 className="font-heading font-bold mt-4">Visit History ({visits.length})</h3>
              <div className="space-y-3">
                {visits.map(v => (
                  <Card key={v.id}>
                    <CardContent className="py-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{new Date(v.created_at).toLocaleDateString()}</span>
                        <span className="text-muted-foreground">Token #{v.token_number}</span>
                      </div>
                      {v.diagnosis && <p className="text-sm mt-1">Dx: {v.diagnosis}</p>}
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                        {v.weight && <span>Wt: {v.weight}kg</span>}
                        {v.blood_pressure && <span>BP: {v.blood_pressure}</span>}
                        {v.pulse_rate && <span>PR: {v.pulse_rate}bpm</span>}
                      </div>
                      {v.prescriptions?.map((rx: any) => (
                        <div key={rx.id} className="mt-2 p-2 rounded bg-muted text-xs">
                          {(rx.medicines as any[])?.map((m: any, i: number) => (
                            <div key={i}>{m.name} — {m.dosage} — {m.frequency} — {m.duration}</div>
                          ))}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}