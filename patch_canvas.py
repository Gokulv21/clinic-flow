import re

with open('src/components/DigitalPrescription.tsx', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')


# 1. Imports
code = code.replace(
    "import { getStroke } from 'perfect-freehand';",
    "import { getStroke } from 'perfect-freehand';\nimport { polygonContains } from 'd3-polygon';"
)
code = code.replace(
    "Tablet, Settings2, AlertTriangle",
    "Tablet, Settings2, AlertTriangle, Scissors, Copy, ClipboardPaste, BookOpen"
)

# 2. State
state_str = """    const [penColor, setPenColor] = useState('#00009F');
    const [penSize, setPenSize] = useState(1);
    const [eraserSize, setEraserSize] = useState(7);
    const [isEraser, setIsEraser] = useState(false);
    const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
    const [isPointerInCanvas, setIsPointerInCanvas] = useState(false);"""
    
new_state_str = state_str + """

    // Lasso and Selection State
    const [toolMode, setToolMode] = useState<'pen' | 'eraser' | 'lasso' | 'select'>('pen');
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
"""
code = code.replace(state_str, new_state_str)

# 3. Render modifications
redraw_page = """        // Draw current path in progress
        if (isDrawingRef.current && currentPathRef.current.length > 0) {
            renderPath(ctx, {
                points: currentPathRef.current,
                color: penColor,
                size: penSize,
                isEraser: isEraser
            }, canvas.width, canvas.height);
        }"""
        
new_redraw_page = """        // Draw current path in progress
        if (isDrawingRef.current && currentPathRef.current.length > 0) {
            if (toolMode === 'lasso') {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(currentPathRef.current[0].x * canvas.width, currentPathRef.current[0].y * canvas.height);
                for(let i=1; i<currentPathRef.current.length; i++) {
                    ctx.lineTo(currentPathRef.current[i].x * canvas.width, currentPathRef.current[i].y * canvas.height);
                }
                ctx.stroke();
                ctx.setLineDash([]);
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
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(minX*canvas.width - 5, minY*canvas.height - 5, (maxX-minX)*canvas.width + 10, (maxY-minY)*canvas.height + 10);
                ctx.setLineDash([]);
            }
        }"""
code = code.replace(redraw_page, new_redraw_page)

# 4. Pointer Events
pointer_down = """    const onPointerDown = (e: React.PointerEvent) => {
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
    };"""

new_pointer_down = """    const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();

        // Allow mouse for testing, otherwise stylus
        if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

        const pos = getCanvasPos(e.clientX, e.clientY);
        
        if (toolMode === 'select' && selectedPathIndices.length > 0) {
            setDragStartPos(pos);
            setIsDraggingSelection(true);
            isDrawingRef.current = false;
            return;
        }

        if (isDrawingRef.current) return;
        if (!isInWritingArea(pos)) return;

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        activePointerIdRef.current = e.pointerId;

        isDrawingRef.current = true;
        const pressure = e.pointerType === 'mouse' ? 0.5 : (e.pressure || 0.5);
        currentPathRef.current = [{ ...pos, pressure }];
        isDirtyRef.current = true;
    };"""
code = code.replace(pointer_down, new_pointer_down)


pointer_move = """    const onPointerMove = (e: React.PointerEvent) => {
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
    };"""

new_pointer_move = """    const onPointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

        if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
        
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

        const coalescedEvents = (e.nativeEvent as any).getCoalescedEvents
            ? (e.nativeEvent as any).getCoalescedEvents()
            : [e.nativeEvent];

        for (const ce of coalescedEvents) {
            const cPos = getCanvasPos(ce.clientX, ce.clientY);
            currentPathRef.current.push({ ...cPos, pressure: e.pointerType === 'mouse' ? 0.5 : (ce.pressure || 0.5) });
        }
        isDirtyRef.current = true;
    };"""
code = code.replace(pointer_move, new_pointer_move)

commit_stroke = """    // Shared commit logic for pointerup / pointercancel / pointerleave
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

            // Notify parent of changes
            if (onPathsChange) {
                onPathsChange(updatedPages);
            }
        }

        currentPathRef.current = [];
        lastTouchDistanceRef.current = null;
        isDirtyRef.current = true;
    };"""

new_commit_stroke = """    // Shared commit logic for pointerup / pointercancel / pointerleave
    const commitStroke = (e?: React.PointerEvent) => {
        if (e && e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

        if (toolMode === 'select' && isDraggingSelection) {
            setIsDraggingSelection(false);
            if (dragOffset.x !== 0 || dragOffset.y !== 0) {
                const updatedPages = [...pages];
                const page = [...updatedPages[currentPageIndex]];
                selectedPathIndices.forEach(idx => {
                    page[idx] = {
                        ...page[idx],
                        points: page[idx].points.map((p: any) => ({
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
                const poly = currentPathRef.current.map(p => [p.x, p.y]) as [number, number][];
                if (poly.length > 2) {
                    const newSelected: number[] = [];
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

    const pasteProtocol = (protocolPaths: any[]) => {
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
    }"""
code = code.replace(commit_stroke, new_commit_stroke)


# 5. UI Updates
toolbar = """                        <div className="flex items-center gap-1">
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
                        </div>"""
                        
new_toolbar = """                        <div className="flex items-center gap-1">
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
                                  <Button variant="ghost" size="sm" onClick={copySelection} className="h-8 text-pink-600 font-bold bg-pink-50" title="Save snippet">
                                      <Copy className="w-4 h-4 mr-1" /> Save
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={unselect} className="h-8 text-slate-500">
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
                           <div className="group relative">
                               <Button variant="ghost" size="sm" className="h-8 text-blue-600 bg-blue-50 font-bold">
                                  <BookOpen className="w-4 h-4 mr-1" /> Snippets
                               </Button>
                               <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-border rounded-xl shadow-xl p-2 hidden group-hover:block z-[100]">
                                  {savedProtocols.length === 0 ? (
                                      <p className="text-xs text-muted-foreground p-2">No snippets saved. Use lasso to select and save.</p>
                                  ) : (
                                      savedProtocols.map((p, i) => (
                                          <button key={i} onClick={() => pasteProtocol(p.paths)} className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-slate-50 rounded-lg text-slate-700">
                                              {p.name}
                                          </button>
                                      ))
                                  )}
                               </div>
                           </div>
                        </div>"""
code = code.replace(toolbar, new_toolbar)

with open('src/components/DigitalPrescription.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done!')
