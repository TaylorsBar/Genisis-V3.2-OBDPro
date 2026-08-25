import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { KarapiroLogo } from '../../components/KarapiroLogo';
import TrackMap from '../../components/telemetry/TrackMap';
import GForceMeter from '../../components/widgets/GForceMeter';
import BespokeEliteProGauge, { GaugeThemeMode } from '../../components/tachometers/BespokeEliteProGauge';

// --- TYPES & CONSTANTS ---

type PageView = 'RACE' | 'ENGINE' | 'CHASSIS';

// --- SUB-COMPONENTS ---

/**
 * Rolling Trace Graph (Optimized)
 * Uses a circular buffer ref and RAF loop to decouple from React renders.
 */
const TraceGraph: React.FC<{ value: number; color: string; min: number; max: number }> = ({ value, color, min, max }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const historyRef = useRef<number[]>(new Array(150).fill(min));
    const rafRef = useRef<number>(0);
    const isLooping = useRef(false);
    const drawnSinceStopped = useRef(0);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const range = max - min || 1;
        const data = historyRef.current;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0; i<w; i+=20) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
        for(let j=0; j<h; j+=20) { ctx.moveTo(0, j); ctx.lineTo(w, j); }
        ctx.stroke();

        // Trace Line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Bloom Effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * w;
            const val = data[i];
            // Clamp value for drawing
            const y = h - (Math.min(1, Math.max(0, (val - min) / range)) * h);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Area Fill
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color + '22');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
    };

    // Push new value to buffer
    useEffect(() => {
        historyRef.current.push(value);
        if (historyRef.current.length > 150) historyRef.current.shift();
        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value]);

    useEffect(() => {
        rafRef.current = requestAnimationFrame(draw);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [color, min, max]);

    return <canvas ref={canvasRef} width={600} height={160} className="w-full h-full bg-black/40 rounded border border-white/5" />;
};

/**
 * LED Shift Light Array
 */
