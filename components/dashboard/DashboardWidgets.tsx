
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, useMotionValue, AnimatePresence } from 'motion/react';
import { SensorDataPoint } from '../../types';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useUIStore } from '../../stores/uiStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useLongPress } from '../../hooks/useLongPress';
import { formatTimeMS } from '../../lib/formatters';

// --- HALTECH STYLE ---

export const HaltechDataBlock: React.FC<{ label: string; value?: string | number; dataKey?: string; unit?: string; alertThreshold?: number; alertCondition?: 'greater' | 'less'; isWarning?: boolean; barValue?: number; fixed?: number; maxBarValue?: number; style?: React.CSSProperties }> = React.memo(({ label, value, dataKey, unit, alertThreshold, alertCondition, isWarning: propIsWarning, barValue: propBarValue, fixed = 1, maxBarValue, style }) => {
    const valMotion = useAnimatedValue(dataKey || (typeof value === 'number' ? value : parseFloat(value as string) || 0), { 
        stiffness: 180, damping: 22, mass: 0.7 
    });
    const [isWarning, setIsWarning] = useState(propIsWarning || false);
    const showDataOverlay = useUIStore(state => state.showDataOverlay);

    const longPressEvents = useLongPress(() => {
        if (dataKey) {
            showDataOverlay(dataKey, label);
        }
    }, 600);

    useEffect(() => {
        if (!dataKey && value !== undefined) {
            valMotion.set(typeof value === 'number' ? value : parseFloat(value as string) || 0);
        }
    }, [dataKey, value, valMotion]);

    useEffect(() => {
        if (alertThreshold !== undefined && alertCondition) {
            return valMotion.on("change", (v) => {
                const alert = alertCondition === 'greater' ? v > alertThreshold : v < alertThreshold;
                setIsWarning(alert);
            });
        }
    }, [valMotion, alertThreshold, alertCondition]);

    const displayValue = useTransform(valMotion, v => {
        if (!dataKey && typeof value === 'string' && isNaN(parseFloat(value))) return value;
        return v.toFixed(fixed);
    });
    
    const barWidth = useTransform(valMotion, v => {
        if (propBarValue !== undefined) return `${Math.min(100, Math.max(0, propBarValue))}%`;
        if (maxBarValue !== undefined) return `${Math.min(100, Math.max(0, (v / maxBarValue) * 100))}%`;
        return '0%';
    });

    return (
        <motion.div 
            {...longPressEvents}
            whileHover={{ scale: 1.02, borderColor: isWarning ? '#dc2626' : '#F4E04D' }}
            className={`bg-[#050505]/80 backdrop-blur-xl border border-white/10 border-l-4 ${isWarning ? 'border-red-600' : 'border-[#F4E04D]'} p-4 md:p-5 flex flex-col justify-between min-h-[110px] sm:min-h-[120px] lg:h-full lg:max-h-[180px] w-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300 rounded-xl relative overflow-hidden cursor-pointer cursor-crosshair active:scale-95`}
            style={style}
        >
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                     backgroundSize: '10px 10px',
                 }}>
            </div>
            <div className={`absolute inset-0 bg-gradient-to-r ${isWarning ? 'from-red-900/20' : 'from-[#F4E04D]/10'} to-transparent pointer-events-none z-0`}></div>
            <div className="flex justify-between items-start relative z-10 w-full mb-1 lg:mb-2">
                <span className="text-[10px] md:text-[11px] lg:text-[13px] font-display font-black text-gray-400 uppercase tracking-[0.25em]">{label}</span>
                {isWarning && <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shadow-[0_0_15px_#dc2626]"></div>}
            </div>
            <div className="flex items-baseline gap-2 md:gap-3 lg:gap-4 relative z-10 w-full overflow-hidden flex-1 justify-start">
                <motion.span className={`font-display font-black tracking-tighter ${isWarning ? 'text-red-500' : 'text-white'} drop-shadow-md text-4xl sm:text-5xl lg:text-6xl xl:text-7xl italic truncate mix-blend-plus-lighter`}>{displayValue}</motion.span>
                <span className="font-mono font-bold text-gray-500 text-[10px] md:text-xs lg:text-[14px] tracking-[0.1em] italic shrink-0">{unit}</span>
            </div>
            {(propBarValue !== undefined || maxBarValue !== undefined) && (
                <div className="h-1.5 w-full bg-white/5 mt-auto overflow-hidden rounded-full mb-1 relative z-10 shadow-inner border border-white/5">
                    <motion.div 
                        style={{ width: barWidth }}
                        className={`h-full ${isWarning ? 'bg-red-500 shadow-[0_0_10px_#dc2626]' : 'bg-gradient-to-r from-[#F4E04D]/80 to-[#F4E04D] shadow-[0_0_10px_#F4E04D]'}`}
                    ></motion.div>
                </div>
            )}
        </motion.div>
    );
});

