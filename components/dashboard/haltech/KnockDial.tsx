import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export const KnockDial: React.FC = () => {
    const [knockLevel, setKnockLevel] = useState(1.4);
    const [isAlert, setIsAlert] = useState(false);
    const [metrics, setMetrics] = useState({
        combustion: 98,
        thermal: 84,
        volumetric: 91,
        telemetry: 100
    });

    useEffect(() => {
        const interval = setInterval(() => {
            // Randomly simulate engine harmonics fluctuation
            const base = 1.2 + Math.random() * 0.4;
            const spike = Math.random() > 0.95 ? 4.5 + Math.random() * 3 : 0;
            const finalKnock = parseFloat((base + spike).toFixed(2));
            setKnockLevel(finalKnock);
            setIsAlert(finalKnock > 4.5);
        }, 300);

        return () => clearInterval(interval);
    }, []);

    // Circular dial logic
    const radius = 80;
    const strokeDash = 2 * Math.PI * radius;
    const maxVal = 10;
    const strokeOffset = strokeDash - (Math.min(maxVal, knockLevel) / maxVal) * strokeDash;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1 max-w-7xl mx-auto w-full items-stretch">
            {/* GOERTZEL FILTER DIAL */}
            <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-between shadow-2xl relative min-h-[380px]">
                <div className="absolute inset-0 bg-radial-fade opacity-20 pointer-events-none z-0"></div>
                <div className="text-center w-full z-10 border-b border-zinc-800 pb-3">
                    <span className="text-[10px] font-technical font-black tracking-[0.25em] text-zinc-500 uppercase">GOERTZEL BANDPASS</span>
                    <h3 className="text-sm font-technical font-black text-brand-cyan tracking-widest uppercase italic mt-1">KNOCK DEVIATION DIAL</h3>
                </div>

                <div className="relative w-48 h-48 flex items-center justify-center my-6 z-10">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                        {/* Dial track */}
                        <circle
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke="#18181b"
                            strokeWidth="10"
                        />
                        {/* Caution sector arc */}
                        <circle
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke="#ea580c"
                            strokeWidth="10"
                            strokeDasharray={strokeDash}
                            strokeDashoffset={strokeDash * 0.5}
                            opacity="0.25"
                            className="pointer-events-none"
                        />
                        {/* Severe Knock sector arc */}
                        <circle
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="10"
                            strokeDasharray={strokeDash}
                            strokeDashoffset={strokeDash * 0.8}
                            opacity="0.25"
                            className="pointer-events-none"
                        />
                        {/* Live indicator bar */}
                        <motion.circle
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={isAlert ? '#FF2A4D' : knockLevel > 3 ? '#FCEE0A' : '#00FA9A'}
                            strokeWidth="10"
                            strokeDasharray={strokeDash}
                            strokeDashoffset={strokeOffset}
                            strokeLinecap="round"
                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                        />
                    </svg>

                    {/* Numeric overlay inside circle */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[8px] font-mono text-zinc-500 tracking-[0.15em] uppercase">INTENSITY</span>
                        <motion.span 
                            animate={{ scale: isAlert ? [1, 1.1, 1] : 1 }}
                            transition={{ duration: 0.15 }}
                            className={`text-4xl font-technical font-black leading-none italic ${isAlert ? 'text-brand-red' : 'text-white'}`}
                        >
                            {knockLevel.toFixed(1)}
                        </motion.span>
                        <span className="text-[8px] font-mono text-zinc-400 mt-1">dB/V<sub>Goertzel</sub></span>
                    </div>
                </div>

                <div className="w-full text-center z-10">
                    <span className={`px-4 py-1.5 rounded-full border text-[10px] font-technical font-black tracking-[0.2em] uppercase ${
                        isAlert 
                            ? 'bg-red-950/40 border-brand-red text-brand-red animate-pulse' 
                            : knockLevel > 3
                            ? 'bg-yellow-950/20 border-brand-yellow text-brand-yellow'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}>
                        {isAlert ? '⚠️ HARMONIC CRITICAL DETECTED' : knockLevel > 3 ? 'CAUTION: ADIABATIC THERMAL HIGH' : 'ENGINE BLOCK STABLE'}
                    </span>
                </div>
            </div>

            {/* BENTO HEALTH INDEX */}
            <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between shadow-2xl min-h-[380px]">
                <div className="border-b border-zinc-800 pb-3">
                    <span className="text-[10px] font-technical font-black tracking-[0.25em] text-zinc-500 uppercase">GIGAFUSION CORE</span>
                    <h3 className="text-sm font-technical font-black text-brand-cyan tracking-widest uppercase italic mt-1">ENGINE HEALTH INDEX</h3>
                </div>

                {/* Health Metrics Sliders */}
                <div className="flex-1 flex flex-col justify-center space-y-5 py-4">
                    
                    {/* Combustion Stability */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-zinc-400 uppercase">COMBUSTION STABILITY</span>
                            <span className="text-brand-green font-bold">{metrics.combustion}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-brand-green"
                                initial={{ width: 0 }}
                                animate={{ width: `${metrics.combustion}%` }}
                                transition={{ duration: 0.8 }}
                            />
                        </div>
                    </div>

                    {/* Thermal Reserves */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-zinc-400 uppercase">THERMAL EXPANSION RESERVES</span>
                            <span className="text-brand-yellow font-bold">{metrics.thermal}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-brand-yellow"
                                initial={{ width: 0 }}
                                animate={{ width: `${metrics.thermal}%` }}
                                transition={{ duration: 0.8, delay: 0.1 }}
                            />
                        </div>
                    </div>

                    {/* Volumetric Efficiency */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-zinc-400 uppercase">VOLUMETRIC CHARGE DENSITY</span>
                            <span className="text-brand-cyan font-bold">{metrics.volumetric}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-brand-cyan"
                                initial={{ width: 0 }}
                                animate={{ width: `${metrics.volumetric}%` }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                            />
                        </div>
                    </div>

                    {/* Telemetry Integrity */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-zinc-400 uppercase">TELEMETRY SENSOR INTEGRITY</span>
                            <span className="text-brand-cyan font-bold">{metrics.telemetry}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-brand-cyan"
                                initial={{ width: 0 }}
                                animate={{ width: `${metrics.telemetry}%` }}
                                transition={{ duration: 0.8, delay: 0.3 }}
                            />
                        </div>
                    </div>

                </div>

                <div className="p-3.5 bg-zinc-900/40 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-wider block">GIGAFUSION CORE INDEX</span>
                        <span className="text-base font-technical font-black tracking-tight text-white uppercase italic">ALL RE-LAYERS STABLE</span>
                    </div>
                    <div className="w-2.5 h-2.5 bg-brand-green rounded-full shadow-[0_0_10px_#00FA9A] animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};

export default KnockDial;
