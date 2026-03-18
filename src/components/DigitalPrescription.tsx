import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2, Save, Undo, Redo, X, Eraser, PenTool, Circle, Plus, ChevronLeft, ChevronRight, Tablet, Settings2 } from 'lucide-react';
import PrescriptionTemplate from './PrescriptionTemplate';
import { getStroke } from 'perfect-freehand';
import { useGesture } from '@use-gesture/react';

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
    const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isEnlarged, setIsEnlarged] = useState(false);
    const [scale, setScale] = useState(1);

    // Drawing State
    const [penColor, setPenColor] = useState('#1e293b');
    const [penSize, setPenSize] = useState(3);
    const [eraserSize, setEraserSize] = useState(10);
    const [isEraser, setIsEraser] = useState(false);



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
    const [history, setHistory] = useState<DrawnPath[][][]>([getInitialPages()]);
    const [historyStep, setHistoryStep] = useState(0);

    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<any[]>([]); // Points with pressure
    const isDirtyRef = useRef(false);
    const requestRef = useRef<number>();
    const activePointerIdRef = useRef<number | null>(null);

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

    const renderPath = (ctx: CanvasRenderingContext2D, path: DrawnPath, canvasWidth: number, canvasHeight: number) => {
        const { points, color, size, isEraser } = path;
        ctx.fillStyle = isEraser ? '#ffffff' : color;
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

        const strokeSize = isEraser ? size * 5 : size * 2;
        const stroke = getStroke(points.map(p => [p.x * canvasWidth, p.y * canvasHeight, (p as any).pressure || 0.5]), {
            size: strokeSize,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
        });

        if (stroke.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(stroke[0][0], stroke[0][1]);
        for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i][0], stroke[i][1]);
        }
        ctx.fill();
    };

    const redrawStatic = useCallback((pathsToRender: DrawnPath[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!staticCanvasRef.current) {
            staticCanvasRef.current = document.createElement('canvas');
        }

        const sc = staticCanvasRef.current;
        sc.width = canvas.width;
        sc.height = canvas.height;
        const sctx = sc.getContext('2d');
        if (!sctx) return;

        sctx.clearRect(0, 0, sc.width, sc.height);
        pathsToRender.forEach(path => renderPath(sctx, path, sc.width, sc.height));
        isDirtyRef.current = true;
    }, []);

    // NEW: Incremental Append (Zero-Latency)
    const appendToStatic = useCallback((path: DrawnPath) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!staticCanvasRef.current) {
            staticCanvasRef.current = document.createElement('canvas');
            staticCanvasRef.current.width = canvas.width;
            staticCanvasRef.current.height = canvas.height;
        }

        const sctx = staticCanvasRef.current.getContext('2d');
        if (!sctx) return;

        renderPath(sctx, path, staticCanvasRef.current.width, staticCanvasRef.current.height);
        isDirtyRef.current = true;
    }, []);

    const redrawPage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw static layer
        if (staticCanvasRef.current) {
            ctx.drawImage(staticCanvasRef.current, 0, 0);
        }

        // Draw current path in progress
        if (isDrawingRef.current && currentPathRef.current.length > 0) {
            renderPath(ctx, {
                points: currentPathRef.current,
                color: penColor,
                size: penSize,
                isEraser: isEraser
            }, canvas.width, canvas.height);
        }

        ctx.globalCompositeOperation = 'source-over';
        isDirtyRef.current = false;
    }, [penColor, penSize, isEraser]);

    // ── Animation Loop
    const animate = useCallback((time: number) => {
        if (isDirtyRef.current) {
            redrawPage();
        }
        requestRef.current = requestAnimationFrame(animate);
    }, [redrawPage]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [animate]);

    useEffect(() => {
        fitCanvas();
        redrawStatic(pages[currentPageIndex] || []);
        redrawPage();
    }, [currentPageIndex, isEnlarged, fitCanvas, redrawStatic, redrawPage]);

    // ── Gesture State
    const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

    // Bind gestures (touch/finger only — pen is handled separately)
    useGesture(
        {
            onDrag: ({ offset: [x, y], event }) => {
                if ((event as any).pointerType === 'touch') {
                    setCanvasTransform(t => ({ ...t, x, y }));
                }
            },
            onPinch: ({ offset: [d, a], event }) => {
                if ((event as any).pointerType === 'touch') {
                    setCanvasTransform(t => ({ ...t, scale: Math.max(0.5, Math.min(4, d)) }));
                }
            },
        },
        {
            target: containerRef,
            drag: {
                from: () => [canvasTransform.x, canvasTransform.y],
                filterTaps: true,
                enabled: !isDrawingRef.current,
            },
            pinch: {
                from: () => [canvasTransform.scale, 0],
                enabled: !isDrawingRef.current,
            },
        }
    );

    // ── Global gesture/selection suppression (WebKit / iPad Chrome)
    useEffect(() => {
        const prevent = (e: Event) => e.preventDefault();
        // Only prevent touchmove if we are actually drawing
        const preventTouch = (e: TouchEvent) => {
            if (isDrawingRef.current) e.preventDefault();
        };
        document.addEventListener('gesturestart', prevent, { passive: false });
        document.addEventListener('gesturechange', prevent, { passive: false });
        document.addEventListener('gestureend', prevent, { passive: false });
        document.addEventListener('touchmove', preventTouch, { passive: false });
        return () => {
            document.removeEventListener('gesturestart', prevent);
            document.removeEventListener('gesturechange', prevent);
            document.removeEventListener('gestureend', prevent);
            document.removeEventListener('touchmove', preventTouch);
        };
    }, []);

    // ── Writing Restriction Check (Only first page has bounds)
    const isInWritingArea = (pos: { x: number, y: number }) => {
        return true; // Doctors can now draw everywhere (strike out vitals, etc.)
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
        e.preventDefault();

        // Only handle Apple Pencil (pen) input
        if (e.pointerType !== 'pen') return;

        // If another pen stroke is already active, ignore
        if (isDrawingRef.current) return;

        const pos = getCanvasPos(e.clientX, e.clientY);
        if (!isInWritingArea(pos)) return;

        // Capture all future events for this pointer (critical for iPad Chrome)
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        activePointerIdRef.current = e.pointerId;

        isDrawingRef.current = true;
        const pressure = e.pressure || 0.5;
        currentPathRef.current = [{ ...pos, pressure }];
        isDirtyRef.current = true;
    };

    const onPointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

        // Only track the active pen pointer
        if (e.pointerType !== 'pen') return;
        if (!isDrawingRef.current) return;
        if (e.pointerId !== activePointerIdRef.current) return;

        // Process all coalesced (high-frequency) events for smooth strokes
        const coalescedEvents = (e.nativeEvent as any).getCoalescedEvents
            ? (e.nativeEvent as any).getCoalescedEvents()
            : [e.nativeEvent];

        for (const ce of coalescedEvents) {
            const cPos = getCanvasPos(ce.clientX, ce.clientY);
            currentPathRef.current.push({ ...cPos, pressure: ce.pressure || 0.5 });
        }

        isDirtyRef.current = true;
    };

    // Shared commit logic for pointerup / pointercancel / pointerleave
    const commitStroke = (e?: React.PointerEvent) => {
        if (e && e.pointerType !== 'pen') return;

        // Always reset drawing state immediately (critical for pointercancel)
        const wasDrawing = isDrawingRef.current;
        isDrawingRef.current = false;
        activePointerIdRef.current = null;

        if (wasDrawing && currentPathRef.current.length > 0) {
            const newPath = {
                points: [...currentPathRef.current],
                color: penColor,
                size: isEraser ? eraserSize : penSize,
                isEraser: isEraser,
            };
            const updatedPages = [...pages];
            updatedPages[currentPageIndex] = [...(updatedPages[currentPageIndex] || []), newPath];

            appendToStatic(newPath);
            setPages(updatedPages);

            const newHistory = history.slice(0, historyStep + 1);
            newHistory.push(updatedPages);
            setHistory(newHistory);
            setHistoryStep(newHistory.length - 1);
        }

        currentPathRef.current = [];
        lastTouchDistanceRef.current = null;
        isDirtyRef.current = true;
    };

    const onPointerUp = (e?: React.PointerEvent) => commitStroke(e);
    const onPointerCancel = (e: React.PointerEvent) => {
        // Immediately discard any in-progress stroke — do NOT commit it
        isDrawingRef.current = false;
        activePointerIdRef.current = null;
        currentPathRef.current = [];
        lastTouchDistanceRef.current = null;
        isDirtyRef.current = true;
    };

    const handleUndo = () => {
        if (historyStep > 0) {
            const nextStep = historyStep - 1;
            setHistoryStep(nextStep);
            setPages(history[nextStep]);
            redrawStatic(history[nextStep][currentPageIndex] || []);
            isDirtyRef.current = true;
        }
    };

    const handleRedo = () => {
        if (historyStep < history.length - 1) {
            const nextStep = historyStep + 1;
            setHistoryStep(nextStep);
            setPages(history[nextStep]);
            redrawStatic(history[nextStep][currentPageIndex] || []);
            isDirtyRef.current = true;
        }
    };

    const handleClear = () => {
        const updatedPages = [...pages];
        updatedPages[currentPageIndex] = [];
        setPages(updatedPages);

        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(updatedPages);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);

        redrawStatic([]); // Manual redraw for clear
        isDirtyRef.current = true;
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
            redrawStatic(pages[i]);
            redrawPage();
            images.push(canvas.toDataURL('image/png', 1.0));
        }

        // Return to current page state for UI
        redrawStatic(pages[currentPageIndex]);
        redrawPage();
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
            <div className="bg-white border-b px-2 py-2 md:px-4 md:py-3 flex flex-wrap items-center justify-between gap-y-2 shrink-0 drop-shadow-md sticky top-0 z-50 rounded-t-xl">
                <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-wrap">
                    <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8 md:h-10 md:w-10"><X className="w-5 h-5" /></Button>

                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={historyStep === 0} className="h-8">
                            <Undo className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRedo} disabled={historyStep === history.length - 1} className="h-8">
                            <Redo className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={pages[currentPageIndex]?.length === 0} className="h-8 text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1 md:gap-1.5 bg-slate-100 p-0.5 rounded-lg flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1">
                            <Button
                                variant={!isEraser ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsEraser(false)}
                                className={`h-8 w-8 p-0 ${!isEraser ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
                            >
                                <PenTool className={`w-4 h-4 ${!isEraser ? 'text-blue-600' : 'text-slate-600'}`} />
                            </Button>
                            <Button
                                variant={isEraser ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsEraser(true)}
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
                        </div>

                        <div className="flex items-center gap-2 px-2 border-l border-slate-200 h-6">
                            <span className="text-[10px] font-bold text-slate-400 w-4">{isEraser ? eraserSize : penSize}</span>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={isEraser ? eraserSize : penSize}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (isEraser) setEraserSize(val);
                                    else setPenSize(val);
                                }}
                                className="w-12 md:w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>


                </div>

                <div className="flex items-center gap-2 ml-auto pl-2">
                    <div className="hidden sm:flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                        <span className="text-[10px] font-bold text-slate-500">{Math.round(canvasTransform.scale * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}>
                            <Settings2 className="w-2.5 h-2.5" />
                        </Button>
                    </div>
                    <Button size="sm" onClick={handleSave} className="h-8 md:h-9 px-3 md:px-4 bg-sky-600 hover:bg-sky-700 text-white shadow-lg shrink-0">
                        <Save className="w-4 h-4 mr-1 md:mr-2" /> <span className="text-xs md:text-sm">Save</span>
                    </Button>
                </div>
            </div>

            {/* ── Main Canvas Area */}
            <div
                ref={scrollContainerRef}
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    background: '#0f172a',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    touchAction: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                    overscrollBehavior: 'none',
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
                        transform: `translate3d(${canvasTransform.x}px, ${canvasTransform.y}px, 0) scale(${canvasTransform.scale})`,
                        transformOrigin: 'top center',
                        touchAction: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                        overscrollBehavior: 'none',
                    }}
                >
                    <div style={{
                        position: 'absolute', inset: 0,
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                    }}>
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
                        tabIndex={-1}
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            zIndex: 20, cursor: 'crosshair', touchAction: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            WebkitTouchCallout: 'none',
                        }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                        onPointerCancel={onPointerCancel}
                    />
                </div>
            </div>

            {/* ── Pagination Bottom Bar */}
            <div
                className="bg-white/90 backdrop-blur border-t px-6 py-4 flex items-center justify-between shrink-0 rounded-b-xl shadow-2xl"
                style={{
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}
            >
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
