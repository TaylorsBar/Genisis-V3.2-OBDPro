
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

const StatMetric: React.FC<{ label: string; value: string; unit?: string; accent?: 'cyan' | 'yellow' | 'red' }> = ({ label, value, unit, accent = 'cyan' }) => {
    const colorClass = {
        cyan: 'text-brand-cyan',
        yellow: 'text-brand-yellow',
        red: 'text-brand-red'
    }[accent];

    return (
        <div className="bg-[#111] border border-white/5 p-3 rounded-lg flex flex-col relative overflow-hidden group hover:border-white/20 transition-all">
            <div className={`absolute top-0 right-0 w-16 h-16 bg-${accent}-500/5 rounded-full blur-xl -translate-y-8 translate-x-8`}></div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest z-10">{label}</span>
            <div className="flex items-baseline gap-1 mt-1 z-10">
                <span className={`text-2xl font-display font-black ${colorClass}`}>{value}</span>
                {unit && <span className="text-[10px] font-mono text-gray-600 font-bold">{unit}</span>}
            </div>
        </div>
    );
};

const PedalBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="flex flex-col items-center h-full gap-2">
        <div className="flex-1 w-8 bg-[#1a1a1a] rounded-full border border-gray-800 relative overflow-hidden flex items-end p-1">
            <div 
                className={`w-full rounded-full transition-all duration-75 ${color} opacity-80 shadow-[0_0_10px_currentColor]`} 
                style={{ height: `${Math.min(100, Math.max(0, value))}%` }}
            ></div>
        </div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
    </div>
);

// --- Main Component ---

