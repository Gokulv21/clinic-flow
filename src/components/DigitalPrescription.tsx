import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2, Save, Undo, X, Eraser, PenTool, Circle } from 'lucide-react';
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

    // Drawing State
    const [penColor, setPenColor] = useState('#1e293b');
    const [penSize, setPenSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false);

    // Paths now store their style metadata
    type PathPoint = { x: number; y: number };
    type DrawnPath = { points: PathPoint[]; color: string; size: number; isEraser: boolean };
    const [paths, setPaths] = useState<DrawnPath[]>([]);

    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<PathPoint[]>([]);

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

    const redrawAll = useCallback((pathsToRender: DrawnPath[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        pathsToRender.forEach(path => {
            const { points, color, size, isEraser } = path;
            const pts = points;

            ctx.strokeStyle = isEraser ? '#ffffff' : color;
            // Base thickness on canvas width but scaled by the user's chosen penSize
            ctx.lineWidth = Math.max(1.5, canvas.width * 0.001 * size);

            if (isEraser) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = ctx.lineWidth * 3; // make eraser wider
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }

            if (pts.length < 2) {
                if (pts.length === 1) {
                    ctx.beginPath();
                    // Dot radius matches the line width stroke
                    ctx.arc(pts[0].x * canvas.width, pts[0].y * canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2);
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.fill();
                }
                return;
            }
            ctx.beginPath();
            ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height);
            ctx.stroke();
        });

        // Reset composite operation to default
        ctx.globalCompositeOperation = 'source-over';
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
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        isDrawingRef.current = true;
        const pos = getCanvasPos(e);
        currentPathRef.current = [pos];

        // Draw a dot for a single tap
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            ctx.beginPath();
            const lineWidth = Math.max(1.5, canvas.width * 0.001 * penSize) * (isEraser ? 3 : 1);
            ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
            ctx.fillStyle = isEraser ? '#ffffff' : penColor;
            ctx.arc(pos.x * canvas.width, pos.y * canvas.height, lineWidth / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
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
            ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
            ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
            ctx.lineWidth = Math.max(1.5, canvas.width * 0.001 * penSize) * (isEraser ? 3 : 1);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(last.x * canvas.width, last.y * canvas.height);
            ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }
        currentPathRef.current = [...path, pos];
    };

    const onPointerUp = () => {
        if (currentPathRef.current.length > 1 || currentPathRef.current.length === 1) { // Save dots too
            const newPath = {
                points: currentPathRef.current,
                color: penColor,
                size: penSize,
                isEraser: isEraser
            };
            setPaths(prev => [...prev, newPath]);
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
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 drop-shadow-sm sticky top-0 z-50 rounded-t-lg">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="w-5 h-5" /></Button>
                    <h2 className="font-heading font-bold text-lg hidden lg:block ml-1 truncate shrink-0">Digital Prescription</h2>

                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={paths.length === 0} className="h-8">
                            <Undo className="w-4 h-4 mr-1 md:mr-2" />
                            <span className="hidden md:inline">Undo</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={paths.length === 0} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 mr-1 md:mr-2" />
                            <span className="hidden md:inline">Clear</span>
                        </Button>
                    </div>

                    {/* ── DRAWING CONTROLS ── */}
                    <div className="flex items-center gap-1.5 sm:gap-3 bg-slate-100 p-0.5 sm:p-1 rounded-lg shrink-0">
                        {/* Eraser Toggle */}
                        <Button
                            variant={isEraser ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setIsEraser(!isEraser)}
                            className={`h-8 w-8 p-0 ${isEraser ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
                            title="Toggle Eraser"
                        >
                            <Eraser className={`w-4 h-4 ${isEraser ? 'text-blue-600' : 'text-slate-600'}`} />
                        </Button>

                        <div className="hidden sm:block w-px h-5 bg-slate-300 mx-0.5"></div>

                        {/* Color Picker (disabled if eraser) */}
                        <div className="flex items-center gap-1 shrink-0" style={{ opacity: isEraser ? 0.5 : 1, pointerEvents: isEraser ? 'none' : 'auto' }}>
                            <PenTool className="hidden sm:block w-4 h-4 text-slate-500 mr-1" />
                            <input
                                type="color"
                                shadow-sm
                                value={penColor}
                                onChange={(e) => setPenColor(e.target.value)}
                                className="w-7 h-7 sm:w-6 sm:h-6 p-0 border-0 rounded-md cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md ring-1 ring-slate-200"
                                title="Pen Color"
                            />
                        </div>

                        {/* Pen Size Slider - Hidden on tiny screens, show on small+ */}
                        <div className="hidden xs:flex items-center gap-1.5 sm:gap-2 ml-1 px-1 sm:px-2 min-w-[60px] sm:min-w-[120px]">
                            <Circle className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-slate-400 fill-current" />
                            <input
                                type="range"
                                min="1"
                                max="15"
                                value={penSize}
                                onChange={(e) => setPenSize(parseInt(e.target.value))}
                                className="w-12 sm:w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                title={`Pen Size: ${penSize}`}
                            />
                            <Circle className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 fill-current" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setIsEnlarged(e => !e)} className="h-9 px-2 sm:px-3">
                        {isEnlarged ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        <span className="hidden xs:inline ml-1.5">{isEnlarged ? 'Shrink' : 'Enlarge'}</span>
                    </Button>
                    <Button size="sm" onClick={handleSave} className="h-9 px-3 sm:px-4 shadow-sm" style={{ background: '#0284c7', color: 'white' }}>
                        <Save className="w-4 h-4 mr-1.5" /> <span className="hidden xs:inline">Save</span>
                    </Button>
                </div>
            </div>

            {/* ── Scrollable paper area */}
            <div style={{
                flex: 1,
                overflowX: 'auto',
                overflowY: 'auto',
                background: '#e2e8f0',
                display: 'flex',
                justifyContent: 'center',
                padding: '16px',
                borderBottomLeftRadius: isEnlarged ? 0 : '8px',
                borderBottomRightRadius: isEnlarged ? 0 : '8px',
            }}>
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
                        touchAction: 'none',
                    }}
                >
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <PrescriptionTemplate patient={patient} visit={visit} handwrittenImage={null} />
                    </div>

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
