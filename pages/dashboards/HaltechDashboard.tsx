
import React, { useState } from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import HaltechTachometer from '../../components/tachometers/HaltechTachometer';
import { KarapiroLogo } from '../../components/KarapiroLogo';
import LiveTelemetryGraph from '../../components/dashboard/LiveTelemetryGraph';

const DataTile = ({ label, value, unit, color = "text-white", border = false, warning = false }: { label: string, value: string, unit: string, color?: string, border?: boolean, warning?: boolean }) => (
    <div className={`flex flex-col justify-center p-4 bg-surface-panel backdrop-blur-sm border border-white/5 ${border ? 'border-l-4 !border-l-[var(--theme-color)]' : ''} ${warning ? 'bg-red-900/20 border-red-500 animate-pulse' : ''} rounded-md min-w-[120px] shadow-md`}>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-mono font-bold ${warning ? 'text-red-500' : color} tracking-tight`}>{value}</span>
            <span className="text-[10px] text-gray-600 font-bold">{unit}</span>
        </div>
    </div>
);

const HaltechDashboard: React.FC = () => {
    const { latestData, data, ekfStats, hasActiveFault } = useVehicleData();
    const d = latestData;
    const [viewMode, setViewMode] = useState<'dash' | 'trace'>('dash');

    return (
        <div className="w-full h-full bg-[#050505] flex flex-col overflow-hidden relative selection:bg-[var(--theme-color)]">
            
            {/* Global Styles for Dynamic Colors */}
            <style>{`
                .theme-text { color: var(--theme-color); }
                .theme-bg { background-color: var(--theme-color); }
                .theme-border { border-color: var(--theme-color); }
                .theme-shadow { box-shadow: var(--theme-glow); }
            `}</style>

            {/* Background Hex Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle at 50% 50%, var(--theme-dim) 0%, transparent 60%), 
                                  url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 0l12 6v12l-12 6L0 18V6z' fill='none' stroke='%23333' stroke-width='1' opacity='0.4'/%3E%3C/svg%3E")`
            }}></div>

            {/* Header Status Bar */}
            <div className="h-14 border-b border-white/10 bg-[#080808]/90 backdrop-blur-md flex items-center justify-between px-8 z-20 shadow-lg">
                <div className="flex items-center gap-6">
                    <KarapiroLogo className="h-7 w-auto opacity-90" />
                    <div className="h-6 w-px bg-white/10"></div>
                    <div className="flex gap-1 bg-black/50 p-1 rounded-lg border border-white/10">
                        <button 
                            onClick={() => setViewMode('dash')} 
                            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded transition-all ${viewMode === 'dash' ? 'bg-[var(--theme-color)] text-black shadow-[0_0_10px_var(--theme-color)]' : 'text-gray-500 hover:text-white'}`}
                        >
                            Cockpit
                        </button>
                        <button 
                            onClick={() => setViewMode('trace')} 
                            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded transition-all ${viewMode === 'trace' ? 'bg-[var(--theme-color)] text-black shadow-[0_0_10px_var(--theme-color)]' : 'text-gray-500 hover:text-white'}`}
                        >
                            Telemetry
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-6 text-[10px] font-mono font-bold text-gray-500">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ekfStats.gpsActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={ekfStats.gpsActive ? 'text-green-500' : ''}>GPS {ekfStats.gpsActive ? 'LOCKED' : 'SEARCH'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${hasActiveFault ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className={hasActiveFault ? 'text-red-500' : 'text-green-500'}>ECU {hasActiveFault ? 'ERR' : 'OK'}</span>
                    </div>
                    <span className="theme-text border border-[var(--theme-color)] px-2 py-0.5 rounded bg-[var(--theme-color)]/10">
                        VIS {Math.round(ekfStats.visionConfidence * 100)}%
                    </span>
                </div>
            </div>

            {/* Main Viewport */}
            <div className="flex-1 relative p-8 flex flex-col z-10">
                
                {viewMode === 'dash' && (
                    <div className="flex-1 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
                        
                        {/* Left Floating Data */}
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-6">
                            <DataTile label="Boost Pressure" value={d.turboBoost.toFixed(2)} unit="BAR" color="theme-text" border />
                            <DataTile label="Intake Temp" value={d.inletAirTemp.toFixed(0)} unit="°C" />
                            <DataTile label="Oil Pressure" value={d.oilPressure.toFixed(1)} unit="BAR" warning={d.oilPressure < 1.0} />
                        </div>

                        {/* Center Tach */}
                        <div className="transform scale-125 drop-shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                            <HaltechTachometer rpm={d.rpm} speed={d.speed} gear={d.gear} />
                        </div>

                        {/* Right Floating Data */}
                        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-6 items-end text-right">
                            <div className="flex flex-col justify-center p-4 bg-surface-panel backdrop-blur-sm border border-white/5 border-r-4 !border-r-green-500 rounded-md min-w-[120px] items-end shadow-md">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Lambda</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-mono font-bold text-green-400 tracking-tight">{(d.o2SensorVoltage * 2).toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-600 font-bold">LA</span>
                                </div>
                            </div>
                            
                            <div className={`flex flex-col justify-center p-4 bg-surface-panel backdrop-blur-sm border border-white/5 rounded-md min-w-[120px] items-end shadow-md ${d.engineTemp > 105 ? 'bg-red-900/20 border-red-500 animate-pulse' : ''}`}>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Coolant</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-3xl font-mono font-bold tracking-tight ${d.engineTemp > 100 ? 'text-red-500' : 'text-white'}`}>{d.engineTemp.toFixed(0)}</span>
                                    <span className="text-[10px] text-gray-600 font-bold">°C</span>
                                </div>
                            </div>

                            <div className="flex flex-col justify-center p-4 bg-surface-panel backdrop-blur-sm border border-white/5 rounded-md min-w-[120px] items-end shadow-md">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Battery</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-mono font-bold text-white tracking-tight">{d.batteryVoltage.toFixed(1)}</span>
                                    <span className="text-[10px] text-gray-600 font-bold">V</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'trace' && (
                    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg p-1 relative shadow-2xl">
                            <div className="absolute top-3 left-4 z-10 bg-black/80 backdrop-blur px-3 py-1 rounded border border-white/10">
                                <span className="text-[10px] font-bold theme-text uppercase tracking-widest">Live Log Buffer [20Hz]</span>
                            </div>
                            <LiveTelemetryGraph data={data} />
                        </div>
                        
                        {/* Stats Footer */}
                        <div className="h-24 mt-4 grid grid-cols-4 gap-4">
                            <div className="bg-[#111] border border-white/10 rounded p-4 flex flex-col justify-between">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Throttle Position</span>
                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
                                    <div className="theme-bg h-full transition-all duration-75" style={{width: `${d.engineLoad}%`}}></div>
                                </div>
                                <span className="text-xl font-mono text-white mt-1">{d.engineLoad.toFixed(1)}%</span>
                            </div>
                            <div className="bg-[#111] border border-white/10 rounded p-4 flex flex-col justify-between">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Short Term Trim</span>
                                <span className={`text-xl font-mono mt-auto ${Math.abs(d.shortTermFuelTrim) > 5 ? 'text-brand-red' : 'text-green-500'}`}>
                                    {d.shortTermFuelTrim > 0 ? '+' : ''}{d.shortTermFuelTrim.toFixed(1)}%
                                </span>
                            </div>
                             <div className="bg-[#111] border border-white/10 rounded p-4 flex flex-col justify-between">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Ignition Angle</span>
                                <span className="text-xl font-mono text-purple-400 mt-auto">{d.timingAdvance.toFixed(1)}°</span>
                            </div>
                             <div className="bg-[#111] border border-white/10 rounded p-4 flex flex-col justify-between">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Knock Sensor</span>
                                <span className="text-xl font-mono text-white mt-auto">0.02V</span>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default HaltechDashboard;
