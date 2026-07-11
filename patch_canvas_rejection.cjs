const fs = require('fs');

let code = fs.readFileSync('src/components/DigitalPrescription.tsx', 'utf8');

// 1. Add dropdownRef and isDropdownOpen state
const stateRegex = /\/\/\s*Lasso\s+and\s+Selection\s+State\s*\r?\n\s*const\s*\[toolMode,\s*setToolMode\s*\][^]*?\}\);\s*\r?\n/;
const stateMatch = code.match(stateRegex);
if (stateMatch) {
    const newState = stateMatch[0] + `
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
`;
    code = code.replace(stateRegex, newState);
} else {
    console.error("State match failed!");
    process.exit(1);
}

// 2. Fix redrawPage dependency array
const redrawPageRegex = /const\s+redrawPage\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?isDirtyRef\.current\s*=\s*false;\s*\},[^]*?\);/;
const redrawPageMatch = code.match(redrawPageRegex);
if (redrawPageMatch) {
    const originalRedraw = redrawPageMatch[0];
    const newRedraw = originalRedraw.replace(
        /\},\s*\[penColor,\s*penSize,\s*isEraser\]\);/,
        `}, [penColor, penSize, toolMode, isDraggingSelection, dragOffset, selectedPathIndices, pages, currentPageIndex]);`
    );
    code = code.replace(originalRedraw, newRedraw);
} else {
    console.error("Redraw page match failed!");
    process.exit(1);
}

// 3. Pointer Down Palm Rejection
const pointerDownRegex = /const\s+onPointerDown\s*=\s*\(e:\s*React\.PointerEvent\)\s*=>\s*\{[\s\S]*?isDirtyRef\.current\s*=\s*true;\s*\};/;
const pointerDownMatch = code.match(pointerDownRegex);
if (pointerDownMatch) {
    const newPointerDown = `const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();

        const pos = getCanvasPos(e.clientX, e.clientY);
        
        if (toolMode === 'select' && selectedPathIndices.length > 0) {
            setDragStartPos(pos);
            setIsDraggingSelection(true);
            isDrawingRef.current = false;
            return;
        }

        // Restrict drawing/lasso to pen only
        if (e.pointerType !== 'pen') return;

        if (isDrawingRef.current) return;
        if (!isInWritingArea(pos)) return;

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        activePointerIdRef.current = e.pointerId;

        isDrawingRef.current = true;
        const pressure = e.pressure || 0.5;
        currentPathRef.current = [{ ...pos, pressure }];
        isDirtyRef.current = true;
    };`;
    code = code.replace(pointerDownRegex, newPointerDown);
} else {
    console.error("PointerDown match failed!");
    process.exit(1);
}

// 4. Pointer Move Palm Rejection
const pointerMoveRegex = /const\s+onPointerMove\s*=\s*\(e:\s*React\.PointerEvent\)\s*=>\s*\{[\s\S]*?isDirtyRef\.current\s*=\s*true;\s*\};/;
const pointerMoveMatch = code.match(pointerMoveRegex);
if (pointerMoveMatch) {
    const newPointerMove = `const onPointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

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

        // Restrict drawing to pen only
        if (e.pointerType !== 'pen') return;
        if (!isDrawingRef.current) return;
        if (e.pointerId !== activePointerIdRef.current) return;

        const coalescedEvents = (e.nativeEvent as any).getCoalescedEvents
            ? (e.nativeEvent as any).getCoalescedEvents()
            : [e.nativeEvent];

        for (const ce of coalescedEvents) {
            const cPos = getCanvasPos(ce.clientX, ce.clientY);
            currentPathRef.current.push({ ...cPos, pressure: ce.pressure || 0.5 });
        }
        isDirtyRef.current = true;
    };`;
    code = code.replace(pointerMoveRegex, newPointerMove);
} else {
    console.error("PointerMove match failed!");
    process.exit(1);
}

// 5. Commit Stroke Palm Rejection
const commitRegex = /\/\/\s*Shared\s+commit\s+logic\s+for\s+pointerup[\s\S]*?isDirtyRef\.current\s*=\s*true;\s*\};/;
const commitMatch = code.match(commitRegex);
if (commitMatch) {
    const newCommit = `// Shared commit logic for pointerup / pointercancel / pointerleave
    const commitStroke = (e?: React.PointerEvent) => {
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

        // Restrict drawing commit to pen only
        if (e && e.pointerType !== 'pen') return;

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
    };`;
    code = code.replace(commitRegex, newCommit);
} else {
    console.error("Commit match failed!");
    process.exit(1);
}

// 6. Update Snippets Toolbar to be click based, not hover
const toolbarRegex = /\{\/\*\s*Saved\s+Protocols\s+Dropdown\s*\*\/\}[\s\S]*?<div\s+className="border-l[^]*?<\/div>\s*<\/div>\s*<\/div>/;
const toolbarMatch = code.match(toolbarRegex);
if (toolbarMatch) {
    const newToolbarPart = `{/* Saved Protocols Dropdown */}
                        <div className="border-l border-border pl-2 flex items-center" ref={dropdownRef}>
                           <div className="relative">
                               <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-blue-600 bg-blue-50 font-bold"
                                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                               >
                                  <BookOpen className="w-4 h-4 mr-1" /> Snippets
                               </Button>
                               {isDropdownOpen && (
                                   <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-border rounded-xl shadow-xl p-2 z-[100]">
                                      {savedProtocols.length === 0 ? (
                                          <p className="text-xs text-muted-foreground p-2">No snippets saved. Use lasso to select and save.</p>
                                      ) : (
                                          savedProtocols.map((p, i) => (
                                              <button 
                                                  key={i} 
                                                  onClick={() => {
                                                      pasteProtocol(p.paths);
                                                      setIsDropdownOpen(false);
                                                  }} 
                                                  className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-slate-50 rounded-lg text-slate-700"
                                              >
                                                  {p.name}
                                              </button>
                                          ))
                                      )}
                                    </div>
                               )}
                            </div>
                        </div>`;
    code = code.replace(toolbarRegex, newToolbarPart);
} else {
    console.error("Toolbar match failed!");
    process.exit(1);
}

fs.writeFileSync('src/components/DigitalPrescription.tsx', code, 'utf8');
console.log('Regex updates successful!');
