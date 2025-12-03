
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
        group relative flex flex-col justify-center py-3 md:py-5 px-4 md:px-8 mb-4 md:mb-6 w-full
        bg-black/40 backdrop-blur-xl border border-white/10
        transition-all duration-300 hover:bg-white/5 hover:border-[var(--theme-color)] hover:scale-[1.02]
        shadow-lg transform
        ${align === 'left' ? 'md:skew-x-[-10deg] border-l-4 border-l-[var(--theme-color)] items-start rounded-r-xl' : 'md:skew-x-[10deg] border-r-4 border-r-[var(--theme-color)] items-end rounded-l-xl'}
    `}>
        <div className={`transform ${align === 'left' ? 'md:skew-x-[10deg]' : 'md:skew-x-[-10deg]'} flex flex-col ${align === 'left' ? 'items-start' : 'items-end'} w-full`}>
            <span className="text-[8px] md:text-[10px] font-display font-bold uppercase tracking-[0.25em] text-gray-500 mb-1 group-hover:text-[var(--theme-color)] transition-colors">
                {label}
            </span>
            <div className="flex items-baseline gap-2">
                <span className={`text-3xl md:text-5xl font-display font-black ${color || 'text-white'} tracking-tighter leading-none drop-shadow-md`}>
                    {value}
                </span>
                <span className="text-[10px] md:text-xs font-mono font-bold text-gray-600 uppercase">{unit}</span>
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
                    background: `radial-gradient(circle at 50% 60%, ${isRedline ? 'rgba(255,0,0,0.2)' : 'var(--theme-glow)'}, transparent 70%)`
                }}
            ></div>

            {/* Hex Pattern */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23333' stroke-width='1'/%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
            }}></div>

            {/* --- Main Layout --- */}
            <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-12 px-4 lg:px-16 py-6 overflow-y-auto md:overflow-hidden">
                
                {/* LEFT STACK */}
                <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-0 z-20 justify-center md:justify-center order-2 md:order-1 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0">
                    <DataWidget label="Boost" value={format(d.turboBoost, 2)} unit="BAR" color="text-[var(--theme-color)]" align="left" />
                    <DataWidget label="A/F Ratio" value={format((d.o2SensorVoltage * 2 + 9), 1)} unit="AFR" align="left" />
                    <DataWidget label="Intake" value={format(d.inletAirTemp, 0)} unit="°C" align="left" />
                </div>

                {/* CENTER CLUSTER */}
                <div className="col-span-1 md:col-span-6 flex flex-col items-center justify-center relative h-[40vh] md:h-full order-1 md:order-2 my-4 md:my-0">
                    <div className="relative w-full h-full flex items-center justify-center transform scale-100 lg:scale-125 transition-transform duration-500 drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
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
                <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-0 z-20 justify-center md:justify-center order-3 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0">
                    <DataWidget label="Oil Press" value={format(d.oilPressure, 1)} unit="BAR" align="right" />
                    <DataWidget label="Coolant" value={format(d.engineTemp, 0)} unit="°C" color={d.engineTemp > 100 ? "text-red-500 animate-pulse" : "text-white"} align="right" />
                    <DataWidget label="Voltage" value={format(d.batteryVoltage, 1)} unit="V" color={d.batteryVoltage < 12.5 ? "text-yellow-500" : "text-green-400"} align="right" />
                </div>
            </div>

            {/* --- Bottom Status Bar --- */}
            <div className="h-12 md:h-16 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-4 md:px-10 z-20 shrink-0">
                 <div className="flex items-center gap-2 md:gap-4">
                     <span className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest hidden xs:inline">Map</span>
                     <div className="px-3 md:px-4 py-1 bg-[var(--theme-color)]/10 border border-[var(--theme-color)]/30 rounded md:skew-x-[-10deg] text-[var(--theme-color)] text-[10px] md:text-xs font-bold uppercase tracking-wider">
                         <span className="block md:skew-x-[10deg]">Sport +</span>
                     </div>
                 </div>

                 <div className="flex items-center gap-6">
                    <div className={`flex items-center gap-2 px-3 md:px-4 py-1 rounded-full border ${hasActiveFault ? 'bg-red-900/20 border-red-600/50' : 'border-white/5 bg-white/5'}`}>
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${hasActiveFault ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className={`text-[8px] md:text-[10px] font-bold uppercase ${hasActiveFault ? 'text-red-400' : 'text-gray-400'}`}>
                            {hasActiveFault ? 'Check Engine' : 'System Nominal'}
                        </span>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default ModernThemeDashboard;
