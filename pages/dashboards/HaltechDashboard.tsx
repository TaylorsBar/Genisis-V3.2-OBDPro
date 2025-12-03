
import React, { useState } from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import HaltechTachometer from '../../components/tachometers/HaltechTachometer';
import { KarapiroLogo } from '../../components/KarapiroLogo';
import LiveTelemetryGraph from '../../components/dashboard/LiveTelemetryGraph';
import DataTile from '../../components/dashboard/DataTile';

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
            <div className="h-12 md:h-14 border-b border-white/10 bg-[#080808]/90 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-20 shadow-lg shrink-0">
                <div className="flex items-center gap-4 md:gap-6">
                    <KarapiroLogo className="h-5 md:h-7 w-auto opacity-90" />
                    <div className="h-4 md:h-6 w-px bg-white/10 hidden sm:block"></div>
                    <div className="flex gap-1 bg-black/50 p-1 rounded-lg border border-white/10">
                        <button 
                            onClick={() => setViewMode('dash')} 
                            className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3 md:px-4 py-1.5 rounded transition-all ${viewMode === 'dash' ? 'bg-[var(--theme-color)] text-black shadow-[0_0_10px_var(--theme-color)]' : 'text-gray-500 hover:text-white'}`}
                        >
                            Dash
                        </button>
                        <button 
                            onClick={() => setViewMode('trace')} 
                            className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3 md:px-4 py-1.5 rounded transition-all ${viewMode === 'trace' ? 'bg-[var(--theme-color)] text-black shadow-[0_0_10px_var(--theme-color)]' : 'text-gray-500 hover:text-white'}`}
                        >
                            Trace
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 md:gap-6 text-[9px] md:text-[10px] font-mono font-bold text-gray-500">
                    <div className="hidden sm:flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ekfStats.gpsActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={ekfStats.gpsActive ? 'text-green-500' : ''}>GPS</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${hasActiveFault ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className={hasActiveFault ? 'text-red-500' : 'text-green-500'}>ECU</span>
                    </div>
                </div>
            </div>

            {/* Main Viewport */}
            <div className="flex-1 relative p-4 md:p-8 flex flex-col z-10 overflow-hidden">
                
                {viewMode === 'dash' && (
                    <div className="flex-1 grid grid-cols-12 gap-4 animate-in fade-in zoom-in-95 duration-300 min-h-0">
                        
                        {/* Left Floating Data */}
                        <div className="col-span-12 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-6 justify-center order-2 md:order-1">
                            <DataTile label="Boost" value={d.turboBoost.toFixed(2)} unit="BAR" color="theme-text" border />
                            <DataTile label="IAT" value={d.inletAirTemp.toFixed(0)} unit="°C" />
                            <DataTile label="Oil P" value={d.oilPressure.toFixed(1)} unit="BAR" warning={d.oilPressure < 1.0} />
                        </div>

                        {/* Center Tach */}
                        <div className="col-span-12 md:col-span-6 flex items-center justify-center order-1 md:order-2 h-[40vh] md:h-full relative">
                            <div className="w-full h-full max-h-[80vw] md:max-h-[60vh] aspect-square drop-shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                                <HaltechTachometer rpm={d.rpm} speed={d.speed} gear={d.gear} />
                            </div>
                        </div>

                        {/* Right Floating Data */}
                        <div className="col-span-12 md:col-span-3 flex flex-row md:flex-col gap-2 md:gap-6 justify-center items-end md:text-right order-3">
                            <DataTile label="Lambda" value={(d.o2SensorVoltage * 2).toFixed(2)} unit="LA" color="text-green-400" />
                            <DataTile label="Coolant" value={d.engineTemp.toFixed(0)} unit="°C" warning={d.engineTemp > 105} />
                            <DataTile label="Battery" value={d.batteryVoltage.toFixed(1)} unit="V" />
                        </div>
                    </div>
                )}

                {viewMode === 'trace' && (
                    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-0">
                        <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg p-1 relative shadow-2xl min-h-0">
                            <div className="absolute top-3 left-4 z-10 bg-black/80 backdrop-blur px-3 py-1 rounded border border-white/10">
                                <span className="text-[10px] font-bold theme-text uppercase tracking-widest">Live Log Buffer [20Hz]</span>
                            </div>
                            <LiveTelemetryGraph data={data} />
                        </div>
                        
                        {/* Stats Footer */}
                        <div className="h-auto md:h-24 mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 shrink-0">
                            <div className="bg-[#111] border border-white/10 rounded p-2 md:p-4 flex flex-col justify-between">
                                <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold">Throttle</span>
                                <div className="w-full bg-gray-800 h-1.5 md:h-2 rounded-full overflow-hidden mt-1 md:mt-2">
                                    <div className="theme-bg h-full transition-all duration-75" style={{width: `${d.engineLoad}%`}}></div>
                                </div>
                                <span className="text-sm md:text-xl font-mono text-white mt-1">{d.engineLoad.toFixed(1)}%</span>
                            </div>
                            <div className="bg-[#111] border border-white/10 rounded p-2 md:p-4 flex flex-col justify-between">
                                <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold">STFT</span>
                                <span className={`text-sm md:text-xl font-mono mt-auto ${Math.abs(d.shortTermFuelTrim) > 5 ? 'text-brand-red' : 'text-green-500'}`}>
                                    {d.shortTermFuelTrim > 0 ? '+' : ''}{d.shortTermFuelTrim.toFixed(1)}%
                                </span>
                            </div>
                             <div className="bg-[#111] border border-white/10 rounded p-2 md:p-4 flex flex-col justify-between">
                                <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold">Ignition</span>
                                <span className="text-sm md:text-xl font-mono text-purple-400 mt-auto">{d.timingAdvance.toFixed(1)}°</span>
                            </div>
                             <div className="bg-[#111] border border-white/10 rounded p-2 md:p-4 flex flex-col justify-between">
                                <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold">Knock</span>
                                <span className="text-sm md:text-xl font-mono text-white mt-auto">0.02V</span>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default HaltechDashboard;
