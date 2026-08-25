import React, { useState } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { Plus, Trash2, Tag, Search, Hash } from 'lucide-react';

const CanSensorMapper: React.FC = () => {
    const uds = useVehicleStore(state => state.uds);
    const addCustomMapping = useVehicleStore(state => state.addCustomMapping);
    const removeCustomMapping = useVehicleStore(state => state.removeCustomMapping);
    const [newId, setNewId] = useState('');
    const [newName, setNewName] = useState('');
    const [newUnit, setNewUnit] = useState('');
    const [newFactor, setNewFactor] = useState(1);
    const [newOffset, setNewOffset] = useState(0);

    const handleAdd = () => {
        if (!newId || !newName) return;
        addCustomMapping(newId.toUpperCase(), {
            name: newName,
            unit: newUnit || 'Raw',
            factor: newFactor,
            offset: newOffset
        });
        setNewId('');
        setNewName('');
        setNewUnit('');
        setNewFactor(1);
        setNewOffset(0);
    };

    return (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-brand-cyan uppercase tracking-[0.2em] flex items-center gap-2">
                    <Tag size={14} />
                    CAN Sensor Mapping
                </h3>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    {Object.keys(uds.customMappings).length} Definitions
                </span>
            </div>

            {/* New Mapping Form */}
            <div className="bg-black/60 border border-white/5 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest pl-1">CAN ID (Hex)</label>
                        <input 
                            value={newId} 
                            onChange={e => setNewId(e.target.value)}
                            placeholder="7E0"
                            className="w-full bg-black/60 border border-white/10 p-2 rounded-lg text-xs font-mono text-brand-cyan focus:border-brand-cyan/50 outline-none"
                        />
                    </div>
                    <div className="space-y-1.5 flex-[2]">
                        <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Name</label>
                        <input 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Oil Temperature"
                            className="w-full bg-black/60 border border-white/10 p-2 rounded-lg text-xs font-white focus:border-white/30 outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Unit</label>
                        <input 
                            value={newUnit} 
                            onChange={e => setNewUnit(e.target.value)}
                            placeholder="°C"
                            className="w-full bg-black/60 border border-white/10 p-2 rounded-lg text-xs font-white focus:border-white/30 outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Factor</label>
                        <input 
                            type="number"
                            value={newFactor} 
                            onChange={e => setNewFactor(Number(e.target.value))}
                            className="w-full bg-black/60 border border-white/10 p-2 rounded-lg text-xs font-mono text-emerald-400 focus:border-emerald-500/50 outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Offset</label>
                        <input 
                            type="number"
                            value={newOffset} 
                            onChange={e => setNewOffset(Number(e.target.value))}
                            className="w-full bg-black/60 border border-white/10 p-2 rounded-lg text-xs font-mono text-emerald-400 focus:border-emerald-500/50 outline-none"
                        />
                    </div>
                </div>
                <button 
                    onClick={handleAdd}
                    className="w-full py-2.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-cyan hover:text-black transition-all"
                >
                    <Plus size={14} />
                    Register Mapping
                </button>
            </div>

            {/* Mappings List */}
            <div className="space-y-2">
                {Object.entries(uds.customMappings).map(([id, mapping]) => (
                    <div key={id} className="group bg-[#111] border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-white/20 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black rounded-lg border border-white/5 flex items-center justify-center text-[10px] font-mono text-brand-cyan">
                                {id}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-white hover:text-brand-cyan transition-colors">{mapping.name}</span>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] font-mono text-emerald-400">Scale: {mapping.factor}x</span>
                                    <span className="text-[9px] font-mono text-emerald-400">Bias: {mapping.offset}</span>
                                    <span className="text-[9px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">{mapping.unit}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => removeCustomMapping(id)}
                            className="p-2 text-zinc-600 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                
                {Object.keys(uds.customMappings).length === 0 && (
                    <div className="py-8 flex flex-col items-center justify-center text-zinc-700 space-y-2">
                        <Search size={32} strokeWidth={1} />
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">No custom logic registered</span>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-white/5 text-[8px] font-mono text-zinc-600 uppercase tracking-widest leading-relaxed">
                Caution: Incorrect scaling factors may result in invalid telemetric data. Register PIDs only with verified engineering documentation.
            </div>
        </div>
    );
};

export default CanSensorMapper;
