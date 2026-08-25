import React, { useEffect, useRef, useState } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';

interface TelemetryCanvasProps {
    sensors: string[];
}

interface SensorMeta {
    min: number;
    max: number;
    unit: string;
    label: string;
    patternColor: string;
    glowColor: string;
}

const getSensorMeta = (sensor: string): SensorMeta => {
    switch (sensor) {
        case 'rpm': 
            return { min: 0, max: 10000, unit: 'RPM', label: 'Engine Speed', patternColor: '#00F0FF', glowColor: 'rgba(0, 240, 255, 0.4)' };
        case 'speed': 
            return { min: 0, max: 300, unit: 'km/h', label: 'Velocity', patternColor: '#FF003C', glowColor: 'rgba(255, 0, 60, 0.4)' };
        case 'turboBoost': 
            return { min: -1.0, max: 3.0, unit: 'Bar', label: 'Boost Pressure', patternColor: '#BC13FE', glowColor: 'rgba(188, 19, 254, 0.4)' };
        case 'lambda': 
            return { min: 0.65, max: 1.35, unit: 'λ', label: 'Combustion Lambda', patternColor: '#FFC800', glowColor: 'rgba(255, 200, 0, 0.4)' };
        case 'throttlePos': 
            return { min: 0, max: 100, unit: '%', label: 'TPS', patternColor: '#39FF14', glowColor: 'rgba(57, 255, 20, 0.4)' };
        case 'engineLoad': 
            return { min: 0, max: 100, unit: '%', label: 'Engine Load', patternColor: '#EA00FF', glowColor: 'rgba(234, 0, 255, 0.4)' };
        case 'brakeTemp': 
            return { min: 20, max: 900, unit: '°C', label: 'Brake Temp', patternColor: '#FF5E00', glowColor: 'rgba(255, 94, 0, 0.4)' };
        case 'engineTemp': 
            return { min: 20, max: 130, unit: '°C', label: 'Engine Temp', patternColor: '#00FFC4', glowColor: 'rgba(0, 255, 196, 0.4)' };
        case 'steeringAngle': 
            return { min: -180, max: 180, unit: '°', label: 'Steering Angle', patternColor: '#0095FF', glowColor: 'rgba(0, 149, 255, 0.4)' };
        case 'gForceX': 
            return { min: -2.0, max: 2.0, unit: 'G', label: 'Longitudinal G', patternColor: '#FF3366', glowColor: 'rgba(255, 51, 102, 0.4)' };
        case 'gForceY': 
            return { min: -2.0, max: 2.0, unit: 'G', label: 'Lateral G', patternColor: '#9D00FF', glowColor: 'rgba(157, 0, 255, 0.4)' };
        default: 
            return { min: 0, max: 100, unit: '', label: sensor, patternColor: '#FFFFFF', glowColor: 'rgba(255, 255, 255, 0.2)' };
    }
};

