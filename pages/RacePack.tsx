
import React, { useState } from 'react';
import { 
    AreaChart, Area, Line, XAxis, YAxis, Tooltip, 
    ResponsiveContainer, CartesianGrid, ComposedChart, 
    ReferenceLine
} from 'recharts';
import { useRaceSession } from '../hooks/useRaceSession';
import { useVehicleData } from '../hooks/useVehicleData';
import GForceMeter from '../components/widgets/GForceMeter';
import RaceCam from '../components/RaceCam';

// --- Helper Components ---

const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    const milliseconds = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${minutes}:${seconds}.${milliseconds}`;
};

const MetricTile: React.FC<{ label: string; value: string; unit?: string; trend?: 'up' | 'down' | 'flat'; color?: string }> = ({ label, value, unit, trend, color = 'text-white' }) => (
    <div className="bg-[#0a0a0a]/80 border border-white/5 rounded p-3 flex flex-col justify-between h-20 relative overflow-hidden group">
        <div className="flex justify-between items-start z-10">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
            {trend && (
                <span className={`text-[8px] ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    {trend === 'up' ? '▲' : '▼'}
                </span>
            )}
        </div>
        <div className="flex items-baseline gap-1 z-10">
            <span className={`text-2xl font-display font-bold ${color}`}>{value}</span>
            {unit && <span className="text-[9px] font-mono text-gray-600">{unit}</span>}
        </div>
        {/* Subtle hover glow */}
        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors"></div>
    </div>
);

const PedalGauge: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="flex flex-col h-full w-8 items-center gap-2">
        <div className="flex-1 w-full bg-[#111] rounded border border-white/10 relative overflow-hidden flex items-end">
            <div 
                className={`w-full transition-all duration-75 ${color} opacity-90 shadow-[0_0_15px_currentColor]`} 
                style={{ height: `${Math.min(100, Math.max(0, value))}%` }}
            ></div>
            {/* Grid lines */}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_19%,rgba(0,0,0,0.5)_20%)] bg-[length:100%_20%] pointer-events-none"></div>
        </div>
        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest -rotate-90 w-20 text-center mb-4">{label}</span>
    </div>
);

// --- Main Component ---

