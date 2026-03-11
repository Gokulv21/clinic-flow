import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UserPlus, Search, Loader2, CheckCircle } from 'lucide-react';

interface PatientForm {
  name: string;
  age: string;
  sex: string;
  phone: string;
  address: string;
}

interface VitalsForm {
  weight: string;
  blood_pressure: string;
  pulse_rate: string;
  spo2: string;
  temperature: string;
  cbg: string;
}

const initialPatient: PatientForm = { name: '', age: '', sex: '', phone: '', address: '' };
const initialVitals: VitalsForm = { weight: '', blood_pressure: '', pulse_rate: '', spo2: '', temperature: '', cbg: '' };

export default function NurseEntry() {
  const [tab, setTab] = useState('new');
  const [step, setStep] = useState<'patient' | 'vitals' | 'done'>('patient');
  const [patient, setPatient] = useState<PatientForm>(initialPatient);
  const [vitals, setVitals] = useState<VitalsForm>(initialVitals);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);

  const searchPatients = async () => {
    if (!searchQuery.trim()) return;
    const { data } = await supabase
      .from('patients')
      .select('*')
      .or(`phone.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const selectOldPatient = (p: any) => {
    setSelectedPatientId(p.id);
    setPatient({ name: p.name, age: String(p.age), sex: p.sex, phone: p.phone, address: p.address || '' });
    setStep('vitals');
  };

  const handleNewPatientNext = () => {
    if (!patient.name || !patient.age || !patient.sex || !patient.phone) {
      toast.error('Please fill all required fields');
      return;
    }
    setStep('vitals');
  };

  const submitVisit = async () => {
    setLoading(true);
    try {
      let patientId = selectedPatientId;

      if (!patientId) {
        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert({ name: patient.name, age: parseInt(patient.age), sex: patient.sex, phone: patient.phone, address: patient.address || null })
          .select()
          .single();
        if (error) throw error;
        patientId = newPatient.id;
      }

      // Get next token
      const { data: tokenData } = await supabase.rpc('get_next_token');
      const token = tokenData || 1;

      const { error: visitError } = await supabase.from('visits').insert({
        patient_id: patientId!,
        token_number: token,
        weight: vitals.weight ? parseFloat(vitals.weight) : null,
        blood_pressure: vitals.blood_pressure || null,
        pulse_rate: vitals.pulse_rate ? parseInt(vitals.pulse_rate) : null,
        spo2: vitals.spo2 ? parseFloat(vitals.spo2) : null,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
        cbg: vitals.cbg ? parseFloat(vitals.cbg) : null,
      });

      if (visitError) throw visitError;
      setTokenNumber(token);
      setStep('done');
      toast.success(`Patient added to queue — Token #${token}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPatient(initialPatient);
    setVitals(initialVitals);
    setStep('patient');
    setSelectedPatientId(null);
    setTokenNumber(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (step === 'done') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md text-center animate-fade-in">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
            <h2 className="text-2xl font-heading font-bold">Patient Queued!</h2>
            <div className="text-6xl font-heading font-bold text-primary">#{tokenNumber}</div>
            <p className="text-muted-foreground">{patient.name} has been added to the consultation queue</p>
            <Button onClick={reset} className="w-full mt-4">Add Another Patient</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Patient Registration</h1>
        <p className="text-muted-foreground">Register a patient and add them to the consultation queue</p>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); reset(); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new" className="gap-2"><UserPlus className="w-4 h-4" />New Patient</TabsTrigger>
          <TabsTrigger value="old" className="gap-2"><Search className="w-4 h-4" />Existing Patient</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          {step === 'patient' && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Patient Details</CardTitle>
                <CardDescription>Enter the new patient's information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Name *</Label>
                    <Input value={patient.name} onChange={e => setPatient(p => ({ ...p, name: e.target.value }))} placeholder="Patient name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Age *</Label>
                    <Input type="number" value={patient.age} onChange={e => setPatient(p => ({ ...p, age: e.target.value }))} placeholder="Age" />
                  </div>
                  <div className="space-y-2">
                    <Label>Sex *</Label>
                    <Select value={patient.sex} onValueChange={v => setPatient(p => ({ ...p, sex: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input value={patient.phone} onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={patient.address} onChange={e => setPatient(p => ({ ...p, address: e.target.value }))} placeholder="Address" />
                  </div>
                </div>
                <Button onClick={handleNewPatientNext} className="w-full">Next — Enter Vitals</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="old">
          {step === 'patient' && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Search Patient</CardTitle>
                <CardDescription>Search by name or phone number</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name or phone..." onKeyDown={e => e.key === 'Enter' && searchPatients()} />
                  <Button onClick={searchPatients} variant="secondary">Search</Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectOldPatient(p)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-secondary transition-colors"
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-muted-foreground">{p.phone} · {p.age}y · {p.sex}</div>
                    </button>
                  ))}
                  {searchResults.length === 0 && searchQuery && (
                    <p className="text-center text-muted-foreground py-4">No patients found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {step === 'vitals' && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Vitals — {patient.name}</CardTitle>
            <CardDescription>Record the patient's vital signs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.1" value={vitals.weight} onChange={e => setVitals(v => ({ ...v, weight: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure</Label>
                <Input value={vitals.blood_pressure} onChange={e => setVitals(v => ({ ...v, blood_pressure: e.target.value }))} placeholder="120/80" />
              </div>
              <div className="space-y-2">
                <Label>Pulse Rate (bpm)</Label>
                <Input type="number" value={vitals.pulse_rate} onChange={e => setVitals(v => ({ ...v, pulse_rate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>SpO2 (%)</Label>
                <Input type="number" step="0.1" value={vitals.spo2} onChange={e => setVitals(v => ({ ...v, spo2: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Temperature (°F)</Label>
                <Input type="number" step="0.1" value={vitals.temperature} onChange={e => setVitals(v => ({ ...v, temperature: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CBG (mg/dL)</Label>
                <Input type="number" value={vitals.cbg} onChange={e => setVitals(v => ({ ...v, cbg: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('patient')} className="flex-1">Back</Button>
              <Button onClick={submitVisit} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit & Queue Patient
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}