export const TelemetryCanvas: React.FC<TelemetryCanvasProps> = ({ sensors }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const data = useVehicleStore(state => state.data);
    const latestData = useVehicleStore(state => state.latestData);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [mouseCoords, setMouseCoords] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

    // High fidelity coordinate mappings
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleResize = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            
            // Track High-DPI Retinal screens
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(dpr, dpr);
            }
            renderCanvas(rect.width, rect.height);
        };

        const renderCanvas = (width: number, height: number) => {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, width, height);

            const activeHistory = data.slice(-200);
            const historyLen = activeHistory.length;
            if (historyLen === 0) return;

            // Draw dark technical background grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            
            // Vertical divisions (time based)
            const numVertLines = 15;
            for (let i = 0; i <= numVertLines; i++) {
                const x = (i / numVertLines) * width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // Horizontal divisions (scale based)
            const numHorizLines = 6;
            for (let i = 1; i < numHorizLines; i++) {
                const y = (i / numHorizLines) * height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                
                // Fine watermark lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.beginPath();
                ctx.moveTo(0, y - 10);
                ctx.lineTo(width, y - 10);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            }

            // Draw waveforms
            sensors.forEach((sensor) => {
                const meta = getSensorMeta(sensor);
                const points: { x: number, y: number }[] = [];

                activeHistory.forEach((point, idx) => {
                    // Fit to history index coordinates
                    const x = (idx / 199) * width;
                    const valRaw = point[sensor as keyof typeof point];
                    const val = typeof valRaw === 'number' ? valRaw : 0;
                    
                    // Normalize to sensor range mapping bounds
                    const pct = (val - meta.min) / (meta.max - meta.min);
                    const clampedPct = Math.max(0, Math.min(1, pct));
                    // Canvas y coordinates are invert-flipped (0 top, height bottom)
                    // Keep 5% vertical margin buffer top and bottom for visual excellence
                    const y = height - (0.05 * height + clampedPct * 0.9 * height);
                    
                    points.push({ x, y });
                });

                // Render Glow Wave Trace Path Outer Core
                ctx.shadowColor = meta.patternColor;
                ctx.shadowBlur = 8;
                ctx.strokeStyle = meta.glowColor;
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                points.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.stroke();

                // Render Sharpened Center Solid Trace Line
                ctx.shadowBlur = 0;
                ctx.strokeStyle = meta.patternColor;
                ctx.lineWidth = 1.75;
                ctx.stroke();
            });

            // Draw Interactive Hover crosshair and data points tracking
            if (hoverIndex !== null && hoverIndex < historyLen) {
                const x = (hoverIndex / 199) * width;
                
                // Neon vertical crosshair marker rule
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                ctx.setLineDash([]); // clear dash state

                // Highlight nodes intersection intersections
                sensors.forEach((sensor) => {
                    const meta = getSensorMeta(sensor);
                    const point = activeHistory[hoverIndex];
                    const valRaw = point[sensor as keyof typeof point];
                    const val = typeof valRaw === 'number' ? valRaw : 0;
                    
                    const pct = (val - meta.min) / (meta.max - meta.min);
                    const clampedPct = Math.max(0, Math.min(1, pct));
                    const y = height - (0.05 * height + clampedPct * 0.9 * height);

                    // Outer tracking halo circles
                    ctx.beginPath();
                    ctx.fillStyle = meta.patternColor;
                    ctx.shadowColor = meta.patternColor;
                    ctx.shadowBlur = 10;
                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                    ctx.fill();

                    // Sharp white structural core circle
                    ctx.beginPath();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }
        };

        // Initialize and setup ResizeObserver
        const resizeObserver = new ResizeObserver(() => handleResize());
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        
        handleResize();

        return () => {
            resizeObserver.disconnect();
        };
    }, [data, sensors, hoverIndex]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMouseCoords({ x, y });

        const pct = x / rect.width;
        
        // Match history array sample size index
        const index = Math.round(pct * 199);
        const historyLen = data.slice(-200).length;
        
        if (index >= 0 && index < historyLen) {
            setHoverIndex(index);
        } else {
            setHoverIndex(null);
        }
    };

    const handleMouseLeave = () => {
        setHoverIndex(null);
    };

    // Grab telemetry context points for current view point (hovered or latest data)
    const activeHistory = data.slice(-200);
    const resolvedIndex = hoverIndex !== null ? hoverIndex : (activeHistory.length > 0 ? activeHistory.length - 1 : null);
    const resolvedPoint = resolvedIndex !== null ? activeHistory[resolvedIndex] : null;

    return (
        <div ref={containerRef} className="relative w-full h-full flex flex-col group/chart bg-black/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-md">
            {/* Top Wave Legend Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-display font-bold text-white tracking-widest uppercase text-[10px]">Telemetry Stream</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    {sensors.map((sensor) => {
                        const meta = getSensorMeta(sensor);
                        const valRaw = resolvedPoint ? resolvedPoint[sensor as keyof typeof resolvedPoint] : latestData[sensor as keyof typeof latestData];
                        const val = typeof valRaw === 'number' ? valRaw : 0;
                        return (
                            <div key={sensor} className="flex items-center gap-2 bg-black/45 px-2.5 py-1 rounded-md border border-white/5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.patternColor, boxShadow: `0 0 6px ${meta.patternColor}` }} />
                                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">{meta.unit}:</span>
                                <span className="font-mono text-white text-[10px] font-black">{val.toFixed(sensor === 'lambda' ? 3 : (sensor === 'turboBoost' ? 2 : 0))}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Core Canvas Target Frame */}
            <div 
                className="relative flex-1 min-h-[160px] cursor-crosshair overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                
                {/* Holographic Tooltip Glass Panel */}
                {hoverIndex !== null && resolvedPoint && (
                    <div 
                        className="absolute z-10 pointer-events-none bg-black/85 backdrop-blur-md border border-white/10 rounded-lg p-2 text-[10px] shadow-2xl flex flex-col gap-1 text-slate-300 min-w-[125px]"
                        style={{ 
                            left: Math.min(mouseCoords.x + 15, (containerRef.current?.getBoundingClientRect().width || 800) - 145), 
                            top: Math.min(mouseCoords.y + 15, (containerRef.current?.getBoundingClientRect().height || 300) - 100) 
                        }}
                    >
                        <div className="border-b border-white/10 pb-1 mb-1 font-bold tracking-widest text-[#9D00FF] uppercase text-[8px]">
                            Cursor Reference
                        </div>
                        {sensors.map((sensor) => {
                            const meta = getSensorMeta(sensor);
                            const valRaw = resolvedPoint[sensor as keyof typeof resolvedPoint];
                            const val = typeof valRaw === 'number' ? valRaw : 0;
                            return (
                                <div key={sensor} className="flex items-center justify-between gap-4 font-mono">
                                    <span className="text-gray-500">{meta.unit || sensor}</span>
                                    <span className="font-black text-white" style={{ color: meta.patternColor }}>
                                        {val.toFixed(sensor === 'lambda' ? 3 : (sensor === 'turboBoost' ? 2 : 0))}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
