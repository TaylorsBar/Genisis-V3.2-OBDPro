
import React, { useMemo } from 'react';

interface AutometerTachProps {
    rpm: number;
    speed: number;
    gear: number;
    maxRpm?: number;
    redline?: number;
    shiftPoint?: number;
    size?: number | string;
}

// --- Static Layer: Background (Bezel, Face, Ticks, Branding) ---
const AutometerBackground = React.memo(({ maxRpm, redline, ticks }: { maxRpm: number, redline: number, ticks: React.ReactNode }) => (
    <>
        <defs>
            {/* Photorealistic Bezel */}
            <linearGradient id="chromeBezel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="20%" stopColor="#ffffff" />
                <stop offset="45%" stopColor="#505050" />
                <stop offset="50%" stopColor="#202020" />
                <stop offset="55%" stopColor="#505050" />
                <stop offset="80%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e0e0e0" />
            </linearGradient>
            
            <radialGradient id="carbonFace" cx="50%" cy="50%" r="50%">
                <stop offset="80%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#000000" />
            </radialGradient>
            
            <linearGradient id="glassReflection" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <filter id="glowEffect">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            
            <filter id="dropShadow">
                <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.7"/>
            </filter>
        </defs>

        {/* Shadow Layer */}
        <circle cx="0" cy="5" r="200" fill="black" opacity="0.6" filter="url(#dropShadow)" />

        {/* Bezel */}
        <circle cx="0" cy="0" r="200" fill="url(#chromeBezel)" stroke="#000" strokeWidth="1" />
        <circle cx="0" cy="0" r="185" fill="url(#carbonFace)" stroke="#000" strokeWidth="2" />

        {/* Branding */}
        <g transform="translate(0, -70)">
            <text x="0" y="0" textAnchor="middle" fill="#888" className="font-display font-black text-3xl italic tracking-tighter" stroke="black" strokeWidth="0.5">
                CARTEL
            </text>
            <text x="0" y="15" textAnchor="middle" fill="#555" className="font-mono text-[8px] font-bold tracking-[0.4em] uppercase">
                COMPETITION
            </text>
        </g>
        
        {/* RPM Label */}
        <text textAnchor="middle" y="50" fill="#bbb" className="font-display italic font-bold text-xl">RPM</text>
        <text textAnchor="middle" y="65" fill="#666" className="font-sans text-[10px] font-bold uppercase">x1000 min-1</text>

        {/* Ticks */}
        <g transform="translate(-200, -200)">{ticks}</g>
    </>
));

// --- Static Layer: Foreground (Glass, Cap) ---
const AutometerForeground = React.memo(() => (
    <>
        {/* Center Cap */}
        <circle cx="0" cy="0" r="22" fill="url(#chromeBezel)" stroke="#222" strokeWidth="1" />
        <circle cx="0" cy="0" r="10" fill="#111" />

        {/* Glass Reflection */}
        <path d="M -170 -90 Q 0 -220 170 -90 Q 90 20 -170 -90 Z" fill="url(#glassReflection)" pointerEvents="none" />
    </>
));

