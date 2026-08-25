
import React, { useEffect, useState } from 'react';
import { motion, useTransform } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import LiveTelemetryGraph from '../../components/dashboard/LiveTelemetryGraph';
import { SystemHealthMonitor } from '../../components/dashboard/SystemHealthMonitor';
import GlassCard from '../../components/ui/GlassCard';
import ThermographicsOverlay from '../../components/dashboard/ThermographicsOverlay';
import InclinometerOverlay from '../../components/dashboard/InclinometerOverlay';
import AeroDynamicsOverlay from '../../components/dashboard/AeroDynamicsOverlay';

const ConnectedChannelRow: React.FC<{ label: string; dataKey: string; unit: string; color?: string; format?: (v: number) => string | number }> = ({ label, dataKey, unit, color = 'text-white', format }) => {
    const valMotion = useAnimatedValue(dataKey, { stiffness: 150, damping: 20 });
    const formattedMotion = useTransform(valMotion, format ? (v => format(v)) : (v => v.toFixed(1)));


    return (
        <div className="flex items-center justify-between py-3 md:py-4 border-b border-white/[0.03] hover:bg-white/5 px-4 md:px-6 transition-colors cursor-default group relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-0 bg-brand-cyan/10 group-hover:w-full transition-all duration-300 ease-out z-0"></div>
            <span className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 relative z-10 w-1/2 truncate pr-2">{label}</span>
            <div className="flex items-baseline gap-2 relative z-10 justify-end flex-1 min-w-0">
                <motion.span className={`font-mono text-lg md:text-xl font-black ${color} tracking-tighter drop-shadow-md truncate`}>{formattedMotion as any}</motion.span>
                <span className="text-[9px] md:text-[10px] text-zinc-600 font-black uppercase tracking-wider shrink-0">{unit}</span>
            </div>
        </div>
    );
};

const ConnectedGForceDot: React.FC = () => {
    const xMotion = useAnimatedValue("gForceX", { stiffness: 300, damping: 20 });
    const yMotion = useAnimatedValue("gForceY", { stiffness: 300, damping: 20 });

    return (
        <motion.div 
            className="absolute w-3 h-3 bg-brand-cyan rounded-full shadow-[0_0_15px_#00f0ff,inset_0_0_5px_#fff]"
            style={{ x: useTransform(xMotion, v => v * 40), y: useTransform(yMotion, v => -v * 40) }}
        />
    );
};

