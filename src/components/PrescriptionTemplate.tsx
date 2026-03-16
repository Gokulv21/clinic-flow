import React, { useRef, useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
    medicines?: any[];
    advice?: string;
    isPrint?: boolean;
}

export default function PrescriptionTemplate({
    patient, visit, handwrittenImage,
    diagnosis, medicines = [], advice, isPrint = false,
}: PrescriptionTemplateProps) {

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const vitals = [
        { label: 'Reg. No', value: visit?.token_number, unit: '' },
        { label: 'Weight', value: visit?.weight, unit: ' kg' },
        { label: 'BP', value: visit?.blood_pressure, unit: ' mmHg' },
        { label: 'Pulse', value: visit?.pulse_rate, unit: ' /min' },
        { label: 'SpO₂', value: visit?.spo2, unit: ' %' },
        { label: 'Temp', value: visit?.temperature, unit: ' °F' },
        { label: 'CBG', value: visit?.cbg, unit: ' mg/dL' },
    ];

    const hasTyped = !!(diagnosis || (medicines && medicines.length > 0) || advice);

    // Multi-page parsing logic: handles both raw arrays and JSON-stringified arrays from the DB
    let images: (string | null)[] = [];
    if (Array.isArray(handwrittenImage)) {
        images = handwrittenImage;
    } else if (typeof handwrittenImage === 'string' && handwrittenImage.startsWith('[')) {
        try {
            images = JSON.parse(handwrittenImage);
        } catch (e) {
            console.error("Failed to parse advice_image", e);
            images = [handwrittenImage];
        }
    } else {
        images = [handwrittenImage as string | null];
    }

    if (images.length === 0) images = [null];

    return (
        <div className="flex flex-col items-center gap-8 w-full print-container">
            {images.map((img, idx) => (
                <div
                    key={idx}
                    id={idx === 0 ? "prescription-template" : undefined}
                    className="single-page-prescription"
                    style={{
                        width: isPrint ? '210mm' : '100%',
                        height: isPrint ? '296mm' : undefined,
                        aspectRatio: isPrint ? undefined : `${EXPORT_W} / ${EXPORT_H}`,
                        containerType: 'inline-size' as any,
                        position: 'relative',
                        overflow: 'hidden',
                        background: '#fdfcfb',
                        boxSizing: 'border-box',
                        boxShadow: isPrint ? 'none' : '0 10px 40px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                    }}
                >
                    {idx === 0 ? (
                        <PageOne
                            patient={patient}
                            visit={visit}
                            today={today}
                            time={time}
                            diagnosis={diagnosis}
                            medicines={medicines}
                            advice={advice}
                            hasTyped={hasTyped}
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

                    {img && (
                        <img
                            src={img}
                            alt={`handwriting`}
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
}

interface PageOneProps {
    patient: any;
    visit: any;
    today: string;
    time: string;
    diagnosis?: string;
    medicines: any[];
    advice?: string;
    hasTyped: boolean;
    vitals: { label: string; value: any; unit: string }[];
}

function PageOne({ patient, visit, today, time, diagnosis, medicines, advice, hasTyped, vitals }: PageOneProps) {
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
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                
                #prescription-template * { box-sizing: border-box; }
                @media print {
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    #rx-inner { font-size: 3.8mm !important; } // Further increased print font size
                }
            `}</style>

            {/* ── HEADER ─────────────────────────────────────── */}
            <div style={{
                background: '#fff',
                padding: '1.4em 2em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative', overflow: 'hidden', flexShrink: 0,
                borderBottom: '1px solid #e2e8f0',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8em' }}>
                    {/* Exact Logo with Theme-Matching Filter */}
                    <img
                        src={prescriptionLogo}
                        alt="Clinic Logo"
                        style={{
                            height: '5.8em',
                            width: 'auto',
                            objectFit: 'contain',
                            flexShrink: 0,
                            display: 'block',
                            // This filter approximates #0f172a (Slate 900) for a black logo
                            filter: 'brightness(0) saturate(100%) invert(8%) sepia(21%) saturate(2853%) hue-rotate(191deg) brightness(91%) contrast(94%)'
                        }}
                    />

                    <div>
                        <div style={{ fontWeight: 800, color: '#c21b1eff', fontSize: '2em', lineHeight: 1, letterSpacing: '0.01em' }}>
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
                    <div style={{ fontWeight: 900, color: '#205213ff', fontSize: '3.2em', letterSpacing: '0.04em', lineHeight: 1 }}>
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
                display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.1fr 0.9fr',
                padding: '0.8em 2em', gap: '1.2em', flexShrink: 0,
            }}>
                {[
                    { label: 'Patient Name', value: (patient?.title ? patient.title + ' ' : '') + (patient?.name ?? '—'), color: '#0f172a' },
                    { label: 'Age / Sex', value: patient ? `${patient.age ?? '—'} / ${patient.sex?.charAt(0) ?? '—'}` : '—' },
                    { label: 'Date', value: today },
                    { label: 'Time', value: time },
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
                            {diagnosis && <div style={{ fontWeight: 800, fontSize: '1.2em', marginBottom: '0.6em', color: '#1e293b' }}>Dx: {diagnosis}</div>}
                            {medicines.map((m, i) => (
                                <div key={i} style={{ marginBottom: '0.6em', paddingLeft: '1em', borderLeft: '3px solid #3b82f6' }}>
                                    <strong style={{ fontWeight: 700 }}>{i + 1}. {m.name}</strong>&nbsp;&nbsp;{m.dosage} × {m.frequency} × {m.duration}
                                </div>
                            ))}
                            {advice && <div style={{ marginTop: '1em', fontStyle: 'italic', color: '#475569', fontSize: '1em', fontWeight: 500 }}>Advice: {advice}</div>}
                        </div>
                    )}
                    {/* Writing Grid */}
                    <div style={{ position: 'absolute', top: '5em', left: '1.5em', right: '1.5em', bottom: 0, backgroundImage: 'radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)', backgroundSize: '1.8em 1.8em', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />
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
            <div style={{ background: '#fff', borderTop: '2px solid #0f172a', padding: '1em 2em', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: '1em' }}>
                <span style={{ color: '#475569', fontSize: '1em', fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>
                    அடுத்த முறை வரும்போது இந்த மருந்துச்சீட்டை கொண்டு வரவும்
                </span>
            </div>
        </div>
    );
}
