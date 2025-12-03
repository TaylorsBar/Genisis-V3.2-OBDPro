
import React from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import { SensorDataPoint } from '../../types';

const RallyDataBlock: React.FC<{ label: string; value: string | number; unit?: string; alert?: boolean }> = ({ label, value, unit, alert }) => (
    <div className={`relative p-2 md:p-3 border-2 ${alert ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-[#1a1a1a] border-[var(--theme-color)] text-[var(--theme-color)]'} md:skew-x-[-10deg] shadow-lg min-h-[4rem] md:h-24 flex flex-col justify-center`}>
        <div className="md:skew-x-[10deg]">
            <div className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${alert ? 'text-white' : 'text-gray-400'}`}>{label}</div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-4xl font-black font-mono tracking-tighter leading-none">{value}</span>
                {unit && <span className="text-[10px] md:text-xs font-bold">{unit}</span>}
            </div>
        </div>
    </div>
);

const DigitalTapeRpm: React.FC<{ rpm: number; max: number }> = ({ rpm, max }) => {
    const pct = Math.min(100, Math.max(0, (rpm / max) * 100));
    const isRedline = pct > 85;
    
    return (
        <div className="w-full h-16 md:h-24 bg-black border-b-4 border-[var(--theme-color)] relative overflow-hidden flex items-end px-1 gap-0.5 md:gap-1">
            {/* Grid Lines */}
            <div className="absolute inset-0 z-0 opacity-20" style={{backgroundImage: 'linear-gradient(90deg, transparent 95%, #555 95%)', backgroundSize: '5% 100%'}}></div>
            
            {/* Bar Segments */}
            {Array.from({length: 50}).map((_, i) => {
                const barPct = (i / 50) * 100;
                const active = pct >= barPct;
                let color = 'bg-[var(--theme-color)]';
                if (barPct > 70) color = 'bg-yellow-400';
                if (barPct > 85) color = 'bg-red-600';
                if (active && barPct > 85) color = 'bg-red-500 animate-pulse';

                return (
                    <div 
                        key={i} 
                        className={`flex-1 transition-all duration-75 ${active ? color : 'bg-[#222]'} ${active ? 'h-full' : 'h-[10%]'} rounded-t-sm`}
                        style={{ opacity: active ? 1 : 0.3 }}
                    />
                )
            })}
            
            {/* Big Number Overlay */}
            <div className="absolute top-1 md:top-2 right-2 md:right-4 text-4xl md:text-6xl font-black text-white font-mono z-10 drop-shadow-[0_4px_0_rgba(0,0,0,1)] italic">
                {rpm.toFixed(0)}
            </div>
            <div className="absolute top-2 md:top-4 left-2 md:left-4 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-[0.5em]">Engine Speed</div>
        </div>
    );
};

const RallyThemeDashboard: React.FC = () => {
    const { latestData } = useVehicleData();
    const d: SensorDataPoint = latestData;

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0a] text-white overflow-hidden relative font-mono selection:bg-yellow-500">
            
            {/* CSS Var Override for Rally Default */}
            <style>{`
                :root { --theme-color: #FCEE0A; } 
            `}</style>

            {/* Dirt Texture Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
            }}></div>

            {/* Top RPM Bar */}
            <div className="w-full z-10 shrink-0">
                <DigitalTapeRpm rpm={d.rpm} max={8000} />
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 z-10 min-h-0 overflow-y-auto md:overflow-hidden">
                
                {/* Left Telemetry */}
                <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-4 order-2 md:order-1">
                    <div className="flex-1"><RallyDataBlock label="Boost" value={d.turboBoost.toFixed(2)} unit="BAR" /></div>
                    <div className="flex-1"><RallyDataBlock label="Oil P" value={d.oilPressure.toFixed(1)} unit="BAR" alert={d.oilPressure < 1.0} /></div>
                    <div className="flex-1"><RallyDataBlock label="Coolant" value={d.engineTemp.toFixed(0)} unit="°C" alert={d.engineTemp > 105} /></div>
                </div>

                {/* Center Gear & Speed */}
                <div className="col-span-1 md:col-span-6 flex flex-col items-center justify-center relative order-1 md:order-2 h-[40vh] md:h-full py-4 md:py-0">
                    <div className="w-full max-w-[60vw] md:max-w-md aspect-square bg-black border-4 border-[var(--theme-color)] rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(252,238,10,0.2)] relative">
                        <span className="text-[25vw] md:text-[14rem] font-black text-white leading-none italic mt-[-10%]" style={{ textShadow: '10px 10px 0px #333' }}>{d.gear === 0 ? 'N' : d.gear}</span>
                        <span className="absolute bottom-[15%] md:bottom-16 text-sm md:text-xl font-bold text-gray-500 bg-black px-4 uppercase tracking-[0.5em]">Gear</span>
                    </div>
                    
                    <div className="absolute bottom-4 md:bottom-0 bg-[var(--theme-color)] text-black px-8 md:px-12 py-1 md:py-2 transform md:skew-x-[-15deg] shadow-xl border-4 border-white rounded md:rounded-none">
                        <span className="text-5xl md:text-7xl font-black block transform md:skew-x-[15deg] tracking-tighter">
                            {d.speed.toFixed(0)}
                        </span>
                    </div>
                </div>

                {/* Right Telemetry */}
                <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-4 order-3">
                    <div className="flex-1"><RallyDataBlock label="Lambda" value={(d.o2SensorVoltage * 2 + 9).toFixed(1)} unit="" /></div>
                    <div className="flex-1"><RallyDataBlock label="Intake" value={d.inletAirTemp.toFixed(0)} unit="°C" /></div>
                    <div className="flex-1"><RallyDataBlock label="Volts" value={d.batteryVoltage.toFixed(1)} unit="V" /></div>
                </div>
            </div>

            {/* Bottom Status Strip */}
            <div className="h-8 md:h-10 bg-[#111] border-t-4 border-[var(--theme-color)] flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
                 <div className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">Stage Mode: <span className="text-[var(--theme-color)] animate-pulse">ACTIVE</span></div>
                 <div className="flex gap-2">
                     <span className={`px-2 md:px-3 py-0.5 md:py-1 text-[8px] md:text-[10px] font-bold uppercase md:skew-x-[-10deg] ${d.engineTemp > 100 ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-black'}`}>ENGINE OK</span>
                     <span className="hidden md:block px-3 py-1 bg-green-600 text-black text-[10px] font-bold uppercase skew-x-[-10deg]">ABS ON</span>
                     <span className="hidden md:block px-3 py-1 bg-[var(--theme-color)] text-black text-[10px] font-bold uppercase skew-x-[-10deg]">DIFF LOCK</span>
                 </div>
            </div>
        </div>
    );
};

export default RallyThemeDashboard;
