
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Hash, MoveHorizontal, MoveVertical, Grid, Zap, SlidersHorizontal, Waves, Activity } from 'lucide-react';
import { MathKernel } from '../../services/MathKernel';

interface AdvancedMapEditorProps {
    data: number[][];
    xAxis: number[];
    yAxis: number[];
    liveRpm: number;
    liveLoad: number;
    onCellChange: (row: number, col: number, value: number) => void;
    onBulkChange?: (changes: {row: number, col: number, value: number}[]) => void;
    title?: string;
    suggestionRange?: SelectionRange | null;
    ghostTrace?: {r: number, c: number, time: number}[];
}

interface SelectionRange {
    startR: number;
    startC: number;
    endR: number;
    endC: number;
}

const getHeatColor = (val: number, maxVal: number) => {
    const norm = Math.min(1, Math.max(0, val / maxVal));
    // Cyberpunk theme: Dark Blue -> Cyan -> Purple -> Red
    if (norm < 0.33) {
        return `rgba(0, 240, 255, ${0.05 + norm * 0.3})`; // Cyan glow
    } else if (norm < 0.66) {
        return `rgba(188, 19, 254, ${0.1 + (norm - 0.33) * 0.4})`; // Purple glow
    } else {
        return `rgba(255, 0, 60, ${0.2 + (norm - 0.66) * 0.5})`; // Red alert
    }
};

const safeToFixed = (val: number | null | undefined, precision: number) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return '0';
    return val.toFixed(precision);
};