const ProTunerDashboard: React.FC = () => {
    return (
        <div className="w-full h-full bg-[#030303] flex flex-col font-sans overflow-hidden selection:bg-brand-cyan/30 relative">
            
            {/* Background grid texture */}
            <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none"></div>

            {/* Top Toolbar - Elite Enterprise Style */}
            <div className="h-14 bg-[#0a0a0a]/80 backdrop-blur-3xl border-b border-white/[0.08] flex items-center px-8 gap-8 text-[10px] font-display font-medium text-zinc-500 tracking-[0.2em] shadow-glass z-20 shrink-0">
                <div className="flex gap-8">
                    <span className="hover:text-brand-cyan cursor-pointer transition-colors text-white py-4 border-b-2 border-brand-cyan">SYSTEM TRACE</span>
                    <span className="hover:text-white cursor-pointer transition-colors py-4 border-b-2 border-transparent">WORKBENCH</span>
                    <span className="hover:text-white cursor-pointer transition-colors py-4 border-b-2 border-transparent">METRICS</span>
                </div>
                <div className="h-4 w-px bg-white/10 hidden md:block"></div>
                <div className="flex-1 flex items-center gap-4 hidden sm:flex">
                    <span className="text-brand-cyan uppercase">Environment: <span className="text-white">Prod_Engine_VMax</span></span>
                    <span className="text-zinc-800">|</span>
                    <div className="flex items-center gap-2 text-green-500 px-3 py-1 bg-green-500/5 rounded border border-green-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                        <span>SYNC ACTIVE [100Hz]</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-zinc-600 font-mono tracking-wider">NET: 1.2ms</span>
                    <div className="w-24 h-1.5 bg-[#111] rounded-full overflow-hidden border border-white/5 relative">
                        <div className="absolute inset-0 bg-brand-cyan h-full w-[96%] shadow-[0_0_12px_rgba(0,240,255,0.8)]"></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10 w-full min-h-0">
                {/* Channel List - Sidebar */}
                <div className="w-full md:w-80 lg:w-96 bg-[#030303]/90 backdrop-blur-3xl border-r border-white/[0.08] flex flex-col overflow-y-auto no-scrollbar shadow-[30px_0_50px_rgba(0,0,0,0.7)] relative z-10 h-[35vh] md:h-full shrink-0">
                    <div className="pt-6 pb-4 px-5 border-b border-white/5 flex justify-between items-end sticky top-0 bg-[#050505]/95 backdrop-blur-md z-20">
                        <div>
                            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.2em] mb-1">Telemetry</h3>
                            <span className="text-zinc-600 text-[9px] uppercase tracking-widest font-mono">14 Data Channels</span>
                        </div>
                        <div className="w-6 h-6 rounded bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                            <span className="text-brand-cyan text-[10px]">●</span>
                        </div>
                    </div>
                    <div className="flex flex-col py-2">
                        <ConnectedChannelRow label="Engine Speed" dataKey="rpm" unit="RPM" color="text-yellow-400" format={v => v.toFixed(0)} />
                        <ConnectedChannelRow label="Vehicle Speed" dataKey="speed" unit="km/h" color="text-cyan-400" format={v => v.toFixed(0)} />
                        <ConnectedChannelRow label="Throttle Pos" dataKey="engineLoad" unit="%" format={v => v.toFixed(1)} />
                        <ConnectedChannelRow label="Manifold Press" dataKey="turboBoost" unit="bar" color="text-purple-400" format={v => v.toFixed(2)} />
                        <ConnectedChannelRow label="Coolant Temp" dataKey="engineTemp" unit="°C" format={v => v.toFixed(0)} />
                        <ConnectedChannelRow label="Oil Temp" dataKey="engineOilTemp" unit="°C" format={v => v.toFixed(0)} />
                        <ConnectedChannelRow label="Intake Air" dataKey="inletAirTemp" unit="°C" format={v => v.toFixed(0)} />
                        <ConnectedChannelRow label="Oil Pressure" dataKey="oilPressure" unit="bar" format={v => v.toFixed(1)} />
                        <ConnectedChannelRow label="Lambda 1" dataKey="o2SensorVoltage" unit="LA" color="text-green-400" format={v => v.toFixed(2)} />
                        <ConnectedChannelRow label="VVEL Pos" dataKey="vvelPosition" unit="%" color="text-cyan-400" format={v => v.toFixed(1)} />
                        <ConnectedChannelRow label="Battery" dataKey="batteryVoltage" unit="V" format={v => v.toFixed(1)} />
                        <ConnectedChannelRow label="Current Gear" dataKey="gear" unit="" color="text-cyan-400" format={v => v === 0 ? 'N' : v.toString()} />
                        <ConnectedChannelRow label="Long Accel" dataKey="gForceY" unit="G" format={v => v.toFixed(2)} />
                        <ConnectedChannelRow label="Lat Accel" dataKey="gForceX" unit="G" format={v => v.toFixed(2)} />
                    </div>
                </div>

                {/* Main Workspace - Data Visualizer */}
                <div className="flex-1 flex flex-col p-2 md:p-4 gap-2 md:gap-4 overflow-y-auto custom-scrollbar bg-[#020202]">
                    
                    {/* Top Chart Area - High Performance Trace */}
                    <GlassCard variant="cyber" className="min-h-[350px] md:flex-[5] flex flex-col pt-1" glowColor="rgba(0, 240, 255, 0.05)">
                        <div className="flex justify-between items-center px-6 py-4 z-20 border-b border-white/5 bg-black/40">
                             <div className="flex items-center gap-3">
                                 <div className="w-1.5 h-6 bg-brand-cyan rounded-full"></div>
                                 <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Real-Time Oscillotrace</h2>
                             </div>
                             <div className="flex gap-2">
                                 <button className="px-3 py-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-colors">Export</button>
                                 <button className="px-3 py-1 bg-brand-cyan/10 border border-brand-cyan/20 hover:bg-brand-cyan/20 rounded text-[9px] font-black uppercase text-brand-cyan transition-colors">Analyze</button>
                             </div>
                        </div>
                        <div className="flex-1 relative border-t border-white/5 mt-1 bg-[#050505]">
                           <LiveTelemetryGraph height="100%" />
                        </div>
                    </GlassCard>

                    {/* Bottom Panels - Diagnostic Grid */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 min-h-[400px] md:min-h-[250px] md:flex-[3]">
                        
                        <GlassCard variant="tech" className="p-6 flex flex-col" glowColor="rgba(255, 255, 255, 0.05)">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Spatial Dynamics</span>
                                <span className="text-[8px] text-emerald-500/70 font-mono tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/5">CALIBRATED</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center border border-white/5 rounded-xl bg-[#080808] relative overflow-hidden shadow-inner">
                                {/* G-Force Grid Target */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">
                                    <div className="rounded-full border border-white w-[150px] h-[150px] absolute"></div>
                                    <div className="rounded-full border border-white w-[100px] h-[100px] absolute"></div>
                                    <div className="rounded-full border border-white w-[50px] h-[50px] absolute"></div>
                                    <div className="w-px h-full bg-white absolute"></div>
                                    <div className="h-px w-full bg-white absolute"></div>
                                </div>
                                <ConnectedGForceDot />
                            </div>
                        </GlassCard>

                        <GlassCard variant="tech" className="p-6 flex flex-col" glowColor="rgba(34, 197, 94, 0.05)">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Performance Metrics</span>
                                <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center items-center py-4 relative">
                                <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest block mb-2 font-mono">Current Sector</span>
                                <span className="text-5xl lg:text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 italic tracking-tighter drop-shadow-2xl">1:24.05</span>
                                <div className="flex items-center gap-2 mt-4 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                    <span className="text-[13px] font-black text-emerald-400 font-mono">-0.128s</span>
                                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest ml-1">SPLIT</span>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard variant="tech" className="p-6 flex flex-col sm:col-span-2 lg:col-span-1" glowColor="rgba(239, 68, 68, 0.05)">
                             <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                 <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block">System Diagnostics</span>
                                 <div className="flex gap-1">
                                    <div className="w-1 h-3 rounded-full bg-zinc-800"></div>
                                    <div className="w-1 h-3 rounded-full bg-zinc-800"></div>
                                    <div className="w-1 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                                 </div>
                             </div>
                             <SystemHealthMonitor />
                             <button
                                onClick={() => useVehicleStore.getState().scanVehicle()}
                                className="mt-4 w-full py-2 bg-brand-cyan/10 border border-brand-cyan/20 hover:bg-brand-cyan/20 text-brand-cyan rounded text-[10px] font-black uppercase tracking-widest transition-colors"
                            >
                                Trigger ECU Scan
                            </button>
                        </GlassCard>

                        <GlassCard variant="tech" className="p-6 flex flex-col" glowColor="rgba(255, 165, 0, 0.05)">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                 <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block">Heat Signature</span>
                                 <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316] animate-pulse"></div>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <ThermographicsOverlay />
                            </div>
                        </GlassCard>

                        <GlassCard variant="tech" className="p-6 flex flex-col" glowColor="rgba(0, 255, 255, 0.05)">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                 <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block">Inertial Frame</span>
                                 <div className="w-2 h-2 rounded-full bg-brand-cyan shadow-[0_0_8px_#00F0FF] animate-pulse"></div>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <InclinometerOverlay />
                            </div>
                        </GlassCard>

                        <GlassCard variant="tech" className="p-6 flex flex-col" glowColor="rgba(255, 0, 255, 0.05)">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                 <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block">Active Aero</span>
                                 <div className="w-2 h-2 rounded-full bg-[#ff00ff] shadow-[0_0_8px_#ff00ff] animate-pulse"></div>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <AeroDynamicsOverlay />
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProTunerDashboard;

