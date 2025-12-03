
import React, { useState } from 'react';

interface MapEditorGridProps {
    data: number[][]; // 16x16
    xAxis: number[]; // RPM headers
    yAxis: number[]; // Load headers
    liveRpm: number;
    liveLoad: number;
    onCellChange: (row: number, col: number, value: number) => void;
}

const getHeatColor = (val: number) => {
    // Simple heatmap: 0=Blue, 60=Green, 120=Red
    const norm = Math.min(1, Math.max(0, val / 120));
    if (norm < 0.5) {
        // Blue to Green
        const g = Math.floor(norm * 2 * 255);
        const b = Math.floor((1 - norm * 2) * 255);
        return `rgba(0, ${g}, ${Math.max(0, b)}, 0.3)`;
    } else {
        // Green to Red
        const r = Math.floor((norm - 0.5) * 2 * 255);
        const g = Math.floor((1 - (norm - 0.5) * 2) * 255);
        return `rgba(${r}, ${g}, 0, 0.3)`;
    }
};

// Static Grid Component (Only re-renders when map data changes)
const StaticGrid = React.memo(({ data, xAxis, yAxis, selectedCell, onCellClick, onKeyDown }: any) => {
    return (
        <div className="inline-block min-w-full">
            {/* Header Row (RPM) */}
            <div className="flex sticky top-0 z-20 bg-[#1a1a1a] border-b border-surface-border">
                <div className="w-10 shrink-0 bg-[#222] border-r border-surface-border sticky left-0 z-30 flex items-center justify-center font-bold text-gray-500">
                    VE
                </div>
                {xAxis.map((rpm: number, i: number) => (
                    <div key={i} className="w-12 shrink-0 py-1 text-center border-r border-[#333] font-bold text-gray-400 text-[10px]">
                        {rpm}
                    </div>
                ))}
            </div>

            {/* Rows */}
            {data.map((row: number[], r: number) => (
                <div key={r} className="flex border-b border-[#222]">
                    {/* Y Axis Header (Load) */}
                    <div className="w-10 shrink-0 sticky left-0 z-10 border-r border-surface-border flex items-center justify-center font-bold bg-[#1a1a1a] text-gray-400 text-[10px]">
                        {yAxis[r].toFixed(0)}
                    </div>
                    
                    {/* Data Cells */}
                    {row.map((val: number, c: number) => {
                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                        return (
                            <div 
                                key={c}
                                onClick={() => onCellClick(r, c)}
                                tabIndex={0}
                                onKeyDown={(e) => onKeyDown(e, r, c)}
                                className={`
                                    w-12 shrink-0 h-8 flex items-center justify-center border-r border-[#222] cursor-pointer outline-none transition-colors
                                    ${isSelected ? 'bg-white text-black font-bold ring-2 ring-brand-cyan z-10' : 'text-gray-300 hover:bg-white/5'}
                                `}
                                style={{ backgroundColor: !isSelected ? getHeatColor(val) : undefined }}
                            >
                                {val.toFixed(0)}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
});

const MapEditorGrid: React.FC<MapEditorGridProps> = ({ data, xAxis, yAxis, liveRpm, liveLoad, onCellChange }) => {
    const [selectedCell, setSelectedCell] = useState<{r: number, c: number} | null>(null);

    // Calculate active cell based on live data
    // Grid constants: 16x16. 
    // Axis ranges: RPM 0-8000 (step 533), Load 0-100 (step 6.66)
    const activeR = Math.min(15, Math.max(0, Math.round(liveLoad / (100/15))));
    const activeC = Math.min(15, Math.max(0, Math.round(liveRpm / (8000/15))));

    // Calculate cursor position for absolute overlay
    // Header height approx 24px (py-1 + text). Row height 32px (h-8).
    // Left header width 40px (w-10). Cell width 48px (w-12).
    // Border widths ~1px included in sizing usually or negligible for visual alignment.
    // Fine-tuning these pixel values matches Tailwind classes.
    const topOffset = 25 + (activeR * 33); 
    const leftOffset = 40 + (activeC * 48); 

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
        <div className="w-full h-full overflow-auto bg-[#111] border border-surface-border rounded-lg relative font-mono text-[10px] select-none custom-scrollbar">
            
            {/* Render Static Grid - Memoized to prevent re-render on 'liveRpm' change */}
            <StaticGrid 
                data={data} 
                xAxis={xAxis} 
                yAxis={yAxis} 
                selectedCell={selectedCell} 
                onCellClick={(r: number, c: number) => setSelectedCell({r, c})}
                onKeyDown={handleKeyDown}
            />

            {/* Live Cursor Overlay */}
            {/* We translate a highlighter box instead of re-rendering the table */}
            <div 
                className="absolute pointer-events-none border-2 border-brand-cyan shadow-[0_0_10px_#00F0FF] z-20 transition-transform duration-100 ease-linear"
                style={{
                    top: 0,
                    left: 0,
                    width: '48px', // w-12
                    height: '33px', // h-8 + border approx
                    transform: `translate(${leftOffset}px, ${topOffset}px)`
                }}
            />
        </div>
    );
};

export default MapEditorGrid;
