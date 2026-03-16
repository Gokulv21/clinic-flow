import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle, Plus, Trash2, Save, Loader2, PenTool, Eye, Menu, Printer, ArrowLeft, Activity, ClipboardList } from 'lucide-react';
import DigitalPrescription from '@/components/DigitalPrescription';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { printPrescription } from '@/lib/printPrescription';
import PageBanner from '@/components/PageBanner';
import consultationBanner from '@/assets/consultation_banner.png';

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export default function DoctorConsultation() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [advice, setAdvice] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDigitalRx, setShowDigitalRx] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [prescriptionPaths, setPrescriptionPaths] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [viewingHistoryRx, setViewingHistoryRx] = useState<any>(null);

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
    setAdvice('');
    
    // Check if prescription image is an array of pages (stored as JSON string)
    let rxData = visit.prescriptions?.[0];
    let rxImage = rxData?.advice_image;
    let rxPaths = rxData?.raw_paths || [];
    
    try {
      if (rxImage && rxImage.startsWith('[')) {
        rxImage = JSON.parse(rxImage);
      }
    } catch (e) {
      console.error("Error parsing multi-page images", e);
    }

    setPrescriptionImage(rxImage);
    setPrescriptionPaths(rxPaths);

    // Update status to in_consultation
    if (visit.status === 'waiting') {
      await supabase.from('visits').update({ 
        status: 'in_consultation'
      }).eq('id', visit.id);
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
    if (!diagnosis.trim() && validMeds.length === 0 && !prescriptionImage) {
      toast.error('Please add diagnosis, medicines or handwriting');
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
        advice_image: prescriptionImage || advice || null,
        raw_paths: prescriptionPaths as any,
      });
      if (rxError) throw rxError;

      // Mark visit completed
      await supabase.from('visits').update({ 
        status: 'completed', 
        diagnosis
      }).eq('id', selectedVisit.id);

      toast.success('Prescription saved & sent to print queue');
      setSelectedVisit(null);
      setPatient(null);
      setPrescriptionImage(null);
      setPrescriptionPaths([]);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrescriptionSave = (data: string | string[] | null, pages: any[][]) => {
    setPrescriptionImage(Array.isArray(data) ? JSON.stringify(data) : data);
    setPrescriptionPaths(pages as any);
    setShowDigitalRx(false);
  };

  const statusColor = (s: string) => {
    if (s === 'waiting') return 'bg-warning/10 text-warning border-warning/30';
    if (s === 'in_consultation') return 'bg-info/10 text-info border-info/30';
    return 'bg-success/10 text-success border-success/30';
  };

  const queuePanel = (
    <div className="h-full flex flex-col bg-card">
      <div className="p-4 border-b border-border bg-card sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg">Patient Queue</h2>
          <p className="text-sm text-muted-foreground">{queue.length} patients today</p>
        </div>
        {/* Mobile-only refresh or count indicator if needed */}
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
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-heading font-bold text-primary text-sm">#{visit.token_number}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{(visit.patients?.title ? visit.patients.title + ' ' : '') + visit.patients?.name}</p>
                  <p className="text-xs text-muted-foreground">{visit.patients?.age}y · {visit.patients?.sex}</p>
                </div>
              </div>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0 ml-2", statusColor(visit.status))}>
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
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-[calc(100vh-0px)] overflow-hidden">
      {/* 
          MOBILE UI REFACTOR: WhatsApp-style Master-Detail 
          - On mobile: If NO selectedVisit, show queue list.
          - On mobile: If selectedVisit, show consultation details.
          - On desktop: Always show both (sidebar + main).
      */}

      {/* Queue List (Sidebar on desktop, full screen on mobile when no patient selected) */}
      <div className={cn(
        "w-full md:w-80 border-r border-border shrink-0 h-full",
        selectedVisit ? "hidden md:block" : "block"
      )}>
        {queuePanel}
      </div>

      {/* Consultation Details (Main content) */}
      <div className={cn(
        "flex-1 overflow-auto bg-slate-50/30 h-full",
        !selectedVisit ? "hidden md:block" : "block"
      )}>
        {!selectedVisit ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center p-6">
              <User className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-medium opacity-50">Select a patient for consultation</p>
              <p className="text-sm opacity-40 mt-1">Tap a patient from the queue to start</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 animate-slide-in pb-20 font-jakarta-sans">
            {/* Mobile-only Header with Back Button */}
            <div className="md:hidden flex items-center justify-between mb-4 bg-white/80 backdrop-blur sticky top-[-1rem] z-20 py-2 -mx-4 px-4 border-b border-border shadow-sm">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedVisit(null)} className="-ml-2">
                  <ArrowLeft className="w-5 h-5 text-primary" />
                </Button>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Consultation</h3>
                  <p className="text-xs text-muted-foreground">Token #{selectedVisit.token_number} · {(patient?.title ? patient.title + ' ' : '') + patient?.name}</p>
                </div>
              </div>
              <Badge variant="outline" className={cn("text-[10px]", statusColor(selectedVisit.status))}>
                {selectedVisit.status === 'waiting' ? 'Wait' : selectedVisit.status === 'in_consultation' ? 'Active' : 'Done'}
              </Badge>
            </div>
            {/* Patient Info */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 px-6">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-extrabold tracking-tight text-slate-800">
                      {(patient?.title ? patient.title + ' ' : '') + patient?.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 border-slate-200">
                    TOKEN #{selectedVisit.token_number}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age / Sex</p>
                    <p className="text-base font-bold text-slate-700">{patient?.age}y · {patient?.sex}</p>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-base font-bold text-slate-700">{patient?.phone}</p>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 col-span-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</p>
                    <p className="text-base font-bold text-slate-700 truncate">{patient?.address || '—'}</p>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <h4 className="text-[12px] font-extrabold text-slate-600 uppercase tracking-widest">Clinical Vitals</h4>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: 'Weight', value: selectedVisit.weight, unit: 'kg' },
                      { label: 'BP', value: selectedVisit.blood_pressure, unit: 'mmHg' },
                      { label: 'Pulse', value: selectedVisit.pulse_rate, unit: 'bpm' },
                      { label: 'SpO2', value: selectedVisit.spo2, unit: '%' },
                      { label: 'Temp', value: selectedVisit.temperature, unit: '°F' },
                      { label: 'CBG', value: selectedVisit.cbg, unit: 'mg/dL' },
                    ].map(v => (
                      <div key={v.label} className="text-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-colors group">
                        <p className="text-[10px] font-extrabold text-slate-400 mb-1 group-hover:text-blue-400 transition-colors uppercase">{v.label}</p>
                        <p className="font-extrabold text-sm text-slate-700">{v.value ?? '—'}<span className="text-[10px] font-medium ml-0.5 opacity-60 font-sans">{v.value ? ` ${v.unit}` : ''}</span></p>
                      </div>
                    ))}
                  </div>
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
                      <div key={h.id} className="text-sm p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-700">{new Date(h.created_at).toLocaleDateString()}</span>
                             <span className="text-[10px] font-bold text-slate-400">TOKEN #{h.token_number}</span>
                          </div>
                          {h.diagnosis && <p className="text-xs text-slate-500 mt-0.5 truncate italic">Dx: {h.diagnosis}</p>}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                          onClick={() => setViewingHistoryRx(h)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prescription */}
            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-800">Prescription Details</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDigitalRx(true)}
                  className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                >
                  <PenTool className="w-4 h-4 mr-2" />
                  Open Template (iPad/Pen)
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {prescriptionImage && (
                  <div className="relative group border rounded-lg overflow-hidden bg-slate-50 mb-4 h-32 flex items-center justify-center">
                    <img src={Array.isArray(prescriptionImage) ? prescriptionImage[0] : (prescriptionImage?.startsWith('[') ? JSON.parse(prescriptionImage)[0] : prescriptionImage)} alt="Handwritten Rx" className="max-h-full" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setPrescriptionImage(null)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest ml-1">Diagnosis</Label>
                  <Input 
                    value={diagnosis} 
                    onChange={e => setDiagnosis(e.target.value)} 
                    placeholder="Enter diagnosis" 
                    className="h-12 text-base font-bold bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-blue-500 transition-all rounded-xl"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Medicines</Label>
                    <Button size="sm" variant="outline" onClick={addMedicine} className="h-8 pr-3 pl-2 text-[11px] font-bold border-blue-100 text-blue-600 hover:bg-blue-50 bg-white rounded-lg">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Medicine
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {medicines.map((med, i) => (
                      <div key={i} className="flex gap-2 items-start bg-slate-50/30 p-3 rounded-2xl border border-slate-100 group relative">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Name</p>
                            <Input placeholder="Paracetamol" value={med.name} onChange={e => updateMedicine(i, 'name', e.target.value)} className="h-10 text-sm font-bold border-slate-200 bg-white rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Dosage</p>
                            <Input placeholder="500mg" value={med.dosage} onChange={e => updateMedicine(i, 'dosage', e.target.value)} className="h-10 text-sm font-bold border-slate-200 bg-white rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Frequency</p>
                            <Input placeholder="1-0-1" value={med.frequency} onChange={e => updateMedicine(i, 'frequency', e.target.value)} className="h-10 text-sm font-bold border-slate-200 bg-white rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Duration</p>
                            <Input placeholder="5 Days" value={med.duration} onChange={e => updateMedicine(i, 'duration', e.target.value)} className="h-10 text-sm font-bold border-slate-200 bg-white rounded-lg" />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeMedicine(i)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg h-10 w-10 mt-5 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest ml-1">Advice</Label>
                  <Input 
                    value={advice} 
                    onChange={e => setAdvice(e.target.value)} 
                    placeholder="Drink plenty of water..." 
                    className="h-12 text-base font-bold bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-blue-500 transition-all rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={savePrescription} disabled={saving} className="h-11 shadow-lg bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save & Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Overlays */}
      {showDigitalRx && (
        <DigitalPrescription
          patient={patient}
          visit={selectedVisit}
          initialPaths={prescriptionPaths}
          onSave={handlePrescriptionSave}
          onClose={() => setShowDigitalRx(false)}
        />
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-slate-100">
          <DialogHeader className="bg-white p-4 border-b flex flex-row items-center justify-between">
            <DialogTitle>Prescription Preview</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => printPrescription()} className="gap-2">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </DialogHeader>
          <div className="p-4 md:p-8 overflow-auto max-h-[85vh] flex justify-center">
            <PrescriptionTemplate
              patient={patient}
              visit={selectedVisit}
              handwrittenImage={prescriptionImage}
              diagnosis={diagnosis}
              medicines={medicines.filter(m => m.name.trim())}
              advice={advice}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* History Preview Dialog */}
      <Dialog open={!!viewingHistoryRx} onOpenChange={open => !open && setViewingHistoryRx(null)}>
        <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-slate-100">
          <div className="bg-white p-4 border-b flex items-center justify-between sticky top-0 z-10">
            <h3 className="font-bold">Prescription History</h3>
            <Button size="sm" onClick={() => printPrescription()} className="gap-2">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
          <div className="p-4 md:p-8 overflow-auto max-h-[75vh] flex justify-center">
            {viewingHistoryRx && (
              <PrescriptionTemplate
                patient={patient}
                visit={viewingHistoryRx}
                handwrittenImage={viewingHistoryRx.prescriptions?.[0]?.advice_image}
                diagnosis={viewingHistoryRx.prescriptions?.[0]?.diagnosis || viewingHistoryRx.diagnosis}
                medicines={viewingHistoryRx.prescriptions?.[0]?.medicines || []}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}