import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import PageBanner from "@/components/PageBanner";
import patientEntryBanner from "@/assets/patient_entry_banner.png";
import { formatAge } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, UserPlus, History, CheckCircle, ArrowRight, User, Phone, MapPin, X, AlertCircle, ChevronDown, Loader2 } from 'lucide-react';

interface PatientForm {
  title: string;
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

const initialPatient: PatientForm = { title: '', name: '', age: '', sex: '', phone: '', address: '' };
const initialVitals: VitalsForm = { weight: '', blood_pressure: '', pulse_rate: '', spo2: '', temperature: '', cbg: '' };

export default function NurseEntry() {
  const [tab, setTab] = useState('new');
  const [step, setStep] = useState<'patient' | 'confirm' | 'vitals' | 'done'>('patient');
  const [patient, setPatient] = useState<PatientForm>(initialPatient);
  const [vitals, setVitals] = useState<VitalsForm>(initialVitals);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientFull, setSelectedPatientFull] = useState<any>(null); // To show full details in confirmation
  const [ageUnit, setAgeUnit] = useState<'years' | 'months' | 'days'>('years');
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPatients = async (query: string = searchQuery) => {
    if (!query.trim()) {
        setSearchResults([]);
        return;
    }
    const { data } = await supabase
      .from('patients')
      .select('*')
      .or(`phone.ilike.%${query}%,name.ilike.%${query}%,registration_id.ilike.%${query}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const selectOldPatient = (p: any) => {
    setSelectedPatientId(p.id);
    setSelectedPatientFull(p);
    setPatient({
      title: p.title || '',
      name: p.name,
      age: String(p.age),
      sex: p.sex,
      phone: p.phone,
      address: p.address || ''
    });
    setStep('confirm'); // Move to confirmation step first
  };

  const handleNewPatientNext = () => {
    if (!patient.name || !patient.age || !patient.sex || !patient.phone || !patient.title) {
      toast.error('Please fill all required fields');
      return;
    }
    setStep('vitals');
  };

  const getNextRegId = async () => {
    const { data, error } = await (supabase.rpc as any)('get_next_registration_id');
    if (error) {
        console.error('Error generating Reg ID, falling back:', error);
        // Fallback to random if RPC fails
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const yy = new Date().getFullYear().toString().slice(-2);
        return `${yy}${timestamp}${random}`;
    }
    return data;
  };

  const submitVisit = async () => {
    setLoading(true);
    const loadingToast = toast.loading('Registering patient...');
    try {
      let patientId = selectedPatientId;
      let finalRegId = '';

      if (!patientId) {
        let ageInYearsRaw = parseFloat(patient.age);
        if (ageUnit === 'months') ageInYearsRaw = ageInYearsRaw / 12;
        if (ageUnit === 'days') ageInYearsRaw = ageInYearsRaw / 365;

        const ageInYears = ageInYearsRaw >= 1 ? Math.floor(ageInYearsRaw) : ageInYearsRaw;
        
        finalRegId = await getNextRegId();

        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert({
            title: patient.title,
            name: patient.name,
            age: ageInYears,
            sex: patient.sex,
            phone: patient.phone,
            address: patient.address || null,
            registration_id: String(finalRegId),
            last_opened_at: new Date().toISOString()
          })
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
      toast.dismiss(loadingToast);
      toast.success(`Patient added to queue — Token #${token}`);
    } catch (err: any) {
      toast.dismiss();
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
    setSelectedPatientFull(null);
    setTokenNumber(null);
    setSearchQuery('');
    setSearchResults([]);
    setAgeUnit('years');
    setTab('new'); // Keep for internal logic if needed
  };

  const autoSetTitle = (age: string, sex: string, unit: 'years' | 'months' | 'days') => {
    if (!age || !sex) return;
    let ageVal = parseFloat(age);
    if (unit === 'months') ageVal = ageVal / 12;
    if (unit === 'days') ageVal = ageVal / 365;

    if (ageVal < 2) {
      setPatient(p => ({ ...p, title: 'Baby.' }));
    } else if (sex === 'Male') {
      const suggested = ageVal < 12 ? 'Mast.' : 'Mr.';
      setPatient(p => ({ ...p, title: suggested }));
    } else if (sex === 'Female') {
      setPatient(p => ({ ...p, title: 'Miss.' }));
    }
  };

  if (step === 'done') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md text-center animate-fade-in shadow-2xl border-primary/20 bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-10 pb-10 space-y-6">
            <div className="relative inline-block">
                <CheckCircle className="w-20 h-20 text-success mx-auto drop-shadow-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full animate-ping opacity-20" />
            </div>
            
            <div className="space-y-2">
                <h2 className="text-3xl font-heading font-bold text-slate-800">Registration Successful!</h2>
                <p className="text-muted-foreground font-medium">{patient.title} {patient.name} </p>
            </div>

            <div className="py-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Queue Ticket</div>
                <div className="text-7xl font-heading font-bold text-primary drop-shadow-sm">#{tokenNumber}</div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
                <Button onClick={reset} className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] transition-transform">
                    Next Patient
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="Patient Registration"
        description="Search for existing patients or register new ones with vitals and history."
        imageSrc={patientEntryBanner}
      />