const RacePack: React.FC = () => {
    const { session, startSession, stopSession, recordLap } = useRaceSession();
    const { latestData } = useVehicleData();
    const d = latestData;
    const [viewMode, setViewMode] = useState<'telemetry' | 'camera'>('telemetry');
    
    const isRacing = session.isActive;
    const currentLap = session.lapTimes.length + 1;
    
    // Calculate performance metrics
    const topSpeed = session.quarterMileSpeed ? session.quarterMileSpeed : Math.max(...session.data.map(d => d.speed), 0);
    const lastLap = session.lapTimes.length > 0 ? session.lapTimes[session.lapTimes.length - 1] : null;
    const bestLap = session.lapTimes.length > 0 ? [...session.lapTimes].sort((a,b) => a.time - b.time)[0] : null;

    // Simulated Tire Temps (FL, FR, RL, RR)
    const tireTemps = [
        85 + Math.sin(Date.now() / 2000) * 5, 
        88 + Math.cos(Date.now() / 2500) * 5, 
        92 + Math.sin(Date.now() / 3000) * 5, 
        90 + Math.cos(Date.now() / 3500) * 5
    ];

    const getTempColor = (temp: number) => {
        if (temp < 70) return 'bg-blue-500';
        if (temp > 105) return 'bg-red-500 animate-pulse';
        return 'bg-green-500';
    };

    return (
        <div className="h-full w-full bg-[#050505] flex flex-col font-sans text-gray-200 overflow-hidden relative">
            
            {/* --- HEADER BAR --- */}
            <div className="h-14 bg-[#080808] border-b border-[#1F1F1F] flex items-center justify-between px-6 shrink-0 z-30">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-lg font-display font-black text-white italic tracking-wider leading-none">
                            RACE<span className="text-brand-red">PACK</span>
                        </h1>
                        <span className="text-[8px] text-gray-500 font-mono uppercase tracking-[0.3em]">Telemetry Suite v4.0</span>
                    </div>
                    
                    <div className="h-8 w-px bg-[#222]"></div>
                    
                    <div className="flex items-center gap-3 bg-[#111] px-3 py-1 rounded border border-[#222]">
                        <div className={`w-2 h-2 rounded-full ${isRacing ? 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
                        <span className={`text-[10px] font-bold uppercase ${isRacing ? 'text-green-500' : 'text-gray-500'}`}>
                            {isRacing ? 'SESSION LIVE' : 'PIT LANE'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className="text-[9px] text-gray-500 uppercase font-bold block">Track Temp</span>
                        <span className="text-xs font-mono text-white">32.4°C</span>
                    </div>
                    <div className="text-right border-l border-[#222] pl-4">
                        <span className="text-[9px] text-gray-500 uppercase font-bold block">Air Temp</span>
                        <span className="text-xs font-mono text-white">24.1°C</span>
                    </div>
                    
                    <div className="flex bg-[#111] p-1 rounded-lg border border-[#222] ml-4">
                        <button 
                            onClick={() => setViewMode('telemetry')}
                            className={`px-4 py-1 text-[9px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === 'telemetry' ? 'bg-brand-cyan text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            Telemetry
                        </button>
                        <button 
                            onClick={() => setViewMode('camera')}
                            className={`px-4 py-1 text-[9px] font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 ${viewMode === 'camera' ? 'bg-brand-red text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            RaceCam
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                {viewMode === 'camera' ? (
                    <RaceCam />
                ) : (
                    <div className="absolute inset-0 p-4 grid grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden">
                        
                        {/* --- COLUMN 1: TIMING (3 Spans) --- */}
                        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-[500px]">
                            
                            {/* Current Lap */}
                            <div className="bg-[#0a0a0a] border-l-4 border-brand-cyan rounded-r-xl p-6 relative overflow-hidden shadow-2xl">
                                <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/5 to-transparent pointer-events-none"></div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Current Lap {currentLap}</span>
                                <div className="text-6xl font-display font-black text-white tabular-nums tracking-tighter mt-1" style={{ textShadow: '0 0 30px rgba(0,240,255,0.15)' }}>
                                    {formatTime(session.elapsedTime)}
                                </div>
                                <div className="flex items-center gap-2 mt-4">
                                    {!isRacing ? (
                                        <button onClick={startSession} className="flex-1 bg-green-600 hover:bg-green-500 text-black font-bold py-3 rounded text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(22,163,74,0.4)]">
                                            Start
                                        </button>
                                    ) : (
                                        <button onClick={stopSession} className="flex-1 bg-brand-red hover:bg-red-500 text-white font-bold py-3 rounded text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                                            Pit In
                                        </button>
                                    )}
                                    <button onClick={recordLap} disabled={!isRacing} className="px-6 bg-[#222] border border-white/10 hover:border-white/30 text-white font-bold rounded text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all">
                                        Lap
                                    </button>
                                </div>
                            </div>

                            {/* Sector & Lap List */}
                            <div className="flex-1 bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl flex flex-col overflow-hidden">
                                <div className="p-3 bg-[#111] border-b border-[#1F1F1F] flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timing Log</span>
                                    <span className="text-[9px] font-mono text-brand-purple">BEST: {bestLap ? formatTime(bestLap.time) : '--:--.--'}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[#0e0e0e] text-[9px] font-bold text-gray-500 uppercase sticky top-0">
                                            <tr>
                                                <th className="py-2 pl-4">Lap</th>
                                                <th className="py-2">Time</th>
                                                <th className="py-2">S1</th>
                                                <th className="py-2">S2</th>
                                                <th className="py-2">S3</th>
                                            </tr>
                                        </thead>
                                        <tbody className="font-mono text-xs">
                                            {session.lapTimes.slice().reverse().map((lap, i) => (
                                                <tr key={lap.lap} className="border-b border-[#151515] hover:bg-white/5 transition-colors">
                                                    <td className="py-2 pl-4 text-gray-500 font-bold">{lap.lap}</td>
                                                    <td className={`py-2 font-bold ${lap.time === bestLap?.time ? 'text-brand-purple' : 'text-gray-300'}`}>{formatTime(lap.time)}</td>
                                                    <td className="py-2 text-gray-500">24.5</td>
                                                    <td className="py-2 text-gray-500">31.2</td>
                                                    <td className="py-2 text-gray-500">18.9</td>
                                                </tr>
                                            ))}
                                            {session.lapTimes.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-gray-700 text-[10px] uppercase">Awaiting Data...</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* --- COLUMN 2: TELEMETRY & VISUALIZATION (6 Spans) --- */}
                        <div className="col-span-12 lg:col-span-6 flex flex-col gap-4 min-h-[500px]">
                            
                            {/* Top Viz Cluster */}
                            <div className="h-64 grid grid-cols-2 gap-4">
                                {/* G-Meter Panel */}
                                <div className="bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl p-4 relative flex items-center justify-center">
                                    <div className="absolute top-3 left-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Dynamics</div>
                                    {/* Friction Circle Background */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                        <div className="w-48 h-48 rounded-full border border-dashed border-gray-500"></div>
                                        <div className="w-32 h-32 rounded-full border border-dashed border-gray-600 absolute"></div>
                                    </div>
                                    <GForceMeter x={d.gForceX} y={d.gForceY} size={180} transparent={true} />
                                </div>

                                {/* Track Map Panel */}
                                <div className="bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl p-4 relative flex items-center justify-center">
                                    <div className="absolute top-3 left-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">GPS Track</div>
                                    <svg viewBox="0 0 200 150" className="w-full h-full p-4 stroke-gray-600 fill-none stroke-2">
                                        <path d="M 40 120 L 40 80 C 40 60, 60 40, 80 40 L 140 40 C 160 40, 160 80, 140 80 L 100 80" />
                                        <circle cx="40" cy="120" r="4" className="fill-brand-cyan stroke-none animate-pulse" />
                                    </svg>
                                    <div className="absolute bottom-3 right-3 text-right">
                                        <div className="text-[9px] text-gray-500 uppercase font-bold">GPS Accuracy</div>
                                        <div className="text-xs font-mono text-green-500">±0.5m</div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Chart */}
                            <div className="flex-1 bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl p-2 relative flex flex-col">
                                <div className="absolute top-3 left-4 z-10 flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-brand-cyan rounded-full shadow-[0_0_5px_#00F0FF]"></div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Velocity</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-brand-purple rounded-full shadow-[0_0_5px_#BC13FE]"></div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">RPM</span>
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={session.data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#333', fontSize: '10px', fontFamily: 'monospace' }}
                                                itemStyle={{ padding: 0 }}
                                                labelFormatter={() => ''}
                                            />
                                            <YAxis yAxisId="left" orientation="left" stroke="#333" tick={{fontSize: 9, fill: '#555'}} domain={[0, 300]} width={30} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#333" tick={{fontSize: 9, fill: '#555'}} domain={[0, 9000]} width={30} />
                                            
                                            <Area yAxisId="left" type="monotone" dataKey="speed" stroke="#00F0FF" strokeWidth={2} fill="url(#speedFill)" isAnimationActive={false} />
                                            <Line yAxisId="right" type="monotone" dataKey="rpm" stroke="#BC13FE" strokeWidth={1} dot={false} isAnimationActive={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Inputs Strip */}
                            <div className="h-24 bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl p-4 flex justify-center gap-12">
                                <PedalGauge label="Clutch" value={0} color="bg-blue-500" />
                                <PedalGauge label="Brake" value={d.gForceY < -0.1 ? Math.abs(d.gForceY) * 80 : 0} color="bg-red-500" />
                                <PedalGauge label="Throttle" value={d.engineLoad} color="bg-green-500" />
                            </div>
                        </div>

                        {/* --- COLUMN 3: VEHICLE HEALTH (3 Spans) --- */}
                        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-[500px]">
                            
                            {/* Vital Stats Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                <MetricTile label="Oil Press" value={d.oilPressure.toFixed(1)} unit="BAR" trend="flat" color="text-white" />
                                <MetricTile label="Oil Temp" value={(d.engineTemp + 10).toFixed(0)} unit="°C" trend="up" color="text-yellow-500" />
                                <MetricTile label="Water" value={d.engineTemp.toFixed(0)} unit="°C" trend="flat" color={d.engineTemp > 100 ? 'text-red-500' : 'text-white'} />
                                <MetricTile label="Fuel Press" value={d.fuelPressure.toFixed(1)} unit="BAR" trend="flat" color="text-white" />
                            </div>

                            {/* Tire Monitor */}
                            <div className="flex-1 bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl p-6 relative flex flex-col items-center">
                                <span className="absolute top-4 left-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tire Status</span>
                                
                                {/* Car Silhouette */}
                                <div className="flex-1 w-full max-w-[140px] relative mt-4">
                                    <div className="absolute inset-0 bg-[#111] rounded-3xl opacity-50"></div>
                                    
                                    {/* FL Tire */}
                                    <div className="absolute top-0 left-[-20px] flex flex-col items-end">
                                        <div className={`w-12 h-16 rounded border border-black/50 transition-colors duration-500 ${getTempColor(tireTemps[0])}`}></div>
                                        <span className="text-[10px] font-mono text-gray-400 mt-1">{tireTemps[0].toFixed(0)}°C</span>
                                        <span className="text-[9px] font-bold text-white">2.1b</span>
                                    </div>

                                    {/* FR Tire */}
                                    <div className="absolute top-0 right-[-20px] flex flex-col items-start">
                                        <div className={`w-12 h-16 rounded border border-black/50 transition-colors duration-500 ${getTempColor(tireTemps[1])}`}></div>
                                        <span className="text-[10px] font-mono text-gray-400 mt-1">{tireTemps[1].toFixed(0)}°C</span>
                                        <span className="text-[9px] font-bold text-white">2.1b</span>
                                    </div>

                                    {/* RL Tire */}
                                    <div className="absolute bottom-0 left-[-20px] flex flex-col items-end">
                                        <span className="text-[9px] font-bold text-white mb-1">2.0b</span>
                                        <span className="text-[10px] font-mono text-gray-400 mb-1">{tireTemps[2].toFixed(0)}°C</span>
                                        <div className={`w-12 h-16 rounded border border-black/50 transition-colors duration-500 ${getTempColor(tireTemps[2])}`}></div>
                                    </div>

                                    {/* RR Tire */}
                                    <div className="absolute bottom-0 right-[-20px] flex flex-col items-start">
                                        <span className="text-[9px] font-bold text-white mb-1">2.0b</span>
                                        <span className="text-[10px] font-mono text-gray-400 mb-1">{tireTemps[3].toFixed(0)}°C</span>
                                        <div className={`w-12 h-16 rounded border border-black/50 transition-colors duration-500 ${getTempColor(tireTemps[3])}`}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Stats */}
                            <div className="bg-[#0a0a0a] border border-[#1F1F1F] rounded-xl p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Battery</span>
                                    <span className="text-xs font-mono text-white">{d.batteryVoltage.toFixed(1)} V</span>
                                </div>
                                <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-brand-cyan h-full" style={{width: '90%'}}></div>
                                </div>
                                
                                <div className="flex justify-between items-center mt-4 mb-2">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Fuel Lvl</span>
                                    <span className="text-xs font-mono text-white">{d.fuelLevel.toFixed(0)} %</span>
                                </div>
                                <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-brand-purple h-full" style={{width: `${d.fuelLevel}%`}}></div>
                                </div>
                            </div>

                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default RacePack;
