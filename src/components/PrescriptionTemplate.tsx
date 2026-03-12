import React from 'react';

const EXPORT_W = 1240;
const EXPORT_H = 1754;

interface PrescriptionTemplateProps {
    patient?: any;
    visit?: any;
    handwrittenImage?: string | null;
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
        { label: 'BP', value: visit?.blood_pressure, unit: '' },
        { label: 'Pulse', value: visit?.pulse_rate, unit: ' /min' },
        { label: 'SpO₂', value: visit?.spo2, unit: ' %' },
        { label: 'Temp', value: visit?.temperature, unit: ' °F' },
        { label: 'CBG', value: visit?.cbg, unit: ' mg/dL' },
    ];

    const hasTyped = !!(diagnosis || (medicines && medicines.length > 0) || advice);

    /*
     *  Layout strategy
     *  ───────────────
     *  Outer  (#prescription-template)
     *    – Owns width / height / aspect-ratio
     *    – Sets container-type: inline-size  →  enables cqw for descendants
     *    – position: relative                →  anchors the handwriting overlay
     *
     *  Inner  (#rx-inner)
     *    – position: absolute; inset: 0      →  fills the outer exactly
     *    – display: flex; flex-direction: column
     *    – font-size: 1.5cqw                 →  all em-based fonts scale with paper width
     *    – flex: 1 on the body works because inner has DEFINITE height (inset: 0)
     */

    return (
        <div
            id="prescription-template"
            style={{
                /* sizing */
                width: isPrint ? '210mm' : '100%',
                height: isPrint ? '297mm' : undefined,
                aspectRatio: isPrint ? undefined : `${EXPORT_W} / ${EXPORT_H}`,
                /* container query — enables cqw units */
                containerType: 'inline-size' as any,
                /* anchor for overlay */
                position: 'relative',
                overflow: 'hidden',
                background: '#fdfcfb',
                boxSizing: 'border-box',
                boxShadow: isPrint ? 'none' : '0 6px 32px rgba(0,0,0,0.18)',
            }}
        >

            {/* Fonts + print CSS (inline style tag) */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;900&family=Lato:ital,wght@0,300;0,400;0,700;1,400&display=swap');

                #prescription-template * { box-sizing: border-box; }

                /* When printed via the iframe utility, #prescription-template
                   is the only element on the page. The iframe CSS handles
                   dimensions and layout. We only need colour accuracy here. */
                @media print {
                    * { -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important; }
                    #rx-inner { font-size: 3.15mm !important; }
                    @page { margin: 0; size: A4 portrait; }
                }
            `}</style>

            {/* ════════════════════════════════════════════════════
                INNER  —  flex column, fills outer via inset 0
                          font-size uses cqw from outer container
            ════════════════════════════════════════════════════ */}
            <div
                id="rx-inner"
                style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    fontFamily: "'Lato', Arial, sans-serif",
                    fontSize: '1.5cqw',   /* ← scales with paper width */
                    color: '#1a2e4a',
                    overflow: 'hidden',
                }}
            >

                {/* ── HEADER ─────────────────────────────────────── */}
                <div style={{
                    background: 'linear-gradient(135deg, #0d2137 0%, #1a3a5c 50%, #1b6ca8 100%)',
                    padding: '1.4em 1.8em',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden', flexShrink: 0,
                }}>
                    {/* Decorative rings */}
                    {[28, 18].map((s, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            right: `${-s * 0.35}%`, top: '50%',
                            transform: 'translateY(-50%)',
                            width: `${s}%`, aspectRatio: '1',
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.07)',
                            pointerEvents: 'none',
                        }} />
                    ))}
                    {/* Doctor */}
                    <div>
                        <div style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontWeight: 900, color: '#fff',
                            fontSize: '2.5em', lineHeight: 1.1,
                        }}>Dr. V. Aravind</div>
                        <div style={{
                            color: '#7ec8e3', fontSize: '0.85em', fontWeight: 300,
                            letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.3em'
                        }}>
                            MBBS · General Physician
                        </div>
                        <div style={{ color: '#a0c4e0', fontSize: '0.78em', marginTop: '0.2em' }}>
                            பொதுமல மருத்துவர் · Reg. No: 152590
                        </div>
                    </div>
                    {/* Clinic */}
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontWeight: 700, color: '#fff',
                            fontSize: '2.1em', letterSpacing: '0.04em', lineHeight: 1.1,
                        }}>GV Clinic</div>
                        <div style={{ color: '#a0c4e0', fontSize: '0.76em', marginTop: '0.35em' }}>
                            742, SSR Complex, Saththanur – 606 706
                        </div>
                        <div style={{
                            color: '#7ec8e3', fontSize: '0.73em', marginTop: '0.2em',
                            letterSpacing: '0.04em'
                        }}>
                            24/7 Emergency · ECG · Lab
                        </div>
                    </div>
                </div>

                {/* Tri-colour stripe */}
                <div style={{
                    height: '0.3em', flexShrink: 0,
                    background: 'linear-gradient(90deg, #1b6ca8 0%, #27ae60 50%, #f39c12 100%)',
                }} />

                {/* ── PATIENT BAR ─────────────────────────────────── */}
                <div style={{
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f5e9 100%)',
                    borderBottom: '1.5px solid #b0cde8',
                    display: 'grid',
                    gridTemplateColumns: '2.4fr 1fr 1.1fr 0.9fr',
                    padding: '0.65em 1.5em', gap: '1em', flexShrink: 0,
                }}>
                    {[
                        { label: 'Patient Name', value: patient?.name ?? '—' },
                        { label: 'Age / Sex', value: patient ? `${patient.age ?? '—'} / ${patient.sex?.charAt(0) ?? '—'}` : '—' },
                        { label: 'Date', value: today },
                        { label: 'Time', value: time },
                    ].map(({ label, value }) => (
                        <div key={label} style={{ overflow: 'hidden', minWidth: 0 }}>
                            <div style={{
                                fontSize: '0.7em', color: '#5a7a9a', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.07em'
                            }}>
                                {label}
                            </div>
                            <div style={{
                                fontFamily: "'Playfair Display', Georgia, serif",
                                fontSize: '1.05em', fontWeight: 700, color: '#1a2e4a',
                                marginTop: '0.15em', whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── BODY (Rx left + Vitals right) ───────────────── */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                    {/* LEFT — Rx writing area */}
                    <div style={{
                        flex: 1, position: 'relative',
                        borderRight: '1.5px solid #b0cde8',
                        padding: '0.9em 1.1em',
                        display: 'flex', flexDirection: 'column',
                        background: '#fdfcfb', overflow: 'hidden',
                    }}>
                        {/* ℞ */}
                        <div style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: '4em', fontWeight: 900, color: '#c0392b',
                            lineHeight: 1, marginBottom: '0.25em', flexShrink: 0,
                        }}>ℛ𝓍</div>

                        {/* Gradient divider */}
                        <div style={{
                            height: '1px', flexShrink: 0, marginBottom: '0.6em',
                            background: 'linear-gradient(90deg, #c0392b55, #b0cde8aa, transparent)',
                        }} />

                        {/* Typed medicines */}
                        {hasTyped && (
                            <div style={{ lineHeight: 1.75, fontSize: '1em', overflow: 'hidden', zIndex: 30, position: 'relative' }}>
                                {diagnosis && (
                                    <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: '0.5em' }}>
                                        Dx: {diagnosis}
                                    </div>
                                )}
                                {medicines.map((m, i) => (
                                    <div key={i} style={{
                                        marginBottom: '0.45em',
                                        paddingLeft: '0.8em',
                                        borderLeft: '2.5px solid #27ae60',
                                    }}>
                                        <strong>{i + 1}. {m.name}</strong>
                                        &ensp;{m.dosage} × {m.frequency} × {m.duration}
                                    </div>
                                ))}
                                {advice && (
                                    <div style={{
                                        marginTop: '0.8em', fontStyle: 'italic',
                                        color: '#4a6a8a', fontSize: '0.9em'
                                    }}>
                                        Advice: {advice}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Dot grid */}
                        <div style={{
                            position: 'absolute',
                            top: '5em', left: '1.1em', right: '1.1em', bottom: 0,
                            backgroundImage: 'radial-gradient(circle, #b0cde866 0.8px, transparent 0.8px)',
                            backgroundSize: '1.8em 1.8em',
                            pointerEvents: 'none', zIndex: 0,
                        }} />
                    </div>

                    {/* RIGHT — Vitals sidebar */}
                    <div style={{
                        width: '27%', flexShrink: 0,
                        backgroundColor: '#f4f9ff',
                        boxShadow: 'inset 0 0 0 1000px #f4f9ff', /* Force print! */
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' as any,
                    }}>
                        <div style={{
                            backgroundColor: '#1a3a5c',
                            boxShadow: 'inset 0 0 0 1000px #1a3a5c', /* Force print! */
                            color: '#fff', fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            fontSize: '0.75em', textAlign: 'center',
                            padding: '0.5em 0', flexShrink: 0,
                            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' as any,
                        }}>
                            Clinical Vitals
                        </div>

                        {vitals.map(({ label, value, unit }, i) => (
                            <div key={label} style={{
                                display: 'flex', alignItems: 'stretch',
                                height: '3em',           /* compact fixed row height */
                                flexShrink: 0,
                                borderBottom: `1px solid ${i % 2 === 0 ? '#cde0f0' : '#d8e8f5'}`,
                                backgroundColor: i % 2 === 0 ? '#ffffff' : '#eef6fc',
                                boxShadow: `inset 0 0 0 100px ${i % 2 === 0 ? '#ffffff' : '#eef6fc'}`, /* Force print! */
                                WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' as any,
                            }}>
                                <div style={{
                                    width: '45%', padding: '0 0.55em',
                                    fontWeight: 700, color: '#1a3a5c', fontSize: '0.78em',
                                    borderRight: '1px solid #b0cde8',
                                    display: 'flex', alignItems: 'center',
                                }}>{label}</div>
                                <div style={{
                                    flex: 1, padding: '0 0.45em',
                                    fontFamily: "'Playfair Display', Georgia, serif",
                                    fontSize: '0.92em',
                                    fontWeight: value != null ? 700 : 400,
                                    color: value != null ? '#0d2137' : '#b0c4d4',
                                    display: 'flex', alignItems: 'center',
                                }}>
                                    {value != null && value !== '' ? `${value}${unit}` : '–'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── FOOTER ──────────────────────────────────────── */}
                <div style={{
                    background: 'linear-gradient(135deg, #0d2137 0%, #1a3a5c 100%)',
                    padding: '0.55em 1.5em',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <span style={{ color: '#7ec8e3', fontSize: '0.7em', fontWeight: 300, letterSpacing: '0.03em' }}>
                        GV Clinic · 742 SSR Complex, Saththanur – 606 706 · 24/7 Emergency
                    </span>
                    <div style={{
                        borderTop: '1px solid #4a6a8a', paddingTop: '0.25em',
                        color: '#a0c4e0', fontSize: '0.68em', letterSpacing: '0.05em',
                    }}>
                        Dr. V. Aravind — Signature
                    </div>
                </div>

            </div>{/* end #rx-inner */}

            {/* ════════════════════════════════════════════════════
                HANDWRITTEN OVERLAY — sits on the outer wrapper,
                above rx-inner, fills 100% via absolute inset 0.
                objectFit: fill → 1:1 pixel mapping because
                export is same apsect ratio as this container.
            ════════════════════════════════════════════════════ */}
            {handwrittenImage && (
                <img
                    src={handwrittenImage}
                    alt="handwriting"
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
    );
}
