import React from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

interface ThermographicsOverlayProps {
    className?: string;
}

const TireHeatmap: React.FC<{
    position: 'FL' | 'FR' | 'RL' | 'RR';
    tempCurve: number; // 0 to 1
    pressureAlert: boolean;
}> = ({ position, tempCurve, pressureAlert }) => {
    // Colors from cold to optimal to overheat
    const getColor = (t: number) => {
        if (t < 0.3) return '#3b82f6'; // Cold
        if (t < 0.6) return '#39FF14'; // Optimal
        if (t < 0.8) return '#FFA500'; // Hot
        return '#FF003C'; // Overheat
    };

    const color = getColor(tempCurve);
    
    return (
        <div className={`p-2 bg-black/60 border border-white/5 backdrop-blur-md rounded relative ${pressureAlert ? 'ring-1 ring-red-500 animate-pulse' : ''}`}>
            <div className="flex justify-between items-center mb-1">
                <span className="font-display font-black text-[10px] text-gray-400">{position} TIRE</span>
                <span className="font-mono text-[9px] font-bold" style={{ color }}>
                    {Math.floor(20 + tempCurve * 110)}°C
                </span>
            </div>
            
            <div className="relative w-12 h-16 bg-gray-900 rounded-sm overflow-hidden flex shadow-inner">
                {/* 3 Temperature Zones Left/Center/Right */}
                <div className="flex-1 opacity-80" style={{ backgroundColor: getColor(tempCurve * 0.9) }} />
                <div className="flex-1 border-x border-black/20 opacity-90" style={{ backgroundColor: color }} />
                <div className="flex-1 opacity-80" style={{ backgroundColor: getColor(tempCurve * 0.85) }} />
            </div>
            
            {/* Brake Rotor Sim */}
            <div className="absolute inset-x-2 bottom-2 h-1 bg-black/50 border border-white/10 rounded overflow-hidden">
                 <div 
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ 
                        width: `${Math.min(100, Math.max(0, tempCurve * 120))}%`,
                        filter: tempCurve > 0.7 ? 'drop-shadow(0 0 4px #FF003C)' : '' 
                    }}
                />
            </div>
               
             <div className="mt-1 flex justify-between">
                <span className="text-[7px] text-gray-500 font-mono">BRAKE</span>
                <span className="text-[7px] text-gray-400 font-mono">
                    {Math.floor(100 + tempCurve * 400)}°c
                </span>
             </div>
             
             <div className="mt-1 flex justify-between pt-1 border-t border-white/10">
                <span className="text-[8px] text-gray-400 font-mono">{(30 + Math.random() * 2).toFixed(1)} PSI</span>
                 {pressureAlert && <span className="text-[8px] text-red-500 font-bold animate-pulse font-mono">WARN</span>}
             </div>
        </div>
    );
}

export const ThermographicsOverlay: React.FC<ThermographicsOverlayProps> = ({ className = '' }) => {
    const activePids = useVehicleStore(state => state.activePids);
    const speed = useVehicleStore(state => state.latestData.speed || 0);
    const rpm = useVehicleStore(state => state.latestData.rpm || 0);
    
    // Simulate heat based on speed and rpm activity (mocked live physics)
    const baseHeat = Math.min(1.0, (speed / 150) + (rpm / 8000));
    
    const flTemp = baseHeat * 0.9 + (Math.sin(Date.now() / 2000) * 0.1);
    const frTemp = baseHeat * 0.85 + (Math.cos(Date.now() / 2000) * 0.1);
    const rlTemp = baseHeat * 0.7 + (Math.sin(Date.now() / 3000) * 0.05);
    const rrTemp = baseHeat * 0.72 + (Math.cos(Date.now() / 3000) * 0.05);

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="text-[9px] text-gray-500 font-mono uppercase tracking-[0.2em] border-b border-gray-800 pb-1 mb-1 shadow-sm">
                Thermographics System
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                {/* Front Array */}
                <TireHeatmap position="FL" tempCurve={Math.max(0, flTemp)} pressureAlert={false} />
                <TireHeatmap position="FR" tempCurve={Math.max(0, frTemp)} pressureAlert={false} />
                
                {/* Rear Array */}
                <TireHeatmap position="RL" tempCurve={Math.max(0, rlTemp)} pressureAlert={baseHeat > 0.85} />
                <TireHeatmap position="RR" tempCurve={Math.max(0, rrTemp)} pressureAlert={false} />
            </div>
            
            <div className="p-2 bg-black/60 border border-white/5 backdrop-blur-md rounded mt-1 flex items-center justify-between">
                <span className="font-display text-[9px] text-gray-400 tracking-wider">CHASSIS TORQUE</span>
                <div className="flex-1 ml-4 h-1 bg-gray-800 rounded overflow-hidden">
                    <div 
                        className="h-full bg-brand-cyan transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, baseHeat * 100))}%` }} 
                    />
                </div>
            </div>
        </div>
    );
};

export default ThermographicsOverlay;