export const StatusPill: React.FC<{ label: string; active?: boolean; color?: string }> = ({ label, active, color = "#00F0FF" }) => (
    <div className={`px-3 py-1 rounded-full border ${active ? 'bg-opacity-20' : 'bg-transparent border-gray-800'} flex items-center gap-2`} style={{ 
        borderColor: active ? color : undefined,
        backgroundColor: active ? `${color}20` : undefined
    }}>
        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'animate-pulse' : 'bg-gray-800'}`} style={{ backgroundColor: active ? color : undefined }}></div>
        <span className={`text-[9px] font-bold uppercase tracking-widest ${active ? 'text-white' : 'text-gray-700'}`}>{label}</span>
    </div>
);

// --- RALLY STYLE ---

export const ConnectedRallyDataBlock: React.FC<{ label: string; dataKey: string; unit?: string; alertThreshold?: number; alertCondition?: 'greater' | 'less'; fixed?: number }> = React.memo(({ label, dataKey, unit, alertThreshold, alertCondition, fixed = 1 }) => {
    const valMotion = useMotionValue(0);
    const [isAlert, setIsAlert] = useState(false);
    const showDataOverlay = useUIStore(state => state.showDataOverlay);

    const longPressEvents = useLongPress(() => {
        showDataOverlay(dataKey, label);
    }, 600);

    useEffect(() => {
        let rafId: number;
        const loop = () => {
            const currentVal = useVehicleStore.getState().latestData[dataKey as keyof SensorDataPoint] as number;
            
            if (currentVal !== undefined) {
                valMotion.set(currentVal);
                
                if (alertThreshold !== undefined && alertCondition) {
                    const alert = alertCondition === 'greater' ? currentVal > alertThreshold : currentVal < alertThreshold;
                    setIsAlert(prev => prev !== alert ? alert : prev);
                }
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [dataKey, alertThreshold, alertCondition, valMotion]);
    
    const displayValue = useTransform(valMotion, v => (typeof v === 'number' ? v.toFixed(fixed) : '0.0'));

    return (
        <motion.div 
            {...longPressEvents}
            animate={{ 
                backgroundColor: isAlert ? '#dc2626' : '#151515',
                borderColor: isAlert ? '#991b1b' : '#333',
                scale: isAlert ? [1, 1.02, 1] : 1
            }}
            transition={{ 
                duration: isAlert ? 0.5 : 0.2, 
                repeat: isAlert ? Infinity : 0 
            }}
            className="relative p-3 md:p-4 border-b-4 border-r-4 group overflow-hidden skew-x-[-12deg] shadow-lg flex flex-col justify-between min-h-[100px] md:min-h-[110px] w-full cursor-pointer cursor-crosshair active:scale-95"
        >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50"></div>
            <div className="skew-x-[12deg] flex justify-between items-start">
                <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${isAlert ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                <span className="text-[10px] md:text-xs font-bold text-gray-700">-</span>
            </div>
            <div className="skew-x-[12deg] flex items-baseline gap-1.5 mt-auto">
                <motion.span 
                    className={`font-mono font-black tracking-tighter leading-none shadow-black drop-shadow-md text-3xl sm:text-4xl lg:text-5xl italic truncate ${isAlert ? 'text-white' : 'text-[var(--theme-color)]'}`}
                >
                    {displayValue}
                </motion.span>
                {unit && <span className={`font-sans font-bold uppercase text-[9px] md:text-[10px] italic underline decoration-black/50 ${isAlert ? 'text-white/80' : 'text-white/40'}`}>{unit}</span>}
            </div>
        </motion.div>
    );
});

export const StageTimer: React.FC<{ time: number }> = ({ time }) => {
    return (
        <div className="bg-[#000] border-2 border-white rounded p-4 flex flex-col items-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">Stage Time</span>
            <div className="font-mono text-5xl font-bold text-white tracking-widest tabular-nums leading-none">
                {formatTimeMS(time)}
            </div>
        </div>
    );
};

// --- CLASSIC / MOTORSPORT STYLE ---

export const TraceGraph: React.FC<{ 
    data: number[] | { values: number[]; color: string; label?: string }[]; 
    color?: string; 
    min: number; 
    max: number; 
    height?: number;
    showGrid?: boolean;
}> = ({ data, color = '#00F0FF', min, max, height = 40, showGrid = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { desynchronized: true });
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const range = max - min;

        ctx.clearRect(0, 0, w, h);

        if (showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let i=0; i<w; i+=w/10) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
            for(let j=0; j<h; j+=h/4) { ctx.moveTo(0, j); ctx.lineTo(w, j); }
            ctx.stroke();
        }

        const series = Array.isArray(data[0]) || typeof data[0] === 'number' 
            ? [{ values: data as number[], color }] 
            : data as { values: number[]; color: string; label?: string }[];

        series.forEach(s => {
            if (s.values.length < 2) return;

            ctx.beginPath();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 5;

            s.values.forEach((val, i) => {
                const x = (i / (s.values.length - 1)) * w;
                const y = h - ((val - min) / range) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.fillStyle = s.color + '11';
            ctx.fill();
        });

    }, [data, color, min, max, showGrid]);

    return <canvas ref={canvasRef} width={600} height={height * 2} className="w-full h-full bg-black/40 rounded border border-white/5" style={{ height: `${height}px` }} />;
};

export const ConnectedTraceGraph: React.FC<{ 
    dataKey?: string; 
    multiKeys?: { key: string; color: string; label?: string; scale?: number }[];
    min: number; 
    max: number; 
    height?: number;
    showGrid?: boolean;
    historyLength?: number;
}> = ({ dataKey, multiKeys, min, max, height = 40, showGrid = true, historyLength = 150 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const historyRef = useRef<{[key: string]: Float32Array}>({});
    const headRef = useRef(0);

    useEffect(() => {
        const keys = dataKey ? [dataKey] : (multiKeys?.map(m => m.key) || []);
        keys.forEach(k => {
            historyRef.current[k] = new Float32Array(historyLength);
        });
    }, [dataKey, multiKeys, historyLength]);

    useEffect(() => {
        let rafId: number;
        const loop = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { alpha: false, desynchronized: true });
            if (!canvas || !ctx) {
                rafId = requestAnimationFrame(loop);
                return;
            }

            const state = useVehicleStore.getState();
            const d = state.latestData;
            const head = headRef.current;

            // Update buffers
            if (dataKey) {
                historyRef.current[dataKey][head] = (d as any)[dataKey] || 0;
            }
            if (multiKeys) {
                multiKeys.forEach(m => {
                    historyRef.current[m.key][head] = (d as any)[m.key] || 0;
                });
            }

            headRef.current = (head + 1) % historyLength;

            // Render
            const w = canvas.width;
            const h = canvas.height;
            const range = max - min || 1;

            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, w, h);

            if (showGrid) {
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for(let i=0; i<w; i+=w/10) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
                for(let j=0; j<h; j+=h/4) { ctx.moveTo(0, j); ctx.lineTo(w, j); }
                ctx.stroke();
            }

            const series = dataKey 
                ? [{ key: dataKey, color: '#00F0FF', scale: 1 }] 
                : (multiKeys || []);

            series.forEach(s => {
                const data = historyRef.current[s.key];
                if (!data) return;

                ctx.beginPath();
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                const scale = s.scale || 1;

                for (let i = 0; i < historyLength; i++) {
                    const idx = (headRef.current + i) % historyLength;
                    const val = data[idx] * scale;
                    const x = (i / (historyLength - 1)) * w;
                    const y = h - ((val - min) / range) * h;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            });

            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [dataKey, multiKeys, min, max, showGrid, historyLength]);

    return <canvas ref={canvasRef} width={600} height={height * 2} className="w-full h-full bg-black/40 rounded border border-white/5" style={{ height: `${height}px` }} />;
};

export const ShiftLights: React.FC<{ rpm: number; limit: number; numLeds?: number; range?: number }> = React.memo(({ rpm, limit, numLeds = 16, range = 3000 }) => {
    const startRpm = limit - range;
    const activeLeds = rpm < startRpm ? 0 : Math.min(numLeds, Math.ceil(((rpm - startRpm) / range) * numLeds));
    const isShift = rpm >= limit;

    return (
        <div className="flex gap-[2px] w-full h-6 md:h-8 bg-[#050505] p-1 border-b border-[#222]">
            {Array.from({ length: numLeds }).map((_, i) => {
                let color = '#16a34a'; // green-600
                if (i > numLeds * 0.4) color = '#eab308'; // yellow-500
                if (i > numLeds * 0.7) color = '#dc2626'; // red-600
                if (isShift) color = '#3b82f6'; // blue-500

                const isActive = i < activeLeds || isShift;
                
                return (
                    <motion.div 
                        key={i} 
                        initial={false}
                        animate={{
                            backgroundColor: isActive ? color : '#151515',
                            opacity: isActive ? 1 : 0.3,
                            scaleY: isActive ? 1.1 : 1,
                            boxShadow: isActive ? `0 0 15px ${color}` : 'none'
                        }}
                        transition={{ duration: 0.05 }}
                        className="flex-1 rounded-[1px]"
                    />
                );
            })}
        </div>
    );
});

export const ClassicDataCell: React.FC<{ 
    label: string; 
    value?: string | number; 
    dataKey?: string;
    unit?: string; 
    alert?: boolean;
    fixed?: number;
}> = React.memo(({ label, value, dataKey, unit, alert, fixed = 1 }) => {
    const valMotion = useAnimatedValue(dataKey || (typeof value === 'number' ? value : parseFloat(value as string) || 0), { 
        stiffness: 180, damping: 22, mass: 0.7 
    });

    useEffect(() => {
        if (!dataKey && value !== undefined) {
            valMotion.set(typeof value === 'number' ? value : parseFloat(value as string) || 0);
        }
    }, [dataKey, value, valMotion]);

    const displayVal = useTransform(valMotion, v => v.toFixed(fixed));

    return (
        <div className={`flex flex-col justify-between p-2 border border-[#222] bg-gradient-to-b from-[#111] to-[#080808] rounded ${alert ? 'bg-red-900/20 border-red-500/50' : ''}`}>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
            <div className="flex items-baseline justify-end gap-1">
                <motion.span className={`text-xl font-mono font-bold ${alert ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {displayVal}
                </motion.span>
                {unit && <span className="text-[9px] text-gray-600 font-mono font-bold uppercase">{unit}</span>}
            </div>
        </div>
    );
});

// --- MODERN / FUTURISTIC STYLE ---

export const ModernDataWidget: React.FC<{ 
    label: string; 
    value?: string | number; 
    dataKey?: string;
    unit: string; 
    color?: string;
    align?: 'left' | 'right';
    fixed?: number;
}> = React.memo(({ label, value, dataKey, unit, color, align = 'left', fixed = 1 }) => {
    const valMotion = useAnimatedValue(dataKey || (typeof value === 'number' ? value : parseFloat(value as string) || 0), { 
        stiffness: 180, damping: 22, mass: 0.7 
    });

    useEffect(() => {
        if (!dataKey && value !== undefined) {
            valMotion.set(typeof value === 'number' ? value : parseFloat(value as string) || 0);
        }
    }, [dataKey, value, valMotion]);

    const animatedDisplay = useTransform(valMotion, v => v.toFixed(fixed));

    return (
        <motion.div 
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            className={`
                group relative flex flex-col justify-center py-4 md:py-6 px-4 md:px-6 mb-2 md:mb-4 w-full min-h-[100px] md:min-h-[120px]
                bg-black/80 backdrop-blur-3xl border-y border-white/10
                transition-all duration-300 hover:border-brand-purple hover:shadow-[0_0_20px_rgba(188,19,254,0.2)]
                ${align === 'left' ? 'border-l-4 border-l-brand-cyan items-start' : 'border-r-4 border-r-brand-cyan items-end'}
            `}
        >
            <div className={`absolute inset-0 z-0 bg-gradient-to-br ${align === 'left' ? 'from-brand-cyan/5' : 'from-brand-purple/5'} to-transparent pointer-events-none`}></div>
            <div className={`flex flex-col ${align === 'left' ? 'items-start' : 'items-end'} w-full relative z-10`}>
                <span className="text-[10px] md:text-sm font-display font-black uppercase tracking-[0.3em] text-gray-500 mb-2 md:mb-3 group-hover:text-brand-purple transition-colors truncate w-full">
                    {label}
                </span>
                <div className={`flex items-baseline gap-2 md:gap-3 w-full ${align === 'left' ? 'justify-start' : 'justify-end'} overflow-hidden`}>
                    <motion.span 
                        className={`font-display ${color || 'text-white'} tracking-tighter leading-none drop-shadow-[0_0_15px_currentColor] text-4xl sm:text-5xl lg:text-7xl italic truncate mix-blend-plus-lighter`}
                    >
                        {animatedDisplay}
                    </motion.span>
                    <span className="font-mono font-black text-gray-600 uppercase text-[9px] md:text-xs italic underline decoration-gray-800 shrink-0 tracking-widest">{unit}</span>
                </div>
            </div>
        </motion.div>
    );
});

// --- PRO TUNER / VERTICAL STYLE ---

export const SlantedDataBlock: React.FC<{
    label: string;
    value?: string | number;
    dataKey?: string;
    unit: string;
    color?: string;
    isRight?: boolean;
    fixed?: number;
}> = React.memo(({ label, value, dataKey, unit, color = "#00F0FF", isRight = false, fixed = 1 }) => {
    const valMotion = useAnimatedValue(dataKey || (typeof value === 'number' ? value : parseFloat(value as string) || 0), { 
        stiffness: 180, damping: 22, mass: 0.7 
    });

    useEffect(() => {
        if (!dataKey && value !== undefined) {
            valMotion.set(typeof value === 'number' ? value : parseFloat(value as string) || 0);
        }
    }, [dataKey, value, valMotion]);

    const animatedDisplay = useTransform(valMotion, v => v.toFixed(fixed));

    return (
        <div className={`relative w-full min-h-[110px] md:min-h-[140px] lg:h-full lg:max-h-[180px] mb-4 group overflow-hidden shadow-[0_10px_30px_rgb(0,0,0,0.5)]`}>
            {/* Background Shape */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                <path 
                    d={isRight ? "M 0 0 L 96 0 L 100 40 L 4 40 Z" : "M 4 0 L 100 0 L 96 40 L 0 40 Z"} 
                    fill="rgba(5,5,5,0.85)" 
                    stroke="rgba(255,255,255,0.15)" 
                    strokeWidth="0.5"
                    className="transition-all duration-300 group-hover:fill-[rgba(10,10,10,0.95)] group-hover:stroke-[rgba(255,255,255,0.3)] backdrop-blur-xl"
                />
                {/* Accent Line */}
                <path 
                    d={isRight ? "M 96 0 L 100 40" : "M 4 0 L 0 40"} 
                    stroke={color} 
                    strokeWidth="4"
                    className="drop-shadow-[0_0_10px_currentColor]"
                />
            </svg>

            <div className={`relative z-10 h-full flex flex-col justify-between py-4 md:py-6 ${isRight ? 'items-end pr-10' : 'items-start pl-10'}`}>
                <span className="text-[10px] md:text-sm font-display font-black text-gray-400 uppercase tracking-[0.4em] group-hover:text-white transition-colors">{label}</span>
                <div className={`flex items-baseline gap-2 mt-2 w-full ${isRight ? 'justify-end' : 'justify-start'}`}>
                    <motion.span 
                        className="font-display tracking-tighter text-white leading-none text-4xl sm:text-5xl lg:text-6xl italic mix-blend-plus-lighter" 
                        style={{ filter: `drop-shadow(0 0 15px ${color}80)` }}
                    >
                        {animatedDisplay}
                    </motion.span>
                    <span className="font-mono font-black text-gray-500 uppercase tracking-[0.2em] text-[8px] md:text-xs italic underline decoration-gray-800">{unit}</span>
                </div>
            </div>
        </div>
    );
});

export const VerticalChannel: React.FC<{
    label: string; value: number; unit: string; min: number; max: number; warnLow?: number; warnHigh?: number; precision?: number;
}> = ({ label, value, unit, min, max, warnLow, warnHigh, precision = 0 }) => {
    const valMotion = useMotionValue(value);
    const smoothVal = useSpring(valMotion, { stiffness: 100, damping: 20, mass: 1 });
    const barRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        valMotion.set(value);
    }, [value, valMotion]);

    useEffect(() => {
        let rafId: number;
        const update = () => {
            const current = smoothVal.get();
            const percent = Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100));
            const isWarning = (warnHigh !== undefined && current >= warnHigh) || (warnLow !== undefined && current <= warnLow);
            
            if (barRef.current) {
                barRef.current.style.height = `${percent}%`;
                if (isWarning) {
                    barRef.current.className = `w-full rounded-sm transition-all duration-75 bg-red-500 shadow-[0_0_10px_currentColor]`;
                } else if (percent > 80) {
                    barRef.current.className = `w-full rounded-sm transition-all duration-75 bg-yellow-400 shadow-[0_0_10px_currentColor]`;
                } else {
                    barRef.current.className = `w-full rounded-sm transition-all duration-75 bg-brand-cyan shadow-[0_0_10px_currentColor]`;
                }
            }
            
            if (textRef.current) {
                textRef.current.textContent = current.toFixed(precision);
                textRef.current.className = `font-mono font-bold text-lg md:text-xl ${isWarning ? 'text-red-500' : 'text-white'}`;
            }

            if (containerRef.current) {
                containerRef.current.className = `w-full bg-[#080808] border border-white/10 rounded py-1.5 md:py-2 text-center ${isWarning ? 'border-red-500/50' : ''}`;
            }

            rafId = requestAnimationFrame(update);
        };
        rafId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafId);
    }, [min, max, warnHigh, warnLow, precision, smoothVal]);

    return (
        <div className="flex flex-col items-center w-full h-full min-h-[140px] md:min-h-[160px] lg:h-full lg:max-h-[220px] gap-2 lg:gap-3">
            <div className="flex justify-between w-full px-1">
                <span className={`text-[9px] md:text-xs font-display font-black uppercase tracking-widest truncate text-gray-500`}>{label}</span>
                <span className="text-[8px] md:text-[10px] font-mono text-gray-600 shrink-0 uppercase tracking-widest">{unit}</span>
            </div>
            <div className="flex-1 w-full bg-[#050505] rounded border border-white/5 relative overflow-hidden flex flex-col justify-end p-1 shadow-[inset_0_4px_20px_rgb(0,0,0,0.8)] backdrop-blur-sm">
                <div className="absolute inset-0 flex flex-col justify-between py-1 px-2 z-10 pointer-events-none opacity-20">
                    {[0,1,2,3,4].map(i => <div key={i} className="w-full h-px border-b border-white border-dashed"></div>)}
                </div>
                <div ref={barRef} className={`w-full rounded-sm transition-all duration-75 bg-brand-cyan shadow-[0_0_15px_currentColor] mix-blend-plus-lighter`} style={{ height: '0%' }}></div>
            </div>
            <div ref={containerRef} className={`w-full bg-[#050505] border border-white/10 rounded py-2 md:py-3 lg:py-4 text-center shrink-0 shadow-[0_4px_15px_rgb(0,0,0,0.5)]`}>
                <span ref={textRef} className={`font-display font-black text-xl md:text-2xl lg:text-3xl text-white tracking-tighter`}>0</span>
            </div>
        </div>
    );
};

