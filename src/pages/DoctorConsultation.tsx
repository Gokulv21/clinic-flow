import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn, formatAge } from '@/lib/utils';
import { User, Clock, CheckCircle, Plus, Trash2, Save, Loader2, PenTool, Eye, Menu, Printer, ArrowLeft, Activity, ClipboardList, Scale, Heart, Wind, Thermometer, Droplet, Pencil, Calendar, RefreshCw, UserX, ChevronDown, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import DigitalPrescription from '@/components/DigitalPrescription';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { format } from "date-fns";
import prescriptionLogo from '@/assets/prescriptionLogo.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { printPrescription } from '@/lib/printPrescription';
import PageBanner from '@/components/PageBanner';
import consultationBanner from '@/assets/consultation_banner.png';

interface Medicine {
  type: string;
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  notes?: string;
  count?: string;
}

const COMMON_FREQUENCIES = [
  '1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', '1-1-0', '0-1-1', 
  'Stat', 'SOS', 'Twice daily', 'Thrice daily', 'Four times daily', 'Before food', 'After food'
];

export default function DoctorConsultation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. Fetch Queue via React Query
  const { data: queue = [], isLoading: isLoadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ['visitQueue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(*), prescriptions(*)')
        .in('status', ['waiting', 'in_consultation'])
        .order('token_number', { ascending: true });
      if (error) throw error;
      return (data || []).filter(v => v.patients);
    },
    staleTime: 30000, // Consider data fresh for 30s
    refetchOnWindowFocus: true,
  });

  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
  const [advice, setAdvice] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDigitalRx, setShowDigitalRx] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [prescriptionPaths, setPrescriptionPaths] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [viewingHistoryRx, setViewingHistoryRx] = useState<any>(null);
  const [isWritingMode, setIsWritingMode] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [showVitalsEdit, setShowVitalsEdit] = useState(false);
  const [lastInputWay, setLastInputWay] = useState<'typing' | 'writing'>('typing');
  const [saveError, setSaveError] = useState<{ step: 'prescription' | 'visit', message: string } | null>(null);
  const lastLoadedVisitId = useRef<string | null>(null);

  useEffect(() => {

    let debounceTimer: any;
    const channel = supabase
      .channel('visits-realtime-doctor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        // Debounce invalidation to prevent "request storms" under high traffic
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!document.hidden) {
            queryClient.invalidateQueries({ queryKey: ['visitQueue'] });
          }
        }, 2000); 
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          toast.error('Realtime connection issue. Check your internet.');
        }
      });

    // RESTORE STATE FROM LOCALSTORAGE
    const restoreState = async () => {
      const savedVisitId = localStorage.getItem('active_consultation_id');
      if (savedVisitId) {
        const { data } = await supabase
          .from('visits')
          .select('*, patients(*), prescriptions(*)')
          .eq('id', savedVisitId)
          .single();
        
        if (data && (data.status === 'waiting' || data.status === 'in_consultation')) {
          selectVisit(data, true); // true = check for drafts
        } else {
          // If the visit is completed or not found, clear the active consultation
          localStorage.removeItem('active_consultation_id');
          setSelectedVisit(null);
          setPatient(null);
        }
      }
    };
    restoreState();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // AUTO-SAVE DRAFT TO LOCALSTORAGE (DEBOUNCED)
  useEffect(() => {
    if (selectedVisit?.id && selectedVisit.id === lastLoadedVisitId.current) {
      const timer = setTimeout(() => {
        const draft = {
          diagnosis,
          clinicalNotes,
          medicines,
          advice,
          prescriptionImage,
          prescriptionPaths,
          isWritingMode,
          lastInputWay,
          timestamp: Date.now()
        };
        localStorage.setItem(`draft_${selectedVisit.id}`, JSON.stringify(draft));
        localStorage.setItem('active_consultation_id', selectedVisit.id);
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timer);
    }
  }, [selectedVisit?.id, diagnosis, clinicalNotes, medicines, advice, prescriptionImage, prescriptionPaths, isWritingMode, lastInputWay]);

  const selectVisit = async (visit: any, checkForDrafts = false) => {
    if (saving) {
      toast.warning('Please wait for the current save to complete');
      return;
    }
    
    if (saveError) {
      toast.error('Previous save failed. Please retry or clear the error before switching patients.', {
        description: `Error at step: ${saveError.step}. Click "Retry Save" to fix.`
      });
      return;
    }

    setSelectedVisit(visit);
    setPatient(visit.patients);
    
    // Update last_opened_at for the patient
    if (visit.patients?.id) {
      supabase.from('patients').update({ last_opened_at: new Date().toISOString() }).eq('id', visit.patients.id).then();
    }
    
    // Check for drafts in localStorage
    const savedDraft = localStorage.getItem(`draft_${visit.id}`);
    if (checkForDrafts && savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        // Only use draft if it's less than 24 hours old
        if (Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
          setDiagnosis(draft.diagnosis || '');
          setClinicalNotes(draft.clinicalNotes || '');
          setMedicines(draft.medicines || [{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
          setAdvice(draft.advice || '');
          setPrescriptionImage(draft.prescriptionImage);
          setPrescriptionPaths(draft.prescriptionPaths || []);
          setIsWritingMode(draft.isWritingMode ?? false);
          setLastInputWay(draft.lastInputWay || (draft.isWritingMode ? 'writing' : 'typing'));
          lastLoadedVisitId.current = visit.id;
          return;
        }
      } catch (e) {
        console.error("Error restoring draft", e);
      }
    }

    // Default: Check if prescription image is an array of pages (stored as JSON string)
    const rxData = visit.prescriptions?.[0];
    let rxImage = rxData?.advice_image;
    const rxPaths = rxData?.raw_paths || [];
    
    // Load existing prescription data
    setDiagnosis(rxData?.diagnosis || '');
    setClinicalNotes(rxData?.clinical_notes || '');
    setMedicines(rxData?.medicines || [{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
    
    // Determine if it's a handwritten prescription or typed advice
    if (rxImage && rxImage.startsWith('data:image')) {
      setPrescriptionImage(rxImage);
      setAdvice('');
    } else if (rxImage && rxImage.startsWith('[')) {
      try {
        const parsed = JSON.parse(rxImage);
        setPrescriptionImage(parsed);
        setAdvice('');
      } catch (e) {
        setPrescriptionImage(rxImage);
      }
    } else {
      setPrescriptionImage(null);
      setAdvice(rxImage || '');
    }

    setIsWritingMode(rxData?.is_writing_mode ?? (!!rxImage && (rxImage.startsWith('data:image') || rxImage.startsWith('['))));
    setLastInputWay(rxData?.is_writing_mode ? 'writing' : 'typing');
    setPrescriptionPaths(rxPaths);
    
    // If there's a drawing, force writing mode preference initially
    if (rxPaths && rxPaths.length > 0 && rxPaths[0].length > 0) {
      setIsWritingMode(true);
      setLastInputWay('writing');
    }

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
    lastLoadedVisitId.current = visit.id;
  };

  const markAsNoShow = async () => {
    if (!selectedVisit) return;
    
    setSaving(true);
    try {
      const patientId = selectedVisit.patient_id;

      // 1. Update status to 'no_show' first as a safeguard (removes from active queue immediately)
      const { error: statusError } = await supabase
        .from('visits')
        .update({ status: 'no_show' })
        .eq('id', selectedVisit.id);
      
      if (statusError) throw new Error(`Failed to update status: ${statusError.message}`);

      // 2. Delete associated prescriptions (to avoid foreign key constraints)
      const { error: rxDeleteError } = await supabase
        .from('prescriptions')
        .delete()
        .eq('visit_id', selectedVisit.id);

      if (rxDeleteError) throw new Error(`Failed to delete prescription: ${rxDeleteError.message}`);

      // 3. Delete the visit record entirely
      const { error: deleteError } = await supabase
        .from('visits')
        .delete()
        .eq('id', selectedVisit.id);

      if (deleteError) throw new Error(`Failed to delete visit record: ${deleteError.message}`);

      // 4. Check if this patient has ANY other visits
      const { data: otherVisits, error: countError } = await supabase
        .from('visits')
        .select('id')
        .eq('patient_id', patientId)
        .limit(1);

      if (countError) throw new Error(`Failed to check patient history: ${countError.message}`);

      let patientDeleted = false;
      if (!otherVisits || otherVisits.length === 0) {
        // No other visits, delete the patient entirely
        console.log("No other visits found for patient, deleting patient record...");
        const { error: patientDeleteError } = await supabase
          .from('patients')
          .delete()
          .eq('id', patientId);
        
        if (patientDeleteError) {
          console.error("Patient deletion failed:", patientDeleteError);
          // Don't throw here, as visit was already deleted. Just toast about it.
          toast.error(`Could not remove patient record: ${patientDeleteError.message}`);
        } else {
          patientDeleted = true;
        }
      }

      toast.success(patientDeleted ? 'Patient record removed' : 'Visit cancelled');
      
      // Clear selection
      localStorage.removeItem(`draft_${selectedVisit.id}`);
      localStorage.removeItem('active_consultation_id');
      setSelectedVisit(null);
      setPatient(null);
      
      queryClient.invalidateQueries({ queryKey: ['visitQueue'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addMedicine = () => setMedicines(m => [...m, { type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
  const removeMedicine = (i: number) => setMedicines(m => m.filter((_, idx) => idx !== i));
  const updateMedicine = (i: number, field: keyof Medicine, value: string) =>
    setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: value } : med));

  const handleMedicineKeyDown = (e: React.KeyboardEvent, index: number, fieldName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest('.medicine-row');
      if (!form) return;
      
      const inputs = Array.from(form.querySelectorAll('input, select')) as HTMLElement[];
      const currentIndex = inputs.indexOf(e.target as HTMLElement);
      
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      } else {
        // If last field of current medicine, maybe add new medicine or go to advice
        if (index === medicines.length - 1) {
          addMedicine();
          // Timeout to wait for new row to render
          setTimeout(() => {
            const nextRow = form.parentElement?.lastElementChild?.querySelector('input');
            if (nextRow) nextRow.focus();
          }, 0);
        }
      }
    }
  };

  // Memoize status color helper to prevent re-calculations during re-renders
  const getStatusColor = (s: string) => {
    if (s === 'waiting') return 'bg-warning/10 text-warning border-warning/30';
    if (s === 'in_consultation') return 'bg-info/10 text-info border-info/30';
    return 'bg-success/10 text-success border-success/30';
  };

  const savePrescription = async () => {
    if (!selectedVisit || !patient) return;
    
    // Prioritize the last way of record
    const isWriting = lastInputWay === 'writing';
    const finalDiagnosis = diagnosis || null;
    const finalClinicalNotes = clinicalNotes || null;
    const finalMedicines = medicines.filter(m => m.name.trim());
    const finalAdviceImage = isWriting ? prescriptionImage : (advice || null);
    const finalPaths = isWriting ? prescriptionPaths : [];

    if (!isWriting && !finalDiagnosis && finalMedicines.length === 0 && !advice && !finalClinicalNotes) {
      toast.error('Please add diagnosis, notes, medicines or advice');
      return;
    }
    
    if (isWriting && !prescriptionImage) {
      toast.error('Please add handwriting using the template');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // Step 1: Save Prescription (if not already saved in a previous failed attempt)
      if (!saveError || saveError.step === 'prescription') {
        const { error: rxError } = await supabase.from('prescriptions').insert({
          visit_id: selectedVisit.id,
          patient_id: patient.id,
          diagnosis: finalDiagnosis,
          clinical_notes: finalClinicalNotes,
          medicines: finalMedicines as any,
          advice_image: finalAdviceImage,
          raw_paths: finalPaths as any,
          is_writing_mode: isWritingMode,
          doctor_id: user?.id
        });

        if (rxError) {
          // If it's a "duplicate key" error, it might mean it was actually saved but the response was lost
          if (rxError.code === '23505') {
             console.log("Prescription likely already exists, proceeding to status update.");
          } else {
            setSaveError({ step: 'prescription', message: rxError.message });
            throw rxError;
          }
        }
      }

      // Step 2: Update Visit Status
      const { error: visitError } = await supabase.from('visits').update({ 
        status: 'completed', 
        diagnosis: finalDiagnosis
      }).eq('id', selectedVisit.id);

      if (visitError) {
        setSaveError({ step: 'visit', message: visitError.message });
        throw visitError;
      }

      // SUCCESS: Clear everything
      toast.success('Prescription saved & sent to print queue');
      
      localStorage.removeItem(`draft_${selectedVisit.id}`);
      localStorage.removeItem('active_consultation_id');
      
      setAdvice('');
      setSelectedVisit(null);
      setPatient(null);
      setPrescriptionImage(null);
      setPrescriptionPaths([]);
      setDiagnosis('');
      setClinicalNotes('');
      setMedicines([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
      setSaveError(null);

      queryClient.invalidateQueries({ queryKey: ['visitQueue'] });
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(`Save Failed: ${err.message || 'Unknown error'}`, {
        description: "Please try again. Your data is still here.",
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrescriptionSave = (data: string | string[] | null, pages: any[][]) => {
    setPrescriptionImage(Array.isArray(data) ? JSON.stringify(data) : data);
    setPrescriptionPaths(pages as any);
    setShowDigitalRx(false);
    setIsWritingMode(true);
    setLastInputWay('writing');
    // Clear typed advice since we are in writing mode
    setAdvice('');
  };

  const queuePanel = (
    <div className="h-full flex flex-col bg-card">
      <div className="p-4 border-b border-border bg-card sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg">Patient Queue</h2>
          {queue.length > 0 ? (
            <p className="text-sm text-muted-foreground">{queue.length} patients today</p>
          ) : (
            <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-bold">Queue is Empty</p>
          )}
        </div>
        <div className="flex items-center gap-2">
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => refetchQueue()}
            disabled={isLoadingQueue}
            className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
            title="Refresh Queue"
          >
            {isLoadingQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {queue.map(visit => (
          <button
            key={visit.id}
            onClick={() => selectVisit(visit, true)}
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
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0 ml-2", getStatusColor(visit.status))}>
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
        "flex-1 overflow-auto bg-muted/30 h-full",
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
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-slide-in pb-[40vh] font-jakarta-sans">
            {/* Mobile-only Header with Back Button */}
            <div className="md:hidden flex items-center justify-between mb-4 bg-background/80 backdrop-blur sticky top-[-1rem] z-20 py-2 -mx-4 px-4 border-b border-border shadow-sm">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => {
                  if (saving) {
                    toast.warning('Save in progress...');
                    return;
                  }
                  if (saveError) {
                    toast.error('Please retry the failed save first');
                    return;
                  }
                  localStorage.removeItem('active_consultation_id');
                  setSelectedVisit(null);
                }} className="-ml-2">
                  <ArrowLeft className="w-5 h-5 text-primary" />
                </Button>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Consultation</h3>
                  <p className="text-xs text-muted-foreground">Token #{selectedVisit.token_number} · {(patient?.title ? patient.title + ' ' : '') + patient?.name}</p>
                </div>
              </div>
              <Badge variant="outline" className={cn("text-[10px]", getStatusColor(selectedVisit.status))}>
                {selectedVisit.status === 'waiting' ? 'Wait' : selectedVisit.status === 'in_consultation' ? 'Active' : 'Done'}
              </Badge>
            </div>
            {/* Patient Info */}
            <Card className="border-none shadow-sm bg-card">
              <CardHeader className="pb-3 px-6">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-extrabold tracking-tight text-foreground">
                      {(patient?.title ? patient.title + ' ' : '') + patient?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAsNoShow}
                      disabled={saving}
                      className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 rounded-lg"
                      title="Patient left without consultation"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold">No Show</span>
                    </Button>
                    <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 border-slate-200">
                      TOKEN #{selectedVisit.token_number}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                  <div className="bg-muted/50 p-3 rounded-xl border border-border">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Age / Sex</p>
                    <p className="text-base font-bold text-foreground">{formatAge(patient?.age)}/{patient?.sex?.charAt(0) ?? '—'}</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-xl border border-border">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-base font-bold text-foreground">{patient?.phone}</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-xl border border-border col-span-2">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Address</p>
                    <p className="text-base font-bold text-foreground truncate">{patient?.address || '—'}</p>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <h4 className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest">Clinical Vitals</h4>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowVitalsEdit(true)}
                      className="h-8 px-2 text-blue-600 hover:bg-blue-50 gap-1 rounded-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold">Edit</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: 'Weight', value: selectedVisit.weight, unit: 'kg', icon: Scale, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
                      { label: 'BP', value: selectedVisit.blood_pressure, unit: 'mmHg', icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
                      { label: 'Pulse', value: selectedVisit.pulse_rate, unit: 'bpm', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                      { label: 'SpO2', value: selectedVisit.spo2, unit: '%', icon: Wind, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10' },
                      { label: 'Temp', value: selectedVisit.temperature, unit: '°F', icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                      { label: 'CBG', value: selectedVisit.cbg, unit: 'mg/dL', icon: Droplet, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
                    ].map(v => (
                      <div key={v.label} className="text-center p-3 rounded-2xl bg-card border border-border shadow-sm hover:border-blue-500/50 transition-all group flex flex-col items-center gap-1.5">
                        <div className={cn("p-2 rounded-xl transition-colors", v.bg)}>
                          <v.icon className={cn("w-4 h-4", v.color)} />
                        </div>
                        <p className="text-[10px] font-extrabold text-muted-foreground group-hover:text-blue-500 transition-colors uppercase">{v.label}</p>
                        <p className="font-extrabold text-sm text-foreground leading-none">{v.value ?? '—'}<span className="text-[10px] font-medium ml-0.5 opacity-60 font-sans">{v.value ? ` ${v.unit}` : ''}</span></p>
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
                      <div key={h.id} className="text-sm p-3 rounded-xl bg-muted border border-border flex items-center justify-between group">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                             <span className="text-[10px] font-bold text-muted-foreground">TOKEN #{h.token_number}</span>
                          </div>
                          {h.diagnosis && <p className="text-xs text-muted-foreground mt-0.5 truncate italic">Dx: {h.diagnosis}</p>}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors shrink-0"
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
            <Card className="border-none shadow-sm overflow-hidden bg-card">
              <CardHeader className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 px-6 bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 rounded-md">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground">Prescription Details</CardTitle>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg shrink-0 border border-border">
                    <Button
                      variant={!isWritingMode ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setIsWritingMode(false)}
                      className={cn("h-8 px-3 text-[11px] font-bold", !isWritingMode && "bg-background shadow-sm")}
                    >
                      Typing Mode
                    </Button>
                    <Button
                      variant={isWritingMode ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setIsWritingMode(true)}
                      className={cn("h-8 px-3 text-[11px] font-bold", isWritingMode && "bg-background shadow-sm")}
                    >
                      Writing Mode
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!isWritingMode) {
                        toast.error("Please switch to Writing Mode first", {
                          description: "The Pen template is only available in Writing Mode.",
                          duration: 3000
                        });
                        return;
                      }
                      setShowDigitalRx(true);
                    }}
                    className={cn(
                      "h-10 px-6 bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg rounded-xl border-none",
                      !isWritingMode && "opacity-40"
                    )}
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    <span className="text-xs font-black uppercase tracking-widest">Open Signature & Pen Template</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isWritingMode && (
                    <div className={cn(
                        "flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed transition-all",
                        prescriptionImage ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/50"
                    )}>
                        {prescriptionImage ? (
                            <div className="relative group w-full max-w-md aspect-[1/1.414] bg-white rounded-2xl shadow-xl border overflow-hidden">
                                <img 
                                    src={Array.isArray(prescriptionImage) ? prescriptionImage[0] : (prescriptionImage?.startsWith('[') ? JSON.parse(prescriptionImage)[0] : prescriptionImage)} 
                                    alt="Handwritten Rx" 
                                    className="w-full h-full object-contain" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <Button size="sm" onClick={() => setShowDigitalRx(true)} className="bg-white text-slate-900 hover:bg-slate-100 font-bold">Edit</Button>
                                    <Button variant="destructive" size="sm" onClick={() => setPrescriptionImage(null)} className="font-bold">Clear</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                    <PenTool className="w-10 h-10" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-black text-foreground">No Pen Content Yet</p>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tap 'Open Template' above to start writing</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {!isWritingMode && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="space-y-3">
                      <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">Clinical Notes</Label>
                      <Textarea 
                        value={clinicalNotes} 
                        onChange={e => {
                          setClinicalNotes(e.target.value);
                          setLastInputWay('typing');
                        }} 
                        placeholder="Enter clinical examination notes, symptoms, etc." 
                        className="min-h-[120px] text-base font-bold bg-muted/50 border-border focus:bg-card focus:ring-blue-500 transition-all rounded-xl resize-none shadow-inner"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">Diagnosis</Label>
                      <Input 
                        value={diagnosis} 
                        onChange={e => {
                          setDiagnosis(e.target.value);
                          setLastInputWay('typing');
                        }} 
                        placeholder="Enter diagnosis" 
                        className="h-12 text-base font-bold bg-muted/50 border-border focus:bg-card focus:ring-blue-500 transition-all rounded-xl shadow-inner"
                      />
                    </div>
                  </div>
                )}

                {!isWritingMode && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-6 duration-700">
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest">Medicines</Label>
                        <Button size="sm" variant="outline" onClick={addMedicine} className="h-8 pr-3 pl-2 text-[11px] font-bold border-blue-500/20 text-blue-600 hover:bg-blue-500/10 bg-card rounded-lg">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Medicine
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {medicines.map((med, i) => (
                          <div key={i} className="medicine-row flex gap-2 items-start bg-muted/30 p-3 rounded-2xl border border-border group relative">
                            <div className="flex flex-col md:flex-row gap-3 flex-1">
                              {/* Type Selector */}
                              <div className="md:w-32 shrink-0">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1 mb-1">Type</p>
                                <select 
                                  value={med.type} 
                                  onChange={e => updateMedicine(i, 'type', e.target.value)}
                                  onKeyDown={e => handleMedicineKeyDown(e, i, 'type')}
                                  className="w-full h-10 text-sm font-bold border border-border bg-card rounded-lg px-2 focus:ring-2 focus:ring-blue-500 outline-none text-foreground"
                                >
                                  <option value="Inj.">Inj.</option>
                                  <option value="Supp.">Supp.</option>
                                  <option value="Syp.">Syp.</option>
                                  <option value="Tab.">Tab.</option>
                                  <option value="Cap.">Cap.</option>
                                  <option value="Oin.">Oin.</option>
                                  <option value="cr.">cr.</option>
                                  <option value="drops.">drops.</option>
                                  <option value="Sac">Sac</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                                <div className="space-y-1">
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Name</p>
                                  <Input 
                                    placeholder="Medicine Name" 
                                    value={med.name} 
                                    onChange={e => {
                                      updateMedicine(i, 'name', e.target.value);
                                      setLastInputWay('typing');
                                    }}
                                    onKeyDown={e => handleMedicineKeyDown(e, i, 'name')}
                                    className="h-10 text-sm font-bold border-border bg-card rounded-lg" 
                                  />
                                </div>

                                {/* Dynamic Fields based on Type */}
                                {(med.type === 'Inj.' || med.type === 'Supp.') && (
                                  <>
                                    <div className="space-y-1 text-blue-600 dark:text-blue-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Dosage</p>
                                      <Input placeholder="1 ml" value={med.dosage} onChange={e => updateMedicine(i, 'dosage', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'dosage')} className="h-10 text-sm font-bold border-blue-500/20 bg-blue-500/5 rounded-lg placeholder:text-blue-200/50" />
                                    </div>
                                    <div className="space-y-1 text-blue-600 dark:text-blue-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Route</p>
                                      <Input placeholder="I.M / I.V" value={med.route} onChange={e => updateMedicine(i, 'route', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'route')} className="h-10 text-sm font-bold border-blue-500/20 bg-blue-500/5 rounded-lg placeholder:text-blue-200/50" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Frequency</p>
                                      <div className="relative medicine-freq-container">
                                        <Input 
                                          placeholder="Stat / SOS" 
                                          value={med.frequency} 
                                          onChange={e => updateMedicine(i, 'frequency', e.target.value)} 
                                          onKeyDown={e => handleMedicineKeyDown(e, i, 'frequency')} 
                                          className="h-10 pr-9 text-sm font-bold border-border bg-card rounded-lg" 
                                        />
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="absolute right-0 top-0 h-10 w-9 hover:bg-muted rounded-r-lg"
                                              title="Select Frequency"
                                            >
                                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[180px] p-0 shadow-xl border-border" align="end">
                                            <div className="max-h-60 overflow-auto p-1 bg-card rounded-lg">
                                              {COMMON_FREQUENCIES.map(freq => (
                                                <button
                                                  key={freq}
                                                  className="w-full text-left px-3 py-2 text-[13px] font-bold hover:bg-blue-500/10 text-foreground rounded-md transition-colors"
                                                  onClick={() => updateMedicine(i, 'frequency', freq)}
                                                >
                                                  {freq}
                                                </button>
                                              ))}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {(med.type === 'Syp.' || med.type === 'Tab.' || med.type === 'Cap.') && (
                                  <>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Dosage</p>
                                      <Input placeholder="500mg / 5ml" value={med.dosage} onChange={e => updateMedicine(i, 'dosage', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'dosage')} className="h-10 text-sm font-bold border-border bg-card rounded-lg" />
                                    </div>
                                    <div className="space-y-1 text-purple-600 dark:text-purple-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Frequency</p>
                                      <div className="relative medicine-freq-container">
                                        <Input 
                                          placeholder="1-0-1" 
                                          value={med.frequency} 
                                          onChange={e => updateMedicine(i, 'frequency', e.target.value)} 
                                          onKeyDown={e => handleMedicineKeyDown(e, i, 'frequency')} 
                                          className="h-10 pr-9 text-sm font-bold border-purple-500/20 bg-purple-500/5 rounded-lg placeholder:text-purple-200/50" 
                                        />
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="absolute right-0 top-0 h-10 w-9 hover:bg-purple-500/10 rounded-r-lg"
                                              title="Select Frequency"
                                            >
                                              <ChevronDown className="h-4 w-4 text-purple-500" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[180px] p-0 shadow-xl border-purple-500/20" align="end">
                                            <div className="max-h-60 overflow-auto p-1 bg-card rounded-lg">
                                              {COMMON_FREQUENCIES.map(freq => (
                                                <button
                                                  key={freq}
                                                  className="w-full text-left px-3 py-2 text-[13px] font-bold hover:bg-purple-500/10 text-foreground rounded-md transition-colors"
                                                  onClick={() => updateMedicine(i, 'frequency', freq)}
                                                >
                                                  {freq}
                                                </button>
                                              ))}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-emerald-600 dark:text-emerald-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Remarks</p>
                                      <Input placeholder="After Food / HR (Notes)" value={med.notes} onChange={e => updateMedicine(i, 'notes', e.target.value)} onKeyDown={handleMedicineKeyDown ? (e) => handleMedicineKeyDown(e, i, 'notes') : undefined} className="h-10 text-sm font-bold border-emerald-500/20 bg-emerald-500/5 rounded-lg placeholder:text-emerald-200/50" />
                                    </div>
                                  </>
                                )}

                                {(med.type === 'Oin.' || med.type === 'cr.') && (
                                  <>
                                    <div className="space-y-1 text-orange-600 dark:text-orange-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Count</p>
                                      <Input placeholder="1 Tube / 1 Unit" value={med.count} onChange={e => updateMedicine(i, 'count', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'count')} className="h-10 text-sm font-bold border-orange-500/20 bg-orange-500/5 rounded-lg placeholder:text-orange-200/50" />
                                    </div>
                                    <div className="space-y-1 text-orange-600 dark:text-orange-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Route</p>
                                      <Input placeholder="External / Local" value={med.route} onChange={e => updateMedicine(i, 'route', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'route')} className="h-10 text-sm font-bold border-orange-500/20 bg-orange-500/5 rounded-lg placeholder:text-orange-200/50" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Remarks</p>
                                      <Input placeholder="Apply 2 times" value={med.notes} onChange={e => updateMedicine(i, 'notes', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'notes')} className="h-10 text-sm font-bold border-border bg-card rounded-lg" />
                                    </div>
                                  </>
                                )}

                                {med.type === 'drops.' && (
                                  <>
                                    <div className="space-y-1 text-sky-600 dark:text-sky-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Count</p>
                                      <Input placeholder="1 Bottle / 5ml" value={med.count} onChange={e => updateMedicine(i, 'count', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'count')} className="h-10 text-sm font-bold border-sky-500/20 bg-sky-500/5 rounded-lg placeholder:text-sky-200/50" />
                                    </div>
                                    <div className="space-y-1 text-sky-600 dark:text-sky-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Frequency</p>
                                      <div className="relative medicine-freq-container">
                                        <Input 
                                          placeholder="2 drops 3 times" 
                                          value={med.frequency} 
                                          onChange={e => updateMedicine(i, 'frequency', e.target.value)} 
                                          onKeyDown={e => handleMedicineKeyDown(e, i, 'frequency')} 
                                          className="h-10 pr-9 text-sm font-bold border-sky-500/20 bg-sky-500/5 rounded-lg placeholder:text-sky-200/50" 
                                        />
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="absolute right-0 top-0 h-10 w-9 hover:bg-sky-500/10 rounded-r-lg"
                                              title="Select Frequency"
                                            >
                                              <ChevronDown className="h-4 w-4 text-sky-500" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[180px] p-0 shadow-xl border-sky-500/20" align="end">
                                            <div className="max-h-60 overflow-auto p-1 bg-card rounded-lg">
                                              {COMMON_FREQUENCIES.map(freq => (
                                                <button
                                                  key={freq}
                                                  className="w-full text-left px-3 py-2 text-[13px] font-bold hover:bg-sky-500/10 text-foreground rounded-md transition-colors"
                                                  onClick={() => updateMedicine(i, 'frequency', freq)}
                                                >
                                                  {freq}
                                                </button>
                                              ))}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Remarks</p>
                                      <Input placeholder="Eye / Ear / Nose" value={med.notes} onChange={e => updateMedicine(i, 'notes', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'notes')} className="h-10 text-sm font-bold border-border bg-card rounded-lg" />
                                    </div>
                                  </>
                                )}

                                {med.type === 'Sac' && (
                                  <>
                                    <div className="space-y-1 text-amber-600 dark:text-amber-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Count</p>
                                      <Input placeholder="1 Sachet / 5 Sac" value={med.count} onChange={e => updateMedicine(i, 'count', e.target.value)} onKeyDown={e => handleMedicineKeyDown(e, i, 'count')} className="h-10 text-sm font-bold border-amber-500/20 bg-amber-500/5 rounded-lg placeholder:text-amber-200/50" />
                                    </div>
                                    <div className="space-y-1 text-amber-600 dark:text-amber-400">
                                      <p className="text-[9px] font-bold uppercase ml-1 italic opacity-60">Frequency</p>
                                      <div className="relative medicine-freq-container">
                                        <Input 
                                          placeholder="Daily night" 
                                          value={med.frequency} 
                                          onChange={e => updateMedicine(i, 'frequency', e.target.value)} 
                                          onKeyDown={e => handleMedicineKeyDown(e, i, 'frequency')} 
                                          className="h-10 pr-9 text-sm font-bold border-amber-500/20 bg-amber-500/5 rounded-lg placeholder:text-amber-200/50" 
                                        />
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="absolute right-0 top-0 h-10 w-9 hover:bg-amber-500/10 rounded-r-lg"
                                              title="Select Frequency"
                                            >
                                              <ChevronDown className="h-4 w-4 text-amber-500" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[180px] p-0 shadow-xl border-amber-500/20" align="end">
                                            <div className="max-h-60 overflow-auto p-1 bg-card rounded-lg">
                                              {COMMON_FREQUENCIES.map(freq => (
                                                <button
                                                  key={freq}
                                                  className="w-full text-left px-3 py-2 text-[13px] font-bold hover:bg-amber-500/10 text-foreground rounded-md transition-colors"
                                                  onClick={() => updateMedicine(i, 'frequency', freq)}
                                                >
                                                  {freq}
                                                </button>
                                              ))}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                    <div className="space-y-1 invisible">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">—</p>
                                      <Input disabled className="h-10 bg-muted" />
                                    </div>
                                  </>
                                )}

                              </div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => removeMedicine(i)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg h-10 w-10 mt-1 transition-colors self-end md:self-center">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">Advice</Label>
                      <Input 
                        value={advice} 
                        onChange={e => setAdvice(e.target.value)} 
                        placeholder="Drink plenty of water..." 
                        className="h-12 text-base font-bold bg-muted/50 border-border focus:bg-card focus:ring-blue-500 transition-all rounded-xl shadow-inner"
                      />
                    </div>
                  </div>
                )}

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
                  <Button 
                    onClick={savePrescription} 
                    disabled={saving} 
                    className={cn(
                      "h-11 shadow-lg transition-all",
                      saveError ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-primary hover:bg-primary/90"
                    )}
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                    ) : (
                      saveError ? (
                        <><RefreshCw className="w-4 h-4 mr-2" /> Retry Save</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Save & Complete</>
                      )
                    )}
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
        <DialogContent className="max-w-[900px] w-[95vw] p-0 overflow-hidden bg-background">
          <DialogHeader className="bg-muted/50 p-4 border-b relative">
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={() => printPrescription('#consultation-print-preview')} className="gap-2 z-10">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <DialogTitle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
                Prescription Preview
              </DialogTitle>
              <div className="w-20" /> {/* Spacer for symmetry with print button */}
            </div>
          </DialogHeader>
          <div className="p-4 md:p-8 overflow-auto max-h-[85vh] bg-muted min-h-[500px]" id="consultation-print-preview">
            <PrescriptionTemplate
              patient={patient}
              visit={selectedVisit}
              handwrittenImage={prescriptionImage}
              clinicalNotes={clinicalNotes}
              diagnosis={diagnosis}
              medicines={medicines.filter(m => m.name.trim())}
              advice={advice}
              isWritingMode={lastInputWay === 'writing'}
              isPrint={true}
              doctorId={user?.id}
              prescriptionCreatedAt={new Date().toISOString()}
            />
          </div>
        </DialogContent>
        </Dialog>

      {/* History Preview Dialog */}
      <Dialog open={!!viewingHistoryRx} onOpenChange={open => !open && setViewingHistoryRx(null)}>
        <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-background border-none shadow-2xl">
          <div className="bg-background/80 p-4 border-b flex items-center justify-between sticky top-0 z-[60] backdrop-blur-md pr-16">
            <div className="flex items-center gap-4">
              <Button size="sm" onClick={() => printPrescription('#history-print-preview')} className="gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
            </div>
            <h3 className="font-bold text-foreground">
              Prescription History
            </h3>
            {/* Built-in Shadcn Close button will appear here in the pr-12 space */}
          </div>
          <div className="p-4 md:p-8 overflow-y-auto max-h-[80vh] bg-muted/30 scrollbar-thin scrollbar-thumb-muted-foreground/20 min-h-[500px]" id="history-print-preview">
            {viewingHistoryRx && (() => {
              const rx = viewingHistoryRx.prescriptions?.[0];
              const isWritingMode = rx?.is_writing_mode ?? (!!rx?.advice_image && (rx.advice_image.startsWith('data:image') || rx.advice_image.startsWith('[')));
              return (
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden">
                  <PrescriptionTemplate
                    patient={patient}
                    visit={viewingHistoryRx}
                    handwrittenImage={rx?.advice_image}
                    clinicalNotes={rx?.clinical_notes}
                    diagnosis={rx?.diagnosis || viewingHistoryRx.diagnosis}
                    medicines={rx?.medicines || []}
                    advice={!isWritingMode ? rx?.advice_image : null}
                    isWritingMode={isWritingMode}
                    isPrint={true}
                    doctorId={rx?.doctor_id}
                    prescriptionCreatedAt={rx?.created_at}
                  />
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Vitals Edit Dialog */}
      <Dialog open={showVitalsEdit} onOpenChange={setShowVitalsEdit}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Clinical Vitals</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input 
                type="number" 
                step="0.1"
                min="0"
                max="300"
                value={selectedVisit?.weight || ''} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (val > 300) return;
                  setSelectedVisit({...selectedVisit, weight: e.target.value});
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>BP (mmHg)</Label>
              <Input 
                value={selectedVisit?.blood_pressure || ''} 
                onChange={e => {
                  const val = e.target.value;
                  // Basic validation: max length or pattern if needed
                  if (val.length > 7) return; 
                  setSelectedVisit({...selectedVisit, blood_pressure: val});
                }}
                placeholder="120/80"
              />
            </div>
            <div className="space-y-2">
              <Label>Pulse (bpm)</Label>
              <Input 
                type="number" 
                min="0"
                max="250"
                value={selectedVisit?.pulse_rate || ''} 
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 250) return;
                  setSelectedVisit({...selectedVisit, pulse_rate: e.target.value});
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>SpO2 (%)</Label>
              <Input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={selectedVisit?.spo2 || ''} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (val > 100) return;
                  setSelectedVisit({...selectedVisit, spo2: e.target.value});
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Temp (°F)</Label>
              <Input 
                type="number" 
                step="0.1"
                min="90"
                max="115"
                value={selectedVisit?.temperature || ''} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (val > 115) return;
                  setSelectedVisit({...selectedVisit, temperature: e.target.value});
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>CBG (mg/dL)</Label>
              <Input 
                type="number" 
                min="0"
                max="800"
                value={selectedVisit?.cbg || ''} 
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 800) return;
                  setSelectedVisit({...selectedVisit, cbg: e.target.value});
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowVitalsEdit(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                const { error } = await supabase.from('visits').update({
                  weight: selectedVisit.weight,
                  blood_pressure: selectedVisit.blood_pressure,
                  pulse_rate: selectedVisit.pulse_rate,
                  spo2: selectedVisit.spo2,
                  temperature: selectedVisit.temperature,
                  cbg: selectedVisit.cbg
                }).eq('id', selectedVisit.id);
                if (error) throw error;
                toast.success('Vitals updated');
                setShowVitalsEdit(false);
              } catch (e: any) {
                toast.error(e.message);
              }
            }}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}