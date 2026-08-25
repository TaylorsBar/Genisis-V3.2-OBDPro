import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Flag, Trophy, History, MapPin, Target, Play, Square, RefreshCw, Layers } from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';
import { useLapTimerStore } from '../stores/lapTimerStore';

export const LapTimer: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    
    // Connect directly to the global high-precision lap timing store
    const {
        isActive,
        trackName,
        lapStartTimeRelative,
        lapTimes,
        currentSplit1,
        currentSplit2,
        bestSector1,
        bestSector2,
        bestSector3,
        startSession,
        stopSession,
        resetSession,
        startLap,
        markSector
    } = useLapTimerStore();

    const [liveElapsedTime, setLiveElapsedTime] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState('Grand Loop');

    // High-precision 60fps stopwatch loop using performance.now() synced with store
    useEffect(() => {
        let rafId: number;
        
        const updateStopwatch = () => {
            if (isActive && lapStartTimeRelative !== null) {
                const now = performance.now();
                setLiveElapsedTime(Math.max(0, (now - lapStartTimeRelative) / 1000));
            } else {
                setLiveElapsedTime(0);
            }
            rafId = requestAnimationFrame(updateStopwatch);
        };
        
        rafId = requestAnimationFrame(updateStopwatch);
        return () => cancelAnimationFrame(rafId);
    }, [isActive, lapStartTimeRelative]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    const bestLapTime = lapTimes.length > 0 
        ? Math.min(...lapTimes.map(l => l.time)) 
        : null;

    // Helper to calculate split values for render
    const displaySplit1 = currentSplit1 !== null ? currentSplit1 : null;
    const displaySplit2 = (currentSplit1 !== null && currentSplit2 !== null) ? (currentSplit2 - currentSplit1) : null;

    return (
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[480px] relative shadow-[0_0_40px_rgba(0,240,255,0.03)] group">
            {/* Tech Corner Accents */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-white/20 pointer-events-none" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-white/20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-white/20 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-white/20 pointer-events-none" />

            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 relative">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#00F0FF]/10 border border-[#00F0FF]/35 rounded-xl text-brand-cyan animate-pulse">
                        <Flag className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm tracking-wide">Elite Precision Lap Timer</h3>
                        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">GPS-synced // 100Hz Engine</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isActive ? (
                        <button 
                            onClick={() => stopSession()}
                            className="px-3 py-1.5 bg-red-600/20 border border-red-500/30 hover:bg-red-600 hover:text-white text-[9px] font-black tracking-widest text-red-400 uppercase rounded-lg flex items-center gap-1.5 transition-all"
                        >
                            <Square className="w-3 h-3 fill-current" />
                            Stop
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <select 
                                value={selectedTrack} 
                                onChange={(e) => setSelectedTrack(e.target.value)}
                                className="bg-zinc-950/90 border border-white/10 text-white rounded-lg text-[9px] font-bold px-2 py-1 focus:outline-none"
                            >
                                <option value="Grand Loop">Grand Loop</option>
                                <option value="Karapiro Speedway">Karapiro Speedway</option>
                                <option value="Hampton Downs">Hampton Downs</option>
                            </select>
                            <button 
                                onClick={() => startSession(selectedTrack)}
                                className="px-3 py-1.5 bg-brand-cyan text-black hover:scale-105 active:scale-95 text-[9px] font-black tracking-widest uppercase rounded-lg flex items-center gap-1.5 transition-all"
                            >
                                <Play className="w-3 h-3 fill-current" />
                                Start
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={() => resetSession()}
                        className="p-1.5 bg-white/5 border border-white/10 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                        title="Reset Current Session"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Main timing view */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 p-4 overflow-hidden min-h-0">
                {/* Stopwatch & Live Delta (3 Columns) */}
                <div className="md:col-span-3 bg-zinc-950/60 border border-white/[0.03] rounded-2xl p-5 flex flex-col justify-between relative group/watch">
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Active Loop</span>
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-brand-cyan animate-ping' : 'bg-zinc-700'}`} />
                    </div>

                    <div className="flex flex-col items-center justify-center flex-grow py-4">
                        <span className="text-[10px] text-[#00F0FF] uppercase tracking-[0.25em] mb-1 font-black">
                            {isActive ? `LAP ${lapTimes.length + 1}` : 'STANDBY'}
                        </span>
                        <div className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.06)]">
                            {formatTime(liveElapsedTime)}
                        </div>
                    </div>

                    {/* Sector details */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/[0.04] text-center bg-black/30 p-3 rounded-xl">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-zinc-500 font-black uppercase">Sector 1</span>
                            <span className="text-xs font-mono font-bold text-white mt-0.5">
                                {displaySplit1 !== null ? `${displaySplit1.toFixed(3)}s` : '--.---'}
                            </span>
                        </div>
                        <div className="flex flex-col border-x border-white/5">
                            <span className="text-[8px] text-zinc-500 font-black uppercase">Sector 2</span>
                            <span className="text-xs font-mono font-bold text-white mt-0.5">
                                {displaySplit2 !== null ? `${displaySplit2.toFixed(3)}s` : '--.---'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] text-zinc-500 font-black uppercase">Sector 3</span>
                            <span className="text-xs font-mono font-bold text-white mt-0.5">
                                {(isActive && lapStartTimeRelative !== null && currentSplit2 !== null) 
                                    ? `${(liveElapsedTime - currentSplit2).toFixed(3)}s` 
                                    : '--.---'}
                            </span>
                        </div>
                    </div>

                    {/* Manual interactive trigger controls for full loop feedback */}
                    <div className="mt-3 flex gap-2 w-full">
                        <button
                            onClick={() => startLap()}
                            disabled={!isActive}
                            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg border text-center transition-all ${
                                isActive 
                                    ? 'bg-brand-cyan/15 border-brand-cyan/40 hover:bg-brand-cyan/30 text-brand-cyan' 
                                    : 'bg-zinc-900 border-white/5 text-zinc-600 cursor-not-allowed'
                            }`}
                        >
                            Trigger Lap (Cross)
                        </button>
                        <button
                            onClick={() => markSector()}
                            disabled={!isActive || (currentSplit1 !== null && currentSplit2 !== null)}
                            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg border text-center transition-all ${
                                isActive && (currentSplit1 === null || currentSplit2 === null)
                                    ? 'bg-amber-400/10 border-amber-400/30 hover:bg-amber-400/20 text-amber-400' 
                                    : 'bg-zinc-900 border-white/5 text-zinc-600 cursor-not-allowed'
                            }`}
                        >
                            Mark Sector Split
                        </button>
                    </div>
                </div>

                {/* History list (2 Columns) */}
                <div className="md:col-span-2 bg-zinc-950/60 border border-white/[0.03] rounded-2xl flex flex-col min-h-0">
                    <div className="p-3 border-b border-white/[0.04] flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Lap History</span>
                        <History className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="flex-grow overflow-y-auto p-2 space-y-1.5 max-h-[220px] scrollbar-hide">
                        {lapTimes.map((lap, idx) => {
                            const isBest = bestLapTime !== null && lap.time === bestLapTime;
                            return (
                                <div 
                                    key={idx} 
                                    className={`p-2.5 rounded-xl flex items-center justify-between border ${
                                        isBest ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/[0.02]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-[10px] ${
                                            isBest ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-400'
                                        }`}>
                                            L{lap.lap}
                                        </div>
                                        <div>
                                            <p className="text-xs font-mono font-black leading-none">{formatTime(lap.time)}</p>
                                            {lap.split1 && (
                                                <p className="text-[8px] font-mono text-zinc-500 mt-1 uppercase">
                                                    S1: {lap.split1.toFixed(1)}s | S2: {(lap.split2 ? (lap.split2 - lap.split1) : 0).toFixed(1)}s
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {isBest && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                </div>
                            );
                        })}

                        {lapTimes.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                                <MapPin className="w-7 h-7 mb-1.5 opacity-40" />
                                <span className="text-[9px] font-black uppercase tracking-wider">Awaiting telemetry splits</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Optimal / Optimal Sector Box */}
            <div className="mx-4 mb-4 p-3 bg-zinc-950/80 border border-white/[0.03] rounded-xl grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col">
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Best Sector 1</span>
                    <span className="text-xs font-mono font-black text-brand-cyan mt-0.5">
                        {bestSector1 !== null ? `${bestSector1.toFixed(3)}s` : '--.---'}
                    </span>
                </div>
                <div className="flex flex-col border-x border-white/5">
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Best Sector 2</span>
                    <span className="text-xs font-mono font-black text-brand-cyan mt-0.5">
                        {bestSector2 !== null ? `${bestSector2.toFixed(3)}s` : '--.---'}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Best Sector 3</span>
                    <span className="text-xs font-mono font-black text-brand-cyan mt-0.5">
                        {bestSector3 !== null ? `${bestSector3.toFixed(3)}s` : '--.---'}
                    </span>
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="p-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-[8.5px] text-zinc-500 uppercase tracking-widest font-mono">
                <div className="flex items-center gap-4">
                    <span>TRACK: {trackName}</span>
                    <span>LAPS RECORDED: {lapTimes.length}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${ekfStats?.gpsActive ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                        GPS Lock
                    </span>
                    <span>10Hz GNSS</span>
                </div>
            </div>
        </div>
    );
};