const RacePack: React.FC = () => {
    const { session, startSession, stopSession, recordLap } = useRaceSession();
    const { latestData } = useVehicleData();
    const [viewMode, setViewMode] = useState<'data' | 'camera'>('data');
    
    // Derived values for UI
    const isRacing = session.isActive;
    const currentLap = session.lapTimes.length + 1;
    
    // Performance Metrics (Mock vs Real Logic)
    const topSpeed = session.quarterMileSpeed ? session.quarterMileSpeed : Math.max(...session.data.map(d => d.speed), 0);
    const zeroToHundred = session.zeroToHundredTime ? session.zeroToHundredTime.toFixed(2) : '--.--';
    const quarterMile = session.quarterMileTime ? session.quarterMileTime.toFixed(2) : '--.--';

    return (
        <div className="h-full w-full bg-[#050505] flex flex-col font-sans text-gray-200 overflow-hidden relative selection:bg-brand-cyan selection:text-black">
            
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px'
            }}></div>

            {/* --- HEADER --- */}
            <div className="h-16 border-b border-white/10 bg-[#080808]/90 backdrop-blur-md flex items-center justify-between px-6 z-30 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-display font-black text-white italic tracking-wider">RACE<span className="text-brand-red">PACK</span></h1>
                        <span className="text-[9px] text-gray-500 font-mono uppercase tracking-[0.2em]">Telemetry & Data Acquisition</span>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${isRacing ? 'bg-green-500/10 border-green-500 text-green-500 animate-pulse' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                            {isRacing ? 'SESSION ACTIVE' : 'PIT LANE'}
                        </span>
                        <span className="text-xs font-mono text-gray-400">ID: <span className="text-white">TRK-2024-X1</span></span>
                    </div>
                </div>

                <div className="flex bg-[#111] p-1 rounded-lg border border-white/10">
                    <button 
                        onClick={() => setViewMode('data')}
                        className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${viewMode === 'data' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        Data
                    </button>
                    <button 
                        onClick={() => setViewMode('camera')}
                        className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${viewMode === 'camera' ? 'bg-brand-red text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        <span>RaceCam</span>
                        {viewMode === 'camera' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 relative overflow-hidden">
                {viewMode === 'camera' ? (
                    <RaceCam />
                ) : (
                    <div className="absolute inset-0 p-4 grid grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden">
                        
                        {/* LEFT COLUMN: TIMING & CONTROL (3 Cols) */}
                        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-[400px]">
                            {/* Lap Timer Card */}
                            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-cyan via-brand-purple to-brand-red"></div>
                                <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest mb-2">Current Lap {currentLap}</span>
                                <div className="text-5xl lg:text-6xl font-display font-black text-white tabular-nums tracking-tighter" style={{ textShadow: '0 0 30px rgba(255,255,255,0.1)' }}>
                                    {formatTime(session.elapsedTime)}
                                </div>
                                <div className="mt-4 flex gap-2 w-full">
                                    {!isRacing ? (
                                        <button onClick={startSession} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(22,163,74,0.3)]">
                                            Start Session
                                        </button>
                                    ) : (
                                        <button onClick={stopSession} className="flex-1 bg-brand-red hover:bg-red-500 text-white font-bold py-3 rounded text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                                            Stop
                                        </button>
                                    )}
                                    <button onClick={recordLap} disabled={!isRacing} className="px-6 bg-[#222] hover:bg-[#333] border border-white/10 text-white font-bold rounded text-xs uppercase tracking-widest disabled:opacity-50 transition-all">
                                        Lap
                                    </button>
                                </div>
                            </div>

                            {/* Lap History List */}
                            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                                <div className="p-3 bg-[#111] border-b border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lap History</span>
                                    <span className="text-[9px] font-mono text-gray-600">{session.lapTimes.length} LAPS REC</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {session.lapTimes.map((lap, i) => {
                                        const isFastest = i === 0; // Simple mock logic for now
                                        return (
                                            <div key={i} className={`flex justify-between items-center p-2 rounded ${isFastest ? 'bg-brand-purple/10 border border-brand-purple/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-mono text-gray-500 w-6">L{lap.lap}</span>
                                                    <span className={`text-sm font-mono font-bold ${isFastest ? 'text-brand-purple' : 'text-gray-300'}`}>{formatTime(lap.time)}</span>
                                                </div>
                                                {isFastest && <span className="text-[8px] font-bold text-brand-purple bg-brand-purple/20 px-1.5 rounded">PB</span>}
                                            </div>
                                        )
                                    })}
                                    {session.lapTimes.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50">
                                            <span className="text-xs font-mono">NO DATA</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CENTER COLUMN: TELEMETRY (6 Cols) */}
                        <div className="col-span-12 lg:col-span-6 flex flex-col gap-4 min-h-[400px]">
                            {/* Performance Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <StatMetric label="0-100 KPH" value={zeroToHundred} unit="SEC" accent="yellow" />
                                <StatMetric label="1/4 Mile" value={quarterMile} unit="SEC" accent="cyan" />
                                <StatMetric label="Top Speed" value={topSpeed.toFixed(0)} unit="KPH" accent="red" />
                            </div>

                            {/* Main Graph Container */}
                            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl p-1 relative flex flex-col min-h-[300px]">
                                <div className="absolute top-4 left-4 z-10 flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-brand-cyan rounded-full"></div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Speed</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-brand-purple rounded-full"></div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">RPM</span>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={session.data} margin={{ top: 40, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="#222" strokeDasharray="3 3" vertical={false} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#333', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}
                                            itemStyle={{ padding: 0 }}
                                            labelFormatter={() => ''}
                                        />
                                        <XAxis dataKey="time" hide />
                                        <YAxis yAxisId="left" orientation="left" stroke="#444" tick={{fontSize: 10, fill: '#666'}} domain={[0, 'auto']} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#444" tick={{fontSize: 10, fill: '#666'}} domain={[0, 9000]} />
                                        
                                        <Area yAxisId="left" type="monotone" dataKey="speed" stroke="#00F0FF" strokeWidth={2} fill="url(#speedGradient)" isAnimationActive={false} />
                                        <Line yAxisId="right" type="monotone" dataKey="rpm" stroke="#BC13FE" strokeWidth={1} dot={false} isAnimationActive={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: DYNAMICS (3 Cols) */}
                        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-[400px]">
                            {/* Dynamics Card */}
                            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl p-6 flex flex-col items-center justify-between">
                                <div className="w-full flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dynamics Circle</span>
                                    <span className="text-[10px] font-mono text-brand-yellow">{latestData.gForceX.toFixed(2)}G</span>
                                </div>
                                
                                <div className="flex-1 flex items-center justify-center relative w-full">
                                    {/* Custom G-Meter integration */}
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-brand-yellow/5 rounded-full blur-2xl"></div>
                                        <GForceMeter x={latestData.gForceX} y={latestData.gForceY} size={220} transparent={true} />
                                    </div>
                                </div>
                            </div>

                            {/* Inputs Card */}
                            <div className="h-48 bg-[#0a0a0a] border border-white/10 rounded-xl p-6 flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Driver Inputs</span>
                                <div className="flex-1 flex justify-center gap-12 items-end pb-2">
                                    <PedalBar label="Brake" value={latestData.gForceY < 0 ? Math.abs(latestData.gForceY) * 100 : 0} color="bg-red-500" />
                                    <PedalBar label="Throttle" value={latestData.engineLoad} color="bg-green-500" />
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