export const ConnectedFooterStat: React.FC<{ 
    label: string, 
    dataKey: string, 
    unit: string, 
    bootVal?: number, 
    isBooting?: boolean, 
    formatFn?: (val: number) => string, 
    colorFn?: (val: number) => string,
    fixed?: number,
    color?: string
}> = React.memo(({ label, dataKey, unit, bootVal = 0, isBooting = false, formatFn, colorFn, fixed = 0, color }) => {
    const smoothVal = useAnimatedValue(isBooting ? bootVal : dataKey, { stiffness: 200, damping: 25 });
    const displayValue = useTransform(smoothVal, (v) => formatFn ? formatFn(v) : v.toFixed(fixed));
    const [colorClass, setColorClass] = useState(color || (colorFn ? colorFn(bootVal) : 'text-white'));

    useEffect(() => {
        if (!colorFn) return;
        return smoothVal.on("change", (v) => {
            const newColor = colorFn(v);
            setColorClass(prev => prev !== newColor ? newColor : prev);
        });
    }, [smoothVal, colorFn]);

    return (
        <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2 font-technical">{label}</span>
            <div className="flex items-baseline gap-2">
                <motion.span className={`text-3xl md:text-5xl font-mono font-black tracking-tighter ${colorClass}`}>{displayValue}</motion.span>
                <span className="text-xs font-black text-gray-600 uppercase tracking-widest font-technical">{unit}</span>
            </div>
        </div>
    );
});
