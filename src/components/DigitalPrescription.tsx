import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2, Save, Undo, X, Eraser, PenTool, Circle, Plus, ChevronLeft, ChevronRight, Tablet } from 'lucide-react';
import PrescriptionTemplate from './PrescriptionTemplate';

interface DigitalPrescriptionProps {
    patient: any;
    visit: any;
    initialPaths?: any[]; // For backward compatibility or if we only have one page
    initialPages?: any[][]; // Better for multi-page
    onSave: (imageData: string | string[] | null, pages: any[][]) => void;
    onClose: () => void;
}

export default function DigitalPrescription({ patient, visit, initialPaths = [], initialPages, onSave, onClose }: DigitalPrescriptionProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isEnlarged, setIsEnlarged] = useState(false);
    const [scale, setScale] = useState(1);

    // Drawing State
    const [penColor, setPenColor] = useState('#1e293b');
    const [penSize, setPenSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    
    // NEW: Precision Mode (Pen Only)
    const [precisionMode, setPrecisionMode] = useState(false);

    // Multi-page State
    type PathPoint = { x: number; y: number };
    type DrawnPath = { points: PathPoint[]; color: string; size: number; isEraser: boolean };
    
    // Improved initialization: check if initialPaths is already structured as pages (array of arrays)
    const getInitialPages = () => {
        if (initialPages) return initialPages;
        if (Array.isArray(initialPaths) && initialPaths.length > 0 && Array.isArray(initialPaths[0])) {
            return initialPaths as DrawnPath[][];
        }
        return [initialPaths] as DrawnPath[][];
    };

    const [pages, setPages] = useState<DrawnPath[][]>(getInitialPages());
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<PathPoint[]>([]);

    // Pinch-to-zoom state
    const lastTouchDistanceRef = useRef<number | null>(null);

    // ── Fit canvas pixel dimensions
    const fitCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const targetWidth = 1240;
        const targetHeight = Math.floor(targetWidth * 1.414);
        
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }
    }, []);

    const redrawPage = useCallback((pathsToRender: DrawnPath[]) => {
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
            ctx.lineWidth = Math.max(1.5, canvas.width * 0.001 * size);

            if (isEraser) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = ctx.lineWidth * 3;
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }

            if (pts.length < 2) {
                if (pts.length === 1) {
                    ctx.beginPath();
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

        ctx.globalCompositeOperation = 'source-over';
    }, []);

    useEffect(() => {
        const id = setTimeout(() => {
            fitCanvas();
            redrawPage(pages[currentPageIndex] || []);
        }, 50);
        return () => clearTimeout(id);
    }, [currentPageIndex, isEnlarged, fitCanvas, redrawPage, pages]);

    // ── Advanced Pointer Tracking
    const activePointersRef = useRef(new Map<number, { x: number, y: number, screenX: number, screenY: number, type: string }>());
    const lastPenTapRef = useRef<number>(0);
    const isPenActiveRef = useRef(false);

    // ── Writing Restriction Check (Only first page has bounds)
    const isInWritingArea = (pos: { x: number, y: number }) => {
        if (currentPageIndex > 0) return true; // Contination pages are full white
        const HEADER_BOUND = 0.22;
        const FOOTER_BOUND = 0.91;
        const SIDEBAR_BOUND = 0.73;
        return pos.y >= HEADER_BOUND && pos.y <= FOOTER_BOUND && pos.x <= SIDEBAR_BOUND;
    };

    const getCanvasPos = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height,
        };
    };

    const onPointerDown = (e: React.PointerEvent) => {
        const pos = getCanvasPos(e.clientX, e.clientY);
        activePointersRef.current.set(e.pointerId, { ...pos, screenX: e.clientX, screenY: e.clientY, type: e.pointerType });

        // Double-Tap Detection (Pencil barrel sim)
        if (e.pointerType === 'pen') {
            const now = Date.now();
            if (now - lastPenTapRef.current < 350) {
                setIsEraser(!isEraser);
                lastPenTapRef.current = 0; // Reset
                return; // Don't start drawing on double tap
            }
            lastPenTapRef.current = now;
            isPenActiveRef.current = true;
        }

        // PALM REJECTION: If a pen is already active on screen, ignore new touch downs
        if (isPenActiveRef.current && e.pointerType === 'touch') {
            return;
        }

        // START DRAWING: Only if not zooming (1 pointer)
        if (activePointersRef.current.size === 1) {
            // Respect precision mode
            if (precisionMode && e.pointerType !== 'pen') return;
            
            if (!isInWritingArea(pos)) return;

            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            isDrawingRef.current = true;
            currentPathRef.current = [pos];

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && canvas) {
                ctx.beginPath();
                const pressure = (e as any).pressure || 0.5;
                const pSize = isEraser ? penSize * 4 : penSize;
                const lineWidth = Math.max(1, canvas.width * 0.001 * pSize * (pressure * 1.5));
                
                ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
                ctx.fillStyle = isEraser ? '#ffffff' : penColor;
                ctx.arc(pos.x * canvas.width, pos.y * canvas.height, lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Multiple pointers -> Stop any active drawing to avoid stray marks during zoom
            onPointerUp();
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const pos = getCanvasPos(e.clientX, e.clientY);
        const touchCount = activePointersRef.current.size;

        // Update tracking
        if (activePointersRef.current.has(e.pointerId)) {
            activePointersRef.current.set(e.pointerId, { 
                ...pos, 
                screenX: e.clientX, 
                screenY: e.clientY, 
                type: e.pointerType 
            });
        }

        // Pinch-to-Zoom logic (Multi-touch)
        if (touchCount >= 2) {
            const pts = Array.from(activePointersRef.current.values());
            // Use Screen Coords for stable distance calculation
            const dist = Math.hypot(pts[0].screenX - pts[1].screenX, pts[0].screenY - pts[1].screenY);
            if (lastTouchDistanceRef.current !== null) {
                const delta = dist / lastTouchDistanceRef.current;
                // Sensitivity adjustment
                setScale(s => Math.min(Math.max(s * delta, 0.5), 4));
            }
            lastTouchDistanceRef.current = dist;
            return;
        }

        if (!isDrawingRef.current) return;
        
        // Strict Palm Rejection: If pen is active, ignore this touch move
        if (isPenActiveRef.current && e.pointerType === 'touch') return;

        if (!isInWritingArea(pos)) {
            onPointerUp();
            return;
        }

        const path = currentPathRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas && path.length > 0) {
            const last = path[path.length - 1];
            ctx.beginPath();
            ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
            ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
            
            const pressure = (e as any).pressure || 0.5;
            const pSize = isEraser ? penSize * 4 : penSize;
            ctx.lineWidth = Math.max(1, canvas.width * 0.001 * pSize * (pressure * 1.5));
            
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(last.x * canvas.width, last.y * canvas.height);
            ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }
        currentPathRef.current = [...path, pos];
    };

    const onPointerUp = (e?: React.PointerEvent) => {
        if (e) {
            activePointersRef.current.delete(e.pointerId);
            if (e.pointerType === 'pen') isPenActiveRef.current = false;
        } else {
            activePointersRef.current.clear();
            isPenActiveRef.current = false;
        }

        if (activePointersRef.current.size === 0) {
            lastTouchDistanceRef.current = null;
        }

        if (isDrawingRef.current && (currentPathRef.current.length > 0)) {
            const newPath = {
                points: currentPathRef.current,
                color: penColor,
                size: penSize,
                isEraser: isEraser
            };
            const updatedPages = [...pages];
            updatedPages[currentPageIndex] = [...(updatedPages[currentPageIndex] || []), newPath];
            setPages(updatedPages);
        }
        currentPathRef.current = [];
        isDrawingRef.current = false;
    };

    const handleUndo = () => {
        const updatedPages = [...pages];
        updatedPages[currentPageIndex] = updatedPages[currentPageIndex].slice(0, -1);
        setPages(updatedPages);
        redrawPage(updatedPages[currentPageIndex]);
    };

    const handleClear = () => {
        const updatedPages = [...pages];
        updatedPages[currentPageIndex] = [];
        setPages(updatedPages);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // ── PAGE MANAGEMENT
    const addPage = () => {
        setPages([...pages, []]);
        setCurrentPageIndex(pages.length);
    };

    const deleteCurrentPage = () => {
        if (pages.length <= 1) return;
        const newPages = pages.filter((_, i) => i !== currentPageIndex);
        setPages(newPages);
        setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
    };

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render each page to image
        const images: string[] = [];
        for (let i = 0; i < pages.length; i++) {
            redrawPage(pages[i]);
            images.push(canvas.toDataURL('image/png', 1.0));
        }

        // Return to current page state for UI
        redrawPage(pages[currentPageIndex]);
        onSave(images.length > 1 ? images : images[0], pages);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setScale(s => Math.min(Math.max(s * delta, 0.5), 4));
        }
    };

    return (
        <div 
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex', flexDirection: 'column',
                padding: isEnlarged ? 0 : '12px',
            }}
            onWheel={handleWheel}
        >
            {/* ── Toolbar */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 drop-shadow-md sticky top-0 z-50 rounded-t-xl">
                <div className="flex items-center gap-2 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="w-5 h-5" /></Button>
                    
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={pages[currentPageIndex]?.length === 0} className="h-8">
                            <Undo className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={pages[currentPageIndex]?.length === 0} className="h-8 text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
                        <Button
                            variant={isEraser ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setIsEraser(!isEraser)}
                            className={`h-8 w-8 p-0 ${isEraser ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
                        >
                            <Eraser className={`w-4 h-4 ${isEraser ? 'text-blue-600' : 'text-slate-600'}`} />
                        </Button>
                        {!isEraser && (
                            <input
                                type="color"
                                value={penColor}
                                onChange={(e) => setPenColor(e.target.value)}
                                className="w-7 h-7 p-0 border-0 rounded-md cursor-pointer ring-1 ring-slate-200"
                            />
                        )}
                        <div className="hidden xs:flex items-center gap-1.5 ml-1 px-1">
                            <input
                                type="range"
                                min="1"
                                max="15"
                                value={penSize}
                                onChange={(e) => setPenSize(parseInt(e.target.value))}
                                className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>

                    {/* Precision Mode Toggle */}
                    <Button 
                        variant={precisionMode ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setPrecisionMode(!precisionMode)}
                        className={cn("h-8 gap-2 ml-1", precisionMode ? "bg-blue-600" : "text-slate-500")}
                    >
                        <Tablet className="w-4 h-4" />
                        <span className="hidden sm:inline">{precisionMode ? 'Pen Only' : 'Finger On'}</span>
                    </Button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                         <span className="text-[10px] font-bold text-slate-500">{Math.round(scale * 100)}%</span>
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setScale(1)}>
                            <Undo className="w-2.5 h-2.5" />
                         </Button>
                    </div>
                    <Button size="sm" onClick={handleSave} className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white shadow-lg">
                        <Save className="w-4 h-4 mr-2" /> Save
                    </Button>
                </div>
            </div>

            {/* ── Main Canvas Area */}
            <div 
                ref={scrollContainerRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    background: '#0f172a',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    touchAction: 'none',
                    userSelect: 'none',
                }}
                onTouchEnd={() => {
                    activePointersRef.current.clear();
                    isPenActiveRef.current = false;
                    lastTouchDistanceRef.current = null;
                }}
            >
                <div
                    ref={containerRef}
                    style={{
                        width: '100%',
                        maxWidth: 700,
                        aspectRatio: '1 / 1.414',
                        position: 'relative',
                        flexShrink: 0,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        transition: lastTouchDistanceRef.current ? 'none' : 'transform 0.15s cubic-bezier(0,0,0.2,1)',
                    }}
                >
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <PrescriptionTemplate 
                            patient={patient} 
                            visit={visit} 
                            handwrittenImage={null} 
                            // Only show template on first page
                        />
                        {/* Background for continuation pages */}
                        {currentPageIndex > 0 && (
                            <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />
                        )}
                        {/* Branding for continuation pages */}
                        {currentPageIndex > 0 && (
                             <div style={{ 
                                position: 'absolute', top: '2em', right: '3em', 
                                color: '#cbd5e1', fontSize: '1.5cqw', fontWeight: 800,
                                zIndex: 5
                            }}>
                                GV CLINIC — PAGE {currentPageIndex + 1}
                            </div>
                        )}
                    </div>

                    <canvas
                        ref={canvasRef}
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            zIndex: 20, cursor: 'crosshair', touchAction: 'none',
                        }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                        onPointerCancel={onPointerUp}
                    />
                </div>
            </div>

            {/* ── Pagination Bottom Bar */}
            <div className="bg-white/90 backdrop-blur border-t px-6 py-4 flex items-center justify-between shrink-0 rounded-b-xl shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <Button 
                            variant="ghost" size="sm" 
                            disabled={currentPageIndex === 0}
                            onClick={() => setCurrentPageIndex(p => p - 1)}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="px-3 text-sm font-bold text-slate-700">
                            Page {currentPageIndex + 1} of {pages.length}
                        </span>
                        <Button 
                            variant="ghost" size="sm" 
                            disabled={currentPageIndex === pages.length - 1}
                            onClick={() => setCurrentPageIndex(p => p + 1)}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                    {pages.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={deleteCurrentPage} className="text-red-500 hover:text-red-700 h-8">
                             Delete Page
                        </Button>
                    )}
                </div>

                <Button onClick={addPage} className="bg-primary text-white h-9 px-5 gap-2 rounded-full shadow-lg">
                    <Plus className="w-4 h-4" /> Add Page
                </Button>
            </div>
        </div>
    );
}

// Helper for conditional classes if not already imported
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