const ShiftLights: React.FC<{ rpm: number; limit: number }> = React.memo(({ rpm, limit }) => {
    const range = 3000;
    const startRpm = limit - range;
    const numLeds = 18;
    const activeLeds = rpm < startRpm ? 0 : Math.min(numLeds, Math.ceil(((rpm - startRpm) / range) * numLeds));
    const isShift = rpm >= limit;

    return (
        <div className="flex gap-1 w-full h-4 md:h-5 bg-black/80 backdrop-blur-xl px-4 py-1 border-b border-white/5 shadow-2xl relative z-50">
            {Array.from({ length: numLeds }).map((_, i) => {
                let color = '#22c55e'; // Green
                if (i > 6) color = '#eab308'; // Yellow
                if (i > 12) color = '#ef4444'; // Red
                if (isShift) color = '#00F0FF'; // Shift Flash Cyan

                const isActive = i < activeLeds || (isShift && Math.floor(Date.now() / 100) % 2 === 0);
                
                return (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-[1px] transition-all duration-75 relative ${isActive ? 'opacity-100' : 'opacity-10 bg-white'}`}
                        style={{ 
                            backgroundColor: isActive ? color : undefined,
                            boxShadow: isActive ? `0 0 15px ${color}` : 'none'
                        }}
                    >
                         {isActive && <div className="absolute inset-0 bg-white/40 blur-[2px] rounded-[1px]"></div>}
                    </div>
                );
            })}
        </div>
    );
});

/**
 * Engineering Data Cell
 */
const DataCell: React.FC<{ label: string; value: string; unit?: string; alert?: boolean }> = ({ label, value, unit, alert }) => (
    <div className={`
        relative flex flex-col justify-between p-4
        bg-black/60 backdrop-blur-xl border border-white/5 rounded-xl transition-all duration-300 group overflow-hidden
        ${alert ? 'bg-red-950/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'hover:bg-white/5 hover:border-white/10 shadow-glass'}
    `}>
        {/* Micro-grid overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:8px_8px]"></div>

        <div className="flex justify-between items-start z-10">
            <span className="text-[9px] font-display font-bold text-gray-500 uppercase tracking-[0.25em] group-hover:text-brand-cyan transition-colors">
                {label}
            </span>
            {alert && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>}
        </div>
        
        <div className="flex items-baseline justify-end gap-1 mt-3 z-10">
            <span className={`text-3xl font-mono font-black tracking-tighter ${alert ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {value}
            </span>
            {unit && <span className="text-[10px] text-gray-600 font-display font-bold uppercase tracking-widest">{unit}</span>}
        </div>

        {/* Spectral accent line */}
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-brand-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
);

/**
 * Premium Motorsport Gauge (Circular)
 */
const MotorsportGauge: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    unit?: string;
    redlineStart?: number;
    warningLow?: number;
    warningHigh?: number;
    size?: 'small' | 'large';
    predictive?: boolean;
    svgStyle?: React.CSSProperties;
}> = ({ label, value, min, max, unit, redlineStart, warningLow, warningHigh, size = 'small', predictive = false, svgStyle }) => {
    const isCritical = (warningHigh !== undefined && value >= warningHigh) || (warningLow !== undefined && value <= warningLow);
    const range = max - min;
    const valueNorm = Math.min(1, Math.max(0, (value - min) / range));
    
    const width = size === 'large' ? 440 : 220;
    const height = width;
    const cx = width / 2;
    const cy = width / 2;
    const r = width * 0.43;
    
    const startAngle = 135;
    const endAngle = 405;
    const totalAngle = endAngle - startAngle;
    const currentAngle = startAngle + (valueNorm * totalAngle);

    const ticks = useMemo(() => {
        const count = size === 'large' ? 11 : 7;
        const subTickCount = (count - 1) * 4;
        
        return (
            <g>
                {/* Minor Sub-ticks */}
                {Array.from({ length: subTickCount + 1 }).map((_, i) => {
                    const ratio = i / subTickCount;
                    const val = min + ratio * range;
                    const ang = startAngle + ratio * totalAngle;
                    const rad = (ang - 90) * (Math.PI / 180);
                    
                    const isMajor = i % 4 === 0;
                    if (isMajor) return null; // Rendered below with labels
                    
                    const rInner = r - (size === 'large' ? 12 : 7);
                    const rOuter = r - 2;
                    
                    const x1 = cx + rInner * Math.cos(rad);
                    const y1 = cy + rInner * Math.sin(rad);
                    const x2 = cx + rOuter * Math.cos(rad);
                    const y2 = cy + rOuter * Math.sin(rad);
                    
                    const isRed = redlineStart && val >= redlineStart;

                    return (
                        <line 
                            key={`minor-${i}`} 
                            x1={x1} y1={y1} x2={x2} y2={y2} 
                            stroke={isRed ? '#FF003C' : 'rgba(0, 240, 255, 0.6)'} 
                            strokeWidth={size === 'large' ? 2 : 1}
                            opacity={0.7}
                        />
                    );
                })}

                {/* Major Ticks & Numbers */}
                {Array.from({ length: count }).map((_, i) => {
                    const val = min + (i * range / (count - 1));
                    const ratio = i / (count - 1);
                    const ang = startAngle + ratio * totalAngle;
                    const rad = (ang - 90) * (Math.PI / 180);
                    
                    const rInner = r - (size === 'large' ? 24 : 14);
                    const rOuter = r - 2;
                    
                    const x1 = cx + rInner * Math.cos(rad);
                    const y1 = cy + rInner * Math.sin(rad);
                    const x2 = cx + rOuter * Math.cos(rad);
                    const y2 = cy + rOuter * Math.sin(rad);
                    
                    const isRed = redlineStart && val >= redlineStart;
                    const displayVal = size === 'large' ? Math.round(val / 1000) : Math.round(val);

                    return (
                        <g key={`major-${i}`}>
                            <line 
                                x1={x1} y1={y1} x2={x2} y2={y2} 
                                stroke={isRed ? '#FF003C' : '#00F0FF'} 
                                strokeWidth={size==='large' ? 4 : 2.5} 
                                strokeLinecap="round"
                                filter={isRed ? 'url(#redGlow)' : 'url(#cyanGlow)'}
                            />
                            {size === 'large' && (
                                <text 
                                    x={cx + (r - 48) * Math.cos(rad)} 
                                    y={cy + (r - 48) * Math.sin(rad)} 
                                    textAnchor="middle" 
                                    dominantBaseline="middle" 
                                    style={{ fontSize: '22px', fontWeight: '900' }}
                                    className={`font-display italic tracking-tighter ${isRed ? 'fill-[#FF003C] drop-shadow-[0_0_10px_rgba(255,0,60,0.8)]' : 'fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'}`}
                                >
                                    {displayVal}
                                </text>
                            )}
                            {size === 'small' && i % 2 === 0 && (
                                <text 
                                    x={cx + (r - 28) * Math.cos(rad)} 
                                    y={cy + (r - 28) * Math.sin(rad)} 
                                    textAnchor="middle" 
                                    dominantBaseline="middle" 
                                    style={{ fontSize: '11px', fontWeight: '800' }}
                                    className={`font-mono ${isRed ? 'fill-[#FF003C]' : 'fill-gray-300'}`}
                                >
                                    {displayVal}
                                </text>
                            )}
                        </g>
                    );
                })}
            </g>
        );
    }, [min, size, redlineStart, r, cx, cy, range, totalAngle, startAngle]);

    return (
        <div 
            className="relative flex flex-col items-center justify-center select-none" 
            style={{ 
                height: `${height}px`, 
                width: `${width}px`, 
            }}
        >
            <svg 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${width} ${height}`} 
                className="overflow-visible drop-shadow-[0_25px_35px_rgba(0,0,0,0.9)]" 
                style={svgStyle}
            >
                <defs>
                    {/* Deep 3D Radial Gauge Face */}
                    <radialGradient id={`gaugeFace-${label}`} cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                        <stop offset="0%" stopColor="#121824" />
                        <stop offset="65%" stopColor="#080c14" />
                        <stop offset="92%" stopColor="#030508" />
                        <stop offset="100%" stopColor="#1a2233" />
                    </radialGradient>

                    {/* Machined Metallic Bezel Gradient */}
                    <linearGradient id="metalBezel3D" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4a5568" />
                        <stop offset="20%" stopColor="#1a202c" />
                        <stop offset="45%" stopColor="#718096" />
                        <stop offset="55%" stopColor="#2d3748" />
                        <stop offset="80%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#374151" />
                    </linearGradient>

                    {/* Inner Bezel Depth Gradient */}
                    <radialGradient id="innerDepthShadow" cx="50%" cy="50%" r="50%">
                        <stop offset="80%" stopColor="transparent" />
                        <stop offset="96%" stopColor="rgba(0,0,0,0.85)" />
                        <stop offset="100%" stopColor="rgba(0,240,255,0.2)" />
                    </radialGradient>

                    {/* Curved 3D Glass Lens Reflection */}
                    <linearGradient id="glassReflection" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.22)" />
                        <stop offset="40%" stopColor="rgba(255, 255, 255, 0.03)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0.0)" />
                    </linearGradient>

                    {/* Glowing Filters */}
                    <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    <filter id="redGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    <filter id="needleShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="3" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity="0.9" />
                    </filter>
                </defs>

                {/* 1. Outer 3D Metallic Bezel */}
                <circle cx={cx} cy={cy} r={r + 14} fill="url(#metalBezel3D)" stroke="#090d14" strokeWidth="2" />
                <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="#1e293b" strokeWidth="1.5" />
                <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="#000000" strokeWidth="3" />
                
                {/* 2. Main 3D Gauge Dial Face */}
                <circle cx={cx} cy={cy} r={r} fill={`url(#gaugeFace-${label})`} stroke="#0f172a" strokeWidth="2" />
                
                {/* 3. Inner Depth Rim Overlay */}
                <circle cx={cx} cy={cy} r={r} fill="url(#innerDepthShadow)" />
                <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                {/* 4. Redline Arc Zone */}
                {redlineStart && (
                    <path 
                        d={`M ${cx + (r-10) * Math.cos(((startAngle + (redlineStart-min)/range*totalAngle)-90)*Math.PI/180)} ${cy + (r-10) * Math.sin(((startAngle + (redlineStart-min)/range*totalAngle)-90)*Math.PI/180)} A ${r-10} ${r-10} 0 0 1 ${cx + (r-10) * Math.cos(((endAngle)-90)*Math.PI/180)} ${cy + (r-10) * Math.sin(((endAngle)-90)*Math.PI/180)}`}
                        fill="none"
                        stroke="#FF003C"
                        strokeWidth={size === 'large' ? '8' : '5'}
                        strokeLinecap="round"
                        opacity="0.85"
                        filter="url(#redGlow)"
                    />
                )}

                {/* 5. Ticks & Digits */}
                {ticks}

                {/* 6. Brand Branding (COBALT / PRECISION) for Large Tachometer */}
                {size === 'large' && (
                    <g transform={`translate(${cx}, ${cy + 35})`}>
                        <text textAnchor="middle" y="0" className="font-display font-black text-[22px] italic fill-[#00F0FF] tracking-[0.25em] drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]">
                            COBALT
                        </text>
                        <text textAnchor="middle" y="16" className="font-display font-bold text-[9px] fill-gray-400 tracking-[0.5em] uppercase">
                            PRECISION
                        </text>
                    </g>
                )}

                {/* 7. High-Fidelity 3D Pointer Needle */}
                <g 
                    style={{ 
                        transformOrigin: `${cx}px ${cy}px`, 
                        transform: `rotate(${currentAngle}deg)`,
                        transition: 'transform 0.05s cubic-bezier(0.1, 0.8, 0.2, 1)'
                    }}
                    filter="url(#needleShadow)"
                >
                    {/* Tapered 3D Red Needle */}
                    <path 
                        d={`M ${cx} ${cy - r + (size === 'large' ? 22 : 12)} L ${cx - (size === 'large' ? 4.5 : 3)} ${cy + 22} L ${cx + (size === 'large' ? 4.5 : 3)} ${cy + 22} Z`} 
                        fill="#FF003C" 
                        filter="url(#redGlow)" 
                    />
                    {/* Inner bright needle core line */}
                    <line 
                        x1={cx} y1={cy - r + (size === 'large' ? 26 : 16)} 
                        x2={cx} y2={cy + 15} 
                        stroke="#FFF" 
                        strokeWidth={size === 'large' ? 1.5 : 1} 
                        opacity="0.8"
                    />
                    
                    {/* Center 3D Hub Cap */}
                    <circle cx={cx} cy={cy} r={size === 'large' ? 18 : 10} fill="#111827" stroke="#374151" strokeWidth="2" />
                    <circle cx={cx} cy={cy} r={size === 'large' ? 12 : 6} fill="#1f2937" stroke="#000" strokeWidth="1" />
                    <circle cx={cx} cy={cy} r={size === 'large' ? 5 : 3} fill="#FF003C" />
                </g>

                {/* 8. Digital Readout Section for Small Gauges */}
                {size === 'small' && (
                    <foreignObject x={cx - 50} y={cy + r * 0.22} width="100" height="50">
                        <div className="text-center flex flex-col items-center justify-center">
                            <div className={`text-xl font-mono font-black leading-none tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] ${isCritical ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                {value.toFixed(1)}
                            </div>
                            <div className="text-[8px] text-cyan-400 font-display font-black uppercase mt-1 tracking-widest">{unit}</div>
                        </div>
                    </foreignObject>
                )}
                
                {/* Gauge Title Label */}
                <text 
                    x={cx} 
                    y={size === 'large' ? cy - r * 0.35 : cy - r * 0.42} 
                    textAnchor="middle" 
                    className="font-display font-black text-[10px] fill-gray-400 tracking-[0.35em] uppercase drop-shadow"
                >
                    {label}
                </text>

                {/* 9. Glass Convex Lens 3D Glare */}
                <path 
                    d={`M ${cx - r * 0.85} ${cy - r * 0.3} A ${r * 0.98} ${r * 0.98} 0 0 1 ${cx + r * 0.85} ${cy - r * 0.3} Q ${cx} ${cy + r * 0.15} ${cx - r * 0.85} ${cy - r * 0.3} Z`} 
                    fill="url(#glassReflection)" 
                    pointerEvents="none" 
                />
            </svg>
        </div>
    );
};

const SuspensionBar: React.FC<{ val: number; label: string }> = ({ val, label }) => (
    <div className="flex flex-col items-center gap-2 h-32 w-12">
        <span className="text-[10px] font-bold text-gray-500">{label}</span>
        <div className="flex-1 w-full bg-[#111] rounded border border-white/10 relative overflow-hidden">
            <div 
                className="absolute bottom-0 w-full transition-all duration-75 bg-brand-cyan"
                style={{ height: `${val}%` }}
            ></div>
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/20"></div>
        </div>
        <span className="text-xs font-mono text-white">{val.toFixed(0)}%</span>
    </div>
);

// --- MAIN COMPONENT ---

const ClassicThemeDashboard: React.FC = () => {
    const { latestData, hasActiveFault, data } = useVehicleStore();
    const d = latestData;
    const [page, setPage] = useState<PageView>('RACE');
    const [useEliteGauge, setUseEliteGauge] = useState(false);

    const egts = [842, 856, 848, 861]; 

    // --- Simulated Chassis Dynamics ---
    const suspFL = Math.min(100, Math.max(0, 50 + (d.gForceY * 30) - (d.gForceX * 30)));
    const suspFR = Math.min(100, Math.max(0, 50 + (d.gForceY * 30) + (d.gForceX * 30)));
    const suspRL = Math.min(100, Math.max(0, 50 - (d.gForceY * 30) - (d.gForceX * 30)));
    const suspRR = Math.min(100, Math.max(0, 50 - (d.gForceY * 30) + (d.gForceX * 30)));

    return (
        <div className="w-full h-full bg-[#020202] text-white flex flex-col overflow-hidden font-sans select-none relative">
            
            {/* Background High-Fidelity Textures */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.03)_0%,transparent_80%)] pointer-events-none"></div>
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:40px_40px]"></div>

            {/* 1. Integrated Header & Shift Lights */}
            <div className="shrink-0 z-40 relative flex flex-col w-full">
                <ShiftLights rpm={d.rpm} limit={7500} />
                
                <div className="flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-xl border-b border-white/5 shadow-2xl">
                    <div className="flex gap-3 items-center">
                        {['RACE', 'ENGINE', 'CHASSIS'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPage(p as PageView)}
                                className={`
                                    px-6 py-2 text-[10px] font-display font-black uppercase tracking-[0.3em] rounded-lg border transition-all duration-100
                                    ${page === p 
                                        ? 'bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-105' 
                                        : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/30 hover:text-white'
                                    }
                                `}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Gauge Mode Switcher */}
                        <button
                            onClick={() => setUseEliteGauge(!useEliteGauge)}
                            className="px-3 py-1.5 text-[9px] font-mono font-bold tracking-wider rounded border border-white/10 bg-white/5 hover:bg-white/10 text-cyan-400 flex items-center gap-1.5 transition-all"
                            title="Toggle between Cobalt Precision & Bespoke Elite Gauge"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            <span>{useEliteGauge ? 'BESPOKE ELITE PRO' : 'COBALT PRECISION'}</span>
                        </button>

                        <div className="hidden md:flex flex-col items-center opacity-60">
                             <KarapiroLogo className="h-5 w-auto" variant="monochrome" />
                             <span className="text-[7px] font-mono tracking-[0.6em] text-gray-500 uppercase mt-1">PRO TUNER OS</span>
                         </div>
                         <div className="w-px h-10 bg-white/5"></div>
                         <div className="flex items-center gap-8">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-display font-bold text-gray-600 uppercase tracking-widest">MAP_SLOT</span>
                                <span className="text-xs font-mono font-black text-brand-cyan tracking-widest italic">STAGE_3_DRY</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-display font-bold text-gray-600 uppercase tracking-widest">SESSION_LAP</span>
                                <span className="text-lg font-mono font-black text-white leading-none">04</span>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* 2. Main High-Fidelity Content View */}
            <div className="flex-1 relative overflow-hidden z-10 p-2 lg:p-4">
                
                {page === 'RACE' && (
                    <div className="w-full h-full grid grid-cols-12 gap-6 animate-in fade-in zoom-in-95 duration-100">
                        
                        {/* Left Wing: Session & Timing */}
                        <div className="col-span-3 flex flex-col gap-4">
                            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-glass relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-brand-cyan/50"></div>
                                <span className="text-[10px] font-display font-bold text-gray-500 uppercase tracking-[0.3em] border-b border-white/5 pb-3 mb-4 block">SESSION TIMING</span>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">LAP_TIME</span>
                                        <span className="text-3xl font-mono font-black text-white tracking-tighter">1:34.22</span>
                                    </div>
                                    <div className="flex justify-between items-baseline opacity-50">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">PREV_LAP</span>
                                        <span className="text-xl font-mono font-bold">1:34.85</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">BEST_LAP</span>
                                        <span className="text-xl font-mono font-black text-brand-purple tracking-tighter italic">1:33.90</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-glass group">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent)] pointer-events-none"></div>
                                <div className="text-center relative z-10">
                                    <div className="text-[10px] font-display font-bold text-gray-500 uppercase mb-4 tracking-[0.4em]">LIVE_DELTA</div>
                                    <div className="text-7xl font-mono font-black text-green-500 tracking-tighter drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]">-0.45</div>
                                </div>
                                <div className="absolute bottom-0 left-0 h-1 w-full bg-green-500/20 group-hover:bg-green-500/40 transition-colors"></div>
                            </div>
                            
                            <DataCell label="System Battery" value={d.batteryVoltage.toFixed(1)} unit="V" alert={d.batteryVoltage < 12.2} />
                        </div>

                        {/* Center: Primary Driver Cluster */}
                        <div className="col-span-6 flex flex-col items-center justify-center relative bg-black/40 border border-white/5 rounded-[40px] shadow-2xl overflow-hidden ring-1 ring-white/5 p-6 group min-h-[480px]">
                            {/* Inner ambient flare */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_70%)] pointer-events-none animate-pulse"></div>
                            
                            <div className="transform transition-transform duration-700 group-hover:scale-105 flex items-center justify-center my-auto w-full h-full max-w-[520px]">
                                {useEliteGauge ? (
                                    <BespokeEliteProGauge 
                                        rpm={d.rpm}
                                        speed={d.speed}
                                        gear={d.gear}
                                        redline={7500}
                                        maxRpm={10000}
                                        theme="cyber_grid"
                                        brandLogo="cartelworx"
                                        showControls={true}
                                    />
                                ) : (
                                    <MotorsportGauge 
                                        label="ENGINE_SPEED" 
                                        value={d.rpm} 
                                        min={0} max={9000} 
                                        size="large" 
                                        redlineStart={7500} 
                                        unit="RPM"
                                        predictive={true}
                                    />
                                )}
                            </div>
                            
                            {/* Velocity HUD */}
                            {!useEliteGauge && (
                                <div className="mt-2 flex flex-col items-center pointer-events-none">
                                    <span className="text-6xl lg:text-7xl font-mono font-black text-white tracking-tighter leading-none drop-shadow-[0_10px_25px_rgba(0,0,0,1)]">
                                        {d.speed.toFixed(0)}
                                    </span>
                                    <div className="h-[2px] w-36 bg-gradient-to-r from-transparent via-brand-cyan to-transparent opacity-60 mt-1"></div>
                                    <span className="text-[10px] font-display font-black text-brand-cyan uppercase tracking-[0.6em] mt-2">KM/H VELOCITY</span>
                                </div>
                            )}

                            {/* Sequential Gear Box */}
                            {!useEliteGauge && (
                                <div className="absolute top-8 right-8 bg-black/80 w-24 h-24 lg:w-28 lg:h-28 rounded-2xl border border-white/10 flex flex-col items-center justify-center shadow-2xl backdrop-blur-3xl group-hover:border-brand-cyan/40 transition-colors">
                                    <span className="text-[9px] font-display font-black text-gray-500 block text-center uppercase tracking-[0.2em] mb-1">GEAR</span>
                                    <span className="text-6xl lg:text-7xl font-display font-black text-brand-yellow leading-none italic drop-shadow-[0_0_20px_rgba(252,238,10,0.4)]">
                                        {d.gear === 0 ? 'N' : d.gear === -1 ? 'R' : d.gear}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Right Wing: Thermal & Pressures */}
                        <div className="col-span-3 flex flex-col gap-4">
                            <div className="flex-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 grid grid-rows-2 gap-4 shadow-glass">
                                <div className="flex gap-4">
                                    <div className="flex-1 flex justify-center items-center border-r border-white/5">
                                        <MotorsportGauge 
                                            label="WATER_T" 
                                            value={d.engineTemp} 
                                            min={40} 
                                            max={120} 
                                            unit="C" 
                                            warningHigh={105} 
                                        />
                                    </div>
                                    <div className="flex-1 flex justify-center items-center">
                                        <MotorsportGauge label="OIL_P" value={d.oilPressure} min={0} max={10} unit="BAR" warningLow={1.5} />
                                    </div>
                                </div>
                                <div className="flex gap-4 border-t border-white/5 pt-4">
                                    <div className="flex-1 flex justify-center border-r border-white/5">
                                        <MotorsportGauge label="OIL_T" value={d.engineOilTemp || d.engineTemp + 12} min={50} max={150} unit="C" />
                                    </div>
                                    <div className="flex-1 flex justify-center">
                                        <MotorsportGauge label="FUEL_P" value={d.fuelPressure} min={0} max={6} unit="BAR" />
                                    </div>
                                </div>
                            </div>
                            <DataCell label="Fuel Level" value={d.fuelLevel.toFixed(0)} unit="%" alert={d.fuelLevel < 15} />
                        </div>
                    </div>
                )}

                {/* --- ENGINE VIEW --- */}
                {page === 'ENGINE' && (
                    <div className="w-full h-full grid grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-100">
                        
                        <div className="col-span-1 flex flex-col gap-4">
                            <div className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-glass">
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-4 block">MANIFOLD_PRESSURE</span>
                                <div className="flex justify-between items-baseline mb-4">
                                    <span className="text-5xl font-mono font-black text-white tabular-nums tracking-tighter">{d.turboBoost.toFixed(2)}</span>
                                    <span className="text-xs font-display font-black text-brand-cyan tracking-widest">BAR</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-cyan shadow-[0_0_10px_#00F0FF]" style={{width: `${Math.min(100, Math.max(0, (d.turboBoost+1)/4*100))}%`}}></div>
                                </div>
                            </div>
                            <DataCell label="Throttle Pos" value={d.throttlePos.toFixed(0)} unit="%" />
                            <DataCell label="Intake Temp" value={d.inletAirTemp.toFixed(0)} unit="C" />
                            <DataCell label="Fuel Trim" value={`${d.longTermFuelTrim.toFixed(1)}`} unit="%" />
                        </div>

                        <div className="col-span-1 flex flex-col gap-4">
                            <div className="bg-black/60 backdrop-blur-xl p-5 border border-white/10 rounded-2xl shadow-glass flex flex-col h-48 group">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em]">LAMBDA_OSCILLOSCOPE</span>
                                    <span className="text-lg font-mono font-black text-brand-cyan italic">{d.lambda.toFixed(3)}</span>
                                </div>
                                <div className="flex-1 rounded overflow-hidden border border-white/5 group-hover:border-white/20 transition-colors">
                                    <TraceGraph value={d.lambda} color={Math.abs(1 - d.lambda) > 0.08 ? '#ef4444' : '#22c55e'} min={0.7} max={1.3} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <DataCell label="TGT_LAMBDA" value="0.880" />
                                <DataCell label="MAF_INLET" value={d.maf.toFixed(1)} unit="g/s" />
                            </div>
                            <DataCell label="Ambient P" value={d.barometricPressure.toFixed(0)} unit="kPa" />
                        </div>

                        <div className="col-span-1 flex flex-col gap-4 bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-glass relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <svg className="w-32 h-32 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em] mb-6 block border-b border-white/5 pb-3">CYLINDER_EGT_VECTOR</span>
                            <div className="flex justify-between items-end h-48 gap-3 pb-4 border-b border-white/5">
                                {egts.map((temp, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                                        <div 
                                            className="w-full bg-gradient-to-t from-orange-900 via-orange-600 to-white/40 rounded-t-sm relative transition-all duration-100 shadow-[0_0_15px_rgba(249,115,22,0.3)]" 
                                            style={{ height: `${(temp / 1000) * 100}%` }}
                                        >
                                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-white bg-black/80 px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap">{temp}°C</span>
                                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                        <span className="text-[9px] text-gray-600 mt-3 font-display font-black">C{i+1}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6">
                                <span className="text-[9px] font-display font-black text-gray-600 uppercase tracking-widest block mb-3">KNOCK_REDUNDANCY</span>
                                <div className="grid grid-cols-4 gap-3">
                                    {egts.map((_, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
                                                <div className="h-full bg-green-500 shadow-[0_0_5px_#22c55e]" style={{width: '12%'}}></div>
                                            </div>
                                            <span className="text-[8px] font-mono font-bold text-gray-500 italic">0.18</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1 flex flex-col gap-4">
                            <DataCell label="Ignition Adv" value={d.timingAdvance.toFixed(1)} unit="DEG" />
                            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-glass flex-1 flex flex-col group">
                                <span className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em] mb-6 block border-b border-white/5 pb-3">VVT_POSITIONING</span>
                                <div className="space-y-6 flex-1 justify-center flex flex-col">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="text-gray-400 font-display">INLET_BANK_1</span>
                                            <span className="text-white font-mono">25.0°</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{width: '40%'}}></div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="text-gray-400 font-display">EXH_BANK_1</span>
                                            <span className="text-white font-mono">10.5°</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7]" style={{width: '20%'}}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className={`p-6 rounded-2xl border backdrop-blur-xl transition-all duration-150 ${hasActiveFault ? 'bg-red-950/40 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-green-950/20 border-green-500/30'}`}>
                                <div className="flex items-center justify-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${hasActiveFault ? 'bg-red-500 animate-pulse' : 'bg-green-500'} shadow-[0_0_10px_currentColor]`}></div>
                                    <span className="font-display font-black uppercase tracking-[0.4em] text-xs">
                                        {hasActiveFault ? 'LINK_FAULT_ACTIVE' : 'SYSTEM_NOMINAL'}
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {page === 'CHASSIS' && (
                    <div className="w-full h-full animate-in fade-in duration-100 grid grid-cols-12 gap-6 p-4">
                         <div className="col-span-8 bg-[#0a0a0a] border border-white/10 rounded-2xl relative overflow-hidden flex flex-col shadow-2xl">
                             <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-3 py-1 rounded border border-white/10">
                                 <span className="text-[10px] font-bold text-brand-cyan uppercase tracking-widest">Live Track Telemetry</span>
                             </div>
                             <div className="flex-1 w-full h-full bg-[#050505]">
                                 <TrackMap data={data} height={500} width={800} colorMetric="gForceY" />
                             </div>
                         </div>

                         <div className="col-span-4 flex flex-col gap-6">
                             {/* Friction Circle */}
                             <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center relative shadow-lg">
                                 <div className="absolute top-4 left-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">G-Force Vector</div>
                                 <GForceMeter x={d.gForceX} y={d.gForceY} size={220} />
                                 <div className="w-full flex justify-between mt-4 text-[10px] font-mono text-gray-400">
                                     <span>LAT: {d.gForceX.toFixed(2)}G</span>
                                     <span>LONG: {d.gForceY.toFixed(2)}G</span>
                                 </div>
                             </div>

                             {/* Suspension Travel Simulation */}
                             <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-lg flex-1 flex flex-col justify-center">
                                 <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Suspension Travel</div>
                                 <div className="flex justify-around items-end h-full pb-4">
                                     <SuspensionBar val={suspFL} label="FL" />
                                     <SuspensionBar val={suspFR} label="FR" />
                                     <SuspensionBar val={suspRL} label="RL" />
                                     <SuspensionBar val={suspRR} label="RR" />
                                 </div>
                             </div>
                         </div>
                    </div>
                )}

            </div>

            {/* 3. High-Performance Footer Bar */}
            <div className="h-10 bg-black border-t border-white/5 flex items-center justify-between px-6 text-[9px] font-mono font-bold text-gray-600 uppercase z-40 relative">
                <div className="flex gap-8 items-center">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div> ECU: <span className="text-white">LINK_G4X_ELITE</span></span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> LINK: <span className="text-green-500">ESTABLISHED</span></span>
                </div>
                <div className="flex gap-8 items-center">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_8px_red]"></div> LOG_STREAM: <span className="text-red-500">ACTIVE [144Hz]</span></span>
                    <span className="text-gray-500">KERNEL_CLOCK: {Math.floor(performance.now()).toString().padStart(8, '0')}</span>
                    <div className="w-px h-4 bg-white/10"></div>
                    <span className="text-brand-cyan opacity-80">ST_HWY_SPD_SHP</span>
                </div>
            </div>

        </div>
    );
};

export default ClassicThemeDashboard;
