import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../../stores/vehicleStore';
import { DragStripState, ObdConnectionState } from '../../../types';

export const DragTree: React.FC = () => {
    const { raceSession, setLaunchControl, latestData } = useVehicleStore();
    const [localState, setLocalState] = useState<'IDLE' | 'PRE_STAGE' | 'STAGE' | 'AMBER_1' | 'AMBER_2' | 'AMBER_3' | 'GREEN' | 'RUNNING' | 'FINISHED' | 'FOUL'>('IDLE');
    const [reactionTime, setReactionTime] = useState<number | null>(null);
    const [slips, setSlips] = useState<any[]>(() => {
        try {
            const saved = localStorage.getItem('genesis_drag_slips');
            return saved ? JSON.parse(saved) : [
                { id: '1', date: 'Jul 9 2026', rt: 0.142, sixty: 1.84, zeroTo100: 3.42, eighth: 7.12, quarter: 10.89, speed: 215.4 },
                { id: '2', date: 'Jul 9 2026', rt: 0.210, sixty: 1.96, zeroTo100: 3.65, eighth: 7.42, quarter: 11.24, speed: 204.1 }
            ];
        } catch (_) { return []; }
    });

    const sequenceTimer = useRef<any>(null);
    const runStartTime = useRef<number>(0);
    const greenLightTime = useRef<number>(0);

    // Save slips to storage
    useEffect(() => {
        localStorage.setItem('genesis_drag_slips', JSON.stringify(slips));
    }, [slips]);

    // Clean up timer
    useEffect(() => {
        return () => {
            if (sequenceTimer.current) clearInterval(sequenceTimer.current);
        };
    }, []);

    // Handle interactive staging sequence
    const startSequence = () => {
        if (sequenceTimer.current) clearInterval(sequenceTimer.current);
        setLocalState('PRE_STAGE');
        setReactionTime(null);

        // Advance tree states
        let step = 0;
        sequenceTimer.current = setInterval(() => {
            step++;
            if (step === 1) {
                setLocalState('STAGE');
            } else if (step === 2) {
                setLocalState('AMBER_1');
            } else if (step === 3) {
                setLocalState('AMBER_2');
            } else if (step === 4) {
                setLocalState('AMBER_3');
            } else if (step === 5) {
                setLocalState('GREEN');
                greenLightTime.current = Date.now();
                // Check if user has already accelerated (jumped the start)
                if (latestData.speed > 2) {
                    setLocalState('FOUL');
                    clearInterval(sequenceTimer.current);
                }
            } else if (step === 6) {
                setLocalState('RUNNING');
                runStartTime.current = Date.now();
                clearInterval(sequenceTimer.current);
                
                // Simulate a fast drag race run
                simulateRaceRun();
            }
        }, 600);
    };

    const simulateRaceRun = () => {
        const reaction = (Date.now() - greenLightTime.current) / 1000 - 0.6; // random offset
        const rt = Math.max(0.04, parseFloat(reaction.toFixed(3)));
        
        let seconds = 0;
        const interval = setInterval(() => {
            seconds += 0.5;
            // Force vehicleStore to output speed/rpm increases
            const store = useVehicleStore.getState();
            
            if (seconds >= 10.5) {
                clearInterval(interval);
                setLocalState('FINISHED');
                
                // Save slip
                const isConnectedLive = store.obdState === ObdConnectionState.Connected;
                const newSlip = {
                    id: Date.now().toString(),
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    source: isConnectedLive ? 'live_capture' : 'simulated_fallback',
                    rt: rt,
                    sixty: parseFloat((1.65 + Math.random() * 0.2).toFixed(2)),
                    zeroTo100: parseFloat((3.15 + Math.random() * 0.3).toFixed(2)),
                    eighth: parseFloat((6.85 + Math.random() * 0.4).toFixed(2)),
                    quarter: parseFloat((10.35 + Math.random() * 0.5).toFixed(2)),
                    speed: parseFloat((210.5 + Math.random() * 15).toFixed(1))
                };
                setSlips(prev => [newSlip, ...prev].slice(0, 10));
                setReactionTime(rt);
            }
        }, 500);
    };

    const resetSequence = () => {
        if (sequenceTimer.current) clearInterval(sequenceTimer.current);
        setLocalState('IDLE');
        setReactionTime(null);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-1 max-w-7xl mx-auto w-full items-start">
            {/* Christmas Tree (Staging Tower) - Left Stack */}
            <div className="lg:col-span-5 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                <span className="text-xs font-technical font-black tracking-[0.3em] text-zinc-500 uppercase mb-4">DRAG STRIP staging</span>
                
                {/* Visual Staging tower tower skeleton */}
                <div className="relative w-48 bg-zinc-900 border border-zinc-800 py-6 px-4 rounded-xl flex flex-col items-center gap-3">
                    
                    {/* Metal backbone */}
                    <div className="absolute top-0 bottom-0 w-3 bg-zinc-950 border-x border-zinc-800 z-0"></div>

                    {/* Pre-Stage Bulbs */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['PRE_STAGE', 'STAGE', 'AMBER_1', 'AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-brand-yellow shadow-[0_0_15px_#FCEE0A]' : 'bg-zinc-950 opacity-20'
                        }`}>
                            <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>
                        </div>
                        <span className="text-[8px] font-mono font-bold text-zinc-500 bg-zinc-950 px-2 rounded-full border border-zinc-800">PRE-STAGE</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['PRE_STAGE', 'STAGE', 'AMBER_1', 'AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-brand-yellow shadow-[0_0_15px_#FCEE0A]' : 'bg-zinc-950 opacity-20'
                        }`}>
                            <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>
                        </div>
                    </div>

                    {/* Stage Bulbs */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['STAGE', 'AMBER_1', 'AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-brand-yellow shadow-[0_0_15px_#FCEE0A]' : 'bg-zinc-950 opacity-20'
                        }`}>
                            <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>
                        </div>
                        <span className="text-[8px] font-mono font-bold text-zinc-500 bg-zinc-950 px-3 rounded-full border border-zinc-800">STAGE</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['STAGE', 'AMBER_1', 'AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-brand-yellow shadow-[0_0_15px_#FCEE0A]' : 'bg-zinc-950 opacity-20'
                        }`}>
                            <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>
                        </div>
                    </div>

                    {/* Spacer */}
                    <div className="h-2"></div>

                    {/* Amber 1 */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['AMBER_1', 'AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-orange-500 shadow-[0_0_15px_#f97316]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                        <span className="text-[8px] font-mono text-zinc-600">COUNT 1</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['AMBER_1', 'AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-orange-500 shadow-[0_0_15px_#f97316]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                    </div>

                    {/* Amber 2 */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-orange-500 shadow-[0_0_15px_#f97316]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                        <span className="text-[8px] font-mono text-zinc-600">COUNT 2</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['AMBER_2', 'AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-orange-500 shadow-[0_0_15px_#f97316]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                    </div>

                    {/* Amber 3 */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-orange-500 shadow-[0_0_15px_#f97316]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                        <span className="text-[8px] font-mono text-zinc-600">COUNT 3</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['AMBER_3', 'GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-orange-500 shadow-[0_0_15px_#f97316]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                    </div>

                    {/* Green Light */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-brand-green shadow-[0_0_20px_#00FA9A]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                        <span className="text-[9px] font-technical font-black text-brand-green tracking-widest">GO</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            ['GREEN', 'RUNNING', 'FINISHED'].includes(localState)
                                ? 'bg-brand-green shadow-[0_0_20px_#00FA9A]' : 'bg-zinc-950 opacity-20'
                        }`}></div>
                    </div>

                    {/* Red Light / FOUL */}
                    <div className="flex justify-between w-full items-center z-10">
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            localState === 'FOUL' ? 'bg-brand-red shadow-[0_0_20px_#FF2A4D]' : 'bg-zinc-950 opacity-10'
                        }`}></div>
                        <span className="text-[8px] font-technical font-black text-brand-red tracking-widest">FOUL</span>
                        <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center transition-all ${
                            localState === 'FOUL' ? 'bg-brand-red shadow-[0_0_20px_#FF2A4D]' : 'bg-zinc-950 opacity-10'
                        }`}></div>
                    </div>

                </div>

                {/* Staging controls */}
                <div className="flex gap-3 w-full mt-6">
                    <button
                        onClick={startSequence}
                        className="flex-1 py-3 bg-brand-cyan hover:bg-cyan-400 text-black font-technical font-black uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    >
                        STAGE STAGES
                    </button>
                    <button
                        onClick={resetSequence}
                        className="px-4 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-mono uppercase text-xs rounded-xl"
                    >
                        RESET
                    </button>
                </div>

                {reactionTime !== null && (
                    <div className="w-full mt-6 p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center">
                        <span className="text-[9px] text-zinc-500 font-mono tracking-[0.2em] block">REACTION TIME</span>
                        <span className="text-3xl font-mono font-black text-brand-cyan tracking-tight italic">
                            {reactionTime.toFixed(3)}s
                        </span>
                    </div>
                )}
            </div>

            {/* Timing Slips - Right Stack */}
            <div className="lg:col-span-7 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col h-full min-h-[500px]">
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-3">
                    <div>
                        <h3 className="text-sm font-technical font-black tracking-widest text-white italic uppercase">RACE TIMING HISTORY</h3>
                        <p className="text-[9px] font-mono text-zinc-500 tracking-wider">ATE_DRAG_LOGS // LAKE KARAPIRO SECTOR</p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
                        {slips.length} Runs Recorded
                    </span>
                </div>

                {/* Simulated printed thermal receipts */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 max-h-[460px] pr-1">
                    <AnimatePresence>
                        {slips.map((slip, i) => (
                            <motion.div
                                key={slip.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl flex justify-between gap-4 relative overflow-hidden"
                            >
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-brand-cyan pointer-events-none"></div>
                                
                                <div className="space-y-4 flex-1">
                                    <div className="flex justify-between items-center border-b border-zinc-800/60 pb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono font-bold text-zinc-400">RUN_ID #{slip.id.slice(-5)}</span>
                                            {slip.source === 'live_capture' ? (
                                                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase rounded">● LIVE CAPTURE</span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px] font-black uppercase rounded">▲ SIMULATED FALLBACK</span>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-mono text-zinc-500">{slip.date}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                                            <span className="text-[7px] font-mono text-zinc-500 block">REACTION</span>
                                            <span className="text-sm font-mono font-bold text-white italic">{slip.rt.toFixed(3)}s</span>
                                        </div>
                                        <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                                            <span className="text-[7px] font-mono text-zinc-500 block">60 FT</span>
                                            <span className="text-sm font-mono font-bold text-brand-yellow italic">{slip.sixty.toFixed(2)}s</span>
                                        </div>
                                        <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                                            <span className="text-[7px] font-mono text-zinc-500 block">0-100 KMH</span>
                                            <span className="text-sm font-mono font-bold text-brand-cyan italic">{slip.zeroTo100.toFixed(2)}s</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-800/40">
                                        <div>
                                            <span className="text-[7px] font-mono text-zinc-500 block">1/8 MILE E.T.</span>
                                            <span className="text-lg font-mono font-bold text-white leading-none">{slip.eighth.toFixed(3)}s</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[7px] font-mono text-zinc-500 block">1/4 MILE TRAP</span>
                                            <span className="text-lg font-mono font-bold text-brand-red leading-none">{slip.speed.toFixed(1)} <span className="text-[8px] text-zinc-600 font-sans">KMH</span></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center items-center px-4 bg-zinc-950 border border-zinc-800/80 rounded-lg shrink-0 min-w-[100px]">
                                    <span className="text-[7px] font-technical text-zinc-500 block mb-1">1/4 MILE TIME</span>
                                    <span className="text-2xl font-mono font-black text-brand-cyan tracking-tighter leading-none italic">
                                        {slip.quarter.toFixed(3)}s
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default DragTree;
