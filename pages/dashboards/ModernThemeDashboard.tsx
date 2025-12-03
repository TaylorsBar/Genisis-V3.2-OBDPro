
import React from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import AutometerTach from '../../components/tachometers/AutometerTach';

const DataWidget: React.FC<{ 
    label: string; 
    value: string | number; 
    unit: string; 
    color?: string;
    align?: 'left' | 'right';
}> = ({ label, value, unit, color, align = 'left' }) => (
    <div className={`
        group relative flex flex-col justify-center py-4 px-6 mb-4 w-full
        bg-black/60 backdrop-blur-md border-y border-white/5
        transition-all duration-300 hover:bg-white/10 hover:border-brand-cyan
        ${align === 'left' ? 'border-l-4 border-l-brand-cyan items-start' : 'border-r-4 border-r-brand-cyan items-end'}
    `}>
        <div className={`flex flex-col ${align === 'left' ? 'items-start' : 'items-end'} w-full`}>
            <span className="text-[10px] font-display font-bold uppercase tracking-[0.25em] text-gray-500 mb-1 group-hover:text-brand-cyan transition-colors">
                {label}
            </span>
            <div className="flex items-baseline gap-2">
                <span className={`text-4xl md:text-5xl font-display font-black ${color || 'text-white'} tracking-tighter leading-none drop-shadow-lg`}>
                    {value}
                </span>
                <span className="text-xs font-mono font-bold text-gray-600 uppercase">{unit}</span>
            </div>
        </div>
    </div>
);

const ModernThemeDashboard: React.FC = () => {
    const { latestData, hasActiveFault } = useVehicleData();
    const d = latestData;
    
    const isRedline = d.rpm > 7200;
    
    const format = (val: number | undefined, prec: number = 0) => 
        (val !== undefined && !isNaN(val)) ? val.toFixed(prec) : "0";

    return (
        <div className="w-full h-full bg-[#050505] relative overflow-hidden flex flex-col font-sans">
            
            {/* Dynamic Background */}
            <div 
                className="absolute inset-0 pointer-events-none transition-colors duration-500 ease-out z-0"
                style={{
                    background: `radial-gradient(circle at 50% 60%, ${isRedline ? 'rgba(255,0,0,0.15)' : 'rgba(0, 240, 255, 0.05)'}, transparent 70%)`
                }}
            ></div>

            {/* Hex Pattern */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
            }}></div>

            {/* --- Main Layout --- */}
            <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-12 px-4 lg:px-16 py-6 overflow-y-auto md:overflow-hidden content-center">
                
                {/* LEFT STACK */}
                <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-4 z-20 justify-center order-2 md:order-1 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0">
                    <DataWidget label="Boost" value={format(d.turboBoost, 2)} unit="BAR" color="text-brand-cyan" align="left" />
                    <DataWidget label="A/F Ratio" value={format((d.o2SensorVoltage * 2 + 9), 1)} unit="AFR" align="left" />
                    <DataWidget label="Intake" value={format(d.inletAirTemp, 0)} unit="°C" align="left" />
                </div>

                {/* CENTER CLUSTER */}
                <div className="col-span-1 md:col-span-6 flex flex-col items-center justify-center relative h-[40vh] md:h-full order-1 md:order-2 my-4 md:my-0">
                    <div className="relative w-full h-full flex items-center justify-center transform scale-100 lg:scale-125 transition-transform duration-500 drop-shadow-2xl">
                        <AutometerTach 
                            rpm={isNaN(d.rpm) ? 0 : d.rpm} 
                            speed={d.speed}
                            gear={d.gear}
                            shiftPoint={7500} 
                            redline={8000} 
                            maxRpm={10000} 
                            size="100%" 
                        />
                    </div>
                </div>

                {/* RIGHT STACK */}
                <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-4 z-20 justify-center order-3 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0">
                    <DataWidget label="Oil Press" value={format(d.oilPressure, 1)} unit="BAR" align="right" />
                    <DataWidget label="Coolant" value={format(d.engineTemp, 0)} unit="°C" color={d.engineTemp > 100 ? "text-red-500 animate-pulse" : "text-white"} align="right" />
                    <DataWidget label="Voltage" value={format(d.batteryVoltage, 1)} unit="V" color={d.batteryVoltage < 12.5 ? "text-yellow-500" : "text-green-400"} align="right" />
                </div>
            </div>

            {/* --- Bottom Status Bar --- */}
            <div className="h-14 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-8 z-20 shrink-0">
                 <div className="flex items-center gap-6">
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hidden xs:inline">Map Selection</span>
                     <div className="px-4 py-1 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold uppercase tracking-wider">
                         Sport +
                     </div>
                 </div>

                 <div className="flex items-center gap-6">
                    <div className={`flex items-center gap-2 px-4 py-1 border ${hasActiveFault ? 'bg-red-900/20 border-red-600/50' : 'border-white/10 bg-white/5'}`}>
                        <div className={`w-2 h-2 rounded-sm ${hasActiveFault ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${hasActiveFault ? 'text-red-400' : 'text-gray-400'}`}>
                            {hasActiveFault ? 'CHECK ENGINE' : 'SYSTEM OK'}
                        </span>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default ModernThemeDashboard;