const AutometerTach: React.FC<AutometerTachProps> = ({ 
    rpm, 
    speed,
    gear,
    maxRpm = 10000, 
    redline = 8500, 
    shiftPoint = 7500,
    size = 400 
}) => {
    // Configuration
    const startAngle = -45; // 0 RPM
    const endAngle = 225;   // Max RPM
    const angleRange = endAngle - startAngle;
    
    const valueToAngle = (val: number) => {
        const ratio = Math.max(0, Math.min(val, maxRpm)) / maxRpm;
        return startAngle + ratio * angleRange;
    };

    const needleAngle = valueToAngle(rpm);
    const isShiftLightOn = rpm >= shiftPoint;

    // Tick Generation (Memoized)
    const ticks = useMemo(() => {
        const generatedTicks = [];
        const numMajorTicks = 11; // 0 to 10
        for (let i = 0; i < numMajorTicks; i++) {
            const tickVal = i * (maxRpm / (numMajorTicks - 1));
            const angle = valueToAngle(tickVal);
            const isRedline = tickVal >= redline;
            
            // Major Tick
            generatedTicks.push(
                <g key={`major-${i}`} transform={`rotate(${angle} 200 200)`}>
                    <rect x="196" y="35" width="8" height="25" fill={isRedline ? "#ef4444" : "#ffffff"} />
                    <text 
                        x="200" 
                        y="90" 
                        transform={`rotate(${-angle} 200 90)`} 
                        textAnchor="middle" 
                        fill={isRedline ? "#ef4444" : "#ffffff"}
                        className="font-display font-bold text-4xl"
                        style={{ fontStyle: 'italic', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                    >
                        {i}
                    </text>
                </g>
            );

            // Minor Ticks
            if (i < numMajorTicks - 1) {
                for (let j = 1; j < 5; j++) {
                    const minorVal = tickVal + j * ((maxRpm / (numMajorTicks - 1)) / 5);
                    const minorAngle = valueToAngle(minorVal);
                    generatedTicks.push(
                        <rect 
                            key={`minor-${i}-${j}`} 
                            x="198" y="35" width="4" height="12" 
                            fill={isRedline ? "#ef4444" : "#a0a0a0"} 
                            transform={`rotate(${minorAngle} 200 200)`} 
                        />
                    );
                }
            }
        }
        return generatedTicks;
    }, [maxRpm, redline]);

    const containerStyle = typeof size === 'number' ? { width: size, height: size } : { width: size, height: size };

    return (
        <div className="relative" style={containerStyle}>
            <svg viewBox="0 0 500 400" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
                
                {/* --- Shift Light (External) --- */}
                <g transform="translate(380, 80) rotate(15)">
                    <path d="M -20 20 L -60 50 L -60 70 L -20 40 Z" fill="#222" stroke="#111" strokeWidth="2" />
                    <circle cx="0" cy="0" r="55" fill="#111" stroke="#333" strokeWidth="4" filter="url(#dropShadow)" />
                    <circle 
                        cx="0" cy="0" r="45" 
                        fill={isShiftLightOn ? "#FFD700" : "#332200"} 
                        filter={isShiftLightOn ? "url(#glowEffect)" : ""}
                        className="transition-colors duration-100"
                    />
                    {isShiftLightOn && <circle cx="0" cy="0" r="45" fill="#fff" opacity="0.3" />}
                </g>

                {/* --- Main Gauge Body --- */}
                <g transform="translate(200, 200)">
                    
                    <AutometerBackground maxRpm={maxRpm} redline={redline} ticks={ticks} />

                    {/* LCD Panels - Semi-Dynamic (Gear/Speed) */}
                    {/* Gear */}
                    <g transform="translate(-90, 30)">
                        <rect x="-40" y="-35" width="80" height="60" rx="4" fill="#080808" stroke="#333" strokeWidth="2" />
                        <text x="0" y="-20" textAnchor="middle" fill="#444" className="font-sans text-[8px] font-bold">GEAR</text>
                        <text x="0" y="15" textAnchor="middle" fill="#fff" className="font-display font-bold text-4xl" filter="url(#glowEffect)">
                             {gear === 0 ? 'N' : gear}
                        </text>
                    </g>

                    {/* Speed */}
                    <g transform="translate(0, 110)">
                         <rect x="-60" y="-25" width="120" height="60" rx="4" fill="#080808" stroke="#333" strokeWidth="2" />
                         <text x="0" y="-12" textAnchor="middle" fill="#444" className="font-sans text-[8px] font-bold tracking-widest">VELOCITY</text>
                         <text x="0" y="25" textAnchor="middle" fill="#00F0FF" className="font-display font-bold text-4xl" filter="url(#glowEffect)">
                             {isNaN(speed) ? '---' : speed.toFixed(0)}
                         </text>
                    </g>

                    {/* Needle - Pure CSS Transition for Max Performance */}
                    <g 
                        style={{ 
                            transform: `rotate(${needleAngle}deg)`, 
                            transition: 'transform 0.1s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
                            willChange: 'transform'
                        }}
                    >
                        <g filter="url(#dropShadow)">
                            <path d="M -6 20 L -2 -160 L 2 -160 L 6 20 Z" fill="#ff3300" stroke="#cc2200" strokeWidth="1" />
                            <circle cx="0" cy="0" r="10" fill="#cc2200" />
                        </g>
                    </g>

                    <AutometerForeground />
                </g>
            </svg>
        </div>
    );
};

export default AutometerTach;
