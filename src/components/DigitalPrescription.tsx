import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { 
    Maximize2, Minimize2, Trash2, Save, Undo, Redo, X, 
    Eraser, PenTool, Circle, Plus, ChevronLeft, ChevronRight, 
    Tablet, Settings2, AlertTriangle, Scissors, Copy, ClipboardPaste, BookOpen, GripVertical 
} from 'lucide-react';
import PrescriptionTemplate from './PrescriptionTemplate';
import { getStroke } from 'perfect-freehand';
import { polygonContains } from 'd3-polygon';
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
    onPathsChange?: (pages: any[][]) => void;
    onClose: () => void;
}

export default function DigitalPrescription({ patient, visit, initialPaths = [], initialPages, onSave, onPathsChange, onClose }: DigitalPrescriptionProps) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

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
    const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
    const [isPointerInCanvas, setIsPointerInCanvas] = useState(false);

    // Draggable Floating Toolbar State
    const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 185 });
    const isDraggingToolbarRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const dashOffsetRef = useRef(0);

    const handleToolbarPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        const dragHandle = target.closest('.drag-handle');
        if (!dragHandle) return;
        
        isDraggingToolbarRef.current = true;
        dragStartRef.current = { x: e.clientX - toolbarPos.x, y: e.clientY - toolbarPos.y };
        dragHandle.setPointerCapture(e.pointerId);
    };

    const handleToolbarPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingToolbarRef.current) return;
        setToolbarPos({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleToolbarPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingToolbarRef.current) return;
        isDraggingToolbarRef.current = false;
        const target = e.target as HTMLElement;
        const dragHandle = target.closest('.drag-handle');
        if (dragHandle) {
            try { dragHandle.releasePointerCapture(e.pointerId); } catch {}
        }
    };

    // Lasso and Selection State
    const [toolMode, setToolMode] = useState<'pen' | 'eraser' | 'lasso' | 'select'>('pen');
    const isEraser = toolMode === 'eraser';
    const [lassoPath, setLassoPath] = useState<{x: number, y: number}[]>([]);
    const [selectedPathIndices, setSelectedPathIndices] = useState<number[]>([]);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [dragStartPos, setDragStartPos] = useState({x: 0, y: 0});
    const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
    const [savedProtocols, setSavedProtocols] = useState<{name: string, paths: any[]}[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('handwritten_protocols') || '[]');
        } catch {
            return [];
        }
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const actionsMenuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



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
            if (toolMode === 'lasso') {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -dashOffsetRef.current;
                ctx.beginPath();
                ctx.moveTo(currentPathRef.current[0].x * canvas.width, currentPathRef.current[0].y * canvas.height);
                for(let i=1; i<currentPathRef.current.length; i++) {
                    ctx.lineTo(currentPathRef.current[i].x * canvas.width, currentPathRef.current[i].y * canvas.height);
                }
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.lineDashOffset = 0;
            } else if (toolMode === 'pen' || toolMode === 'eraser') {
                renderPath(ctx, {
                    points: currentPathRef.current,
                    color: penColor,
                    size: toolMode === 'eraser' ? eraserSize : penSize,
                    isEraser: toolMode === 'eraser'
                }, canvas.width, canvas.height);
            }
        }
        
        // Draw selection highlight and dragged paths
        if (selectedPathIndices.length > 0) {
            // Draw dragged paths
            if (isDraggingSelection) {
               ctx.clearRect(0,0, canvas.width, canvas.height);
               if (staticCanvasRef.current) ctx.drawImage(staticCanvasRef.current, 0, 0);
               
               // Re-clear selected original paths by using globalCompositeOperation
               ctx.globalCompositeOperation = 'destination-out';
               selectedPathIndices.forEach(idx => {
                   const path = pages[currentPageIndex][idx];
                   if(path) renderPath(ctx, {...path, isEraser: false, size: path.size + 2}, canvas.width, canvas.height);
               });
               ctx.globalCompositeOperation = 'source-over';
               
               // Draw them at offset
               selectedPathIndices.forEach(idx => {
                   const path = pages[currentPageIndex][idx];
                   if(path) {
                       const offsetPath = {
                           ...path,
                           points: path.points.map(p => ({x: p.x + dragOffset.x, y: p.y + dragOffset.y}))
                       };
                       renderPath(ctx, offsetPath, canvas.width, canvas.height);
                   }
               });
            }
            
            // Draw Bounding Box
            let minX=1, minY=1, maxX=0, maxY=0;
            let hasPoints = false;
            selectedPathIndices.forEach(idx => {
               const path = pages[currentPageIndex][idx];
               if(path) {
                   path.points.forEach(p => {
                       const x = p.x + (isDraggingSelection ? dragOffset.x : 0);
                       const y = p.y + (isDraggingSelection ? dragOffset.y : 0);
                       if(!hasPoints) { minX=x; maxX=x; minY=y; maxY=y; hasPoints=true; }
                       if(x < minX) minX = x;
                       if(x > maxX) maxX = x;
                       if(y < minY) minY = y;
                       if(y > maxY) maxY = y;
                   });
               }
            });
            if (hasPoints) {
                ctx.strokeStyle = '#ec4899'; // pink
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.lineDashOffset = -dashOffsetRef.current;
                ctx.strokeRect(minX*canvas.width - 5, minY*canvas.height - 5, (maxX-minX)*canvas.width + 10, (maxY-minY)*canvas.height + 10);
                ctx.setLineDash([]);
                ctx.lineDashOffset = 0;
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        isDirtyRef.current = false;
    }, [penColor, penSize, isEraser]);

    // ── Animation Loop
    const animate = useCallback((time: number) => {
        if (selectedPathIndices.length > 0 || (isDrawingRef.current && toolMode === 'lasso')) {
            dashOffsetRef.current = (dashOffsetRef.current + 0.3) % 10;
            isDirtyRef.current = true;
        }
        if (isDirtyRef.current) {
            redrawPage();
        }
        requestRef.current = requestAnimationFrame(animate);
    }, [redrawPage, selectedPathIndices, toolMode]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [animate]);

    useEffect(() => {
        if (!mounted) return;
        fitCanvas();
        redrawStatic(pages[currentPageIndex] || []);
        redrawPage();
    }, [mounted, currentPageIndex, isEnlarged, fitCanvas, redrawStatic, redrawPage]);

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
        if (e.pointerType !== 'pen' && toolMode !== 'lasso' && toolMode !== 'select' && toolMode !== 'eraser') return;

        setIsPointerInCanvas(true);

        const pos = getCanvasPos(e.clientX, e.clientY);
        
        if (toolMode === 'select' && selectedPathIndices.length > 0) {
            setDragStartPos(pos);
            setIsDraggingSelection(true);
            isDrawingRef.current = false;
            return;
        }

        // If another pen stroke is already active, ignore
        if (isDrawingRef.current) return;
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
        if (e.pointerType !== 'pen' && toolMode !== 'lasso' && toolMode !== 'select' && toolMode !== 'eraser') return;
        
        setIsPointerInCanvas(true);
        const pos = getCanvasPos(e.clientX, e.clientY);
        setPointerPos({ x: e.clientX, y: e.clientY });
        
        if (toolMode === 'select' && isDraggingSelection) {
            setDragOffset({
                x: pos.x - dragStartPos.x,
                y: pos.y - dragStartPos.y
            });
            isDirtyRef.current = true;
            return;
        }

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

    const handlePointerMoveGlobal = (e: React.PointerEvent) => {
        // No longer tracking global moves to prevent state churn and gesture interference
    };

    // Shared commit logic for pointerup / pointercancel / pointerleave
    const commitStroke = (e?: React.PointerEvent) => {
        if (e && e.pointerType !== 'pen' && toolMode !== 'lasso' && toolMode !== 'select' && toolMode !== 'eraser') return;

        if (toolMode === 'select' && isDraggingSelection) {
            setIsDraggingSelection(false);
            if (dragOffset.x !== 0 || dragOffset.y !== 0) {
                const updatedPages = [...pages];
                const page = [...updatedPages[currentPageIndex]];
                selectedPathIndices.forEach(idx => {
                    page[idx] = {
                        ...page[idx],
                        points: page[idx].points.map((p) => ({
                            ...p,
                            x: p.x + dragOffset.x,
                            y: p.y + dragOffset.y
                        }))
                    };
                });
                updatedPages[currentPageIndex] = page;
                setPages(updatedPages);
                
                const newHistory = history.slice(0, historyStep + 1);
                newHistory.push(updatedPages);
                setHistory(newHistory);
                setHistoryStep(newHistory.length - 1);
                
                if (onPathsChange) onPathsChange(updatedPages);
                redrawStatic(page);
            }
            setDragOffset({x: 0, y: 0});
            isDirtyRef.current = true;
            return;
        }

        const wasDrawing = isDrawingRef.current;
        isDrawingRef.current = false;
        activePointerIdRef.current = null;

        if (wasDrawing && currentPathRef.current.length > 0) {
            if (toolMode === 'lasso') {
                const poly = currentPathRef.current.map(p => [p.x, p.y]);
                if (poly.length > 2) {
                    const newSelected = [];
                    (pages[currentPageIndex] || []).forEach((path, idx) => {
                        const isInside = path.points.some(p => polygonContains(poly, [p.x, p.y]));
                        if (isInside) newSelected.push(idx);
                    });
                    setSelectedPathIndices(newSelected);
                    if (newSelected.length > 0) setToolMode('select');
                }
            } else if (toolMode === 'pen' || toolMode === 'eraser') {
                const newPath = {
                    points: [...currentPathRef.current],
                    color: penColor,
                    size: toolMode === 'eraser' ? eraserSize : penSize,
                    isEraser: toolMode === 'eraser',
                };
                const updatedPages = [...pages];
                updatedPages[currentPageIndex] = [...(updatedPages[currentPageIndex] || []), newPath];

                appendToStatic(newPath);
                setPages(updatedPages);

                const newHistory = history.slice(0, historyStep + 1);
                newHistory.push(updatedPages);
                setHistory(newHistory);
                setHistoryStep(newHistory.length - 1);

                if (onPathsChange) {
                    onPathsChange(updatedPages);
                }
            }
        }

        currentPathRef.current = [];
        lastTouchDistanceRef.current = null;
        isDirtyRef.current = true;
    };

    const copySelection = () => {
        if (selectedPathIndices.length === 0) return;
        const selectedPaths = selectedPathIndices.map(idx => pages[currentPageIndex][idx]);
        
        const name = prompt("Name this handwritten protocol:");
        if (name) {
            const newProtocol = { name, paths: selectedPaths };
            const updated = [...savedProtocols, newProtocol];
            setSavedProtocols(updated);
            localStorage.setItem('handwritten_protocols', JSON.stringify(updated));
            setToolMode('pen');
            setSelectedPathIndices([]);
            isDirtyRef.current = true;
        }
    };

    const clearSelectedPaths = () => {
        if (selectedPathIndices.length === 0) return;
        const updatedPages = [...pages];
        const page = (updatedPages[currentPageIndex] || []).filter((_, idx) => !selectedPathIndices.includes(idx));
        updatedPages[currentPageIndex] = page;
        setPages(updatedPages);
        setSelectedPathIndices([]);
        setToolMode('pen');
        
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(updatedPages);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        
        if (onPathsChange) onPathsChange(updatedPages);
        redrawStatic(page);
        isDirtyRef.current = true;
    };

    const duplicateSelection = () => {
        if (selectedPathIndices.length === 0) return;
        const selectedPaths = selectedPathIndices.map(idx => pages[currentPageIndex][idx]);
        const duplicatedPaths = selectedPaths.map(path => ({
            ...path,
            points: path.points.map(p => ({ x: p.x + 0.03, y: p.y + 0.03 }))
        }));
        const updatedPages = [...pages];
        const startIdx = (updatedPages[currentPageIndex] || []).length;
        updatedPages[currentPageIndex] = [...(updatedPages[currentPageIndex] || []), ...duplicatedPaths];
        setPages(updatedPages);
        
        const newSelected = duplicatedPaths.map((_, i) => startIdx + i);
        setSelectedPathIndices(newSelected);
        
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(updatedPages);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        
        if (onPathsChange) onPathsChange(updatedPages);
        redrawStatic(updatedPages[currentPageIndex]);
        isDirtyRef.current = true;
    };

    const changeSelectionColor = (newColor: string) => {
        if (selectedPathIndices.length === 0) return;
        const updatedPages = [...pages];
        const page = [...updatedPages[currentPageIndex]];
        selectedPathIndices.forEach(idx => {
            if (page[idx]) {
                page[idx] = { ...page[idx], color: newColor };
            }
        });
        updatedPages[currentPageIndex] = page;
        setPages(updatedPages);
        
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(updatedPages);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        
        if (onPathsChange) onPathsChange(updatedPages);
        redrawStatic(page);
        isDirtyRef.current = true;
    };

    const scaleSelection = (factor: number) => {
        if (selectedPathIndices.length === 0) return;
        
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        let hasPoints = false;
        selectedPathIndices.forEach(idx => {
           const path = pages[currentPageIndex][idx];
           if(path) {
               path.points.forEach(p => {
                   if(!hasPoints) { minX = p.x; maxX = p.x; minY = p.y; maxY = p.y; hasPoints = true; }
                   if(p.x < minX) minX = p.x;
                   if(p.x > maxX) maxX = p.x;
                   if(p.y < minY) minY = p.y;
                   if(p.y > maxY) maxY = p.y;
               });
           }
        });
        if (!hasPoints) return;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const updatedPages = [...pages];
        const page = [...updatedPages[currentPageIndex]];
        selectedPathIndices.forEach(idx => {
            if (page[idx]) {
                page[idx] = {
                    ...page[idx],
                    points: page[idx].points.map(p => ({
                        ...p,
                        x: centerX + (p.x - centerX) * factor,
                        y: centerY + (p.y - centerY) * factor
                    }))
                };
            }
        });
        updatedPages[currentPageIndex] = page;
        setPages(updatedPages);
        
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(updatedPages);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        
        if (onPathsChange) onPathsChange(updatedPages);
        redrawStatic(page);
        isDirtyRef.current = true;
    };

    const pasteProtocol = (protocolPaths = []) => {
        const updatedPages = [...pages];
        const startIdx = (updatedPages[currentPageIndex] || []).length;
        updatedPages[currentPageIndex] = [...(updatedPages[currentPageIndex] || []), ...protocolPaths];
        setPages(updatedPages);
        
        const newSelected = protocolPaths.map((_, i) => startIdx + i);
        setSelectedPathIndices(newSelected);
        setToolMode('select');
        
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(updatedPages);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        
        redrawStatic(updatedPages[currentPageIndex]);
        isDirtyRef.current = true;
        
        if (onPathsChange) onPathsChange(updatedPages);
    };
    
    const unselect = () => {
        setSelectedPathIndices([]);
        setToolMode('pen');
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
            if (onPathsChange) onPathsChange(history[nextStep]);
        }
    };

    const handleRedo = () => {
        if (historyStep < history.length - 1) {
            const nextStep = historyStep + 1;
            setHistoryStep(nextStep);
            setPages(history[nextStep]);
            redrawStatic(history[nextStep][currentPageIndex] || []);
            isDirtyRef.current = true;
            if (onPathsChange) onPathsChange(history[nextStep]);
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

            if (onPathsChange) onPathsChange(updated);
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

    if (!mounted || typeof document === 'undefined') return null;

    return createPortal(
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000, // Very high z-index to stay on top
                background: '#f1f5f9',
                display: 'flex', flexDirection: 'column',
                padding: 0,
            }}
            onWheel={handleWheel}
        >
            {/* ── Eraser Cursor Overlay */}
            {isEraser && isPointerInCanvas && (() => {
                const getEraserSizeOnScreen = () => {
                    const canvas = canvasRef.current;
                    if (!canvas) return eraserSize * 5;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = rect.width / canvas.width;
                    return eraserSize * 5 * scaleX;
                };
                const sizeOnScreen = getEraserSizeOnScreen();
                return (
                    <div 
                        style={{
                            position: 'fixed',
                            left: pointerPos.x,
                            top: pointerPos.y,
                            width: sizeOnScreen,
                            height: sizeOnScreen,
                            border: '2px solid rgba(255, 255, 255, 0.75)',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 200,
                            boxShadow: '0 0 10px rgba(0,0,0,0.2)'
                        }}
                    />
                );
            })()}
            {/* ── Floating Draggable Canvas Toolbar (Hidden on Mobile, premium glassmorphism card on Desktop) */}
            <div 
                className="hidden md:flex fixed bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-border px-3 py-2 rounded-full items-center shadow-xl z-50 select-none touch-none ring-1 ring-black/5"
                style={{
                    transform: `translate3d(calc(-50% + ${toolbarPos.x}px), ${toolbarPos.y}px, 0)`,
                    left: '50%',
                    top: '0px',
                }}
                onPointerDown={handleToolbarPointerDown}
                onPointerMove={handleToolbarPointerMove}
                onPointerUp={handleToolbarPointerUp}
                onPointerCancel={handleToolbarPointerUp}
            >
                {/* Drag Handle */}
                <div className="drag-handle cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 border-r border-border mr-1.5 py-1">
                    <GripVertical className="w-4 h-4" />
                </div>

                <div className="flex items-center gap-1 md:gap-2 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8 text-foreground hover:bg-muted rounded-full"><X className="w-4 h-4" /></Button>

                    <div className="flex items-center gap-0.5 bg-muted/60 dark:bg-slate-800/60 p-0.5 rounded-full shrink-0">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={historyStep === 0} className="h-7 w-7 p-0 text-foreground disabled:opacity-30 rounded-full">
                            <Undo className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRedo} disabled={historyStep === history.length - 1} className="h-7 w-7 p-0 text-foreground disabled:opacity-30 rounded-full">
                            <Redo className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={pages[currentPageIndex]?.length === 0} className="h-7 w-7 p-0 text-red-600 rounded-full">
                                    <Trash2 className="w-3.5 h-3.5" />
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

                    <div className="flex items-center gap-1 md:gap-1.5 bg-muted/60 dark:bg-slate-800/60 p-0.5 rounded-full flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1">
                            <Button variant={toolMode === 'pen' ? "secondary" : "ghost"} size="sm" onClick={() => {setToolMode('pen'); setSelectedPathIndices([]);}} className={`h-8 w-8 p-0 ${toolMode==='pen' ? 'bg-background shadow-sm ring-1 ring-border' : ''} text-foreground`} title="Pen">
                                <PenTool className={`w-4 h-4 ${toolMode==='pen' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button variant={toolMode === 'eraser' ? "secondary" : "ghost"} size="sm" onClick={() => {setToolMode('eraser'); setSelectedPathIndices([]);}} className={`h-8 w-8 p-0 ${toolMode==='eraser' ? 'bg-background shadow-sm ring-1 ring-border' : ''} text-foreground`} title="Eraser">
                                <Eraser className={`w-4 h-4 ${toolMode==='eraser' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button variant={toolMode === 'lasso' ? "secondary" : "ghost"} size="sm" onClick={() => {setToolMode('lasso'); setSelectedPathIndices([]);}} className={`h-8 w-8 p-0 ${toolMode==='lasso' ? 'bg-background shadow-sm ring-1 ring-border' : ''} text-foreground`} title="Lasso Select">
                                <Scissors className={`w-4 h-4 ${toolMode==='lasso' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            </Button>
                            
                            {toolMode === 'select' && selectedPathIndices.length > 0 && (
                                <>
                                  <div className="w-[1px] h-4 bg-border mx-1" />
                                  
                                  {/* Clear Selection */}
                                  <Button variant="ghost" size="sm" onClick={clearSelectedPaths} className="h-8 text-red-650 font-bold bg-red-50 hover:bg-red-100 rounded-md" title="Clear selection">
                                      <Trash2 className="w-4 h-4 mr-1" /> Clear
                                  </Button>

                                  {/* Save Snippet */}
                                  <Button variant="ghost" size="sm" onClick={copySelection} className="h-8 text-pink-600 font-bold bg-pink-50 hover:bg-pink-100 rounded-md" title="Save snippet">
                                      <Copy className="w-4 h-4 mr-1" /> Save
                                  </Button>

                                  {/* Three Dots More Actions Menu */}
                                  <div className="relative font-bold text-sm text-foreground" ref={actionsMenuRef}>
                                      <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)} 
                                          className="h-8 w-8 p-0 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md"
                                          title="More actions"
                                      >
                                          <Settings2 className="w-4 h-4" />
                                      </Button>
                                      {isActionsMenuOpen && (
                                          <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xl p-2 z-[101]">
                                              <button 
                                                  onClick={() => { duplicateSelection(); setIsActionsMenuOpen(false); }} 
                                                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
                                              >
                                                  <Copy className="w-3.5 h-3.5" /> Duplicate
                                              </button>
                                              
                                              <div className="h-[1px] bg-border my-1" />
                                              
                                              <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase">Scale</div>
                                              <div className="flex gap-1 px-2 pb-1">
                                                  <button 
                                                      onClick={() => { scaleSelection(1.1); }} 
                                                      className="flex-1 text-center py-1 text-[10px] font-black bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded border border-border"
                                                  >
                                                      +10%
                                                  </button>
                                                  <button 
                                                      onClick={() => { scaleSelection(0.9); }} 
                                                      className="flex-1 text-center py-1 text-[10px] font-black bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded border border-border"
                                                  >
                                                      -10%
                                                  </button>
                                              </div>

                                              <div className="h-[1px] bg-border my-1" />
                                              
                                              <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase">Color</div>
                                              <div className="flex gap-1.5 px-3 py-1 justify-center">
                                                  {['#00009F', '#dc2626', '#16a34a', '#000000'].map((color) => (
                                                      <button
                                                          key={color}
                                                          onClick={() => { changeSelectionColor(color); setIsActionsMenuOpen(false); }}
                                                          className="w-4 h-4 rounded-full border border-black/10 shadow-sm shrink-0"
                                                          style={{ backgroundColor: color }}
                                                      />
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                  </div>

                                  <Button variant="ghost" size="sm" onClick={unselect} className="h-8 text-slate-500 hover:bg-slate-100 rounded-md">
                                      Done
                                  </Button>
                                </>
                            )}

                            {toolMode === 'pen' && (
                                <input
                                    type="color"
                                    value={penColor}
                                    onChange={(e) => setPenColor(e.target.value)}
                                    className="w-7 h-7 p-0 ml-1 border-0 rounded-md cursor-pointer ring-1 ring-border bg-transparent"
                                />
                            )}
                        </div>

                        {(toolMode === 'pen' || toolMode === 'eraser') && (
                            <div className="flex items-center gap-2 px-2 border-l border-border h-6">
                                <span className="text-[10px] font-bold text-muted-foreground w-4">{toolMode === 'eraser' ? eraserSize : penSize}</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={toolMode === 'eraser' ? eraserSize : penSize}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (toolMode === 'eraser') setEraserSize(val);
                                        else setPenSize(val);
                                    }}
                                    className="w-12 md:w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        )}
                        
                        {/* Saved Protocols Dropdown */}
                        <div className="border-l border-border pl-2 flex items-center">
                           <div className="relative" ref={dropdownRef}>
                               <Button variant="ghost" size="sm" onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="h-8 text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold rounded-md">
                                  <BookOpen className="w-4 h-4 mr-1" /> Snippets
                                </Button>
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-border rounded-xl shadow-xl p-2 z-[100]">
                                       {savedProtocols.length === 0 ? (
                                           <p className="text-xs text-muted-foreground p-2">No snippets saved. Use lasso to select and save.</p>
                                       ) : (
                                           savedProtocols.map((p, i) => (
                                               <div key={i} className="flex items-center justify-between hover:bg-slate-50 rounded-lg pr-1">
                                                   <button onClick={() => { pasteProtocol(p.paths); setIsDropdownOpen(false); }} className="flex-1 text-left px-3 py-2 text-sm font-bold text-slate-700">
                                                       {p.name}
                                                   </button>
                                                   <Button 
                                                       variant="ghost" 
                                                       size="icon" 
                                                       className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                       onClick={() => {
                                                           if (confirm('Delete this snippet?')) {
                                                               const updated = savedProtocols.filter((_, idx) => idx !== i);
                                                               setSavedProtocols(updated);
                                                               localStorage.setItem('handwritten_protocols', JSON.stringify(updated));
                                                           }
                                                       }}
                                                   >
                                                       <Trash2 className="w-3.5 h-3.5" />
                                                   </Button>
                                               </div>
                                           ))
                                       )}
                                    </div>
                                )}
                           </div>
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
                    background: '#f1f5f9',
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
