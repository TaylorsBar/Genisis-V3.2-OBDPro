import React from 'react';
import { motion } from 'motion/react';

interface RpmTapeProps {
    rpm: number;
    maxRpm?: number;
    shiftLightRpm?: number;
}

export const RpmTape: React.FC<RpmTapeProps> = ({ rpm, maxRpm = 8000, shiftLightRpm = 6500 }) => {
    const numSegments = 28;
    const isRpmLimitHit = rpm >= shiftLightRpm;
    const activeSegments = Math.min(numSegments, Math.ceil((rpm / maxRpm) * numSegments));

    return (
        <div className="w-full bg-black/90 p-1.5 border-b border-zinc-800 flex items-center justify-between gap-1 select-none overflow-hidden relative shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-red-500/5 pointer-events-none"></div>
            
            {/* Left label */}
            <div className="flex flex-col pl-4 pr-2 shrink-0 border-r border-zinc-800">
                <span className="text-[7px] text-zinc-500 font-mono tracking-[0.2em] uppercase leading-none">TACH TAPE</span>
                <span className="text-sm font-technical font-black tracking-tighter text-brand-cyan italic leading-none mt-0.5">
                    {rpm.toFixed(0)} <span className="text-[8px] font-mono text-zinc-600">RPM</span>
                </span>
            </div>

            {/* Tape segments container */}
            <div className="flex-1 flex gap-[3px] px-3 items-center h-4 overflow-hidden">
                {Array.from({ length: numSegments }).map((_, idx) => {
                    const segmentVal = (idx / numSegments) * maxRpm;
                    const isActive = idx < activeSegments;
                    
                    // Style segments by RPM ranges (Green, Yellow, Red)
                    let baseColor = 'bg-zinc-900 border-zinc-950';
                    let activeColor = 'bg-brand-green shadow-[0_0_8px_#00FA9A]';
                    
                    if (segmentVal >= shiftLightRpm) {
                        activeColor = isRpmLimitHit && Math.floor(Date.now() / 80) % 2 === 0
                            ? 'bg-white shadow-[0_0_12px_#ffffff]'
                            : 'bg-brand-red shadow-[0_0_10px_#FF2A4D]';
                    } else if (segmentVal >= shiftLightRpm * 0.75) {
                        activeColor = 'bg-brand-yellow shadow-[0_0_8px_#FCEE0A]';
                    }

                    return (
                        <div
                            key={idx}
                            className={`flex-1 h-3 transform skew-x-[-15deg] transition-all duration-75 border border-black/30 rounded-[1px] ${
                                isActive ? activeColor : baseColor
                            }`}
                        />
                    );
                })}
            </div>

            {/* Right label */}
            <div className="flex flex-col px-4 shrink-0 border-l border-zinc-800 text-right">
                <span className="text-[7px] text-zinc-500 font-mono tracking-[0.2em] uppercase leading-none">LIMIT TRIGGER</span>
                <span className="text-[11px] font-mono font-bold text-brand-red leading-none mt-1">
                    {shiftLightRpm} <span className="text-[7px] opacity-60">RPM</span>
                </span>
            </div>
        </div>
    );
};

export default RpmTape;
