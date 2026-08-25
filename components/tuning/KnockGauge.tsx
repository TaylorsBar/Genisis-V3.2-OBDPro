import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, AlertTriangle } from 'lucide-react';

interface KnockGaugeProps {
    signal: number;      // Current knock sensor voltage/power
    threshold: number;   // Adaptive noise floor threshold
    count: number;       // Cumulative knock events
    maxSignal?: number;  // Full scale value (default 5.0V)
}

export const KnockGauge: React.FC<KnockGaugeProps> = ({ 
    signal, 
    threshold, 
    count, 
    maxSignal = 5.0 
}) => {
    const isKnocking = signal > threshold;
    const signalPercent = Math.min(100, Math.max(0, (signal / maxSignal) * 100));

    // Calculate color based on signal vs threshold
    const getSignalColor = () => {
        if (isKnocking) return '#ef4444'; // Red
        if (signal > threshold * 0.7) return '#f59e0b'; // Amber
        return '#00f0ff'; // Cyan
    };

    return (
        <div className="w-full h-full flex items-center justify-between p-4 bg-[#050505] border border-white/5 rounded-xl relative overflow-hidden group">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-digital-noise opacity-5 pointer-events-none"></div>
            
            {/* Left side: Status and Level */}
            <div className="flex flex-col h-full justify-between z-10 w-1/2">
                <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${isKnocking ? 'bg-red-500/20 border border-red-500 shadow-[0_0_15px_#ef444450]' : 'bg-brand-cyan/10 border border-brand-cyan/30'}`}>
                        <Activity className={`w-3 h-3 ${isKnocking ? 'text-red-500 animate-pulse' : 'text-brand-cyan'}`} />
                    </div>
                </div>
                
                <div>
                    <span className="text-[32px] font-mono font-black italic tracking-tighter leading-none block" style={{ color: getSignalColor() }}>
                        {signal.toFixed(2)}<span className="text-xs opacity-50 ml-1">V</span>
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-1 h-1 rounded-full ${isKnocking ? 'bg-red-500 animate-ping' : 'bg-brand-green'}`}></div>
                        <span className="text-[7px] font-mono text-gray-400 uppercase tracking-widest">{isKnocking ? 'DETONATION' : 'NOMINAL'}</span>
                    </div>
                </div>
            </div>

            {/* Right side: Graph and Stats */}
            <div className="flex flex-col h-full justify-between items-end z-10 w-1/2">
                <div className="flex flex-col items-end">
                    <span className="text-[7px] font-mono text-gray-500 uppercase tracking-widest leading-none mb-1">Total Events</span>
                    <span className={`text-sm font-mono font-black ${count > 0 ? 'text-red-500' : 'text-white'} leading-none`}>
                        {count.toString().padStart(3, '0')}
                    </span>
                </div>

                <div className="w-full flex flex-col items-end gap-1 mt-auto">
                    <div className="w-full flex items-end gap-[1px] h-8 opacity-40 group-hover:opacity-100 transition-opacity justify-end">
                        {Array.from({ length: 24 }).map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 1 }}
                                animate={{ height: `${Math.max(10, Math.random() * (isKnocking ? 100 : 40))}%` }}
                                transition={{ repeat: Infinity, duration: 0.1 + Math.random() * 0.3, repeatType: 'reverse' }}
                                className={`flex-1 rounded-t-[1px] ${isKnocking ? 'bg-red-500' : 'bg-brand-cyan'}`}
                            />
                        ))}
                    </div>
                    {/* Level Bar */}
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1 relative">
                        <div className="absolute top-0 bottom-0 w-px bg-red-500 z-20" style={{ left: `${(threshold / maxSignal) * 100}%` }}></div>
                        <motion.div 
                            className="h-full relative z-10"
                            style={{ backgroundColor: getSignalColor() }}
                            animate={{ width: `${signalPercent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KnockGauge;
