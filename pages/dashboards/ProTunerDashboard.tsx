
import React from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { KarapiroLogo } from '../../components/KarapiroLogo';

// --- Sub-Components ---

const ChannelRow: React.FC<{ 
    label: string; 
    value: string | number; 
    unit: string; 
    min: number; 
    max: number; 
    rawVal: number;
    color?: string; // Tailwind color class for bar
    alert?: boolean;
}> = ({ label, value, unit, min, max, rawVal, color = 'bg-brand-cyan', alert }) => {
    const pct = Math.min(100, Math.max(0, ((rawVal - min) / (max - min)) * 100));
    
    return (
        <div className={`flex flex-col mb-[1px] bg-[#0a0a0a] p-2 border-l-4 ${alert ? 'border-red-600 bg-red-900/20' : 'border-[#222]'}`}>
            <div className="flex justify-between items-baseline mb-1">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono">{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-bold font-mono leading-none ${alert ? 'text-red-500 animate-pulse' : 'text-white'}`}>{value}</span>
                    <span className="text-[9px] text-gray-600 font-mono">{unit}</span>
                </div>
            </div>
            {/* Bar Graph */}
            <div className="w-full h-1.5 bg-[#151515] relative overflow-hidden">
                <div 
                    className={`h-full ${alert ? 'bg-red-500' : color} transition-all duration-75 ease-linear`} 
                    style={{ width: `${pct}%` }}
                ></div>
                {/* Ticks */}
                <div className="absolute inset-0 flex justify-between px-0.5">
                    <div className="w-px h-full bg-black/50"></div>
                    <div className="w-px h-full bg-black/50"></div>
                    <div className="w-px h-full bg-black/50"></div>
                </div>
            </div>
        </div>
    );
};

