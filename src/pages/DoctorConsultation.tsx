import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle, Plus, Trash2, Save, Loader2 } from 'lucide-react';

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export default function DoctorConsultation() {
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [advice, setAdvice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchQueue = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('visits')
      .select('*, patients(*)')
      .gte('created_at', today)
      .in('status', ['waiting', 'in_consultation'])
      .order('token_number', { ascending: true });
    setQueue(data || []);
  };

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel('visits-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => fetchQueue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const selectVisit = async (visit: any) => {
    setSelectedVisit(visit);
    setPatient(visit.patients);
    setDiagnosis(visit.diagnosis || '');
    setMedicines([{ name: '', dosage: '', frequency: '', duration: '' }]);
    setAdvice('');

    // Update status to in_consultation
    if (visit.status === 'waiting') {
      await supabase.from('visits').update({ status: 'in_consultation' }).eq('id', visit.id);
    }

    // Fetch history
    const { data } = await supabase
      .from('visits')
      .select('*, prescriptions(*)')
      .eq('patient_id', visit.patient_id)
      .neq('id', visit.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setHistory(data || []);
  };

  const addMedicine = () => setMedicines(m => [...m, { name: '', dosage: '', frequency: '', duration: '' }]);
  const removeMedicine = (i: number) => setMedicines(m => m.filter((_, idx) => idx !== i));
  const updateMedicine = (i: number, field: keyof Medicine, value: string) =>
    setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: value } : med));

  const savePrescription = async () => {
    if (!selectedVisit || !patient) return;
    const validMeds = medicines.filter(m => m.name.trim());
    if (!diagnosis.trim() && validMeds.length === 0) {
      toast.error('Please add diagnosis or medicines');
      return;
    }
    setSaving(true);
    try {
      // Save prescription
      const { error: rxError } = await supabase.from('prescriptions').insert({
        visit_id: selectedVisit.id,
        patient_id: patient.id,
        diagnosis: diagnosis || null,
        medicines: validMeds as any,
        advice_image: advice || null,
      });
      if (rxError) throw rxError;

      // Mark visit completed
      await supabase.from('visits').update({ status: 'completed', diagnosis }).eq('id', selectedVisit.id);

      toast.success('Prescription saved & sent to print queue');
      setSelectedVisit(null);
      setPatient(null);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'waiting') return 'bg-warning/10 text-warning border-warning/30';
    if (s === 'in_consultation') return 'bg-info/10 text-info border-info/30';
    return 'bg-success/10 text-success border-success/30';
  };

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen">
      {/* Left panel — Queue */}
      <div className="w-80 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-heading font-bold text-lg">Patient Queue</h2>
          <p className="text-sm text-muted-foreground">{queue.length} patients today</p>
        </div>
        <div className="flex-1 overflow-auto">
          {queue.map(visit => (
            <button
              key={visit.id}
              onClick={() => selectVisit(visit)}
              className={cn(
                "w-full text-left p-4 border-b border-border hover:bg-secondary/50 transition-colors",
                selectedVisit?.id === visit.id && "bg-secondary"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-heading font-bold text-primary text-sm">#{visit.token_number}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{visit.patients?.name}</p>
                    <p className="text-xs text-muted-foreground">{visit.patients?.age}y · {visit.patients?.sex}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-xs", statusColor(visit.status))}>
                  {visit.status === 'waiting' ? 'Wait' : visit.status === 'in_consultation' ? 'Active' : 'Done'}
                </Badge>
              </div>
            </button>
          ))}
          {queue.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No patients in queue</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Details & Prescription */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedVisit ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Select a patient from the queue</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 animate-slide-in">
            {/* Patient Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Token #{selectedVisit.token_number}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>{patient?.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Age:</span> {patient?.age}y</div>
                  <div><span className="text-muted-foreground">Sex:</span> {patient?.sex}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {patient?.phone}</div>
                  <div><span className="text-muted-foreground">Address:</span> {patient?.address || '—'}</div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Weight', value: selectedVisit.weight, unit: 'kg' },
                    { label: 'BP', value: selectedVisit.blood_pressure, unit: '' },
                    { label: 'Pulse', value: selectedVisit.pulse_rate, unit: 'bpm' },
                    { label: 'SpO2', value: selectedVisit.spo2, unit: '%' },
                    { label: 'Temp', value: selectedVisit.temperature, unit: '°F' },
                    { label: 'CBG', value: selectedVisit.cbg, unit: 'mg/dL' },
                  ].map(v => (
                    <div key={v.label} className="text-center p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">{v.label}</p>
                      <p className="font-bold text-sm">{v.value ?? '—'}{v.value ? ` ${v.unit}` : ''}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* History */}
            {history.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Visit History</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-40 overflow-auto">
                    {history.map(h => (
                      <div key={h.id} className="text-sm p-2 rounded bg-muted">
                        <div className="flex justify-between">
                          <span className="font-medium">{new Date(h.created_at).toLocaleDateString()}</span>
                          <span className="text-muted-foreground">Token #{h.token_number}</span>
                        </div>
                        {h.diagnosis && <p className="text-muted-foreground mt-1">Dx: {h.diagnosis}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prescription */}
            <Card>
              <CardHeader><CardTitle>Prescription</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Enter diagnosis" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Medicines</Label>
                    <Button size="sm" variant="outline" onClick={addMedicine}><Plus className="w-4 h-4 mr-1" />Add</Button>
                  </div>
                  {medicines.map((med, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 items-end">
                      <Input placeholder="Medicine" value={med.name} onChange={e => updateMedicine(i, 'name', e.target.value)} />
                      <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMedicine(i, 'dosage', e.target.value)} />
                      <Input placeholder="Frequency" value={med.frequency} onChange={e => updateMedicine(i, 'frequency', e.target.value)} />
                      <Input placeholder="Duration" value={med.duration} onChange={e => updateMedicine(i, 'duration', e.target.value)} />
                      <Button size="icon" variant="ghost" onClick={() => removeMedicine(i)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Advice</Label>
                  <Input value={advice} onChange={e => setAdvice(e.target.value)} placeholder="General advice for the patient" />
                </div>

                <Button onClick={savePrescription} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Prescription & Complete Visit
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}