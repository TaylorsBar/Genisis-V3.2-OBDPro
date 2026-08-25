import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Maximize2, Minimize2 } from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';

export const LiveTelemetryGraph = React.memo(() => {
    const data = useVehicleStore(state => state.data);
    const [activeSensors, setActiveSensors] = useState<string[]>(['rpm', 'speed', 'turboBoost']);
    const [isExpanded, setIsExpanded] = useState(false);

    const sensors = [
        { id: 'rpm', name: 'Engine RPM', color: '#00F0FF', unit: 'RPM' },
        { id: 'speed', name: 'Ground Speed', color: '#BC13FE', unit: 'KPH' },
        { id: 'turboBoost', name: 'Boost Pressure', color: '#FF003C', unit: 'PSI' },
        { id: 'coolantTemp', name: 'Coolant Temp', color: '#FFD700', unit: '°C' },
        { id: 'timingAdvance', name: 'Ignition Timing', color: '#00FF00', unit: '°' },
        { id: 'throttlePos', name: 'Throttle %', color: '#FFA500', unit: '%' },
    ];

    const toggleSensor = (id: string) => {
        setActiveSensors(prev => 
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    return (
        <div className={`bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col transition-all duration-500 ${isExpanded ? 'h-[600px]' : 'h-[400px]'}`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Activity className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Live Telemetry Analysis</h3>
                        <p className="text-xs text-white/40">Multi-channel sensor fusion & trend analysis</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl transition-all"
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Sensor Selector */}
            <div className="p-3 border-b border-white/10 flex gap-2 overflow-x-auto scrollbar-hide bg-black/20">
                {sensors.map(s => (
                    <button
                        key={s.id}
                        onClick={() => toggleSensor(s.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap ${
                            activeSensors.includes(s.id)
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-transparent border-white/5 text-white/20 hover:border-white/10'
                        }`}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <div className="flex-1 p-4 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.slice(-100)}>
                        <defs>
                            {sensors.map(s => (
                                <linearGradient key={s.id} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={10}
                            tickFormatter={(val) => val.toFixed(0)}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                            itemStyle={{ padding: '2px 0' }}
                        />
                        {activeSensors.map(id => (
                            <Area
                                key={id}
                                type="monotone"
                                dataKey={id}
                                stroke={sensors.find(s => s.id === id)?.color}
                                fillOpacity={1}
                                fill={`url(#grad-${id})`}
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Bar */}
            <div className="p-3 bg-black/40 border-t border-white/10 grid grid-cols-3 gap-4">
                {activeSensors.slice(0, 3).map(id => {
                    const s = sensors.find(x => x.id === id);
                    const lastVal = data[data.length - 1]?.[id as keyof typeof data[0]] as number || 0;
                    return (
                        <div key={id} className="flex flex-col">
                            <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold">{s?.name}</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm font-mono font-bold text-white">{typeof lastVal === 'number' ? lastVal.toFixed(1) : lastVal}</span>
                                <span className="text-[10px] text-white/40">{s?.unit}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
