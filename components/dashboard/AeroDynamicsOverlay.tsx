import React from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

export const AeroDynamicsOverlay: React.FC<{ className?: string }> = ({ className = '' }) => {
    const speed = useVehicleStore(state => state.latestData.speed || 0);

    // Simulated Aerodynamic Load based on speed (v^2 relationship)
    // Drag = Cd * A * .5 * r * V^2 (simplified)
    const speedMs = speed / 3.6;
    const dynamicPressure = 0.5 * 1.225 * Math.pow(speedMs, 2);
    
    // Mock coefficients
    const cd = 0.32;
    const frontalArea = 2.2;
    const clLoad = -0.45; // Downforce coefficient
    
    const dragForce = dynamicPressure * cd * frontalArea; // in Newtons
    const downforce = dynamicPressure * Math.abs(clLoad) * frontalArea; // in Newtons

    const maxExpectedDownforce = 3000; // Expected max at around 250km/h
    const downforcePercentage = Math.min(100, Math.max(0, (downforce / maxExpectedDownforce) * 100));

    return (
        <div className={`p-3 bg-[#0c0c0e]/90 backdrop-blur-md border-l-2 border-brand-cyan shadow-lg flex flex-col gap-2 ${className}`}>
            <div className="text-[9px] text-brand-cyan font-mono uppercase tracking-[0.2em] border-b border-gray-800 pb-1 mb-1 flex justify-between">
                <span>Active Aerodynamics</span>
                <span>CFD MODEL</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="block text-[8px] text-gray-500 font-mono mb-1">PARASITIC DRAG</span>
                    <div className="flex items-end gap-1 mb-1">
                        <span className="font-mono text-sm text-red-400 font-bold">{Math.round(dragForce)}</span>
                        <span className="font-mono text-[9px] text-gray-500 mb-[2px]">N</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                        <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${Math.min(100, dragForce / 1500 * 100)}%` }}></div>
                    </div>
                </div>

                <div>
                    <span className="block text-[8px] text-gray-500 font-mono mb-1">DOWNFORCE YIELD</span>
                    <div className="flex items-end gap-1 mb-1">
                        <span className="font-mono text-sm text-green-400 font-bold">{Math.round(downforce)}</span>
                        <span className="font-mono text-[9px] text-gray-500 mb-[2px]">N</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${downforcePercentage}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="mt-1 pt-2 border-t border-gray-800 flex justify-between items-center">
                <div className="flex gap-2 items-center">
                    <span className="text-[8px] text-gray-400 font-mono">DRAG COEFF (Cd)</span>
                    <span className="text-[9px] text-white font-mono font-bold">0.32</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-[8px] text-gray-400 font-mono">AERO BALANCE</span>
                    <span className="text-[9px] text-brand-cyan font-mono font-bold">42:58</span>
                </div>
            </div>
        </div>
    );
};

export default AeroDynamicsOverlay;