      <div className="px-4 md:px-8 max-w-5xl mx-auto">
        {step === 'confirm' && selectedPatientFull && (
            <div className="max-w-2xl mx-auto space-y-6">
                <Card className="animate-in slide-in-from-bottom-5 duration-500 overflow-hidden shadow-2xl border-primary/20">
                    <CardHeader className="bg-primary/5 py-8 border-b border-primary/10">
                        <div className="text-center space-y-2">
                            <CardDescription className="text-primary font-bold uppercase tracking-widest text-xs">Verify Patient Information</CardDescription>
                            <CardTitle className="text-3xl font-heading font-black text-slate-800">Is this the correct patient?</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-10 pb-10 space-y-8 px-6 md:px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 md:gap-y-8">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</Label>
                                <div className="text-xl font-bold text-slate-800">{selectedPatientFull.title} {selectedPatientFull.name}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registration ID</Label>
                                <div className="text-xl font-mono font-bold text-primary">{selectedPatientFull.registration_id || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Age / Gender</Label>
                                <div className="text-xl font-bold text-slate-800">{formatAge(selectedPatientFull.age)} / {selectedPatientFull.sex}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</Label>
                                <div className="text-xl font-bold text-slate-800">{selectedPatientFull.phone || '—'}</div>
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Address</Label>
                                <div className="text-lg md:text-xl font-medium text-slate-600 leading-relaxed italic bg-slate-50 p-4 md:p-6 rounded-xl border border-dashed border-slate-200">
                                    "{selectedPatientFull.address || 'No address on record'}"
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex flex-col md:flex-row gap-4">
                            <Button variant="ghost" className="order-2 md:order-1 flex-1 h-14 text-slate-500 font-bold text-lg hover:bg-slate-100" onClick={() => setStep('patient')}>
                                <X className="w-5 h-5 mr-2" /> No, Search Again
                            </Button>
                            <Button className="order-1 md:order-2 flex-[2] h-14 text-lg font-black shadow-xl shadow-primary/30" onClick={() => setStep('vitals')}>
                                <CheckCircle className="w-6 h-6 mr-2" /> Yes, Proceed to Vitals
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {step === 'patient' && (
            <div className="space-y-8">
                {/* Search Header Interface */}
                <div className="relative group" ref={searchContainerRef}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-sky-400/20 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <Card className="relative border-primary/10 shadow-xl overflow-visible">
                        <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        className="h-14 pl-12 text-lg border-slate-200 focus:border-primary focus:ring-primary/20 transition-all rounded-xl shadow-sm"
                                        placeholder="Search by Name, Phone, or Reg ID..."
                                        value={searchQuery}
                                        onFocus={() => setShowSearch(true)}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            searchPatients(e.target.value);
                                            setShowSearch(true);
                                        }}
                                    />
                                    {showSearch && searchQuery && (
                                        <div className="absolute z-50 top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-2 space-y-1">
                                                {searchResults.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => selectOldPatient(p)}
                                                        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-all text-left rounded-xl group/item"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="font-heading font-bold text-slate-800 flex items-center gap-2">
                                                                {p.title} {p.name}
                                                                {p.registration_id && (
                                                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-black">
                                                                        {p.registration_id}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                                                <span>{p.phone || 'No Phone'}</span>
                                                                <span>·</span>
                                                                <span>{formatAge(p.age)}</span>
                                                                <span>·</span>
                                                                <span>{p.sex}</span>
                                                            </div>
                                                            {p.address && (
                                                                <div className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" /> {p.address}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right hidden md:flex flex-col items-end">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Reg ID</div>
                                                            <div className="text-sm font-mono font-bold text-primary/80">{p.registration_id || 'N/A'}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                                {searchResults.length === 0 && (
                                                    <div className="p-8 text-center space-y-3">
                                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                                            <Search className="w-6 h-6 text-slate-300" />
                                                        </div>
                                                        <p className="text-sm text-slate-500 font-medium">No patients found for "{searchQuery}"</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-slate-50/50 p-3 border-t border-slate-100 flex justify-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="text-xs font-bold text-primary gap-2"
                                                    onClick={() => {
                                                        setPatient(prev => ({ ...prev, name: searchQuery, phone: /^\d+$/.test(searchQuery) ? searchQuery : '' }));
                                                        setSearchResults([]);
                                                        setSearchQuery('');
                                                    }}
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" /> Register This as New Patient
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="h-6 w-px bg-slate-100 hidden md:block" />
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Button 
                                        onClick={() => { reset(); setSearchQuery(''); }}
                                        variant="outline" 
                                        className="h-14 rounded-xl px-6 border-slate-200 font-bold text-slate-600 flex-1 hover:bg-slate-50"
                                    >
                                        Clear
                                    </Button>
                                    <Button 
                                        variant="default" 
                                        className="h-14 rounded-xl px-8 font-bold shadow-lg shadow-primary/20 flex-1 hover:scale-[1.02] transition-transform"
                                        onClick={() => {
                                            setSearchResults([]);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <UserPlus className="w-5 h-5 mr-2" /> New Patient
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Registration Form */}
                <Card className="border-slate-100 shadow-lg animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-heading font-bold text-slate-800">Patient Details</CardTitle>
                                <CardDescription className="font-medium">Complete information for the new registration</CardDescription>
                            </div>
                            <div className="hidden sm:block">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-right">System ID</div>
                                <div className="text-xs font-mono font-bold bg-white py-1 px-3 rounded-lg border border-slate-200 text-slate-400">
                                    PENDING GENERATION
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Patient Identity
                                    </Label>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="col-span-1">
                                            <Select value={patient.title} onValueChange={v => setPatient(p => ({ ...p, title: v }))}>
                                                <SelectTrigger className="h-12 rounded-xl focus:ring-primary/10 border-slate-200"><SelectValue placeholder="Ti" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Mr.">Mr.</SelectItem>
                                                    <SelectItem value="Mast.">Mast.</SelectItem>
                                                    <SelectItem value="Miss">Miss</SelectItem>
                                                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                                                    <SelectItem value="Baby">Baby</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-3">
                                            <Input 
                                                className="h-12 rounded-xl focus:ring-primary/10 border-slate-200 placeholder:text-slate-300 font-medium" 
                                                value={patient.name} 
                                                onChange={e => setPatient(p => ({ ...p, name: e.target.value }))} 
                                                placeholder="Full Name" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Medical Profile
                                    </Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={patient.age}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        if (val > 1000) return;
                                                        setPatient(p => ({ ...p, age: e.target.value }));
                                                        autoSetTitle(e.target.value, patient.sex, ageUnit);
                                                    }}
                                                    placeholder="Age"
                                                    className="h-12 rounded-xl focus:ring-primary/10 border-slate-200 font-medium flex-1"
                                                />
                                                <Select value={ageUnit} onValueChange={(v: any) => {
                                                    setAgeUnit(v);
                                                    autoSetTitle(patient.age, patient.sex, v);
                                                }}>
                                                    <SelectTrigger className="h-12 w-[85px] rounded-xl focus:ring-primary/10 border-slate-200"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="years">Yrs</SelectItem>
                                                        <SelectItem value="months">Mo</SelectItem>
                                                        <SelectItem value="days">Day</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Select
                                            value={patient.sex}
                                            onValueChange={v => {
                                                setPatient(p => ({ ...p, sex: v }));
                                                autoSetTitle(patient.age, v, ageUnit);
                                            }}
                                        >
                                            <SelectTrigger className="h-12 rounded-xl focus:ring-primary/10 border-slate-200 font-medium">
                                                <SelectValue placeholder="Gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Contact Information
                                    </Label>
                                    <Input
                                        className="h-12 rounded-xl focus:ring-primary/10 border-slate-200 font-medium placeholder:text-slate-300"
                                        value={patient.phone}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setPatient(p => ({ ...p, phone: val }));
                                        }}
                                        placeholder="Phone Number (10 digits)"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Location
                                    </Label>
                                    <Input 
                                        className="h-12 rounded-xl focus:ring-primary/10 border-slate-200 font-medium placeholder:text-slate-300" 
                                        value={patient.address} 
                                        onChange={e => setPatient(p => ({ ...p, address: e.target.value }))} 
                                        placeholder="Full Address" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 -mx-6 px-6 bg-slate-50/30 flex justify-center md:justify-end pb-8">
                            <Button onClick={handleNewPatientNext} size="lg" className="w-full md:w-auto h-14 px-10 rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:translate-y-[-2px] hover:shadow-primary/30 active:translate-y-[0px] transition-all">
                                Continue — Record Vitals <ChevronDown className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {step === 'vitals' && (
          <Card className="animate-fade-in shadow-2xl border-primary/20 max-w-4xl mx-auto overflow-hidden">
            <CardHeader className="bg-primary/5 py-8 border-b border-primary/10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardDescription className="text-primary font-bold uppercase tracking-widest text-[10px]">Vitals Pre-Consultation</CardDescription>
                        <CardTitle className="text-2xl font-heading font-black text-slate-800">Recording Vitals: {patient.title} {patient.name}</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-10 space-y-10 pb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">Weight <span className="text-slate-300">(kg)</span></Label>
                  <Input
                    className="h-14 rounded-2xl text-xl font-bold border-slate-200 focus:ring-primary/10"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    value={vitals.weight}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 300) return;
                        setVitals(v => ({ ...v, weight: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">Blood Pressure <span className="text-slate-300">(mmHg)</span></Label>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Sys"
                      inputMode="numeric"
                      value={vitals.blood_pressure.split('/')[0] || ''}
                      onChange={e => {
                        const sbp = e.target.value.replace(/\D/g, '').slice(0, 3);
                        if (parseInt(sbp) > 300) return;
                        const dbp = vitals.blood_pressure.split('/')[1] || '';
                        setVitals(v => ({ ...v, blood_pressure: `${sbp}/${dbp}`.replace(/^\/|\/$/g, '') }));
                        if (sbp.length >= 3) {
                          document.getElementById('dbp-input')?.focus();
                        }
                      }}
                      className="h-14 rounded-2xl text-xl font-bold text-center border-slate-200 focus:ring-primary/10"
                    />
                    <span className="text-primary font-black text-2xl">/</span>
                    <Input
                      id="dbp-input"
                      placeholder="Dia"
                      inputMode="numeric"
                      value={vitals.blood_pressure.split('/')[1] || ''}
                      onChange={e => {
                        const sbp = vitals.blood_pressure.split('/')[0] || '';
                        const dbp = e.target.value.replace(/\D/g, '').slice(0, 3);
                        if (parseInt(dbp) > 300) return;
                        setVitals(v => ({ ...v, blood_pressure: `${sbp}/${dbp}`.replace(/^\/|\/$/g, '') }));
                        if (dbp.length >= 3) {
                          document.getElementById('pulse-input')?.focus();
                        }
                      }}
                      className="h-14 rounded-2xl text-xl font-bold text-center border-slate-200 focus:ring-primary/10"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">Pulse Rate <span className="text-slate-300">(bpm)</span></Label>
                  <Input
                    id="pulse-input"
                    className="h-14 rounded-2xl text-xl font-bold border-slate-200 focus:ring-primary/10"
                    type="number"
                    min="0"
                    max="250"
                    value={vitals.pulse_rate}
                    onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val > 250) return;
                        setVitals(v => ({ ...v, pulse_rate: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">SpO2 <span className="text-slate-300">(%)</span></Label>
                  <Input
                    className="h-14 rounded-2xl text-xl font-bold border-slate-200 focus:ring-primary/10"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vitals.spo2}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 100) return;
                        setVitals(v => ({ ...v, spo2: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">Temperature <span className="text-slate-300">(°F)</span></Label>
                  <Input
                    className="h-14 rounded-2xl text-xl font-bold border-slate-200 focus:ring-primary/10"
                    type="number"
                    step="0.1"
                    min="90"
                    max="110"
                    value={vitals.temperature}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 110) return;
                        setVitals(v => ({ ...v, temperature: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">CBG <span className="text-slate-300">(mg/dL)</span></Label>
                  <Input
                    className="h-14 rounded-2xl text-xl font-bold border-slate-200 focus:ring-primary/10"
                    type="number"
                    min="0"
                    max="600"
                    value={vitals.cbg}
                    onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val > 600) return;
                        setVitals(v => ({ ...v, cbg: e.target.value }));
                    }}
                  />
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 pt-4">
                <Button variant="outline" size="lg" onClick={() => setStep('patient')} className="order-2 md:order-1 flex-1 h-14 rounded-2xl font-bold text-slate-400 group border-slate-200">
                    <ChevronDown className="w-5 h-5 mr-2 rotate-90 group-hover:-translate-x-1 transition-transform" /> Go Back
                </Button>
                <Button onClick={submitVisit} disabled={loading} size="lg" className="order-1 md:order-2 flex-[2] h-14 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mr-3 font-bold" /> : <CheckCircle className="w-6 h-6 mr-3" />}
                  Submit & Queue Patient
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}