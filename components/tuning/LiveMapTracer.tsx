import React from 'react';

interface LiveMapTracerProps {
    mapData: number[][];
    rpm: number;
    load: number;
    colorScale?: [number, number, number]; // [r, g, b] format for highest value
}

const LiveMapTracer: React.FC<LiveMapTracerProps> = ({ mapData, rpm, load, colorScale = [188, 19, 254] }) => {
    // Determine bounds
    const maxRpm = 8000;
    const maxLoad = 100;
    
    // Calculate current cell index (0 to 15)
    const xIndex = Math.floor(Math.min(15, Math.max(0, (rpm / maxRpm) * 16)));
    const yIndex = Math.floor(Math.min(15, Math.max(0, (load / maxLoad) * 16)));

    // Find min/max for color scaling
    let minVal = Infinity;
    let maxVal = -Infinity;
    mapData.forEach(row => {
        row.forEach(val => {
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
        });
    });

    const range = maxVal - minVal || 1;

    return (
        <div className="w-full h-full relative grid grid-cols-[repeat(16,minmax(0,1fr))] grid-rows-[repeat(16,minmax(0,1fr))] gap-[1px] bg-[#1a1a1a] border border-[#333] p-[1px]">
            {mapData.map((row, y) => (
                row.map((val, x) => {
                    const intensity = (val - minVal) / range;
                    const isCellActive = x === xIndex && y === (15 - yIndex); // Display inverted y (Load 100 at top)
                    
                    // Base color based on intensity
                    const baseColor = `rgba(${colorScale[0]}, ${colorScale[1]}, ${colorScale[2]}, ${0.1 + intensity * 0.4})`;

                    return (
                        <div 
                            key={`${x}-${y}`}
                            className="relative overflow-hidden transition-all duration-75"
                            style={{ backgroundColor: baseColor }}
                        >
                            {isCellActive && (
                                <div className="absolute inset-0 bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 
                                    animate-pulse mix-blend-screen" />
                            )}
                        </div>
                    );
                })
            ))}
        </div>
    );
};

export default LiveMapTracer;
