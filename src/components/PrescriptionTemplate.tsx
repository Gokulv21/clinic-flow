import React, { useRef, useEffect, useState } from 'react';
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
}

// Filter out invalid image data to prevent broken image icons
const isValidImage = (src: any): src is string =>
    typeof src === 'string' && src.length > 5 && (src.startsWith('data:image') || src.startsWith('http'));

const PrescriptionTemplate = React.memo(({
    patient, visit, handwrittenImage,
    diagnosis, clinicalNotes, medicines = [], advice, isPrint = false,
    isWritingMode = false,
}: PrescriptionTemplateProps) => {

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const vitals = [
        { label: 'Weight', value: visit?.weight, unit: ' kg' },
        { label: 'BP', value: visit?.blood_pressure, unit: ' mmHg' },
        { label: 'Pulse', value: visit?.pulse_rate, unit: ' /min' },
        { label: 'SpO₂', value: visit?.spo2, unit: ' %' },
        { label: 'Temp', value: visit?.temperature, unit: ' °F' },
        { label: 'CBG', value: visit?.cbg, unit: ' mg/dL' },
    ];

    const hasTyped = !!(diagnosis || clinicalNotes || (medicines && medicines.length > 0) || advice);
    const showTyped = !isWritingMode && hasTyped;

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
    const showHandwritten = images.length > 0;

    // If no handwriting or not in writing mode, we still need one "page" for typed content
    const pagesToShow = showHandwritten ? images : [null];

    return (
        <div className="flex flex-col items-center gap-8 w-full print-container">
            {pagesToShow.map((img, idx) => (
                <div
                    key={idx}
                    id={idx === 0 ? "prescription-template" : undefined}
                    className="single-page-prescription"
                    style={{
                        width: isPrint ? '210mm' : '100%',
                        maxWidth: '100%',
                        height: isPrint ? '296mm' : undefined,
                        maxHeight: isPrint ? '100%' : undefined,
                        aspectRatio: isPrint ? undefined : `${EXPORT_W} / ${EXPORT_H}`,
                        containerType: 'inline-size' as any,
                        position: 'relative',
                        overflow: 'hidden',
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
                                objectFit: 'fill',
                                zIndex: 20,
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                </div>
            ))}
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
    vitals: { label: string; value: any; unit: string }[];
}

function PageOne({ patient, visit, today, time, clinicalNotes, diagnosis, medicines, advice, hasTyped, vitals }: PageOneProps) {
    return (
        <div
            id="rx-inner"
            style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: '1.8cqw', // Further increased base font size
                color: '#0f172a',
                overflow: 'hidden',
            }}
        >
            <div className="margin-line margin-line-left" />
            <div className="margin-line margin-line-right" />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                
                #prescription-template * { box-sizing: border-box; }
                @media print {
                    @page { margin: 0; size: A4; }
                    body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    #rx-inner { 
                        font-size: 3.8mm !important; 
                        background: white !important; 
                        background-color: #ffffff !important; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                        height: 297mm !important;
                        width: 210mm !important;
                    }
                    .single-page-prescription { 
                        background: white !important; 
                        background-color: #ffffff !important; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                        height: 297mm !important;
                        width: 210mm !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                }

                .margin-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background-color: #cbd5e1;
                    opacity: 0.8;
                    z-index: 10;
                }
                .margin-line-left { left: 0em; }
                .margin-line-right { right: 0em; }
            `}</style>

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
                            Dr. V. Aravind
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.9em', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.3em' }}>
                            MBBS., CCEBDM., (PHFI)
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.85em', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Reg. No: 152590
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.8em', fontWeight: 600, marginTop: '0.1em' }}>
                            பொதுநலம் மற்றும் சர்க்கரை நோய் நிபுணர்
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: '#7d326cff', fontSize: '3.2em', letterSpacing: '0.04em', lineHeight: 1 }}>
                        GV Clinic
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.8em', marginTop: '0.4em', letterSpacing: '0.2em', fontWeight: 800 }}>
                        24/7 Emergency · ECG · Lab
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75em', marginTop: '0.2em', letterSpacing: '0.02em', fontWeight: 500 }}>
                        742, SSR Complex, Saththanur – 606 706
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75em', marginTop: '0.2em', letterSpacing: '0.02em', fontWeight: 500, textAlign: 'center' }}>
                        +91-9488017536
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
                                <div key={i} style={{ marginBottom: '0.6em', paddingLeft: '1em', borderLeft: '3px solid #3b82f6' }}>
                                    <strong style={{ fontWeight: 700 }}>{i + 1}. {m.name}</strong>&nbsp;&nbsp;{m.dosage} × {m.frequency} × {m.duration}
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
            <div style={{ background: '#fff', borderTop: '2px solid #0f172a', padding: '1em 2em', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
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
