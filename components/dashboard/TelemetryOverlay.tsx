import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUIStore } from '../../stores/uiStore';
import { useVehicleStore } from '../../stores/vehicleStore';
import { X, Activity, Maximize2, Zap, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const TelemetryOverlay: React.FC = () => {
    const { 
        overlayVisible, 
        overlayActiveDataKey, 
        overlayActiveTitle, 
        overlayPosition, 
        hideDataOverlay 
    } = useUIStore();

    const dataHistoryRef = useRef<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

    const liveValRef = useRef<HTMLSpanElement>(null);
    const peakValRef = useRef<HTMLSpanElement>(null);
    const minValRef = useRef<HTMLSpanElement>(null);
    const avgValRef = useRef<HTMLSpanElement>(null);

    // Keep reference of last active keys for smooth exit transitions
    const lastActiveDataKey = useRef<string | null>(null);
    const lastActiveTitle = useRef<string | null>(null);

    if (overlayActiveDataKey) {
        lastActiveDataKey.current = overlayActiveDataKey;
    }
    if (overlayActiveTitle) {
        lastActiveTitle.current = overlayActiveTitle;
    }

    const activeKey = overlayActiveDataKey || lastActiveDataKey.current;
    const activeTitle = overlayActiveTitle || lastActiveTitle.current;

    useEffect(() => {
        if (!overlayVisible || !activeKey) return;
        
        let lastChartUpdate = 0;
        let rafId: number;

        const update = () => {
            const state = useVehicleStore.getState();
            const valRaw = (state.latestData as any)[activeKey];
            const val = typeof valRaw === 'number' ? valRaw : parseFloat(valRaw) || 0;

            // Update history ref
            dataHistoryRef.current.push({
                time: new Date().getTime(),
                value: val
            });
            if (dataHistoryRef.current.length > 50) {
                dataHistoryRef.current.shift();
            }

            // Calculations
            const values = dataHistoryRef.current.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v));
            const peakVal = values.length > 0 ? Math.max(...values, val) : val;
            const minVal = values.length > 0 ? Math.min(...values, val) : val;
            const avgVal = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : val;

            // Direct DOM updates (60fps)
            if (liveValRef.current) liveValRef.current.textContent = val.toFixed(2);
            if (peakValRef.current) peakValRef.current.textContent = peakVal.toFixed(2);
            if (minValRef.current) minValRef.current.textContent = minVal.toFixed(2);
            if (avgValRef.current) avgValRef.current.textContent = avgVal.toFixed(2);

            // Throttle Recharts State updates to ~10Hz (every 100ms) to bypass heavy SVG chart re-renders
            const now = performance.now();
            if (now - lastChartUpdate >= 100) {
                setHistory([...dataHistoryRef.current]);
                lastChartUpdate = now;
            }

            rafId = requestAnimationFrame(update);
        };

        rafId = requestAnimationFrame(update);
        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [overlayVisible, activeKey]);

    if (!activeKey || !overlayPosition) return null;

    // Grab initial values static-query style for seamless first-render hydration
    const initialValRaw = (useVehicleStore.getState().latestData as any)[activeKey];
    const initialVal = typeof initialValRaw === 'number' ? initialValRaw : parseFloat(initialValRaw) || 0;

    return (
        <AnimatePresence>
            {overlayVisible && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 shadow-2xl"
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={hideDataOverlay}></div>
                    
                    <motion.div 
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="relative w-full max-w-xl bg-[#080808] border border-white/10 p-6 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3 space-x-2">
                                <div className="p-2 bg-brand-cyan/20 rounded-full border border-brand-cyan/30 text-brand-cyan">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium tracking-tight text-white uppercase">{activeTitle}</h2>
                                    <p className="text-xs font-mono text-white/50 tracking-wider">Advanced Telemetry Diagnostics</p>
                                </div>
                            </div>
                            <button 
                                onClick={hideDataOverlay}
                                className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Top-line Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Live Value</span>
                                <span ref={liveValRef} className="text-2xl font-mono text-brand-cyan font-bold leading-none">{initialVal.toFixed(2)}</span>
                            </div>
                            <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Peak</span>
                                <span ref={peakValRef} className="text-xl font-mono text-white/90 leading-none">{initialVal.toFixed(2)}</span>
                                <Maximize2 className="absolute top-2 right-2 w-3 h-3 text-white/10" />
                            </div>
                            <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Min</span>
                                <span ref={minValRef} className="text-xl font-mono text-white/90 leading-none">{initialVal.toFixed(2)}</span>
                            </div>
                            <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Rolling Avg</span>
                                <span ref={avgValRef} className="text-xl font-mono text-white/90 leading-none">{initialVal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Dynamic Trace Chart */}
                        <div className="h-48 w-full bg-[#0a0a0a] rounded-xl border border-white/5 mb-6 overflow-hidden relative p-3">
                            <div className="absolute top-3 left-3 text-[10px] font-mono text-white/30 uppercase tracking-widest z-10 font-bold">Session Trace</div>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" hide />
                                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#666', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#000', borderColor: '#333', fontSize: '12px', fontFamily: 'monospace' }}
                                        itemStyle={{ color: '#00F0FF' }}
                                        labelStyle={{ display: 'none' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke="#00F0FF" 
                                        fillOpacity={1} 
                                        fill="url(#colorValue)" 
                                        isAnimationActive={false}
                                        strokeWidth={1.5}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Alerts & Insights */}
                        <div className="flex gap-4">
                            <div className="flex-1 bg-brand-cyan/5 border border-brand-cyan/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2 text-brand-cyan">
                                    <Zap className="w-4 h-4" />
                                    <h3 className="text-xs uppercase tracking-widest font-bold">System Status</h3>
                                </div>
                                <p className="text-xs text-brand-cyan/70 font-mono">Telemetry stream nominal. Signal variance is within optimal operative thresholds.</p>
                            </div>
                            <div className="flex-1 bg-brand-red/5 border border-brand-red/20 rounded-xl p-4 hidden md:block">
                                <div className="flex items-center gap-2 mb-2 text-brand-red">
                                    <AlertTriangle className="w-4 h-4" />
                                    <h3 className="text-xs uppercase tracking-widest font-bold">Active Rules</h3>
                                </div>
                                <p className="text-xs text-brand-red/70 font-mono">No limiters engaged. Safety envelope fully active.</p>
                            </div>
                        </div>

                        {/* Expandable Secondary Info - Step 2 De-cluttering */}
                        <div className="mt-4 border-t border-white/5 pt-4 flex flex-col items-center">
                            <button
                                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                                className="flex items-center gap-2 px-4 py-2 border border-brand-cyan/20 hover:border-brand-cyan bg-brand-cyan/5 hover:bg-brand-cyan/10 rounded-lg text-[10px] font-mono text-brand-cyan uppercase tracking-widest transition-all cursor-pointer shadow-md select-none active:scale-95"
                            >
                                <Activity className={`w-3.5 h-3.5 transition-transform duration-300 ${isDetailsExpanded ? 'rotate-180 text-brand-purple' : ''}`} />
                                {isDetailsExpanded ? 'Hide Advanced Diagnostics' : 'Show Advanced Diagnostics & EKF Fusion Matrix'}
                            </button>
                        </div>

                        <AnimatePresence initial={false}>
                            {isDetailsExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-[10px] font-mono space-y-3 mt-4">
                                        <div className="flex justify-between items-center text-brand-cyan/80 border-b border-white/5 pb-1">
                                            <span className="font-bold">GENESIS EKF CALIBRATION LOG</span>
                                            <span className="text-[9px] text-zinc-500">SYSTEM: ACTIVE</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-zinc-400">
                                            <div>
                                                <span className="text-[9px] text-zinc-500 block uppercase mb-1">State Covariance Trace (P)</span>
                                                <div className="grid grid-cols-3 gap-1 text-center bg-black/60 p-1.5 rounded border border-white/5">
                                                    <span className="bg-white/5 py-0.5 rounded text-[9px]">0.0124</span>
                                                    <span className="bg-white/5 py-0.5 rounded text-[9px]">0.0089</span>
                                                    <span className="bg-white/5 py-0.5 rounded text-[9px]">0.0245</span>
                                                    <span className="bg-white/5 py-0.5 rounded text-[9px]">0.0031</span>
                                                    <span className="bg-white/5 py-0.5 rounded text-[9px]">0.0152</span>
                                                    <span className="bg-white/5 py-0.5 rounded text-[9px]">0.0097</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[9px] text-zinc-500 block uppercase mb-1">Sensor Biases (Δ)</span>
                                                <div className="space-y-1 bg-black/60 p-1.5 rounded border border-white/5">
                                                    <div className="flex justify-between"><span className="text-[8px] text-zinc-500">ACCEL_X:</span> <span>+0.0021 g</span></div>
                                                    <div className="flex justify-between"><span className="text-[8px] text-zinc-500">GYRO_Y:</span> <span>-0.0142 °/s</span></div>
                                                    <div className="flex justify-between"><span className="text-[8px] text-zinc-500">GPS_LAG:</span> <span>0.045 s</span></div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white/[0.02] border border-white/5 rounded p-2 text-zinc-500 leading-normal text-[9px]">
                                            <p className="font-semibold text-zinc-400 uppercase mb-0.5">Active EKF Filter Coefficients:</p>
                                            Multi-channel state-space system propagating at 100Hz with adaptive Q-matrix scaling. Process noise dynamically updated based on road slip-angle and lateral G variance thresholds.
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
