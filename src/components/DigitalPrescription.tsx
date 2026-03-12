import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2, Save, Undo, X } from 'lucide-react';
import PrescriptionTemplate from './PrescriptionTemplate';

interface DigitalPrescriptionProps {
    patient: any;
    visit: any;
    onSave: (imageData: string | null) => void;
    onClose: () => void;
}

export default function DigitalPrescription({ patient, visit, onSave, onClose }: DigitalPrescriptionProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEnlarged, setIsEnlarged] = useState(false);
    const [paths, setPaths] = useState<{ x: number; y: number }[][]>([]);
    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<{ x: number; y: number }[]>([]);

    // ── Fit canvas pixel dimensions to its CSS display size (NO scaling trick)
    const fitCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const rect = container.getBoundingClientRect();
        // Only resize if dimensions actually changed to avoid clearing needlessly
        if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
            canvas.width = Math.floor(rect.width);
            canvas.height = Math.floor(rect.height);
        }
    }, []);

    const redrawAll = useCallback((pathsToRender: { x: number; y: number }[][]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = Math.max(1.5, canvas.width * 0.0035);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        pathsToRender.forEach(path => {
            if (path.length < 2) {
                if (path.length === 1) {
                    ctx.beginPath();
                    ctx.arc(path[0].x * canvas.width, path[0].y * canvas.height, Math.max(1, canvas.width * 0.002), 0, Math.PI * 2);
                    ctx.fillStyle = '#1a1a1a';
                    ctx.fill();
                }
                return;
            }
            ctx.beginPath();
            ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
            ctx.stroke();
        });
    }, []);

    // Fit on mount and when enlarged state changes
    useEffect(() => {
        const id = setTimeout(() => {
            fitCanvas();
            redrawAll(paths);
        }, 50);
        return () => clearTimeout(id);
    }, [isEnlarged, fitCanvas, redrawAll, paths]);

    // ── Get normalized canvas coordinates [0..1]
    const getCanvasPos = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
        };
    };

    const onPointerDown = (e: React.PointerEvent) => {
        // Capture the pointer so we keep getting events even if the finger leaves the element
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        isDrawingRef.current = true;
        const pos = getCanvasPos(e);
        currentPathRef.current = [pos];

        // Draw a dot for a single tap
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            ctx.beginPath();
            ctx.arc(pos.x * canvas.width, pos.y * canvas.height, Math.max(1, canvas.width * 0.002), 0, Math.PI * 2);
            ctx.fillStyle = '#1a1a1a';
            ctx.fill();
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        const pos = getCanvasPos(e);
        const path = currentPathRef.current;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas && path.length > 0) {
            const last = path[path.length - 1];
            ctx.beginPath();
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = Math.max(1.5, canvas.width * 0.0035);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(last.x * canvas.width, last.y * canvas.height);
            ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
            ctx.stroke();
        }
        currentPathRef.current = [...path, pos];
    };

    const onPointerUp = () => {
        if (currentPathRef.current.length > 1) {
            const newPaths = [...paths, currentPathRef.current];
            setPaths(newPaths);
        }
        currentPathRef.current = [];
        isDrawingRef.current = false;
    };

    const handleUndo = () => {
        const newPaths = paths.slice(0, -1);
        setPaths(newPaths);
        redrawAll(newPaths);
    };

    const handleClear = () => {
        setPaths([]);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas || paths.length === 0) {
            onSave(null);
            return;
        }
        onSave(canvas.toDataURL('image/png', 1.0));
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column',
            padding: isEnlarged ? 0 : '8px',
        }}>
            {/* ── Toolbar */}
            <div style={{
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                gap: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
                        {patient?.name} — Digital Prescription
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button variant="outline" size="sm" onClick={handleUndo} disabled={paths.length === 0}>
                        <Undo className="w-4 h-4 mr-1" /> Undo
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClear} style={{ color: 'red' }}>
                        <Trash2 className="w-4 h-4 mr-1" /> Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsEnlarged(e => !e)}>
                        {isEnlarged ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                        {isEnlarged ? 'Shrink' : 'Enlarge'}
                    </Button>
                    <Button size="sm" onClick={handleSave} style={{ background: '#0284c7', color: 'white' }}>
                        <Save className="w-4 h-4 mr-1" /> Save
                    </Button>
                </div>
            </div>

            {/* ── Scrollable paper area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                background: '#94a3b8',
                display: 'flex',
                justifyContent: 'center',
                padding: '16px',
            }}>
                {/* 
                    The paper: 
                    - Min width 320px, max 700px
                    - Uses a natural aspect ratio matching A4 (1/√2 ≈ 0.707)
                    - The template image IS the paper; canvas is on top
                */}
                <div
                    ref={containerRef}
                    style={{
                        width: '100%',
                        maxWidth: 700,
                        aspectRatio: '1 / 1.414',
                        position: 'relative',
                        flexShrink: 0,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        cursor: 'crosshair',
                        // Prevent scroll interference while drawing
                        touchAction: 'none',
                    }}
                >
                    {/* Template background */}
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <PrescriptionTemplate patient={patient} visit={visit} handwrittenImage={null} />
                    </div>

                    {/* Drawing canvas — on top of everything */}
                    <canvas
                        ref={canvasRef}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: 20,
                            cursor: 'crosshair',
                            touchAction: 'none',
                        }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                    />
                </div>
            </div>
        </div>
    );
}
