import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Zap, History, Trophy, Gauge, Flag, Target, Play, RotateCcw } from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';

type RaceMode = '0-100' | '1/4_MILE' | 'ROLL_RACE';
type RaceStatus = 'IDLE' | 'STAGING' | 'COUNTDOWN' | 'ARMED' | 'RECORDING' | 'FINISHED';

interface PerfRun {
    id: string;
    timestamp: number;
    mode: RaceMode;
    time: number;
    peakG: number;
    metrics: string; // e.g. "60-130 KPH" or "400M"
}

export const PerformanceMeter: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    
    const [mode, setMode] = useState<RaceMode>('0-100');
    const [status, setStatus] = useState<RaceStatus>('IDLE');
    
    // Config
    const [rollStartSpeed, setRollStartSpeed] = useState(60);
    const [rollEndSpeed, setRollEndSpeed] = useState(130);
    
    // Active Tracking
    const [currentTime, setCurrentTime] = useState(0);
    const [countdownTime, setCountdownTime] = useState<number | null>(null);
    const [peakG, setPeakG] = useState(0);
    const [startDistance, setStartDistance] = useState<number>(0);
    const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
    
    const [runs, setRuns] = useState<PerfRun[]>([]);

    const QUARTER_MILE_METERS = 402.336;
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const speed = latestData.speed;
        const gForce = Math.sqrt((latestData.gForceX || 0)**2 + (latestData.gForceY || 0)**2);

        if (status === 'RECORDING' && gForce > peakG) {
            setPeakG(gForce);
        }

        // Logic for auto-start on movement (0-100 & 1/4 Mile)
        if (status === 'STAGING' && (mode === '0-100' || mode === '1/4_MILE')) {
            if (speed > 2) {
                setStatus('RECORDING');
                setStartTimestamp(performance.now());
                setStartDistance(latestData.distance || 0);
                setPeakG(0);
            }
        }
        
        // Logic for armed Roll Race
        if (status === 'ARMED' && mode === 'ROLL_RACE') {
             if (speed >= rollStartSpeed) {
                  setStatus('RECORDING');
                  setStartTimestamp(performance.now());
                  setPeakG(0);
             }
        }

        // Logic for tracking metrics while RECORDING
        if (status === 'RECORDING' && startTimestamp) {
            const now = performance.now();
            const elapsed = (now - startTimestamp) / 1000;
            setCurrentTime(elapsed);
            
            let isFinished = false;
            let metricsStr = "";

            if (mode === '0-100') {
                if (speed >= 100) {
                    isFinished = true;
                    metricsStr = "0-100 KM/H";
                }
            } else if (mode === '1/4_MILE') {
                const distCovered = (latestData.distance || 0) - startDistance;
                if (distCovered >= QUARTER_MILE_METERS) {
                    isFinished = true;
                    metricsStr = "1/4 MILE";
                }
            } else if (mode === 'ROLL_RACE') {
                if (speed >= rollEndSpeed) {
                    isFinished = true;
                    metricsStr = `${rollStartSpeed}-${rollEndSpeed} KM/H`;
                }
            }

            if (isFinished) {
                setStatus('FINISHED');
                const newRun: PerfRun = {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    mode: mode,
                    time: elapsed,
                    peakG: peakG,
                    metrics: metricsStr
                };
                setRuns(prev => [newRun, ...prev].slice(0, 15));
            }
        }
    }, [latestData.speed, latestData.distance, status]);

    // Cleanup countdown
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRollRace = () => {
        setStatus('COUNTDOWN');
        setCountdownTime(3);
        let count = 3;
        
        if (timerRef.current) clearInterval(timerRef.current);
        
        timerRef.current = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdownTime(count);
            } else if (count === 0) {
                setCountdownTime(0); // Display "GO"
            } else {
                if (timerRef.current) clearInterval(timerRef.current);
                setCountdownTime(null);
                // Switch to ARMED, wait for car to actually cross rollStartSpeed
                setStatus('ARMED');
            }
        }, 1000) as unknown as number;
    };

    const handleAction = () => {
        if (status === 'IDLE' || status === 'FINISHED') {
            if (mode === 'ROLL_RACE') {
                startRollRace();
            } else {
                setStatus('STAGING');
                setCurrentTime(0);
            }
        } else {
            // Cancel staging or countdown
            setStatus('IDLE');
            if (timerRef.current) clearInterval(timerRef.current);
            setCountdownTime(null);
            setCurrentTime(0);
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'IDLE': return 'text-white/40 bg-white/5 border-white/10';
            case 'STAGING': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'COUNTDOWN': return 'text-brand-purple bg-brand-purple/10 border-brand-purple/30 shadow-[inset_0_0_20px_rgba(188,19,254,0.2)]';
            case 'ARMED': return 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/30 shadow-[inset_0_0_20px_rgba(0,240,255,0.2)]';
            case 'RECORDING': return 'text-red-500 bg-red-500/10 border-red-500/30 shadow-[inset_0_0_20px_rgba(255,0,0,0.2)] animate-pulse';
            case 'FINISHED': return 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/30';
            default: return '';
        }
    };

    return (
        <div className="bg-[#050505] border border-white/10 rounded-none overflow-hidden flex flex-col h-[400px] shadow-[4px_4px_0_rgba(0,0,0,1)] relative group">
            {/* Background Grid */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                     backgroundSize: '20px 20px',
                     backgroundPosition: 'center center'
                 }}>
            </div>

            {/* Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a] relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-[#111] border border-white/10">
                        <Trophy className="w-4 h-4 text-brand-cyan" />
                    </div>
                    <div>
                        <h3 className="text-white font-mono font-black uppercase tracking-widest text-xs">Performance Kinematics</h3>
                        <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">High-Freq Race Telemetry</p>
                    </div>
                </div>
                <div className={`px-3 py-1 flex items-center gap-2 border ${getStatusColor()} transition-colors`}>
                    <div className={`w-1.5 h-1.5 rounded-sm ${status === 'RECORDING' || status === 'COUNTDOWN' ? 'bg-current shadow-[0_0_8px_currentColor]' : 'bg-current'} ${status === 'ARMED' ? 'animate-ping' : ''}`} />
                    <span className="text-[10px] font-mono font-black tracking-widest uppercase">{status}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-between p-4 relative z-10">
                
                {/* HUD Top - Mode Selector */}
                <div className="flex gap-2 mb-4 shrink-0">
                    {(['0-100', '1/4_MILE', 'ROLL_RACE'] as RaceMode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => { if (status === 'IDLE' || status === 'FINISHED') setMode(m); }}
                            className={`flex-1 py-1.5 border font-mono text-[10px] font-black uppercase tracking-widest transition-all ${
                                mode === m 
                                ? 'bg-[#111] border-brand-cyan text-brand-cyan shadow-[inset_0_2px_10px_rgba(0,240,255,0.1)]'
                                : 'bg-[#0a0a0a] border-white/5 text-white/40 hover:bg-white/5 hover:text-white/60 hover:border-white/20'
                            } ${status !== 'IDLE' && status !== 'FINISHED' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {m.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Main Metrics Area */}
                <div className="flex-1 flex flex-col items-center justify-center relative bg-[#0a0a0a] border border-white/5 mb-4 group-hover:border-white/10 transition-colors">
                    <AnimatePresence mode="wait">
                        {status === 'COUNTDOWN' && countdownTime !== null ? (
                            <motion.div
                                key="countdown"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.5, opacity: 0 }}
                                className={`text-[120px] font-mono font-black italic tracking-tighter leading-none ${countdownTime === 0 ? 'text-brand-cyan shadow-[0_0_30px_#00F0FF30]' : 'text-brand-purple'}`}
                            >
                                {countdownTime === 0 ? 'GO' : countdownTime}
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="timer"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center w-full relative"
                            >
                                <span className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-2 ${status === 'ARMED' ? 'text-brand-cyan animate-pulse' : 'text-gray-500'}`}>
                                     {status === 'ARMED' ? 'WAITING FOR START SPEED' : 'Elapsed Time'}
                                </span>
                                <div className={`text-[64px] md:text-[80px] font-mono font-black tabular-nums tracking-tighter leading-none mb-1 transition-colors ${status === 'ARMED' ? 'text-brand-cyan/50' : 'text-white'}`}>
                                    {currentTime.toFixed(2)}<span className="text-2xl text-white/30 ml-2">s</span>
                                </div>
                                
                                {mode === 'ROLL_RACE' && status !== 'RECORDING' && (
                                    <div className="mt-4 flex gap-4 absolute top-full">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-mono text-brand-cyan uppercase mb-1">Start KPH</span>
                                            <div className="flex bg-[#111] border border-white/10 hover:border-brand-cyan/50 transition-colors">
                                                <button disabled={status !== 'IDLE' && status !== 'FINISHED'} onClick={() => setRollStartSpeed(s => Math.max(0, s - 10))} className="px-2 py-1 text-gray-400 hover:text-white">-</button>
                                                <span className="px-2 py-1 text-[10px] font-mono font-bold text-white min-w-[30px] text-center">{rollStartSpeed}</span>
                                                <button disabled={status !== 'IDLE' && status !== 'FINISHED'} onClick={() => setRollStartSpeed(s => Math.min(rollEndSpeed - 10, s + 10))} className="px-2 py-1 text-gray-400 hover:text-white">+</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-mono text-red-500 uppercase mb-1">End KPH</span>
                                            <div className="flex bg-[#111] border border-white/10 hover:border-red-500/50 transition-colors">
                                                <button disabled={status !== 'IDLE' && status !== 'FINISHED'} onClick={() => setRollEndSpeed(s => Math.max(rollStartSpeed + 10, s - 10))} className="px-2 py-1 text-gray-400 hover:text-white">-</button>
                                                <span className="px-2 py-1 text-[10px] font-mono font-bold text-white min-w-[30px] text-center">{rollEndSpeed}</span>
                                                <button disabled={status !== 'IDLE' && status !== 'FINISHED'} onClick={() => setRollEndSpeed(s => s + 10)} className="px-2 py-1 text-gray-400 hover:text-white">+</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {mode === '1/4_MILE' && status === 'RECORDING' && (
                                    <div className="absolute top-full mt-4 w-3/4 max-w-sm">
                                        <div className="flex justify-between text-[8px] font-mono text-gray-500 mb-1 font-bold uppercase">
                                            <span>Stage</span>
                                            <span>Trap 400m</span>
                                        </div>
                                        <div className="h-1.5 bg-[#111] border border-white/10 overflow-hidden relative">
                                            <div 
                                                className="h-full bg-gradient-to-r from-amber-500 to-red-500 relative"
                                                style={{ width: `${Math.min(100, (((latestData.distance || 0) - startDistance) / QUARTER_MILE_METERS) * 100)}%` }}
                                            >
                                                <div className="absolute top-0 right-0 w-2 h-full bg-white opacity-50 blur-sm"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Action Trigger */}
                <button 
                    onClick={handleAction}
                    className={`w-full py-3 shrine-0 font-mono font-black text-xs uppercase tracking-[0.2em] transition-all border ${
                        status === 'IDLE' || status === 'FINISHED' 
                        ? mode === 'ROLL_RACE' 
                            ? 'bg-brand-purple/20 border-brand-purple text-brand-purple hover:bg-brand-purple/30'
                            : 'bg-amber-500/20 border-amber-500 text-amber-500 hover:bg-amber-500/30'
                        : 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30 shadow-[inset_0_0_15px_rgba(255,0,0,0.2)]'
                    }`}
                >
                    {status === 'IDLE' || status === 'FINISHED' ? (mode === 'ROLL_RACE' ? 'INIT COUNTDOWN' : 'STAGE VEHICLE') : 'ABORT SEQUENCE'}
                </button>
            </div>
            
            {/* History Panel - Slottable overlay if runs exist */}
            {runs.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-[#0a0a0a] border-t border-brand-cyan/30 z-20 transition-transform group-hover:-translate-y-[100px] h-[100px] flex flex-col p-2">
                    <div className="flex justify-between items-center px-2 mb-1">
                        <span className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-widest">Recent Logs</span>
                        <History className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {runs.map(r => (
                            <div key={r.id} className="flex justify-between items-center bg-[#111] px-3 py-1.5 border border-white/5 text-[10px] font-mono hover:border-brand-cyan/40 transition-colors">
                                <span className="text-gray-400 font-bold uppercase tracking-wider">{r.metrics}</span>
                                <div className="flex items-center gap-3">
                                     <span className="text-brand-purple text-[8px]">{r.peakG.toFixed(2)}G Max</span>
                                     <span className="text-brand-cyan font-black">{r.time.toFixed(2)}s</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
