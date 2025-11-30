
import React from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

const DataCell: React.FC<{ label: string; value: string | number; unit?: string; alert?: boolean }> = ({ label, value, unit, alert }) => (
    <div className={`flex flex-col justify-between p-2 h-24 border border-gray-700 ${alert ? 'bg-red-600' : 'bg-[#151515]'}`}>
        <span className={`text-[10px] font-bold uppercase ${alert ? 'text-black' : 'text-gray-400'}`}>{label}</span>
        <div className="flex items-baseline justify-end gap-1">
             <span className={`text-3xl font-bold font-mono ${alert ? 'text-white' : 'text-white'}`}>{value}</span>
             {unit && <span className={`text-xs ${alert ? 'text-black' : 'text-gray-500'}`}>{unit}</span>}
        </div>
    </div>
);

const HorizontalBar: React.FC<{ value: number; max: number; label: string; color?: string }> = ({ value, max, label, color = 'bg-green-500' }) => {
    const width = Math.min(100, (value / max) * 100);
    return (
        <div className="w-full mb-1">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>{label}</span>
                <span>{value.toFixed(1)}</span>
            </div>
            <div className="h-4 bg-[#222] w-full">
                <div className={`h-full ${color} transition-all duration-75`} style={{ width: `${width}%` }}></div>
            </div>
        </div>
    );
};

const ProTunerDashboard: React.FC = () => {
    const { latestData } = useVehicleData();
    const d = latestData;
    const animatedRpm = useAnimatedValue(d.rpm);

    return (
        <div className="w-full h-full bg-black p-1 flex flex-col font-mono text-white overflow-hidden">
            {/* Top RPM Strip */}
            <div className="h-16 w-full bg-[#111] mb-1 flex items-stretch border-b border-gray-800">
                <div className="w-32 flex flex-col justify-center items-center bg-[#222] border-r border-gray-700">
                    <span className="text-2xl font-bold">{animatedRpm.toFixed(0)}</span>
                    <span className="text-[10px] text-gray-400">RPM</span>
                </div>
                <div className="flex-1 flex gap-0.5 p-1">
                    {Array.from({length: 50}).map((_, i) => {
                         const step = 8000 / 50;
                         const currentRpm = i * step;
                         const active = d.rpm > currentRpm;
                         
                         let color = 'bg-green-500';
                         if (currentRpm > 5500) color = 'bg-yellow-500';
                         if (currentRpm > 7000) color = 'bg-red-500';

                         return (
                             <div key={i} className={`flex-1 ${active ? color : 'bg-[#222]'} transition-colors duration-75`}></div>
                         )
                    })}
                </div>
                <div className="w-24 bg-black flex items-center justify-center text-4xl font-bold text-yellow-500">
                    {d.gear}
                </div>
            </div>

            {/* Main Data Grid */}
            <div className="flex-1 grid grid-cols-12 gap-1">
                
                {/* Left Column: Temperatures */}
                <div className="col-span-3 bg-[#111] p-2 flex flex-col gap-4">
                    <HorizontalBar label="Eng Temp" value={d.engineTemp} max={120} color={d.engineTemp > 100 ? 'bg-red-500' : 'bg-green-500'} />
                    <HorizontalBar label="Oil Temp" value={95} max={150} color="bg-green-500" />
                    <HorizontalBar label="Intake" value={d.inletAirTemp} max={80} color="bg-blue-400" />
                    <HorizontalBar label="Trans" value={88} max={120} color="bg-green-500" />
                </div>

                {/* Center Column: Primary Metrics */}
                <div className="col-span-6 grid grid-cols-2 gap-1">
                    <DataCell label="Lap Time" value="1:24.08" />
                    <DataCell label="Last Lap" value="1:24.45" />
                    <DataCell label="Best Lap" value="1:23.90" unit="" alert={true} />
                    <DataCell label="Delta" value="-0.37" alert={true} />
                    
                    <div className="col-span-2 bg-[#1a1a1a] p-4 flex justify-between items-center border border-gray-700">
                        <div>
                            <div className="text-xs text-gray-500 uppercase">Speed</div>
                            <div className="text-6xl font-bold">{d.speed.toFixed(0)}</div>
                        </div>
                        <div className="text-right">
                             <div className="text-xs text-gray-500 uppercase">GPS Pos</div>
                             <div className="text-sm text-gray-300">{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Pressures & Lambda */}
                <div className="col-span-3 bg-[#111] p-2 flex flex-col gap-4">
                     <HorizontalBar label="Oil Press" value={d.oilPressure} max={8} color="bg-yellow-500" />
                     <HorizontalBar label="Fuel Press" value={d.fuelPressure} max={6} color="bg-green-500" />
                     <HorizontalBar label="Lambda 1" value={d.o2SensorVoltage * 2} max={1.5} color="bg-cyan-400" />
                     <HorizontalBar label="TPS" value={d.engineLoad} max={100} color="bg-white" />
                </div>
            </div>

            {/* Bottom Status */}
            <div className="h-8 bg-[#222] mt-1 flex items-center justify-between px-4 text-xs text-gray-400 uppercase font-bold">
                 <span>Logger Status: <span className="text-green-500">RECORDING</span></span>
                 <span>File: 20240722_SESSION_01.LOG</span>
                 <span>GPS: 3D FIX (12 SAT)</span>
            </div>
        </div>
    );
};

export default ProTunerDashboard;
