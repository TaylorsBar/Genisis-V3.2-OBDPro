
import React from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Area, Legend } from 'recharts';
import { DynoRun, DynoPoint } from '../../types';

interface DynoGraphProps {
    runs: DynoRun[];
    currentRunData?: DynoPoint[];
    isRunning: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#050505]/95 border border-white/10 backdrop-blur-xl p-4 rounded-lg shadow-xl font-mono text-xs z-50">
                <div className="font-bold text-gray-400 mb-2 border-b border-white/10 pb-1">
                    {Number(label).toFixed(0)} RPM
                </div>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between gap-4">
                        <span style={{ color: p.color }}>{p.name}:</span>
                        <span className="text-white font-bold">{Number(p.value).toFixed(2)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const DynoGraph: React.FC<DynoGraphProps> = ({ runs, currentRunData, isRunning }) => {
    // We need a unified X-axis. Let's create buckets from 2000 to 8000
    const allDataPoints: any[] = [];
    
    // Sort runs to find overall peak
    const activeRuns = runs.filter(r => r.isVisible);
    const overallPeak = Math.max(...activeRuns.map(r => r.peakPower), isRunning && currentRunData && currentRunData.length ? Math.max(...currentRunData.map(d => d.power)) : 0);

    for(let rpm = 2000; rpm <= 8500; rpm += 100) {
        const point: any = { rpm };
        
        activeRuns.forEach(run => {
            const match = run.data.find(d => Math.abs(d.rpm - rpm) < 60); 
            if (match) {
                point[`${run.id}_p`] = match.power;
                point[`${run.id}_t`] = match.torque;
                point[`${run.id}_afr`] = match.afr;
                point[`${run.id}_boost`] = match.boost;
            }
        });

        if (isRunning && currentRunData) {
            const match = currentRunData.find(d => Math.abs(d.rpm - rpm) < 60);
            if (match) {
                point['live_p'] = match.power;
                point['live_t'] = match.torque;
                point['live_afr'] = match.afr;
                point['live_boost'] = match.boost;
            }
        }
        allDataPoints.push(point);
    }

    return (
        <div className="w-full h-full bg-[#050505] rounded-xl border border-white/5 flex flex-col overflow-hidden">
            {/* Industry Grade Stats Header */}
            <div className="grid grid-cols-4 gap-px bg-white/5 border-b border-white/5">
                {activeRuns.slice(0, 3).map((run, i) => {
                    const prevRun = i > 0 ? activeRuns[i - 1] : null;
                    const hpDelta = prevRun ? run.peakPower - prevRun.peakPower : null;
                    const tqDelta = prevRun ? run.peakTorque - prevRun.peakTorque : null;
                    
                    return (
                        <div key={run.id} className="bg-[#0A0A0A] p-3 border-r border-white/5">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: run.color }} />
                                <span className="text-[9px] text-white/40 uppercase tracking-tighter">{run.name}</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold font-mono tracking-tighter" style={{ color: run.color }}>{run.peakPower.toFixed(1)}</span>
                                <span className="text-[10px] text-white/20 uppercase font-mono">WHP</span>
                                {hpDelta !== null && (
                                    <span className={`text-[10px] font-bold ${hpDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {hpDelta >= 0 ? '+' : ''}{hpDelta.toFixed(1)}
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-white/40 font-mono italic">
                                TQ: {run.peakTorque.toFixed(1)} Nm 
                                {tqDelta !== null && (
                                    <span className={`ml-1 ${tqDelta >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                                        ({tqDelta >= 0 ? '+' : ''}{tqDelta.toFixed(1)})
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
                {isRunning && (
                    <div className="bg-[#0A0A0A] p-3 animate-pulse">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                            <span className="text-[9px] text-[#00F0FF] uppercase tracking-tighter">LIVE PULL</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold font-mono tracking-tighter text-[#00F0FF]">
                                {(currentRunData && currentRunData.length > 0 ? Math.max(...currentRunData.map(d => d.power)) : 0).toFixed(1)}
                            </span>
                            <span className="text-[10px] text-white/20 uppercase font-mono">WHP</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-[300px] p-4">
                 <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={allDataPoints} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                        <linearGradient id="livePower" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis 
                        dataKey="rpm" 
                        stroke="#444" 
                        tick={{fill: '#666', fontSize: 10}} 
                        type="number" 
                        domain={[2000, 8500]} 
                        tickCount={7} 
                    />
                    
                    {/* Primary Axis: HP */}
                    <YAxis yAxisId="p" stroke="#00F0FF" tick={{fill: '#00F0FF', fontSize: 10}} domain={[0, 'auto']} width={40} label={{ value: 'HP', angle: -90, position: 'insideLeft', fill:'#00F0FF', fontSize: 10 }} />
                    
                    {/* Secondary Axis: Torque */}
                    <YAxis yAxisId="t" orientation="right" stroke="#FF003C" tick={{fill: '#FF003C', fontSize: 10}} domain={[0, 'auto']} width={40} label={{ value: 'TQ', angle: 90, position: 'insideRight', fill:'#FF003C', fontSize: 10 }} />
                    
                    {/* Tertiary Axis: AFR (Hidden axis, just for line scaling) */}
                    <YAxis yAxisId="afr" orientation="right" domain={[8, 18]} hide />

                    {/* Quaternary Axis: Boost (Hidden axis, just for line scaling) */}
                    <YAxis yAxisId="boost" orientation="right" domain={[0, 3.5]} hide />

                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                    <Legend wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />

                    {runs.filter(r => r.isVisible).map(run => (
                        <React.Fragment key={run.id}>
                            <Line connectNulls yAxisId="p" type="monotone" dataKey={`${run.id}_p`} stroke={run.color} strokeWidth={2} dot={false} isAnimationActive={false} name={`Power #${run.id.slice(-2)}`} />
                            <Line connectNulls yAxisId="t" type="monotone" dataKey={`${run.id}_t`} stroke={run.color} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} name={`Torque #${run.id.slice(-2)}`} opacity={0.6} />
                            <Line connectNulls yAxisId="boost" type="monotone" dataKey={`${run.id}_boost`} stroke="#EAB308" strokeWidth={1} strokeDasharray="2 4" dot={false} isAnimationActive={false} opacity={0.4} name="Boost" />
                            <Line connectNulls yAxisId="afr" type="stepAfter" dataKey={`${run.id}_afr`} stroke="#A855F7" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.3} name="AFR" />
                        </React.Fragment>
                    ))}

                    {isRunning && (
                        <>
                            <Area connectNulls yAxisId="p" type="monotone" dataKey="live_p" stroke="#00F0FF" fill="url(#livePower)" strokeWidth={3} dot={false} isAnimationActive={false} name="Live Power" />
                            <Line connectNulls yAxisId="t" type="monotone" dataKey="live_t" stroke="#FF003C" strokeWidth={3} dot={false} isAnimationActive={false} name="Live Torque" />
                            <Line connectNulls yAxisId="afr" type="stepAfter" dataKey="live_afr" stroke="#A855F7" strokeWidth={2} dot={false} isAnimationActive={false} name="Live AFR" opacity={0.7} />
                            <Line connectNulls yAxisId="boost" type="monotone" dataKey="live_boost" stroke="#EAB308" strokeWidth={2} dot={false} isAnimationActive={false} name="Live Boost" opacity={0.8} />
                        </>
                    )}
                </ComposedChart>
            </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DynoGraph;
