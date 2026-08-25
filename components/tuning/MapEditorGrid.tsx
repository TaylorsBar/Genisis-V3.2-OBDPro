
import React, { useState, useMemo } from 'react';

interface MapEditorGridProps {
    data: number[][]; // 16x16
    originalData?: number[][]; // For showing diffs
    xAxis: number[]; // RPM headers
    yAxis: number[]; // Load headers
    liveRpm: number;
    liveLoad: number;
    onCellChange: (row: number, col: number, value: number) => void;
    suggestionRange?: { startR: number, startC: number, endR: number, endC: number } | null;
}

const getHeatColor = (val: number, maxVal: number) => {
    // Simple heatmap: 0=Blue, 0.5=Green, 1=Red
    const norm = Math.min(1, Math.max(0, val / maxVal));
    if (norm < 0.5) {
        // Blue to Green
        const g = Math.floor(norm * 2 * 255);
        const b = Math.floor((1 - norm * 2) * 255);
        return `rgba(0, ${g}, ${Math.max(0, b)}, 0.15)`; // Low opacity for background
    } else {
        // Green to Red
        const r = Math.floor((norm - 0.5) * 2 * 255);
        const g = Math.floor((1 - (norm - 0.5) * 2) * 255);
        return `rgba(${r}, ${g}, 0, 0.2)`;
    }
};

const StaticGrid = React.memo(({ data, originalData, xAxis, yAxis, selectedCell, onCellClick, onKeyDown, activeR, activeC, maxVal, suggestionRange }: any) => {
    const isCellSuggested = (r: number, c: number) => {
        if (!suggestionRange) return false;
        const minR = Math.min(suggestionRange.startR, suggestionRange.endR);
        const maxR = Math.max(suggestionRange.startR, suggestionRange.endR);
        const minC = Math.min(suggestionRange.startC, suggestionRange.endC);
        const maxC = Math.max(suggestionRange.startC, suggestionRange.endC);
        return r >= minR && r <= maxR && c >= minC && c <= maxC;
    };

    return (
        <div className="inline-block min-w-full">
            {/* Header Row (RPM) */}
            <div className="flex sticky top-0 z-20 bg-[#0a0a0a] border-b border-white/10 shadow-lg">
                <div className="w-10 shrink-0 bg-[#111] border-r border-white/10 sticky left-0 z-30 flex items-center justify-center font-bold text-brand-cyan text-[10px] tracking-wider">
                    VE
                </div>
                {xAxis.map((rpm: number, i: number) => (
                    <div key={i} className={`w-12 shrink-0 py-1.5 text-center border-r border-white/5 font-bold text-[9px] font-mono transition-colors ${i === activeC ? 'bg-brand-cyan text-black' : 'bg-[#0c0c0c] text-gray-500'}`}>
                        {rpm}
                    </div>
                ))}
            </div>

            {/* Rows */}
            {data?.map((row: number[], r: number) => (
                <div key={r} className="flex border-b border-white/5">
                    {/* Y Axis Header (Load) */}
                    <div className={`w-10 shrink-0 sticky left-0 z-10 border-r border-white/10 flex items-center justify-center font-bold text-[9px] font-mono transition-colors ${r === activeR ? 'bg-brand-cyan text-black' : 'bg-[#0c0c0c] text-gray-500'}`}>
                        {yAxis[r].toFixed(0)}
                    </div>
                    
                    {/* Data Cells */}
                    {row.map((val: number, c: number) => {
                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                        const isLive = activeR === r && activeC === c;
                        const isSuggested = isCellSuggested(r, c);
                        
                        const origVal = originalData ? originalData[r][c] : val;
                        const diff = val - origVal;
                        const hasChanged = Math.abs(diff) > 0.01;
                        
                        let cellBg = undefined;
                        let cellTextColor = 'text-gray-300';
                        
                        if (hasChanged) {
                            if (diff > 0) {
                                cellBg = 'rgba(34, 197, 94, 0.4)'; // green
                                cellTextColor = 'text-green-300 font-bold';
                            } else {
                                cellBg = 'rgba(239, 68, 68, 0.4)'; // red
                                cellTextColor = 'text-red-300 font-bold';
                            }
                        } else if (!isSelected) {
                            cellBg = getHeatColor(val, maxVal);
                        }

                        return (
                            <div 
                                key={c}
                                onClick={() => onCellClick(r, c)}
                                tabIndex={0}
                                onKeyDown={(e) => onKeyDown(e, r, c)}
                                className={`
                                    w-12 shrink-0 h-8 flex items-center justify-center border-r border-white/5 cursor-pointer outline-none transition-all duration-75 text-[10px] font-mono relative
                                    ${isSelected ? 'bg-white !text-black font-bold ring-1 ring-inset ring-brand-cyan z-10 scale-105' : `${cellTextColor} hover:bg-white/5`}
                                    ${isSuggested && !isSelected ? 'ring-1 ring-inset ring-yellow-500/50 bg-yellow-900/10' : ''}
                                `}
                                style={{ backgroundColor: cellBg }}
                                title={hasChanged ? `Original: ${origVal.toFixed(1)} -> New: ${val.toFixed(1)} (Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(1)})` : ''}
                            >
                                {val.toFixed(0)}
                                {hasChanged && (
                                    <div className="absolute top-0.5 right-0.5 text-[6px] opacity-70">
                                        {diff > 0 ? '▲' : '▼'}
                                    </div>
                                )}
                                {isLive && !isSelected && (
                                    <div className="absolute inset-0 bg-brand-cyan/30 border border-brand-cyan shadow-[inset_0_0_10px_#00F0FF] animate-pulse pointer-events-none"></div>
                                )}
                                {isSuggested && !isSelected && (
                                    <div className="absolute inset-0 border border-yellow-500/20 bg-yellow-500/5 pointer-events-none"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
});

const MapEditorGrid: React.FC<MapEditorGridProps> = ({ data, originalData, xAxis, yAxis, liveRpm, liveLoad, onCellChange, suggestionRange }) => {
    const [selectedCell, setSelectedCell] = useState<{r: number, c: number} | null>(null);

    const activeR = Math.min(15, Math.max(0, Math.round(liveLoad / (100/15))));
    const activeC = Math.min(15, Math.max(0, Math.round(liveRpm / (8000/15))));

    // Calculate max value for heat map scaling
    const maxVal = useMemo(() => {
        let m = 0;
        data.forEach(r => r.forEach(v => m = Math.max(m, v)));
        return m || 100;
    }, [data]);

    const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
            e.preventDefault();
            let diff = 0;
            if (e.key === 'ArrowUp') diff = 1;
            if (e.key === 'ArrowDown') diff = -1;
            if (e.key === 'PageUp') diff = 5;
            if (e.key === 'PageDown') diff = -5;
            onCellChange(r, c, data[r][c] + diff);
        }
    };

    return (
        <div className="w-full h-full overflow-auto bg-[#050505] rounded-lg relative font-mono select-none custom-scrollbar">
            <StaticGrid 
                data={data} 
                originalData={originalData}
                xAxis={xAxis} 
                yAxis={yAxis} 
                selectedCell={selectedCell} 
                onCellClick={(r: number, c: number) => setSelectedCell({r, c})}
                onKeyDown={handleKeyDown}
                activeR={activeR}
                activeC={activeC}
                maxVal={maxVal}
                suggestionRange={suggestionRange}
            />
        </div>
    );
};

export default MapEditorGrid;
