import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export const MpcEngine: React.FC = () => {
    const [reward, setReward] = useState<number[]>(Array.from({ length: 12 }, () => Math.random() * 50 + 40));
    const [qTable, setQTable] = useState<number[][]>(() => 
        Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => Math.random() * 100))
    );
    const [boostHorizon, setBoostHorizon] = useState<number[]>([12.5, 14.2, 15.8, 16.5, 15.1, 13.8, 12.0]);

    useEffect(() => {
        const interval = setInterval(() => {
            // Update reward history list
            setReward(prev => [...prev.slice(1), Math.min(100, Math.max(0, prev[prev.length - 1] + (Math.random() - 0.45) * 12))]);
            
            // Randomly update Q-Table heatmap values
            setQTable(prev => prev.map(row => row.map(cell => Math.min(100, Math.max(0, cell + (Math.random() - 0.5) * 15)))));

            // Shift predicted boost controller curve slightly
            setBoostHorizon(prev => prev.map(val => Math.min(22, Math.max(5, val + (Math.random() - 0.5) * 1.5))));
        }, 400);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-1 max-w-7xl mx-auto w-full items-start">
            
            {/* Q-TABLE HEATMAP & REWARD HISTORY */}
            <div className="lg:col-span-6 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between shadow-2xl min-h-[440px]">
                <div>
                    <span className="text-[10px] font-technical font-black tracking-[0.25em] text-zinc-500 uppercase">RL/MPC ENGINE</span>
                    <h3 className="text-sm font-technical font-black text-brand-cyan tracking-widest uppercase italic mt-1 pb-3 border-b border-zinc-800">Q-TABLE CODESPACE</h3>
                </div>

                {/* 6x6 Q-Table Heatmap Matrix */}
                <div className="my-6">
                    <span className="text-[9px] font-mono text-zinc-500 tracking-wider block mb-2 text-center">RL STATE-ACTION VALUE WEIGHTS (HEATMAP)</span>
                    <div className="grid grid-cols-6 gap-2">
                        {qTable.map((row, rIdx) => 
                            row.map((cell, cIdx) => {
                                // Map value 0-100 to color scale
                                let heatColor = 'bg-cyan-950/20';
                                if (cell > 80) heatColor = 'bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.6)] text-black';
                                else if (cell > 60) heatColor = 'bg-cyan-600/80 text-white/90';
                                else if (cell > 45) heatColor = 'bg-cyan-800/60 text-white/60';
                                else if (cell > 25) heatColor = 'bg-cyan-950/40 text-white/30';

                                return (
                                    <div
                                        key={`${rIdx}-${cIdx}`}
                                        className={`aspect-square rounded border border-zinc-900/60 flex items-center justify-center font-mono text-[8px] font-semibold transition-colors duration-200 ${heatColor}`}
                                    >
                                        {cell.toFixed(0)}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Reward history sparkline */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                        <span>RL STEP REWARD LOGS</span>
                        <span className="text-brand-green font-bold">AVG: { (reward.reduce((a,b)=>a+b, 0) / reward.length).toFixed(1) }</span>
                    </div>
                    <div className="h-10 flex items-end justify-between gap-1 border-t border-zinc-900 pt-1.5">
                        {reward.map((val, idx) => {
                            const percent = (val / 100) * 100;
                            return (
                                <motion.div
                                    key={idx}
                                    className="flex-1 bg-brand-green/80 rounded-[1px]"
                                    style={{ height: `${percent}%` }}
                                    animate={{ height: `${percent}%` }}
                                    transition={{ duration: 0.2 }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* PREDICTIVE BOOST HORIZON & SAFETY LAYER */}
            <div className="lg:col-span-6 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between shadow-2xl min-h-[440px]">
                <div className="border-b border-zinc-800 pb-3">
                    <span className="text-[10px] font-technical font-black tracking-[0.25em] text-zinc-500 uppercase">PREDICTIVE STOCHASTIC CONTROL</span>
                    <h3 className="text-sm font-technical font-black text-brand-cyan tracking-widest uppercase italic mt-1">MPC HORIZON MODEL</h3>
                </div>

                {/* Boost Horizon Forecast Curves */}
                <div className="my-4 flex flex-col justify-center flex-1 space-y-6">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                            <span>PREDICTED MPC BOOST HORIZON (PSI)</span>
                            <span className="text-brand-cyan font-bold">PEAK: { Math.max(...boostHorizon).toFixed(1) } PSI</span>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 h-32 flex items-end justify-between gap-2.5 relative">
                            {/* Grid markers */}
                            <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none p-4 opacity-5">
                                <div className="border-b border-white border-dashed w-full h-px"></div>
                                <div className="border-b border-white border-dashed w-full h-px"></div>
                                <div className="border-b border-white border-dashed w-full h-px"></div>
                            </div>
                            
                            {boostHorizon.map((val, idx) => {
                                const percent = (val / 25) * 100;
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                        <div className="w-full h-full flex flex-col justify-end">
                                            <motion.div 
                                                className="w-full bg-brand-cyan/80 rounded-t shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                                                style={{ height: `${percent}%` }}
                                                animate={{ height: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="text-[7px] font-mono text-zinc-500">+{idx * 50}ms</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* MPC Safety constraints checklist */}
                    <div className="space-y-3">
                        <span className="text-[9px] font-mono text-zinc-500 tracking-wider block">MPC CONSTRAINTS SAFETY CHECKS</span>
                        <div className="grid grid-cols-2 gap-3.5">
                            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-mono text-zinc-500 block">TURBO COMPRESSOR</span>
                                    <span className="text-xs font-mono font-bold text-white uppercase">SURGE LIMIT CHECK</span>
                                </div>
                                <div className="w-2.5 h-2.5 bg-brand-green rounded-full shadow-[0_0_8px_#00FA9A]"></div>
                            </div>

                            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-mono text-zinc-500 block">CYLINDER HEAD</span>
                                    <span className="text-xs font-mono font-bold text-white uppercase">P_MAX CYCLING OK</span>
                                </div>
                                <div className="w-2.5 h-2.5 bg-brand-green rounded-full shadow-[0_0_8px_#00FA9A]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3.5 bg-zinc-900/40 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-wider block">SAFETY LAYER INTEGRITY</span>
                        <span className="text-base font-technical font-black tracking-tight text-white uppercase italic">Active Guardrails Nominal</span>
                    </div>
                    <div className="w-2.5 h-2.5 bg-brand-green rounded-full shadow-[0_0_10px_#00FA9A] animate-pulse"></div>
                </div>
            </div>

        </div>
    );
};

export default MpcEngine;
