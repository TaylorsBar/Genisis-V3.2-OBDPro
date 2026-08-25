import React from 'react';
import { motion } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { Shield, Zap, Wind, Orbit, Disc, Thermometer } from 'lucide-react';

export const SubsystemNerveMap: React.FC = () => {
    const subsystems = useVehicleStore(state => state.subsystems);
    const data = useVehicleStore(state => state.latestData);

    const nodes = [
        { id: 'ecu', label: 'Neural_Core', icon: <Shield className="w-3 h-3" />, x: 50, y: 50, status: 'NOMINAL', color: '#00F0FF' },
        { id: 'turbo', label: 'Compressor', icon: <Wind className="w-3 h-3" />, x: 25, y: 30, status: data.turboBoost > 1.8 ? 'PEAK' : 'NOMINAL', color: '#FF003C' },
        { id: 'fuel', label: 'Injection', icon: <Zap className="w-3 h-3" />, x: 75, y: 30, status: 'IDLE', color: '#FCEE0A' },
        { id: 'brake', label: 'Thermal_Mat', icon: <Disc className="w-3 h-3" />, x: 25, y: 70, status: (data.brakeTemp || 0) > 400 ? 'THERMAL_STRESS' : 'COLD', color: '#BC13FE' },
        { id: 'wmi', label: 'Methane_Inj', icon: <Orbit className="w-3 h-3" />, x: 75, y: 70, status: subsystems.wmi, color: '#00FF41' },
    ];

    return (
        <div className="relative w-full aspect-[4/3] bg-[#0A0A0A] border border-white/20 overflow-hidden group">
            {/* Engineering Grid */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                     backgroundSize: '20px 20px',
                     backgroundPosition: 'center center'
                 }}>
            </div>
            
            {/* Connection Lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {/* Simplified hard-angled connections to the Core */}
                <path d="M 25% 30% L 50% 50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <path d="M 75% 30% L 50% 50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <path d="M 25% 70% L 50% 50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <path d="M 75% 70% L 50% 50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
            </svg>

            {nodes.map((node) => {
                const isNominal = node.status === 'ON' || node.status === 'NOMINAL' || node.status === 'COLD';
                const isCritical = node.status === 'PEAK' || node.status === 'THERMAL_STRESS';
                
                return (
                <motion.div
                    key={node.id}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                >
                    <div className={`w-10 h-10 flex items-center justify-center transition-all bg-[#111] overflow-hidden group-hover:scale-105 border ${isCritical ? 'border-[#FF003C]' : isNominal ? 'border-white/20' : 'border-white/10'}`}>
                         <div className="absolute top-0 left-0 w-full h-[2px]" style={{ backgroundColor: node.color }}></div>
                        <div className={`z-10`} style={{ color: isCritical ? '#FF003C' : node.color }}>
                            {node.icon}
                        </div>
                        
                        {/* Pulse effect for core */}
                        {node.id === 'ecu' && (
                            <div className="absolute inset-0 border border-brand-cyan/20 animate-ping"></div>
                        )}
                    </div>
                    
                    <div className="mt-2 text-center bg-[#050505] border border-white/5 px-2 py-0.5 shadow-[2px_2px_0_#000]">
                        <span className="text-[7px] font-mono font-bold text-gray-500 uppercase tracking-widest block">{node.label}</span>
                        <span className={`text-[8px] font-mono font-black uppercase ${
                            isNominal ? 'text-brand-cyan' : 
                            isCritical ? 'text-[#FF003C]' : 'text-gray-700'
                        }`}>{node.status}</span>
                    </div>
                </motion.div>
            )})}

            {/* Tactical Scanning Laser Decoration */}
            <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute left-0 right-0 h-px bg-brand-cyan/40 shadow-[0_0_15px_#00F0FF] pointer-events-none z-30 opacity-50"
            />
        </div>
    );
};
