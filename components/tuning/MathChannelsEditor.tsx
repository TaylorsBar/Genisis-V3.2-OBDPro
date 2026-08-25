
import React, { useState } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { Plus, Trash2, Calculator, Save, Info, AlertTriangle, Play } from 'lucide-react';
import { MathEngineService, MathChannel } from '../../services/MathEngineService';

const MathChannelsEditor: React.FC = () => {
    const mathChannels = useVehicleStore(state => state.mathChannels);
    const addMathChannel = useVehicleStore(state => state.addMathChannel);
    const removeMathChannel = useVehicleStore(state => state.removeMathChannel);
    const latestData = useVehicleStore(state => state.latestData);
    const [newChannel, setNewChannel] = useState<Partial<MathChannel>>({
        name: '',
        formula: '',
        unit: '',
        color: '#00F0FF'
    });
    const [testValue, setTestValue] = useState<number | null>(null);

    const handleTest = () => {
        if (!newChannel.formula) return;
        const math = MathEngineService.getInstance();
        const result = math.evaluate(newChannel.formula, latestData);
        setTestValue(result);
    };

    const handleAdd = () => {
        if (!newChannel.name || !newChannel.formula) return;
        addMathChannel({
            id: `custom_${Date.now()}`,
            name: newChannel.name,
            description: 'Custom Math Channel',
            formula: newChannel.formula,
            unit: newChannel.unit || '',
            color: newChannel.color || '#FFF'
        });
        setNewChannel({ name: '', formula: '', unit: '', color: '#00F0FF' });
        setTestValue(null);
    };

    return (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-cyan/10 rounded-lg">
                        <Calculator className="w-5 h-5 text-brand-cyan" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Math Engine Engine</h3>
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Virtual Channel Synthesis & Synthetic Telemetry</p>
                    </div>
                </div>
            </div>

            {/* CREATOR */}
            <div className="bg-black/60 border border-white/5 rounded-xl p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] pl-1">Channel Name</label>
                            <input 
                                value={newChannel.name}
                                onChange={e => setNewChannel({...newChannel, name: e.target.value})}
                                placeholder="e.g. Real-Time VE"
                                className="w-full bg-black/80 border border-white/10 p-3 rounded-xl text-xs font-white focus:border-brand-cyan/50 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] pl-1">Unit</label>
                            <input 
                                value={newChannel.unit}
                                onChange={e => setNewChannel({...newChannel, unit: e.target.value})}
                                placeholder="%"
                                className="w-full bg-black/80 border border-white/10 p-3 rounded-xl text-xs font-white focus:border-brand-cyan/50 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] pl-1">Mathematical Formula</label>
                            <div className="relative">
                                <textarea 
                                    rows={3}
                                    value={newChannel.formula}
                                    onChange={e => setNewChannel({...newChannel, formula: e.target.value})}
                                    placeholder="(maf * 1000) / (rpm * displacement)"
                                    className="w-full bg-black/80 border border-white/10 p-3 rounded-xl text-xs font-mono text-brand-cyan focus:border-brand-cyan/50 outline-none transition-all resize-none"
                                />
                                <button 
                                    onClick={handleTest}
                                    className="absolute bottom-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-all group"
                                    title="Test Formula"
                                >
                                    <Play size={14} className="group-hover:text-brand-cyan transition-colors" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black rounded-lg border border-white/5">
                            <span className="text-[8px] font-mono text-zinc-500">Live Test:</span>
                            <span className={`text-[10px] font-mono font-bold ${testValue !== null ? 'text-emerald-400' : 'text-zinc-700'}`}>
                                {testValue !== null ? testValue.toFixed(4) : '---'}
                            </span>
                        </div>
                        {testValue === 0 && newChannel.formula && (
                            <div className="flex items-center gap-1.5 text-[8px] font-bold text-yellow-500 animate-pulse">
                                <AlertTriangle size={10} />
                                Verify Field Names
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleAdd}
                        className="px-8 py-3 bg-brand-cyan text-black text-[10px] font-black uppercase rounded-xl flex items-center gap-2 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                    >
                        <Plus size={14} /> Commit Channel
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mathChannels.map(channel => (
                    <div key={channel.id} className="group bg-black/40 border border-white/5 rounded-2xl p-4 hover:border-brand-cyan/30 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.02] rounded-full -mr-8 -mt-8"></div>
                        
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: channel.color }}></div>
                                <span className="text-[11px] font-black text-white uppercase tracking-wider">{channel.name}</span>
                            </div>
                            <button 
                                onClick={() => removeMathChannel(channel.id)}
                                className="p-1.5 text-zinc-600 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>

                        <div className="bg-black/80 rounded-lg p-3 border border-white/5 mb-3">
                            <code className="text-[9px] font-mono text-brand-cyan/80 break-all leading-relaxed">
                                f(x) = {channel.formula}
                            </code>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-zinc-500">Unit: {channel.unit || 'n/a'}</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded text-[8px] font-mono text-zinc-400">
                                <Save size={10} />
                                PERSISTENT
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex items-start gap-4">
                <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Syntax Guide</h4>
                    <p className="text-[9px] text-zinc-500 leading-relaxed">
                        Use any sensor name (rpm, speed, maf, load, knockRetard, lambda). 
                        Standard math operators (+, -, *, /) and functions (sqrt, pow, abs) are supported.
                        Example: <span className="text-brand-cyan font-mono">sqrt(maf) * (rpm / 1000)</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MathChannelsEditor;
