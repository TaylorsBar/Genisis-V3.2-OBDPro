
import React from 'react';
import { motion } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useTransform } from 'motion/react';

export const EliteGlassPanel: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; contentStyle?: React.CSSProperties }> = ({ children, className = "", style, contentStyle }) => (
    <div style={style} className={`relative group overflow-hidden ${className} bg-[#070707] border border-white/10 shadow-[4px_4px_0_rgba(0,0,0,1)] hover:border-brand-cyan/30 transition-colors`}>
        {/* Synthetic Lidar Grid Background */}
        <div className="absolute inset-0 bg-mesh opacity-10 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>
        
        {/* Hover inner edge glow */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-brand-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        {/* Glass Content */}
        <div style={contentStyle} className="relative z-10 p-5 h-full">
            {children}
        </div>
        
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/30 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/30 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/30 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/30 pointer-events-none"></div>

        {/* Anamorphic Lens Flare Effect */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-cyan/80 to-transparent transform -translate-y-full group-hover:translate-y-[400px] transition-transform duration-[1000ms] pointer-events-none ease-linear"></div>
    </div>
);

export const NeuralLinkStat: React.FC<{ label: string; value: number | string; unit: string; color?: string; trend?: number[]; icon?: React.ReactNode }> = ({ label, value, unit, color = "#00F0FF", trend, icon }) => {
    const val = typeof value === 'number' ? value : parseFloat(value) || 0;
    const progress = useAnimatedValue(val, { stiffness: 100, damping: 20 });
    const displayValue = useTransform(progress, v => v.toFixed(1));

    return (
        <div className="flex flex-col gap-1 w-full group h-full justify-between">
            <div className="flex justify-between items-start mb-1 h-full">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">{label}</span>
                    <div className="text-gray-500 opacity-40 group-hover:opacity-100 transition-opacity mix-blend-screen" style={{ color: color }}>
                        {icon}
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <motion.span 
                        className="font-mono font-black text-2xl tracking-tighter"
                        style={{ color }}
                    >
                        {displayValue}
                    </motion.span>
                    <span className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-widest leading-none">{unit}</span>
                </div>
            </div>
            
            {/* Dot Matrix Level Visualization */}
            <div className="mt-2 w-full grid grid-cols-[repeat(20,minmax(0,1fr))] gap-px opacity-60">
                {Array.from({ length: 20 }).map((_, i) => {
                    const threshold = (100 / 20) * i;
                    const isActive = Math.min(100, Math.max(0, val)) > threshold;
                    return (
                        <div 
                            key={i} 
                            className="h-1 rounded-sm transition-colors duration-300"
                            style={{ backgroundColor: isActive ? color : 'rgba(255,255,255,0.05)' }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export const EliteTelemRibbon: React.FC<{ data: number[]; color?: string }> = ({ data, color = "#00F0FF" }) => {
    return (
        <div className="w-full h-8 flex gap-px items-end bg-white/5 p-px">
            {data.slice(-30).map((v, i) => {
                const height = Math.max(5, Math.min(100, v));
                return (
                    <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        className="flex-1 opacity-60 hover:opacity-100 transition-opacity mix-blend-screen"
                        style={{ backgroundColor: color }}
                    />
                );
            })}
        </div>
    );
};

export const GForceVisualizer: React.FC<{ accX: number; accY: number }> = ({ accX, accY }) => {
    // Map G-force to a -100 to 100 range for the visualizer (limiting at 2G)
    const x = Math.max(-100, Math.min(100, (accY / 2) * 100)); // Lat G
    const y = Math.max(-100, Math.min(100, (accX / 2) * -100)); // Lon G (Invert for visual coordinate)

    return (
        <div className="relative w-full aspect-square bg-[#050505] rounded-none border border-white/20 overflow-hidden flex items-center justify-center group shadow-[4px_4px_0_#000]">
            {/* Grid Lines */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-30">
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="border-r border-b border-brand-cyan/20"></div>
                ))}
            </div>
            
            <div className="absolute w-full h-[1px] bg-brand-cyan/50 top-1/2 -translate-y-1/2 shadow-[0_0_10px_#00F0FF]"></div>
            <div className="absolute h-full w-[1px] bg-brand-cyan/50 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#00F0FF]"></div>
            
            {/* Target Boxes instead of circles for brutalist look */}
            <div className="absolute w-[80%] h-[80%] border border-white/10 outline outline-[4px] outline-transparent"></div>
            <div style={{ marginBottom: '14px', marginRight: '-9px' }} className="absolute w-[40%] h-[40%] border border-white/10 outline outline-[4px] outline-transparent"></div>

            {/* Labels */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold text-gray-500 uppercase tracking-widest bg-[#050505] px-2 border border-white/5">+ Accel</div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold text-gray-500 uppercase tracking-widest bg-[#050505] px-2 border border-white/5">- Brake</div>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[7px] font-mono font-bold text-gray-500 uppercase tracking-widest vertical-text rotate-180 bg-[#050505] py-2 border border-white/5">- Lat_Left</div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-mono font-bold text-gray-500 uppercase tracking-widest vertical-text bg-[#050505] py-2 border border-white/5">+ Lat_Right</div>

            {/* The Dot (Current G) */}
            <motion.div 
                animate={{ x, y }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-4 h-4 bg-transparent border-2 border-brand-cyan z-20 shadow-[0_0_15px_#00F0FF] relative flex items-center justify-center transform scale-110"
            >
                <div className="w-1 h-1 bg-brand-cyan animate-ping"></div>
            </motion.div>
            
            {/* Metrics Panel overlaid */}
            <div className="absolute top-3 right-3 bg-black/80 px-2 py-1 border border-brand-cyan/40 backdrop-blur-md">
                <span className="text-[10px] font-mono font-black text-brand-cyan leading-none tracking-tighter block">
                    {Math.sqrt(accX**2 + accY**2).toFixed(2)}<span className="text-[7px]"> G_TOT</span>
                </span>
            </div>
            
            {/* Hardware screws in corners */}
            <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-white/20"></div>
            <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-white/20"></div>
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white/20"></div>
            <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-white/20"></div>
        </div>
    );
};

export const KinematicMatrix: React.FC<{ ekfUncertainty: number; gpsActive: boolean; imuActive: boolean; gpuActive?: boolean }> = ({ ekfUncertainty, gpsActive, imuActive, gpuActive }) => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">Fusion_Status</span>
                <div className="flex gap-2 items-center">
                    {gpuActive && (
                        <div className="mr-2 flex items-center gap-1.5 px-2 py-0.5 border border-brand-cyan/30 bg-brand-cyan/5">
                            <div className="w-1.5 h-1.5 bg-brand-cyan rounded-sm animate-pulse"></div>
                            <span className="text-[7px] font-mono font-bold text-brand-cyan uppercase">WebGPU_Active</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 hidden md:flex">
                         <div className={`w-1.5 h-1.5 rounded-sm ${gpsActive ? 'bg-brand-cyan shadow-[0_0_8px_#00F0FF]' : 'bg-white/10'}`} title="GPS Uplink"></div>
                         <span className="text-[7px] font-mono uppercase tracking-widest text-gray-600">GPS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                         <div className={`w-1.5 h-1.5 rounded-sm ${imuActive ? 'bg-brand-purple shadow-[0_0_8px_#BC13FE]' : 'bg-white/10'}`} title="IMU Core"></div>
                         <span className="text-[7px] font-mono uppercase tracking-widest text-gray-600">IMU</span>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-px bg-white/10 p-px">
                <div className="bg-[#0a0a0a] p-3 flex flex-col justify-between hover:bg-[#111] transition-colors">
                    <span className="text-[8px] font-mono font-bold text-gray-600 uppercase block mb-2">State_Entropy</span>
                    <span className="text-xl font-mono font-black tracking-tighter text-white">{(ekfUncertainty * 100).toFixed(2)}%</span>
                </div>
                <div className="bg-[#0a0a0a] p-3 flex flex-col justify-between hover:bg-[#111] transition-colors border-l border-white/5">
                    <span className="text-[8px] font-mono font-bold text-gray-600 uppercase block mb-2">Math_Kernel</span>
                    <span className="text-[10px] font-mono font-black text-brand-cyan tracking-wider uppercase mt-auto leading-tight">{gpuActive ? 'VULKAN_GPU_CORE' : 'AVX512_HYBRID'}</span>
                </div>
            </div>

            <div className="pt-2 border-t border-dashed border-white/10 mt-4">
                <div className="flex justify-between text-[8px] font-mono font-bold text-gray-500 uppercase mb-1">
                    <span>Uplink_Quality</span>
                    <span className="text-white">98.2%</span>
                </div>
                {/* Dot matrix uplink visualization */}
                <div className="w-full flex gap-[2px] h-2">
                     {Array.from({ length: 40 }).map((_, i) => (
                         <div key={i} className={`flex-1 ${i < 39 ? 'bg-brand-cyan' : 'bg-brand-cyan/20'} opacity-80 mix-blend-screen`}></div>
                     ))}
                </div>
            </div>
        </div>
    );
};
