
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

// --- TYPES & CONSTANTS ---

type PageView = 'RACE' | 'ENGINE' | 'CHASSIS';

const COLORS = {
    bg: '#000000',
    panel: '#111111',
    border: '#333333',
    text: '#e0e0e0',
    textDim: '#666666',
    accent: '#FCEE0A', // Race Yellow
    alert: '#FF003C',
    ok: '#00FF00',
    cold: '#00F0FF',
    hot: '#FF3333'
};

// --- UTILITIES ---

const formatFloat = (val: number, prec: number = 1) => val.toFixed(prec);

// --- SUB-COMPONENTS ---

/**
 * Rolling Trace Graph (Canvas based for performance)
 */
const TraceGraph: React.FC<{ data: number[]; color: string; min: number; max: number; height?: number }> = ({ data, color, min, max, height = 40 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const range = max - min;

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        data.forEach((val, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((val - min) / range) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill
        ctx.fillStyle = color + '22'; // Low opacity hex
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fill();

    }, [data, color, min, max]);

    return <canvas ref={canvasRef} width={300} height={height} className="w-full h-full" />;
};

/**
 * LED Shift Light Array
 */
const ShiftLights: React.FC<{ rpm: number; limit: number }> = React.memo(({ rpm, limit }) => {
    const range = 3000;
    const startRpm = limit - range;
    const numLeds = 16;
    const activeLeds = rpm < startRpm ? 0 : Math.min(numLeds, Math.ceil(((rpm - startRpm) / range) * numLeds));
    const isShift = rpm >= limit;

    return (
        <div className="flex gap-[2px] w-full h-6 md:h-8 bg-[#050505] p-1 border-b border-[#222]">
            {Array.from({ length: numLeds }).map((_, i) => {
                let bg = 'bg-green-600';
                if (i > 5) bg = 'bg-yellow-500';
                if (i > 10) bg = 'bg-red-600';
                if (isShift) bg = 'bg-blue-500'; 

                const isActive = i < activeLeds || isShift;
                
                return (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-[1px] transition-opacity duration-50 ${isActive ? `${bg} shadow-[0_0_10px_currentColor]` : 'bg-[#151515] opacity-30'}`}
                    />
                );
            })}
        </div>
    );
});

/**
 * Engineering Data Cell
 */
const DataCell: React.FC<{ label: string; value: string; unit?: string; alert?: boolean }> = ({ label, value, unit, alert }) => (
    <div className={`flex flex-col justify-between p-2 border border-[#222] bg-[#080808] ${alert ? 'bg-red-900/30 border-red-500' : ''}`}>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-baseline justify-end gap-1">
            <span className={`text-xl font-mono font-bold ${alert ? 'text-red-500 animate-pulse' : 'text-white'}`}>{value}</span>
            {unit && <span className="text-[10px] text-gray-600 font-mono">{unit}</span>}
        </div>
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
}> = ({ label, value, min, max, unit, redlineStart, warningLow, warningHigh, size = 'small' }) => {
    // Animation
    const animatedValue = useAnimatedValue(value, { duration: 100 });
    
    // Logic
    const isCritical = (warningHigh !== undefined && animatedValue >= warningHigh) || (warningLow !== undefined && animatedValue <= warningLow);
    const range = max - min;
    const valueNorm = Math.min(1, Math.max(0, (animatedValue - min) / range));
    
    // Geometry
    const width = size === 'large' ? 360 : 180;
    const height = width;
    const cx = width / 2;
    const cy = width / 2;
    const r = width * 0.45;
    const strokeWidth = size === 'large' ? 12 : 8;
    
    const startAngle = 135;
    const endAngle = 405;
    const totalAngle = endAngle - startAngle;
    const currentAngle = startAngle + (valueNorm * totalAngle);

    // Ticks
    const ticks = useMemo(() => {
        const count = size === 'large' ? 11 : 6;
        return Array.from({ length: count }).map((_, i) => {
            const val = min + (i * range / (count - 1));
            const ratio = i / (count - 1);
            const ang = startAngle + ratio * totalAngle;
            const rad = (ang - 90) * (Math.PI / 180);
            
            const rInner = r - (size === 'large' ? 25 : 15);
            const rOuter = r - 5;
            
            const x1 = cx + rInner * Math.cos(rad);
            const y1 = cy + rInner * Math.sin(rad);
            const x2 = cx + rOuter * Math.cos(rad);
            const y2 = cy + rOuter * Math.sin(rad);
            
            const isRed = redlineStart && val >= redlineStart;

            return (
                <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isRed ? '#EF4444' : '#666'} strokeWidth={2} />
                    {size === 'large' && (
                        <text 
                            x={cx + (r - 40) * Math.cos(rad)} 
                            y={cy + (r - 40) * Math.sin(rad)} 
                            textAnchor="middle" 
                            dominantBaseline="middle" 
                            className={`font-mono text-[10px] font-bold ${isRed ? 'fill-red-500' : 'fill-gray-500'}`}
                        >
                            {val}
                        </text>
                    )}
                </g>
            );
        });
    }, [min, max, size, redlineStart, r, cx, cy]);

    return (
        <div className="relative flex flex-col items-center justify-center">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* Background */}
                <circle cx={cx} cy={cy} r={r} fill="#050505" stroke="#222" strokeWidth="2" />
                
                {/* Ticks */}
                {ticks}

                {/* Value Arc (Needle Trail) */}
                <path 
                    d={`M ${cx + r * Math.cos((startAngle-90)*Math.PI/180)} ${cy + r * Math.sin((startAngle-90)*Math.PI/180)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos((endAngle-90)*Math.PI/180)} ${cy + r * Math.sin((endAngle-90)*Math.PI/180)}`}
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Needle */}
                <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${currentAngle}deg)`, transition: 'transform 0.1s linear' }}>
                    <path d={`M ${cx} ${cy - r} L ${cx - 6} ${cy + 10} L ${cx + 6} ${cy + 10} Z`} fill={isCritical ? '#EF4444' : '#FCEE0A'} />
                    <circle cx={cx} cy={cy} r={6} fill="#111" stroke="#333" />
                </g>

                {/* Center Text */}
                <foreignObject x={cx - 50} y={cy + r * 0.4} width="100" height="60">
                    <div className="text-center">
                        <div className={`text-2xl font-mono font-bold leading-none ${isCritical ? 'text-red-500' : 'text-white'}`}>
                            {animatedValue.toFixed(size === 'large' ? 0 : 1)}
                        </div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">{unit}</div>
                    </div>
                </foreignObject>
            </svg>
            <div className="absolute top-[25%] text-xs font-bold text-gray-600 uppercase tracking-widest">{label}</div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const ClassicThemeDashboard: React.FC = () => {
    const { latestData, hasActiveFault } = useVehicleData();
    const d = latestData;
    const [page, setPage] = useState<PageView>('RACE');
    const [traceHistory, setTraceHistory] = useState<number[]>([]);

    // Maintain history for Trace Graph
    useEffect(() => {
        setTraceHistory(prev => {
            const next = [...prev, d.lambda];
            if (next.length > 100) next.shift();
            return next;
        });
    }, [d.lambda]);

    // Simulated EGTs for Demo
    const egts = [840, 855, 845, 860]; 

    return (
        <div className="w-full h-full bg-black text-white flex flex-col overflow-hidden font-sans select-none">
            
            {/* 1. Header & Shift Lights */}
            <div className="shrink-0 z-20">
                <ShiftLights rpm={d.rpm} limit={7500} />
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#222] bg-[#080808]">
                    <div className="flex gap-2">
                        {['RACE', 'ENGINE', 'CHASSIS'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPage(p as PageView)}
                                className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded border transition-all ${
                                    page === p 
                                    ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                                    : 'bg-transparent text-gray-600 border-[#333] hover:border-gray-500'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Map</span>
                            <span className="text-xs font-mono font-bold text-brand-cyan">RACE_DRY_1</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Lap</span>
                            <span className="text-xs font-mono font-bold text-white">4</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Main Viewport */}
            <div className="flex-1 relative overflow-hidden">
                
                {/* --- RACE VIEW --- */}
                {page === 'RACE' && (
                    <div className="w-full h-full grid grid-cols-12 gap-0 animate-in fade-in duration-300">
                        
                        {/* Left Info */}
                        <div className="col-span-3 flex flex-col border-r border-[#222]">
                            <DataCell label="Lap Time" value="1:34.22" />
                            <DataCell label="Last Lap" value="1:34.85" />
                            <DataCell label="Best Lap" value="1:33.90" alert={true} /> {/* Green alert for best? Custom logic needed usually */}
                            <div className="flex-1 bg-[#050505] flex items-center justify-center border-t border-[#222]">
                                <div className="text-center">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Delta</div>
                                    <div className="text-4xl font-mono font-black text-green-500">-0.45</div>
                                </div>
                            </div>
                            <DataCell label="Fuel Level" value={d.fuelLevel.toFixed(0)} unit="%" />
                            <DataCell label="Laps Rem" value="12.5" />
                        </div>

                        {/* Center Gauge */}
                        <div className="col-span-6 flex flex-col items-center justify-center relative bg-[#020202]">
                            <MotorsportGauge 
                                label="Engine Speed" 
                                value={d.rpm} 
                                min={0} max={9000} 
                                size="large" 
                                redlineStart={7500} 
                                unit="RPM" 
                            />
                            
                            {/* Speed Overlay */}
                            <div className="absolute bottom-8 flex flex-col items-center">
                                <span className="text-7xl font-display font-black text-white tracking-tighter leading-none">
                                    {d.speed.toFixed(0)}
                                </span>
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-[0.5em]">KM/H</span>
                            </div>

                            {/* Gear Overlay */}
                            <div className="absolute top-16 right-16">
                                <span className="text-[10px] font-bold text-gray-500 block text-center">GEAR</span>
                                <span className="text-6xl font-display font-black text-yellow-500 leading-none">
                                    {d.gear === 0 ? 'N' : d.gear}
                                </span>
                            </div>
                        </div>

                        {/* Right Info */}
                        <div className="col-span-3 flex flex-col border-l border-[#222]">
                            <div className="grid grid-cols-2 h-full">
                                <div className="flex flex-col justify-around border-r border-[#222] p-2">
                                    <MotorsportGauge label="Water" value={d.engineTemp} min={40} max={120} unit="C" warningHigh={105} />
                                    <MotorsportGauge label="Oil P" value={d.oilPressure} min={0} max={10} unit="BAR" warningLow={1.0} />
                                </div>
                                <div className="flex flex-col justify-around p-2">
                                    <MotorsportGauge label="Oil T" value={d.engineTemp + 15} min={50} max={150} unit="C" />
                                    <MotorsportGauge label="Fuel P" value={d.fuelPressure} min={0} max={6} unit="BAR" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ENGINE VIEW --- */}
                {page === 'ENGINE' && (
                    <div className="w-full h-full p-4 grid grid-cols-4 gap-4 animate-in fade-in duration-300 bg-[#0a0a0a]">
                        
                        {/* Col 1: Primary Metrics */}
                        <div className="col-span-1 flex flex-col gap-1">
                            <DataCell label="RPM" value={d.rpm.toFixed(0)} />
                            <DataCell label="MAP" value={d.turboBoost.toFixed(2)} unit="BAR" />
                            <DataCell label="TPS" value={d.throttlePos.toFixed(0)} unit="%" />
                            <DataCell label="IAT" value={d.inletAirTemp.toFixed(0)} unit="C" />
                            <DataCell label="Battery" value={d.batteryVoltage.toFixed(1)} unit="V" />
                        </div>

                        {/* Col 2: Fueling */}
                        <div className="col-span-1 flex flex-col gap-1">
                            <div className="bg-[#111] p-2 border border-[#333] h-24 flex flex-col">
                                <span className="text-[9px] font-bold text-gray-500 uppercase">Lambda Trace</span>
                                <div className="flex-1 mt-1">
                                    <TraceGraph data={traceHistory} color={d.lambda > 1.05 ? '#EF4444' : '#00FF00'} min={0.8} max={1.2} />
                                </div>
                                <div className="text-right text-xl font-mono font-bold text-white">{d.lambda.toFixed(3)}</div>
                            </div>
                            <DataCell label="Target Lambda" value="0.880" />
                            <DataCell label="STFT" value={`${d.shortTermFuelTrim > 0 ? '+' : ''}${d.shortTermFuelTrim.toFixed(1)}`} unit="%" />
                            <DataCell label="LTFT" value={`${d.longTermFuelTrim > 0 ? '+' : ''}${d.longTermFuelTrim.toFixed(1)}`} unit="%" />
                            <DataCell label="Inj Duty" value={(d.rpm / 8000 * 80).toFixed(1)} unit="%" />
                        </div>

                        {/* Col 3: EGTs & Knock */}
                        <div className="col-span-1 flex flex-col gap-1 bg-[#111] border border-[#333] p-2">
                            <span className="text-[9px] font-bold text-gray-500 uppercase mb-2">EGT (°C)</span>
                            <div className="flex justify-between items-end h-32 gap-2 pb-2 border-b border-[#222]">
                                {egts.map((temp, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                                        <div 
                                            className="w-full bg-orange-600 transition-all duration-300 relative group" 
                                            style={{ height: `${(temp / 1000) * 100}%` }}
                                        >
                                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white opacity-0 group-hover:opacity-100">{temp}</span>
                                        </div>
                                        <span className="text-[9px] text-gray-500 mt-1">{i+1}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2">
                                <span className="text-[9px] font-bold text-gray-500 uppercase">Knock Levels (dB)</span>
                                <div className="grid grid-cols-4 gap-2 mt-1">
                                    {egts.map((_, i) => (
                                        <div key={i} className="text-center font-mono text-xs text-green-500 border border-green-900 rounded bg-green-900/10 py-1">
                                            {(Math.random() * 2).toFixed(1)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Col 4: Ignition & VVT */}
                        <div className="col-span-1 flex flex-col gap-1">
                            <DataCell label="Ign Angle" value={d.timingAdvance.toFixed(1)} unit="DEG" />
                            <DataCell label="Dwell" value="2.1" unit="MS" />
                            <DataCell label="Cam Inlet" value="25.0" unit="DEG" />
                            <DataCell label="Cam Exh" value="10.5" unit="DEG" />
                            <div className={`mt-auto p-4 border border-[#333] text-center ${hasActiveFault ? 'bg-red-600 text-white' : 'bg-green-900/20 text-green-500'}`}>
                                <span className="font-bold uppercase tracking-widest">{hasActiveFault ? 'FAULT ACTIVE' : 'SYSTEM OK'}</span>
                            </div>
                        </div>

                    </div>
                )}

                {/* --- CHASSIS VIEW --- */}
                {page === 'CHASSIS' && (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-mono animate-in fade-in duration-300">
                        <div className="text-center">
                            <div className="text-6xl mb-4 opacity-20">⚠</div>
                            <p>CHASSIS DYNAMICS MODULE</p>
                            <p className="text-xs mt-2">Awaiting TPMS & Suspension Potentiometer Calibration...</p>
                        </div>
                    </div>
                )}

            </div>

            {/* 3. Footer Bar */}
            <div className="h-8 bg-[#050505] border-t border-[#222] flex items-center justify-between px-4 text-[10px] font-mono text-gray-600 uppercase">
                <span>ECU: <span className="text-white">LINK G4X</span></span>
                <span>STATUS: <span className="text-green-500">ONLINE</span></span>
                <span>LOG: <span className="text-red-500 animate-pulse">REC</span> 144Hz</span>
            </div>

        </div>
    );
};

export default ClassicThemeDashboard;
