import React from 'react';

interface PrescriptionTemplateProps {
    patient?: any;
    visit?: any;
    handwrittenImage?: string | null;
    diagnosis?: string;
    medicines?: any[];
    advice?: string;
    isPrint?: boolean;
}

// --- Layout constants derived from the official template image ---
// Image aspect ratio: ~727x1028 (approx A4 portrait)
// All values are percentage of the container's width/height

export default function PrescriptionTemplate({
    patient,
    visit,
    handwrittenImage,
    diagnosis,
    medicines = [],
    advice,
    isPrint = false
}: PrescriptionTemplateProps) {
    const today = new Date().toLocaleDateString('en-IN');
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const containerStyle: React.CSSProperties = isPrint
        ? { width: '210mm', height: '297mm', position: 'relative', overflow: 'hidden', background: 'white' }
        : { width: '100%', aspectRatio: '0.707 / 1', position: 'relative', overflow: 'hidden', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' };

    // Font size scales with the container. For a ~700px wide container, 12px is good.
    // We'll use a relative font size via em
    return (
        <div id="prescription-template" style={{ ...containerStyle, fontFamily: 'Arial, sans-serif' }}>
            {/* Background Official Image */}
            <img
                src="/prescription-template.jpg"
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 0, display: 'block' }}
                draggable={false}
            />

            {/* Data Overlay — all positions derived by pixel-measuring the 727×1028 source image */}
            {/* The white "paper" inner box top-left is roughly (22px, 216px), bottom-right (705px, 1003px) */}
            {/* We express each field as % of image dimensions */}

            {/* ── NAME field: dots run from ~9% to ~41% from left, at row ~22% from top */}
            <span style={{
                position: 'absolute', zIndex: 5,
                top: '22%', left: '9%',
                fontSize: '1.4vw',
                fontWeight: 700,
                color: '#111',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap'
            }}>
                {patient?.name || ''}
            </span>

            {/* ── AGE/SEX field: dots at ~47%–57% from left */}
            <span style={{
                position: 'absolute', zIndex: 5,
                top: '22%', left: '48.5%',
                fontSize: '1.4vw',
                fontWeight: 700,
                color: '#111',
            }}>
                {patient?.age || ''}{patient?.sex ? `/ ${patient.sex.charAt(0)}` : ''}
            </span>

            {/* ── DATE field: dots at ~63%–76% from left */}
            <span style={{
                position: 'absolute', zIndex: 5,
                top: '22%', left: '64%',
                fontSize: '1.4vw',
                fontWeight: 700,
                color: '#111',
            }}>
                {today}
            </span>

            {/* ── TIME field: dots at ~83%–94% from left */}
            <span style={{
                position: 'absolute', zIndex: 5,
                top: '22%', left: '84%',
                fontSize: '1.4vw',
                fontWeight: 700,
                color: '#111',
            }}>
                {time}
            </span>

            {/* ── VITALS on the right sidebar */}
            {/* Reg.No value starts at ~77% from left, first row at ~27.5% from top */}
            {[
                { label: 'token_number', value: visit?.token_number, unit: '' },
                { label: 'weight', value: visit?.weight, unit: ' KG' },
                { label: 'bp', value: visit?.blood_pressure, unit: '' },
                { label: 'pulse', value: visit?.pulse_rate, unit: ' BPM' },
                { label: 'spo2', value: visit?.spo2, unit: ' %' },
                { label: 'temp', value: visit?.temperature, unit: '°F' },
                { label: 'cbg', value: visit?.cbg, unit: '' },
            ].map((v, i) => (
                <span key={v.label} style={{
                    position: 'absolute', zIndex: 5,
                    // Reg.No row: 27.5%, each next row adds 3.55%
                    top: `${27.5 + i * 3.55}%`,
                    left: '75%',
                    fontSize: '1.2vw',
                    fontWeight: 700,
                    color: '#111',
                }}>
                    {v.value != null && v.value !== '' ? `${v.value}${v.unit}` : ''}
                </span>
            ))}

            {/* ── PRESCRIPTION AREA — handwriting or typed medicines */}
            {/* Drawing area starts at ~25% from top, left ~4%, right ~68%, bottom ~92% */}
            <div style={{
                position: 'absolute', zIndex: 5,
                top: '25%', left: '4%',
                width: '63%',
                bottom: '10%',
                overflow: 'hidden'
            }}>
                {handwrittenImage && (
                    <img
                        src={handwrittenImage}
                        alt="Handwritten"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                )}
                {!handwrittenImage && (diagnosis || medicines.length > 0 || advice) && (
                    <div style={{ padding: '4% 6%', lineHeight: '1.6', color: '#111' }}>
                        {diagnosis && (
                            <div style={{ marginBottom: '6%' }}>
                                <div style={{ fontSize: '1.1vw', fontWeight: 700 }}>Dx: {diagnosis}</div>
                            </div>
                        )}
                        {medicines.map((m, i) => (
                            <div key={i} style={{ fontSize: '1.1vw', marginBottom: '3%', paddingLeft: '2%' }}>
                                <strong>{i + 1}. {m.name}</strong> — {m.dosage} × {m.frequency} × {m.duration}
                            </div>
                        ))}
                        {advice && (
                            <div style={{ marginTop: '6%', fontSize: '1vw', fontStyle: 'italic' }}>
                                Advice: {advice}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Print-specific CSS */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #prescription-template,
                    #prescription-template * { visibility: visible !important; }
                    #prescription-template {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
}