const AdvancedMapEditor: React.FC<AdvancedMapEditorProps> = ({ 
    data, 
    xAxis, 
    yAxis, 
    liveRpm, 
    liveLoad, 
    onCellChange,
    onBulkChange,
    title = "MAP EDITOR",
    suggestionRange = null,
    ghostTrace = []
}) => {
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [editValue, setEditValue] = useState<string>("");
    const [showInput, setShowInput] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);

    const activeR = Math.min(15, Math.max(0, Math.round(liveLoad / (100/15))));
    const activeC = Math.min(15, Math.max(0, Math.round(liveRpm / (8000/15))));

    const maxVal = useMemo(() => {
        let m = 0;
        data.forEach(r => r.forEach(v => m = Math.max(m, v)));
        return m || 100;
    }, [data]);

    const isCellSelected = useCallback((r: number, c: number) => {
        if (!selection) return false;
        const minR = Math.min(selection.startR, selection.endR);
        const maxR = Math.max(selection.startR, selection.endR);
        const minC = Math.min(selection.startC, selection.endC);
        const maxC = Math.max(selection.startC, selection.endC);
        return r >= minR && r <= maxR && c >= minC && c <= maxC;
    }, [selection]);

    const isCellSuggested = useCallback((r: number, c: number) => {
        if (!suggestionRange) return false;
        const minR = Math.min(suggestionRange.startR, suggestionRange.endR);
        const maxR = Math.max(suggestionRange.startR, suggestionRange.endR);
        const minC = Math.min(suggestionRange.startC, suggestionRange.endC);
        const maxC = Math.max(suggestionRange.startC, suggestionRange.endC);
        return r >= minR && r <= maxR && c >= minC && c <= maxC;
    }, [suggestionRange]);

    const handleMouseDown = (r: number, c: number) => {
        setSelection({ startR: r, startC: c, endR: r, endC: c });
        setIsDragging(true);
        setShowInput(false);
    };

    const handleMouseEnter = (r: number, c: number) => {
        if (isDragging && selection) {
            setSelection({ ...selection, endR: r, endC: c });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const applyBulkOperation = (op: (val: number) => number) => {
        if (!selection) return;
        const minR = Math.min(selection.startR, selection.endR);
        const maxR = Math.max(selection.startR, selection.endR);
        const minC = Math.min(selection.startC, selection.endC);
        const maxC = Math.max(selection.startC, selection.endC);

        const changes = [];
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const newVal = op(data[r][c]);
                changes.push({ row: r, col: c, value: newVal });
                onCellChange(r, c, newVal);
            }
        }
        if (onBulkChange) onBulkChange(changes);
    };

    const handleInterpolate = (direction: 'h' | 'v' | 'both') => {
        if (!selection) return;
        const minR = Math.min(selection.startR, selection.endR);
        const maxR = Math.max(selection.startR, selection.endR);
        const minC = Math.min(selection.startC, selection.endC);
        const maxC = Math.max(selection.startC, selection.endC);

        if (minR === maxR && minC === maxC) return;

        if (direction === 'h' || direction === 'both') {
            for (let r = minR; r <= maxR; r++) {
                const startVal = data[r][minC];
                const endVal = data[r][maxC];
                const steps = maxC - minC;
                if (steps > 0) {
                    for (let c = minC + 1; c < maxC; c++) {
                        const val = startVal + (endVal - startVal) * ((c - minC) / steps);
                        onCellChange(r, c, val);
                    }
                }
            }
        }

        if (direction === 'v' || direction === 'both') {
            for (let c = minC; c <= maxC; c++) {
                const startVal = data[minR][c];
                const endVal = data[maxR][c];
                const steps = maxR - minR;
                if (steps > 0) {
                    for (let r = minR + 1; r < maxR; r++) {
                        const val = startVal + (endVal - startVal) * ((r - minR) / steps);
                        onCellChange(r, c, val);
                    }
                }
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!selection) return;
        
        if (e.key === 'Enter') {
            if (showInput) {
                const val = parseFloat(editValue);
                if (!isNaN(val)) applyBulkOperation(() => val);
                setShowInput(false);
            } else {
                setShowInput(true);
                setEditValue("");
            }
            return;
        }

        if (showInput) return;

        let diff = 0;
        if (e.key === 'ArrowUp') diff = 1;
        if (e.key === 'ArrowDown') diff = -1;
        if (e.key === 'PageUp') diff = 5;
        if (e.key === 'PageDown') diff = -5;

        if (diff !== 0) {
            e.preventDefault();
            applyBulkOperation(v => v + diff);
        }
    };

    return (
        <div 
            className="flex flex-col h-full w-full bg-[#080808] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            {/* TOOLBAR */}
            <div className="h-12 bg-[#111] border-b border-white/10 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Grid className="w-4 h-4 text-brand-cyan" />
                        <span className="text-[10px] font-technical font-black uppercase tracking-[0.2em] text-white">{title}</span>
                    </div>
                    <div className="h-4 w-px bg-white/10"></div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => applyBulkOperation(v => v + 1)} className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Increment (+1)"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => applyBulkOperation(v => v - 1)} className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Decrement (-1)"><Minus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleInterpolate('h')} className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Interpolate Horizontal"><MoveHorizontal className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleInterpolate('v')} className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Interpolate Vertical"><MoveVertical className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleInterpolate('both')} className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Interpolate 2D"><Zap className="w-3.5 h-3.5" /></button>
                        <button 
                            onClick={() => {
                                const buffer = MathKernel.toBuffer(data);
                                const smoothed = MathKernel.gaussianSmooth(buffer, 16, 16, 0.3);
                                const newData = MathKernel.fromBuffer(smoothed, 16, 16);
                                const changes = [];
                                for(let r=0; r<16; r++) {
                                    for(let c=0; c<16; c++) {
                                        if (Math.abs(data[r][c] - newData[r][c]) > 0.01) {
                                            changes.push({row: r, col: c, value: newData[r][c]});
                                            onCellChange(r, c, newData[r][c]);
                                        }
                                    }
                                }
                                if (onBulkChange) onBulkChange(changes);
                            }} 
                            className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors border-l border-white/10 ml-1 pl-2" 
                            title="Gaussian Smooth Map"
                        >
                            <Waves className="w-3.5 h-3.5 text-brand-cyan" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-sm border border-white/5">
                        <span className="text-[8px] font-technical text-gray-500 uppercase tracking-widest">Selection:</span>
                        <span className="text-[8px] font-mono text-brand-cyan">
                            {selection ? `${selection.startR},${selection.startC} to ${selection.endR},${selection.endC}` : 'NONE'}
                        </span>
                    </div>
                    <button onClick={() => setShowInput(true)} className="flex items-center gap-2 px-4 py-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan rounded-sm text-[9px] font-technical font-black uppercase hover:bg-brand-cyan hover:text-black transition-all shadow-glow-cyan/20">
                        <Hash className="w-3 h-3" /> Set Value
                    </button>
                </div>
            </div>

            {/* GRID CONTAINER */}
            <div className="flex-1 overflow-auto relative custom-scrollbar bg-black" ref={gridRef}>
                {/* Grid Background Pattern */}
                <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '14px 10px' }}></div>
                
                <div className="inline-block min-w-full relative z-10">
                    {/* RPM HEADERS */}
                    <div className="flex sticky top-0 z-30 bg-[#080808] border-b border-white/10 shadow-xl">
                        <div className="w-12 shrink-0 bg-[#111] border-r border-white/10 sticky left-0 z-40 flex items-center justify-center font-black text-brand-cyan text-[9px] tracking-widest uppercase">
                            LOAD
                        </div>
                        {xAxis.map((rpm, i) => (
                            <div key={i} className={`w-14 shrink-0 py-2 text-center border-r border-white/5 font-mono text-[9px] font-bold transition-colors ${i === activeC ? 'bg-brand-cyan text-black' : 'text-gray-500'}`}>
                                {rpm}
                            </div>
                        ))}
                    </div>

                    {/* ROWS */}
                    {data.map((row, r) => (
                        <div key={r} className="flex border-b border-white/5 group">
                            {/* LOAD HEADERS */}
                            <div className={`w-12 shrink-0 sticky left-0 z-20 border-r border-white/10 flex items-center justify-center font-mono text-[9px] font-bold transition-colors ${r === activeR ? 'bg-brand-cyan text-black' : 'bg-[#0c0c0c] text-gray-500'}`}>
                                {safeToFixed(yAxis[r], 0)}
                            </div>

                            {/* CELLS */}
                            {row.map((val, c) => {
                                const selected = isCellSelected(r, c);
                                const suggested = isCellSuggested(r, c);
                                const live = activeR === r && activeC === c;
                                
                                // Ghost trace check
                                const isGhost = ghostTrace.some(g => g.r === r && g.c === c);
                                const ghostIntensity = isGhost ? 0.4 : 0;
                                
                                return (
                                    <div 
                                        key={c}
                                        onMouseDown={() => handleMouseDown(r, c)}
                                        onMouseEnter={() => handleMouseEnter(r, c)}
                                        className={`
                                            w-14 shrink-0 h-10 flex items-center justify-center border-r border-white/5 cursor-crosshair transition-all duration-75 relative
                                            ${selected ? 'bg-white/20 ring-1 ring-inset ring-brand-cyan z-10' : 'hover:bg-white/5'}
                                            ${suggested ? 'ring-1 ring-inset ring-yellow-500/50' : ''}
                                            ${isGhost ? 'ring-1 ring-inset ring-white/10' : ''}
                                        `}
                                        style={{ 
                                            backgroundColor: !selected ? getHeatColor(val, maxVal) : undefined,
                                            boxShadow: isGhost ? `inset 0 0 10px rgba(255,255,255,${ghostIntensity})` : undefined
                                        }}
                                    >
                                        <span className={`text-[10px] font-mono font-bold ${selected ? 'text-brand-cyan' : suggested ? 'text-yellow-400' : 'text-gray-300'}`}>
                                            {safeToFixed(val, 1)}
                                        </span>

                                        {suggested && !selected && (
                                            <div className="absolute inset-x-0.5 inset-y-0.5 border border-yellow-500/20 bg-yellow-500/5 pointer-events-none"></div>
                                        )}

                                        {live && (
                                            <div className="absolute inset-0 border-2 border-brand-cyan shadow-[0_0_15px_#00F0FF] z-20 pointer-events-none">
                                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-brand-cyan"></div>
                                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-cyan"></div>
                                                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-brand-cyan"></div>
                                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-brand-cyan"></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* CROSSHAIR TRACER */}
                <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute left-12 right-0 h-px bg-brand-cyan/20" style={{ top: `${activeR * 40 + 32 + 20}px` }}></div>
                    <div className="absolute top-8 bottom-0 w-px bg-brand-cyan/20" style={{ left: `${activeC * 56 + 48 + 28}px` }}></div>
                </div>
            </div>

            {/* INPUT OVERLAY */}
            <AnimatePresence>
                {showInput && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowInput(false)}
                    >
                        <div 
                            className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl shadow-2xl w-64"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-[10px] font-black text-brand-cyan uppercase tracking-widest mb-4">Set Cell Value</h3>
                            <input 
                                autoFocus
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const val = parseFloat(editValue);
                                        if (!isNaN(val)) applyBulkOperation(() => val);
                                        setShowInput(false);
                                    }
                                    if (e.key === 'Escape') setShowInput(false);
                                }}
                                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-xl focus:border-brand-cyan outline-none transition-all"
                                placeholder="0.0"
                            />
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setShowInput(false)} className="flex-1 py-2 text-[10px] font-bold uppercase text-gray-500 hover:text-white transition-colors">Cancel</button>
                                <button 
                                    onClick={() => {
                                        const val = parseFloat(editValue);
                                        if (!isNaN(val)) applyBulkOperation(() => val);
                                        setShowInput(false);
                                    }}
                                    className="flex-1 py-2 bg-brand-cyan text-black text-[10px] font-black uppercase rounded"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* STATUS BAR */}
            <div className="h-8 bg-[#0a0a0a] border-t border-white/10 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse shadow-[0_0_8px_#00FF41]"></div>
                        <span className="text-[8px] font-technical text-gray-500 uppercase tracking-widest">Live Telemetry Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-technical text-gray-600 uppercase">RPM:</span>
                        <span className="text-[8px] font-mono text-white">{safeToFixed(liveRpm, 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-technical text-gray-600 uppercase">LOAD:</span>
                        <span className="text-[8px] font-mono text-white">{safeToFixed(liveLoad, 1)}%</span>
                    </div>
                </div>
                <div className="text-[8px] font-technical text-gray-600 uppercase tracking-widest">
                    Use Arrows to Nudge | Enter to Set | Drag to Select
                </div>
            </div>
        </div>
    );
};

export default AdvancedMapEditor;