const ShiftLightArray: React.FC<{ rpm: number; limit: number }> = ({ rpm, limit }) => {
    const start = limit - 3000;
    const numLeds = 15;
    const activeLeds = Math.max(0, Math.min(numLeds, Math.floor(((rpm - start) / (limit - start)) * numLeds)));
    const isShift = rpm >= limit;

    return (
        <div className="flex w-full gap-[2px] h-4 mb-2 bg-black p-1 border-b border-[#222]">
            {Array.from({ length: numLeds }).map((_, i) => {
                let color = 'bg-green-600';
                if (i > 5) color = 'bg-yellow-500';
                if (i > 10) color = 'bg-red-600';
                if (isShift) color = 'bg-blue-500'; // Flash blue on shift

                const isActive = i < activeLeds || isShift;
                return (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-[1px] ${isActive ? color : 'bg-[#1a1a1a]'} ${isActive && isShift ? 'animate-pulse' : ''}`}
                    />
                );
            })}
        </div>
    );
};

// --- Main Dashboard ---

const ProTunerDashboard: React.FC = () => {
    const { latestData, hasActiveFault } = useVehicleData();
    const d = latestData;
    
    // Smooth RPM for main display
    const smoothRpm = useAnimatedValue(d.rpm);

    return (
        <div className="w-full h-full bg-black text-white flex flex-col font-sans overflow-hidden">
            
            {/* 1. Header & Shift Lights */}
            <ShiftLightArray rpm={d.rpm} limit={7500} />
            
            <div className="flex items-start justify-between px-4 pb-2 border-b border-[#222]">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Profile</span>
                    <span className="text-xs font-mono text-brand-cyan">QUALIFY_MAP_3</span>
                </div>
                <div className="flex flex-col items-center">
                    <KarapiroLogo className="h-6 w-auto opacity-80" variant="monochrome" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Lap Time</span>
                    <span className="text-xl font-mono text-yellow-500 font-bold leading-none">1:24.08</span>
                </div>
            </div>

            {/* 2. Main Content Grid */}
            <div className="flex-1 grid grid-cols-12 gap-[1px] bg-[#111] p-[1px]">
                
                {/* --- Left Column: Pressures & Fluids --- */}
                <div className="col-span-3 bg-black flex flex-col gap-[1px]">
                    <div className="bg-[#111] px-2 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest">FLUID SYSTEMS</div>
                    <ChannelRow label="Engine Oil P" value={d.oilPressure.toFixed(1)} rawVal={d.oilPressure} unit="BAR" min={0} max={8} color="bg-yellow-500" alert={d.oilPressure < 1.0} />
                    <ChannelRow label="Fuel Rail P" value={d.fuelPressure.toFixed(1)} rawVal={d.fuelPressure} unit="BAR" min={0} max={6} color="bg-green-500" />
                    <ChannelRow label="Coolant P" value="1.1" rawVal={1.1} unit="BAR" min={0} max={2} color="bg-blue-500" />
                    <ChannelRow label="Brake P F" value="0" rawVal={0} unit="BAR" min={0} max={100} color="bg-red-500" />
                    <div className="flex-1 bg-black"></div> {/* Spacer */}
                    <ChannelRow label="Battery" value={d.batteryVoltage.toFixed(1)} rawVal={d.batteryVoltage} unit="V" min={11} max={15} color="bg-gray-400" />
                </div>

                {/* --- Center Column: Driver Focus --- */}
                <div className="col-span-6 bg-black flex flex-col relative">
                    
                    {/* RPM Tape */}
                    <div className="h-16 w-full border-b border-[#222] relative flex flex-col justify-end pb-1 px-2">
                        <span className="absolute top-1 right-2 text-[10px] text-gray-500 font-bold">RPM</span>
                        <div className="text-5xl font-mono font-bold text-white text-center z-10">{smoothRpm.toFixed(0)}</div>
                    </div>

                    {/* Gear & Speed */}
                    <div className="flex-1 flex flex-col items-center justify-center py-4">
                        <div className="text-[12rem] font-display font-black text-yellow-500 leading-none" style={{ textShadow: '0 0 50px rgba(252,238,10,0.2)' }}>
                            {d.gear === 0 ? 'N' : d.gear}
                        </div>
                        <div className="flex items-baseline gap-2 mt-[-20px]">
                            <span className="text-6xl font-mono font-bold text-white">{d.speed.toFixed(0)}</span>
                            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">KM/H</span>
                        </div>
                    </div>

                    {/* Alerts Overlay */}
                    {hasActiveFault && (
                        <div className="absolute top-20 left-4 right-4 bg-red-600/90 text-white p-2 text-center animate-pulse border-2 border-red-500">
                            <span className="font-bold text-sm uppercase tracking-widest block">CHECK ENGINE</span>
                            <span className="text-xs font-mono">CODE: P0300</span>
                        </div>
                    )}

                    {/* Bottom Status Toggles */}
                    <div className="grid grid-cols-4 gap-[1px] border-t border-[#222] bg-[#222]">
                        <div className="bg-black p-2 text-center">
                            <span className="text-[9px] text-gray-500 block">TC</span>
                            <span className="text-xl font-bold text-green-500">4</span>
                        </div>
                        <div className="bg-black p-2 text-center">
                            <span className="text-[9px] text-gray-500 block">ABS</span>
                            <span className="text-xl font-bold text-green-500">2</span>
                        </div>
                        <div className="bg-black p-2 text-center">
                            <span className="text-[9px] text-gray-500 block">MAP</span>
                            <span className="text-xl font-bold text-white">A</span>
                        </div>
                        <div className="bg-black p-2 text-center">
                            <span className="text-[9px] text-gray-500 block">BIAS</span>
                            <span className="text-xl font-bold text-white">58</span>
                        </div>
                    </div>
                </div>

                {/* --- Right Column: Temps & Aero --- */}
                <div className="col-span-3 bg-black flex flex-col gap-[1px]">
                    <div className="bg-[#111] px-2 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest">THERMAL & AERO</div>
                    <ChannelRow label="Coolant Temp" value={d.engineTemp.toFixed(0)} rawVal={d.engineTemp} unit="°C" min={60} max={120} color="bg-blue-400" alert={d.engineTemp > 105} />
                    <ChannelRow label="Oil Temp" value={(d.engineTemp + 15).toFixed(0)} rawVal={d.engineTemp + 15} unit="°C" min={70} max={140} color="bg-yellow-600" />
                    <ChannelRow label="Intake Temp" value={d.inletAirTemp.toFixed(0)} rawVal={d.inletAirTemp} unit="°C" min={20} max={80} color="bg-cyan-600" />
                    <ChannelRow label="Exhaust Temp" value="840" rawVal={840} unit="°C" min={400} max={1000} color="bg-orange-600" />
                    <div className="h-[1px] bg-[#222] my-1"></div>
                    <ChannelRow label="Lambda 1" value={(d.o2SensorVoltage * 2 + 0.5).toFixed(3)} rawVal={d.o2SensorVoltage * 2 + 0.5} unit="LA" min={0.7} max={1.3} color="bg-green-400" />
                    <ChannelRow label="Boost" value={d.turboBoost.toFixed(2)} rawVal={d.turboBoost} unit="BAR" min={-1} max={2.5} color="bg-white" />
                </div>

            </div>

            {/* 3. Footer Logger Bar */}
            <div className="h-6 bg-[#050505] border-t border-[#222] flex items-center justify-between px-2 text-[9px] font-mono text-gray-600">
                <span>LOG STATUS: <span className="text-green-500 font-bold">RECORDING [00:14:22]</span></span>
                <span>GPS: <span className="text-white">3D FIX (12)</span></span>
                <span>STORAGE: 64% FREE</span>
            </div>
        </div>
    );
};

export default ProTunerDashboard;
