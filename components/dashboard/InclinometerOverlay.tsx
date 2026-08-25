import React from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

export const InclinometerOverlay: React.FC<{ className?: string }> = ({ className = '' }) => {
    const gForceX = useVehicleStore(state => state.latestData.gForceX || 0);
    const gForceY = useVehicleStore(state => state.latestData.gForceY || 0);
    const speed = useVehicleStore(state => state.latestData.speed || 0);

    // Simulated Pitch and Roll based on acceleration and turning Gs
    // Pitch: positive is braking (nose down), negative is accelerating (nose up)
    const pitch = gForceY * -15; // approximate degrees mapping
    const roll = gForceX * 12; // approximate degrees mapping

    return (
        <div className={`p-3 bg-[#0c0c0e]/90 backdrop-blur-md border-l-2 border-[#ff00ff] shadow-lg flex flex-col gap-2 ${className}`}>
            <div className="text-[9px] text-[#ff00ff] font-mono uppercase tracking-[0.2em] border-b border-gray-800 pb-1 mb-1 flex justify-between">
                <span>Inclinometer & G-Force</span>
                <span>ATTITUDE SYS</span>
            </div>

            <div className="flex gap-4">
                {/* Visual Artificial Horizon */}
                <div className="relative w-24 h-24 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden flex-shrink-0">
                    <div 
                        className="absolute inset-x-0 h-[200%] bg-brand-cyan/20 origin-center transition-transform duration-300 ease-out"
                        style={{ 
                            top: '-50%',
                            transform: `rotate(${roll}deg) translateY(${pitch}%)` 
                        }}
                    >
                        <div className="w-full h-1 bg-[#ff00ff]/80 absolute top-1/2 -translate-y-1/2"></div>
                    </div>
                    {/* Fixed Aircraft Symbol */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 flex justify-between z-10">
                        <div className="w-3 h-0.5 bg-white shadow-[0_0_2px_#fff]"></div>
                        <div className="w-1 h-0.5 bg-white shadow-[0_0_2px_#fff]"></div>
                        <div className="w-3 h-0.5 bg-white shadow-[0_0_2px_#fff]"></div>
                    </div>
                    {/* Tick marks */}
                    <div className="absolute inset-0 border-[3px] border-dashed border-gray-500/30 rounded-full"></div>
                </div>

                <div className="flex flex-col justify-between py-1">
                    <div>
                        <span className="block text-[8px] text-gray-500 font-mono">PITCH (LONG)</span>
                        <span className="font-mono text-xs text-white">{(pitch > 0 ? '+' : '')}{pitch.toFixed(1)}°</span>
                    </div>
                    <div>
                        <span className="block text-[8px] text-gray-500 font-mono">ROLL (LAT)</span>
                        <span className="font-mono text-xs text-white">{(roll > 0 ? '+' : '')}{roll.toFixed(1)}°</span>
                    </div>
                    <div>
                        <span className="block text-[8px] text-gray-500 font-mono">G-VECTOR</span>
                        <span className="font-mono text-xs text-brand-cyan font-bold">{Math.sqrt(gForceX**2 + gForceY**2).toFixed(2)} G</span>
                    </div>
                </div>

                {/* G-Circle */}
                <div className="relative w-24 h-24 bg-gray-900 rounded-full border border-gray-800 flex-shrink-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 rounded-full border border-gray-700/50"></div>
                    <div className="absolute inset-4 rounded-full border border-gray-600/30"></div>
                    <div className="absolute inset-8 rounded-full border border-gray-500/20"></div>
                    <div className="w-full h-[1px] bg-gray-800 absolute top-1/2"></div>
                    <div className="h-full w-[1px] bg-gray-800 absolute left-1/2"></div>
                    
                    {/* G-Dot */}
                    <div 
                        className="absolute w-3 h-3 bg-[#ff00ff] rounded-full shadow-[0_0_8px_#ff00ff] transition-all duration-100 ease-linear"
                        style={{
                            left: `calc(50% + ${Math.min(1, Math.max(-1, gForceX / 1.5)) * 40}px)`,
                            top: `calc(50% + ${Math.min(1, Math.max(-1, gForceY / 1.5)) * 40}px)`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default InclinometerOverlay;
