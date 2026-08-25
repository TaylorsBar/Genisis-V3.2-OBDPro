import React, { useMemo } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { Activity, AlertTriangle, CheckCircle, Flame, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export const SystemHealthMonitor: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const dtcs = useVehicleStore(state => state.dtcs);
    const readiness = useVehicleStore(state => state.readiness);
    const hasActiveFault = useVehicleStore(state => state.hasActiveFault);

    const healthMetrics = useMemo(() => {
        if (!latestData) return null;

        const { engineTemp, oilPressure, knockLevel, lambda } = latestData;

        // Simple mock health evaluation logic
        const engineTempOk = engineTemp > 70 && engineTemp < 110;
        const oilPressureOk = oilPressure > 20; // Simplified
        const knockOk = knockLevel < 5;
        const lambdaOk = lambda > 0.7 && lambda < 1.05;

        const faults = dtcs.length;
        const readinessIssues = readiness ? Object.values(readiness).filter(r => !r).length : 0;
        
        const score = [engineTempOk, oilPressureOk, knockOk, lambdaOk, faults === 0, readinessIssues === 0]
            .filter(Boolean).length * (100 / 6);

        return {
            score: Math.round(score),
            engineTempOk,
            oilPressureOk,
            knockOk,
            lambdaOk,
            faults,
            readinessIssues
        };
    }, [latestData, dtcs, readiness]);

    if (!healthMetrics) return null;

    const strokeDashoffset = 283 - (283 * healthMetrics.score) / 100;
    const isOptimal = healthMetrics.score >= 80;

    return (
        <div className="flex flex-col gap-5 w-full relative">
            <div className="flex justify-between items-center bg-black/50 p-2.5 rounded-lg border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_3s_infinite_linear] opacity-30"></div>
                <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-brand-cyan" />
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 z-10 relative">System Integrity</h3>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black z-10 relative shadow-inner ${isOptimal ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]' : 'bg-brand-red/10 text-brand-red border border-brand-red/20 shadow-[inset_0_0_10px_rgba(255,0,60,0.1)]'}`}>
                    {isOptimal ? 'OPTIMAL' : 'CRITICAL'}
                    {isOptimal ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                </div>
            </div>

            <div className="flex justify-center items-center py-4 md:py-6 relative flex-1">
                {/* Gauge Background Elements */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                    <div className="w-[160px] h-[160px] md:w-[200px] md:h-[200px] lg:w-[220px] lg:h-[220px] border border-brand-cyan rounded-full animate-[spin_8s_linear_infinite]" style={{ borderStyle: 'dashed' }}></div>
                    <div className="w-[140px] h-[140px] md:w-[170px] md:h-[170px] lg:w-[190px] lg:h-[190px] border border-white/30 rounded-full absolute"></div>
                </div>

                <div className="relative w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex items-center justify-center z-10">
                    <svg viewBox="0 0 128 128" className="w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                        {/* Background Track */}
                        <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="8" />
                        
                        {/* Interactive Arc */}
                        <motion.circle 
                            cx="64" cy="64" r="54" fill="none" 
                            stroke={isOptimal ? '#10b981' : '#FCEE0A'} 
                            strokeWidth="8" 
                            strokeLinecap="round"
                            strokeDasharray="339.292"
                            initial={{ strokeDashoffset: 339.292 }}
                            animate={{ strokeDashoffset: 339.292 - (339.292 * healthMetrics.score) / 100 }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="drop-shadow-[0_0_6px_currentColor]"
                        />
                    </svg>

                    {/* Center Readout */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl md:text-6xl font-mono font-black tracking-tighter text-white drop-shadow-md">
                            {healthMetrics.score}
                        </span>
                        <span className="text-[9px] md:text-[10px] font-black text-brand-cyan uppercase tracking-widest leading-none mt-1">INDEX %</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
                <StatusItem label="CORE TEMP" ok={healthMetrics.engineTempOk} />
                <StatusItem label="OIL PRESS" ok={healthMetrics.oilPressureOk} />
                <StatusItem label="KNOCK LVL" ok={healthMetrics.knockOk} />
                <StatusItem label="ACTIVE DTC" ok={healthMetrics.faults === 0} value={healthMetrics.faults.toString()} />
            </div>
            
            {hasActiveFault && (
                <div className="mt-2 flex items-center justify-center gap-2 text-brand-red bg-brand-red/10 p-2.5 border border-brand-red/30 rounded text-[10px] font-black uppercase tracking-[0.2em] shadow-[inset_0_0_20px_rgba(255,0,60,0.1)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-brand-red/20 translate-x-[-100%] animate-[shimmer_1s_infinite]"></div>
                    <ShieldAlert size={14} className="relative z-10 animate-pulse" /> 
                    <span className="relative z-10 pt-0.5">CRITICAL FAULT DETECTED</span>
                </div>
            )}
        </div>
    );
};

const StatusItem: React.FC<{label: string, ok: boolean, value?: string}> = ({label, ok, value}) => (
    <div className="flex justify-between items-center bg-[#0a0a0a] border border-white/5 px-3 py-2.5 rounded-lg group hover:bg-[#111] transition-colors relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${ok ? 'bg-emerald-500/50' : 'bg-brand-red/50'} opacity-50`}></div>
        <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.1em] pl-1 group-hover:text-zinc-300 transition-colors">{label}</span>
        <span className={`text-[10px] font-mono font-black ${ok ? 'text-emerald-400 drop-shadow-[0_0_5px_#10b981]' : 'text-brand-red drop-shadow-[0_0_5px_#FF003C]'}`}>
            {value || (ok ? 'OK' : 'ERR')}
        </span>
    </div>
);
