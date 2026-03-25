import React, { useRef, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { formatAge } from '@/lib/utils';
import prescriptionLogo from '@/assets/prescriptionLogo.png';

const EXPORT_W = 1240;
const EXPORT_H = 1754;

interface VitalSign {
    label: string;
    value: any;
    unit: string;
}

interface PrescriptionTemplateProps {
    patient?: any;
    visit?: any;
    handwrittenImage?: string | string[] | null;
    diagnosis?: string;
    clinicalNotes?: string;
    medicines?: any[];
    advice?: string;
    isPrint?: boolean;
    isWritingMode?: boolean;
    // Audit data
    doctorId?: string;
    prescriptionCreatedAt?: string;
    // Overrides for doctor/clinic info
    doctorName?: string;
    doctorQualifications?: string;
    doctorRegId?: string;
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
}

// Filter out invalid image data to prevent broken image icons
const isValidImage = (src: any): src is string =>
    typeof src === 'string' && src.length > 5 && (src.startsWith('data:image') || src.startsWith('http'));

const PrescriptionTemplate = React.memo(({
    patient, visit, handwrittenImage,
    diagnosis, clinicalNotes, medicines = [], advice, isPrint = false,
    isWritingMode = false,
    doctorId, prescriptionCreatedAt,
    doctorName, doctorQualifications, doctorRegId,
    clinicName, clinicAddress, clinicPhone
}: PrescriptionTemplateProps) => {

    const { user: authUser } = useAuth();
    const [doctorProfile, setDoctorProfile] = useState<any>(null);

    useEffect(() => {
        const fetchDoctorProfile = async () => {
            // Priority 1: Use the specific doctor_id if provided (Saved Rx)
            // Priority 2: Use current user ID ONLY if this is a fresh preview (unsaved draft)
            let targetId = doctorId;
            const isSavedRecord = !!prescriptionCreatedAt;
            
            if (!targetId && !isSavedRecord) {
                targetId = authUser?.id;
            }

            if (targetId) {
                try {
                    // Fetch the specific profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', targetId)
                        .maybeSingle();
                    
                    if (profile) {
                        // For a reliable header, verify this user is actually a doctor
                        const { data: roleCheck } = await supabase
                            .from('user_roles')
                            .select('role')
                            .eq('user_id', targetId)
                            .eq('role', 'doctor')
                            .maybeSingle();

                        if (roleCheck || doctorId) {
                            setDoctorProfile(profile);
                            return;
                        }
                    }
                } catch (err) {
                    console.error("Error fetching specific doctor profile:", err);
                }
            }

            // Fallback: Fetch the primary/first doctor for historical records with no ID
            try {
                const { data: doctorRoles } = await supabase
                    .from('user_roles')
                    .select('user_id')
                    .eq('role', 'doctor')
                    .order('created_at', { ascending: true });
                
                if (doctorRoles && doctorRoles.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('*')
                        .in('user_id', doctorRoles.map(r => r.user_id));
                    
                    if (profiles && profiles.length > 0) {
                        const primary = profiles.find(p => p.full_name?.toLowerCase().includes('aravind'));
                        setDoctorProfile(primary || profiles[0]);
                    }
                }
            } catch (err) {
                console.error("Error fetching fallback doctor profile:", err);
            }
        };
        fetchDoctorProfile();
    }, [authUser, doctorId, prescriptionCreatedAt]); 


    const displayDate = prescriptionCreatedAt ? new Date(prescriptionCreatedAt) : (visit?.created_at ? new Date(visit.created_at) : new Date());
    const today = displayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = displayDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const shareToWhatsApp = () => {
        const patientName = patient?.name || 'Patient';
        const clinic = clinicName || doctorProfile?.clinic_name || 'GV Clinic';
        const patientPhone = patient?.phone || '';
        
        // Format phone number: remove non-digits
        let cleanPhone = patientPhone.replace(/\D/g, '');
        // If it's a 10-digit number, assume India (+91)
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }

        const publicLink = `${window.location.protocol}//${window.location.host}/prescripto/rx/${visit?.id}`;
        
        let message = `*${clinic} Prescription*\n\n`;
        message += `*Date:* ${today} ${time}\n`;
        message += `*Patient:* ${patientName}\n`;
        message += `*Token:* ${visit?.token_number || '—'}\n\n`;

        if (diagnosis) message += `*Diagnosis:* ${diagnosis}\n`;
        
        if (medicines && medicines.length > 0 && medicines.some(m => m.name.trim())) {
            message += `\n*Medicines:*\n`;
            medicines.forEach((m, i) => {
                if (m.name.trim()) {
                    message += `${i + 1}. ${m.type || ''} ${m.name} ${m.dosage || ''} (${m.frequency || ''}) - ${m.duration || ''}\n`;
                }
            });
        }

        if (advice && !isWritingMode) {
            message += `\n*Advice:* ${advice}\n`;
        } else if (isWritingMode) {
            message += `\n_Note: This prescription includes handwritten instructions._\n`;
        }

        message += `\n*View Digital Prescription:* ${publicLink}\n`;
        message += `\n_Sent via ${clinic}_`;

        const url = `https://wa.me/${cleanPhone}/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const vitals = [
        { label: 'Weight', value: visit?.weight, unit: ' kg' },
        { label: 'BP', value: visit?.blood_pressure, unit: ' mmHg' },
        { label: 'Pulse', value: visit?.pulse_rate, unit: ' /min' },
        { label: 'SpO₂', value: visit?.spo2, unit: ' %' },
        { label: 'Temp', value: visit?.temperature, unit: ' °F' },
        { label: 'CBG', value: visit?.cbg, unit: ' mg/dL' },
    ];

    const hasTyped = !!(diagnosis || clinicalNotes || (medicines && medicines.length > 0) || advice);
    const showTyped = hasTyped; // Show typed content regardless of writing mode if it exists

    // Multi-page parsing logic
    let rawImages: (string | null)[] = [];
    if (Array.isArray(handwrittenImage)) {
        rawImages = handwrittenImage;
    } else if (typeof handwrittenImage === 'string' && handwrittenImage.startsWith('[')) {
        try {
            rawImages = JSON.parse(handwrittenImage);
        } catch (e) {
            rawImages = [handwrittenImage];
        }
    } else {
        rawImages = [handwrittenImage as string | null];
    }

    const images = rawImages.filter(isValidImage);
    const showHandwritten = isWritingMode && images.length > 0;

    // If no handwriting or not in writing mode, we still need one "page" for typed content
    const pagesToShow = showHandwritten ? images : [null];

    return (
        <div className="flex flex-col items-center gap-8 w-full print-container print:gap-0">
            {pagesToShow.map((img, idx) => (
                <div
                    key={idx}
                    id={idx === 0 ? "prescription-template" : undefined}
                    className="single-page-prescription"
                    style={{
                        width: isPrint ? '210mm' : '100%',
                        maxWidth: isPrint ? undefined : '800px',
                        height: isPrint ? '296mm' : undefined,
                        minHeight: isPrint ? undefined : '500px',
                        margin: '0 auto',
                        aspectRatio: isPrint ? undefined : '1 / 1.414',
                        containerType: 'inline-size' as any,
                        position: 'relative',
                        overflow: isPrint ? 'hidden' : 'visible',
                        background: '#ffffff',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        boxShadow: isPrint ? 'none' : '0 10px 40px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                        pageBreakAfter: (isPrint && idx < pagesToShow.length - 1) ? 'always' : undefined,
                    }}
                >
                    {idx === 0 ? (
                        <PageOne
                            patient={patient}
                            visit={visit}
                            today={today}
                            time={time}
                            clinicalNotes={clinicalNotes}
                            diagnosis={diagnosis}
                            medicines={medicines}
                            advice={advice}
                            hasTyped={showTyped}
                            vitals={vitals}
                            doctorProfile={doctorProfile}
                            isWritingMode={isWritingMode}
                            // Props overrides
                            doctorName={doctorName}
                            doctorQualifications={doctorQualifications}
                            doctorRegId={doctorRegId}
                            clinicName={clinicName}
                            clinicAddress={clinicAddress}
                            clinicPhone={clinicPhone}
                        />
                    ) : (
                        <div style={{ position: 'absolute', inset: 0, background: '#fff' }}>
                            <div style={{
                                position: 'absolute', top: '2em', right: '3em',
                                color: '#b0cde8', fontSize: '1.4cqw', fontWeight: 800
                            }}>
                                GV Clinic — Continuation Page {idx + 1}
                            </div>
                        </div>
                    )}

                    {showHandwritten && isValidImage(img) && (
                        <img
                            src={img}
                            alt=""
                            draggable={false}
                            style={{
                                position: 'absolute', top: 0, left: 0,
                                width: '100%', height: '100%',
                                objectFit: 'contain', // Change back to contain for better quality
                                zIndex: 100, // Ensure it's on top of everything
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                </div>
            ))}

            {/* WhatsApp Share Button - Screen Only */}
            {!isPrint && (
                <div className="mt-4 mb-8 print:hidden">
                    <button
                        onClick={shareToWhatsApp}
                        className="flex items-center gap-2 px-8 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-black uppercase tracking-widest text-[10px] rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Share to WhatsApp
                    </button>
                </div>
            )}
        </div>
    );
});

interface PageOneProps {
    patient: any;
    visit: any;
    today: string;
    time: string;
    clinicalNotes?: string;
    diagnosis?: string;
    medicines: any[];
    advice?: string;
    hasTyped: boolean;
    doctorProfile: any;
    vitals: { label: string; value: any; unit: string }[];
    isWritingMode: boolean;
    // Overrides
    doctorName?: string;
    doctorQualifications?: string;
    doctorRegId?: string;
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
}

function PageOne({ 
    patient, visit, today, time, clinicalNotes, diagnosis, medicines, advice, 
    hasTyped, vitals, doctorProfile, isWritingMode,
    doctorName, doctorQualifications, doctorRegId,
    clinicName, clinicAddress, clinicPhone
}: PageOneProps) {
    
    // Resolve display values with priority: Prop Override > Fetched Profile > Hardcoded Default
    const dispDoctorName = doctorName || doctorProfile?.full_name || 'Dr V Aravind';
    const dispQualifications = doctorQualifications || doctorProfile?.qualifications || 'MBBS., CCEBDM., (PHFI)';
    const dispRegId = doctorRegId || doctorProfile?.registration_id || '152590';
    const dispClinicName = clinicName || doctorProfile?.clinic_name || 'GV Clinic';
    const dispClinicAddress = clinicAddress || doctorProfile?.clinic_address || '742, SSR Complex, Saththanur – 606 706';
    const dispClinicPhone = clinicPhone || doctorProfile?.clinic_phone || '+91-9488017536';

    return (
        <div
            id="rx-inner"
            style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: '1.8cqw', // Further increased base font size
                color: '#0f172a',
                overflow: 'visible',
            }}
        >
            <div className="margin-line margin-line-left" />
            <div className="margin-line margin-line-right" />

            {/* ── HEADER ─────────────────────────────────────── */}
            <div style={{
                background: '#fff',
                padding: '1.4em 2em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative', overflow: 'hidden', flexShrink: 0,
                borderBottom: '1px solid #e2e8f0',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6em' }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <img
                            src={prescriptionLogo}
                            alt="Clinic Logo"
                            style={{
                                height: '5.2em', // Precisely tuned to match text block height
                                width: 'auto',
                                objectFit: 'contain',
                                flexShrink: 0,
                                display: 'block',
                                // This filter approximates #0f172a (Slate 900) for a black logo
                                filter: 'brightness(0) saturate(100%) invert(8%) sepia(21%) saturate(2853%) hue-rotate(191deg) brightness(91%) contrast(94%)'
                            }}
                        />
                    </div>

                    <div>
                        <div style={{ fontWeight: 800, color: '#334155', fontSize: '2em', lineHeight: 1, letterSpacing: '0.01em' }}>
                            {dispDoctorName}
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.9em', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.3em' }}>
                            {dispQualifications}
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.85em', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {dispRegId ? `Reg. No: ${dispRegId}` : 'Reg. No: 152590'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.8em', fontWeight: 600, marginTop: '0.1em' }}>
                            பொதுநலம் மற்றும் சர்க்கரை நோய் நிபுணர்
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: '#7d326cff', fontSize: '3.2em', letterSpacing: '0.04em', lineHeight: 1 }}>
                        {dispClinicName}
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.8em', marginTop: '0.4em', letterSpacing: '0.2em', fontWeight: 800 }}>
                        24/7 Emergency · ECG · Lab
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75em', marginTop: '0.2em', letterSpacing: '0.02em', fontWeight: 500 }}>
                        {dispClinicAddress}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75em', marginTop: '0.2em', letterSpacing: '0.02em', fontWeight: 500, textAlign: 'right' }}>
                        {dispClinicPhone}
                    </div>
                </div>
            </div>

            <div style={{ height: '2px', flexShrink: 0, backgroundColor: '#0f172a' }} />

            {/* ── PATIENT BAR ─────────────────────────────────── */}
            <div style={{
                background: '#fff',
                borderBottom: '2px solid #e2e8f0',
                display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 0.8fr 0.8fr',
                padding: '0.8em 2em', gap: '1.2em', flexShrink: 0,
            }}>
                {[
                    { label: 'Patient Name', value: (patient?.title ? patient.title + ' ' : '') + (patient?.name ?? '—'), color: '#0f172a' },
                    { label: 'Age / Sex', value: patient ? `${formatAge(patient.age)}/${patient.sex?.charAt(0) ?? '—'}` : '—' },
                    { label: 'Date', value: today },
                    { label: 'Time', value: time },
                    { label: 'Reg. ID', value: patient?.registration_id || (patient?.reg_no ? `REG-${patient.reg_no}` : '—') },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ overflow: 'hidden', minWidth: 0 }}>
                        <div style={{ fontSize: '0.75em', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                        <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || '#0f172a', marginTop: '0.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── BODY (Rx left + Vitals right) ───────────────── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* LEFT — Rx writing area */}
                <div style={{ flex: 1, position: 'relative', borderRight: '2px solid #e2e8f0', padding: '1.2em 1.5em', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
                    <div style={{ height: '5em', flexShrink: 0 }} />
                    {hasTyped && (
                        <div style={{ lineHeight: 1.6, fontSize: '1.1em', overflow: 'hidden', zIndex: 30, position: 'relative' }}>
                            {clinicalNotes && (
                                <div style={{ marginBottom: '1.2em', color: '#334155' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8em', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.4em' }}>Clinical Notes & History:</div>
                                    <div style={{ whiteSpace: 'pre-wrap', fontWeight: 500, borderLeft: '3px solid #e2e8f0', paddingLeft: '0.8em', fontStyle: 'italic' }}>{clinicalNotes}</div>
                                </div>
                            )}
                            {diagnosis && <div style={{ fontWeight: 800, fontSize: '1.2em', marginBottom: '0.6em', color: '#1e293b' }}>Dx: {diagnosis}</div>}
                            {medicines.map((m, i) => (
                                <div key={i} style={{ marginBottom: '0.8em', paddingLeft: '1em', borderLeft: '3px solid #3b82f6', fontSize: '1.05em' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4em' }}>
                                        <strong style={{ fontWeight: 800, color: '#0f172a' }}>{i + 1}. {m.type} {m.name}</strong>
                                        {m.dosage && <span style={{ fontWeight: 600, color: '#334155' }}>{m.dosage}</span>}
                                        {m.count && <span style={{ fontWeight: 600, color: '#334155' }}>({m.count})</span>}
                                        {m.route && <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.9em', textTransform: 'uppercase' }}>[{m.route}]</span>}
                                        {m.frequency && <span style={{ fontWeight: 700, color: '#0f172a' }}>{m.frequency}</span>}
                                        {m.duration && <span style={{ fontWeight: 600, color: '#475569' }}>for {m.duration}</span>}
                                    </div>
                                    {m.notes && (
                                        <div style={{ fontSize: '0.85em', fontWeight: 600, color: '#64748b', marginTop: '0.1em', fontStyle: 'italic' }}>
                                            Remarks: {m.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {advice && !isValidImage(advice) && <div style={{ marginTop: '1em', fontStyle: 'italic', color: '#475569', fontSize: '1em', fontWeight: 500 }}>Advice: {advice}</div>}
                        </div>
                    )}
                    {/* Watermark */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%) rotate(-45deg)',
                        fontSize: '10cqw', fontWeight: 900, color: '#f8fafc',
                        pointerEvents: 'none', zIndex: 5,
                        whiteSpace: 'nowrap', textTransform: 'uppercase',
                        letterSpacing: '0.2em'
                    }}>
                        GV CLINIC
                    </div>

                    {/* Writing Grid */}
                    <div className="no-print" style={{ position: 'absolute', top: '5em', left: '1.5em', right: '1.5em', bottom: 0, backgroundImage: 'radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)', backgroundSize: '1.8em 1.8em', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />
                </div>

                {/* RIGHT — Vitals sidebar (Compact/Opulent) */}
                <div style={{ width: '24%', flexShrink: 0, backgroundColor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#0f172a', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85em', textAlign: 'center', padding: '1em 0', borderBottom: '2px solid #0f172a', flexShrink: 0 }}>Clinical Vitals</div>
                    {vitals.map(({ label, value, unit }, i) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'stretch', height: '3.2em', flexShrink: 0, borderBottom: `1px solid #f1f5f9` }}>
                            <div style={{ width: '50%', padding: '0 1em', fontWeight: 700, color: '#64748b', fontSize: '0.8em', borderRight: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>{label}</div>
                            <div style={{ flex: 1, padding: '0 0.8em', fontSize: '1.05em', fontWeight: 800, color: value != null && value !== '' ? '#0f172a' : '#cbd5e1', display: 'flex', alignItems: 'center' }}>
                                {value != null && value !== '' ? `${value}${unit}` : '–'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────── */}
            <div style={{ background: '#fff', borderTop: '2px solid #0f172a', padding: '1em 2em', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                {doctorProfile?.signature_data && !isWritingMode && (
                    <div style={{ position: 'absolute', right: '3.5em', bottom: '4.5em', textAlign: 'center' }}>
                        <img src={doctorProfile.signature_data} alt="Signature" style={{ maxHeight: '10em', width: 'auto', marginBottom: '0.3em', mixBlendMode: 'multiply' }} />
                        <div style={{ fontSize: '0.75em', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Digital Signature</div>
                    </div>
                )}
                <span style={{ color: '#475569', fontSize: '1em', fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>
                    அடுத்த முறை வரும்போது இந்த மருந்துச்சீட்டை கொண்டு வரவும்
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.6em', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', alignSelf: 'flex-end', marginTop: '0.3em' }}>
                    Developed by Prescripto
                </span>
            </div>
        </div>
    );
}

export default PrescriptionTemplate;
