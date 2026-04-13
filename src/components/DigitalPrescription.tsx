import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { 
    Maximize2, Minimize2, Trash2, Save, Undo, Redo, X, 
    Eraser, PenTool, Circle, Plus, ChevronLeft, ChevronRight, 
    Tablet, Settings2, AlertTriangle 
} from 'lucide-react';
import PrescriptionTemplate from './PrescriptionTemplate';
import { getStroke } from 'perfect-freehand';
import { useGesture } from '@use-gesture/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    const [penColor, setPenColor] = useState('#00009F');
    const [penSize, setPenSize] = useState(1);
    const [eraserSize, setEraserSize] = useState(7);
    const [isEraser, setIsEraser] = useState(false);
    const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
    const [isPointerInCanvas, setIsPointerInCanvas] = useState(false);



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

        // Restore Palm Rejection: Strictly ONLY allow Stylus/Pen for drawing. 
        // This ensures fingers can still be used for Pinch-to-zoom gestures.
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

        // Restore palm rejection: Only track the active pen
        if (e.pointerType !== 'pen') return;
        if (!isDrawingRef.current) return;
        if (e.pointerId !== activePointerIdRef.current) return;

        // Track pointer for Eraser Cursor
        setPointerPos({ x: e.clientX, y: e.clientY });

        // Process all coalesced (high-frequency) events for smooth strokes
        const coalescedEvents = (e.nativeEvent as any).getCoalescedEvents
            ? (e.nativeEvent as any).getCoalescedEvents()
            : [e.nativeEvent];

        for (const ce of coalescedEvents) {
            const cPos = getCanvasPos(ce.clientX, ce.clientY);
            currentPathRef.current.push({ ...cPos, pressure: ce.pressure || 0.5 });
        }

        setPointerPos({ x: e.clientX, y: e.clientY });
        isDirtyRef.current = true;
    };

    const handlePointerMoveGlobal = (e: React.PointerEvent) => {
        // No longer tracking global moves to prevent state churn and gesture interference
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
        // Use a functional update to ensure we have the latest state and avoid closure issues
        setPages(prevPages => {
            const updated = [...prevPages];
            updated[currentPageIndex] = [];
            
            // Sync history
            setHistory(prevHistory => {
                const newHistory = prevHistory.slice(0, historyStep + 1);
                newHistory.push(updated);
                setHistoryStep(newHistory.length - 1);
                return newHistory;
            });

            return updated;
        });

        // Use requestAnimationFrame to ensure the state update has propagated if needed
        requestAnimationFrame(() => {
            redrawStatic([]);
            isDirtyRef.current = true;
        });
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

    return createPortal(
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000, // Very high z-index to stay on top
                background: '#ffffff',
                display: 'flex', flexDirection: 'column',
                padding: 0,
            }}
            onWheel={handleWheel}
        >
            {/* ── Eraser Cursor Overly */}
            {isEraser && isPointerInCanvas && (
                <div 
                    style={{
                        position: 'fixed',
                        left: pointerPos.x,
                        top: pointerPos.y,
                        width: eraserSize * 5 * canvasTransform.scale * (800 / 1240), // Approximating canvas to screen scale
                        height: eraserSize * 5 * canvasTransform.scale * (800 / 1240),
                        border: '2px solid rgba(255, 255, 255, 0.5)',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        zIndex: 200,
                        boxShadow: '0 0 10px rgba(0,0,0,0.2)'
                    }}
                />
            )}
            {/* ── Toolbar (Hidden on Mobile) */}
            <div className="hidden md:flex bg-white border-b border-border px-4 py-3 items-center justify-between gap-y-2 shrink-0 shadow-sm sticky top-0 z-50 rounded-t-xl">
                <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-wrap">
                    <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8 md:h-10 md:w-10 text-foreground hover:bg-muted"><X className="w-5 h-5" /></Button>

                    <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg shrink-0">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={historyStep === 0} className="h-8 text-foreground disabled:opacity-30">
                            <Undo className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRedo} disabled={historyStep === history.length - 1} className="h-8 text-foreground disabled:opacity-30">
                            <Redo className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={pages[currentPageIndex]?.length === 0} className="h-8 text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl z-[1000]">
                                <AlertDialogHeader>
                                    <div className="flex items-center gap-3 text-red-600 mb-2">
                                        <AlertTriangle className="w-6 h-6" />
                                        <AlertDialogTitle className="text-xl font-black">Clear Prescription?</AlertDialogTitle>
                                    </div>
                                    <AlertDialogDescription className="text-slate-500 font-bold">
                                        This will permanently delete all your drawings on this page. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2 sm:gap-0">
                                    <AlertDialogCancel className="rounded-full font-bold border-slate-200">Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={handleClear}
                                        className="rounded-full font-black uppercase tracking-widest text-[10px] bg-red-600 hover:bg-red-700 text-white px-6"
                                    >
                                        Yes, Clear Page
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    <div className="flex items-center gap-1 md:gap-1.5 bg-muted p-0.5 rounded-lg flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1">
                            <Button
                                variant={!isEraser ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsEraser(false)}
                                className={`h-8 w-8 p-0 ${!isEraser ? 'bg-background shadow-sm ring-1 ring-border' : ''} text-foreground`}
                            >
                                <PenTool className={`w-4 h-4 ${!isEraser ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button
                                variant={isEraser ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsEraser(true)}
                                className={`h-8 w-8 p-0 ${isEraser ? 'bg-background shadow-sm ring-1 ring-border' : ''} text-foreground`}
                            >
                                <Eraser className={`w-4 h-4 ${isEraser ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            </Button>

                            {!isEraser && (
                                <input
                                    type="color"
                                    value={penColor}
                                    onChange={(e) => setPenColor(e.target.value)}
                                    className="w-7 h-7 p-0 border-0 rounded-md cursor-pointer ring-1 ring-border bg-transparent"
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2 px-2 border-l border-border h-6">
                            <span className="text-[10px] font-bold text-muted-foreground w-4">{isEraser ? eraserSize : penSize}</span>
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
                                className="w-12 md:w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>


                </div>

                <div className="flex items-center gap-2 ml-auto pl-2">
                    <div className="hidden sm:flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                        <span className="text-[10px] font-bold text-muted-foreground">{Math.round(canvasTransform.scale * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}>
                            <Settings2 className="w-2.5 h-2.5" />
                        </Button>
                    </div>
                    <Button size="sm" onClick={handleSave} className="h-8 md:h-9 px-3 md:px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shrink-0 font-bold">
                        <Save className="w-4 h-4 mr-1 md:mr-2" /> <span className="text-xs md:text-sm">Save</span>
                    </Button>
                </div>
            </div>

            {/* ── Main Canvas Area */}
            <div
                ref={scrollContainerRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0', 
                    touchAction: 'pan-y pinch-zoom', // Allow native-like scroll and zoom
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}
            >
                <div
                    ref={containerRef}
                    style={{
                        width: '100vw',
                        minHeight: '1130px', // Force A4 height to ensure scrolling
                        aspectRatio: '1 / 1.414',
                        position: 'relative',
                        flexShrink: 0,
                        boxShadow: 'none',
                        transform: `translate3d(${canvasTransform.x}px, ${canvasTransform.y}px, 0) scale(${canvasTransform.scale})`,
                        transformOrigin: 'top center',
                        touchAction: 'none', // Drawing area still needs touchAction: none
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
                        onPointerLeave={(e) => {
                            onPointerUp(e);
                            setIsPointerInCanvas(false);
                        }}
                        onPointerEnter={() => setIsPointerInCanvas(true)}
                        onPointerCancel={onPointerCancel}
                    />
                </div>
            </div>

            {/* ── Floating Mobile Controls (Show only on Mobile) */}
            <div className="md:hidden fixed top-6 right-6 flex flex-col gap-4 z-[70]">
                <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={onClose} 
                    className="h-12 w-12 rounded-full shadow-2xl bg-background/90 backdrop-blur border border-border"
                >
                    <X className="w-6 h-6 text-foreground" />
                </Button>
                <Button 
                    variant="default" 
                    size="icon" 
                    onClick={handleSave} 
                    className="h-12 w-12 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700"
                >
                    <Save className="w-6 h-6 text-white" />
                </Button>
                {pages.length > 1 && (
                    <div className="h-12 w-12 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center text-xs font-black shadow-lg">
                        {currentPageIndex + 1}/{pages.length}
                    </div>
                )}
            </div>

            {/* ── Pagination Bottom Bar (Hidden on Mobile) */}
            <div
                className="hidden md:flex bg-background/90 dark:bg-slate-900/95 backdrop-blur border-t border-border px-6 py-4 items-center justify-between shrink-0 rounded-b-xl shadow-2xl"
                style={{
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Button
                            variant="ghost" size="sm"
                            disabled={currentPageIndex === 0}
                            onClick={() => setCurrentPageIndex(p => p - 1)}
                            className="h-8 w-8 p-0 text-foreground"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="px-3 text-sm font-bold text-foreground">
                            Page {currentPageIndex + 1} of {pages.length}
                        </span>
                        <Button
                            variant="ghost" size="sm"
                            disabled={currentPageIndex === pages.length - 1}
                            onClick={() => setCurrentPageIndex(p => p + 1)}
                            className="h-8 w-8 p-0 text-foreground"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                    {pages.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={deleteCurrentPage} className="text-red-500 hover:text-red-600 h-8 font-bold">
                            Delete Page
                        </Button>
                    )}
                </div>

                <Button onClick={addPage} className="bg-primary text-white h-9 px-5 gap-2 rounded-full shadow-lg">
                    <Plus className="w-4 h-4" /> Add Page
                </Button>
            </div>
        </div>,
        document.body
    );
}

// Helper for conditional classes if not already imported
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
