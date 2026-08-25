import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Plus, Trash2, Edit2, Save, X, Settings2, Hash, 
    Type, Ruler, ChevronRight, Binary, ArrowRightLeft,
    CheckCircle2, AlertCircle
} from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';
import { CanMapping } from '../types';

export const CanMappingManager: React.FC = () => {
    const canMappings = useVehicleStore(state => state.canMappings);
    const addCanMapping = useVehicleStore(state => state.addCanMapping);
    const removeCanMapping = useVehicleStore(state => state.removeCanMapping);
    const updateCanMapping = useVehicleStore(state => state.updateCanMapping);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<Partial<CanMapping>>({
        canId: '',
        name: '',
        unit: '',
        startBit: 0,
        bitLength: 16,
        byteOrder: 'big',
        isSigned: false,
        scaling: 1,
        offset: 0
    });

    const resetForm = () => {
        setForm({
            canId: '',
            name: '',
            unit: '',
            startBit: 0,
            bitLength: 16,
            byteOrder: 'big',
            isSigned: false,
            scaling: 1,
            offset: 0
        });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSave = () => {
        if (!form.canId || !form.name) return;

        const mapping: CanMapping = {
            id: editingId || Math.random().toString(36).substring(7),
            canId: form.canId!,
            name: form.name!,
            unit: form.unit || '',
            startBit: form.startBit || 0,
            bitLength: form.bitLength || 8,
            byteOrder: form.byteOrder || 'big',
            isSigned: !!form.isSigned,
            scaling: form.scaling || 1,
            offset: form.offset || 0
        };

        if (editingId) {
            updateCanMapping(mapping);
        } else {
            addCanMapping(mapping);
        }
        resetForm();
    };

    const startEdit = (m: CanMapping) => {
        setForm(m);
        setEditingId(m.id);
        setIsAdding(true);
    };

    return (
        <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-brand-cyan" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">CAN Sensor Mappings</h3>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 rounded-lg text-xs font-bold hover:bg-brand-cyan/30 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    NEW MAPPING
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
                <AnimatePresence mode="popLayout">
                    {isAdding && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">CAN ID (Hex)</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                                        <input
                                            value={form.canId}
                                            onChange={e => setForm({ ...form, canId: e.target.value.toUpperCase() })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-brand-cyan"
                                            placeholder="e.g. 1A0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">Sensor Name</label>
                                    <div className="relative">
                                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                                        <input
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-brand-cyan"
                                            placeholder="e.g. Steering Angle"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">Start Bit</label>
                                    <input
                                        type="number"
                                        value={form.startBit}
                                        onChange={e => setForm({ ...form, startBit: parseInt(e.target.value) })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-cyan"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">Bit Length</label>
                                    <input
                                        type="number"
                                        value={form.bitLength}
                                        onChange={e => setForm({ ...form, bitLength: parseInt(e.target.value) })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-cyan"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">Unit</label>
                                    <input
                                        value={form.unit}
                                        onChange={e => setForm({ ...form, unit: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-cyan text-center"
                                        placeholder="°"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 text-center">
                                    <label className="text-[10px] font-bold text-white/40 uppercase block mb-2">Byte Order</label>
                                    <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
                                        <button 
                                            onClick={() => setForm({...form, byteOrder: 'big'})}
                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${form.byteOrder === 'big' ? 'bg-brand-cyan text-black' : 'text-white/40 hover:text-white'}`}
                                        >
                                            BIG (Motorola)
                                        </button>
                                        <button 
                                            onClick={() => setForm({...form, byteOrder: 'little'})}
                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${form.byteOrder === 'little' ? 'bg-brand-cyan text-black' : 'text-white/40 hover:text-white'}`}
                                        >
                                            LITTLE (Intel)
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1 text-center">
                                    <label className="text-[10px] font-bold text-white/40 uppercase block mb-2">Signed</label>
                                    <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
                                        <button 
                                            onClick={() => setForm({...form, isSigned: false})}
                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${!form.isSigned ? 'bg-brand-cyan text-black' : 'text-white/40 hover:text-white'}`}
                                        >
                                            UNSIGNED
                                        </button>
                                        <button 
                                            onClick={() => setForm({...form, isSigned: true})}
                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${form.isSigned ? 'bg-brand-cyan text-black' : 'text-white/40 hover:text-white'}`}
                                        >
                                            SIGNED
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">Scaling (Mult)</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={form.scaling}
                                        onChange={e => setForm({ ...form, scaling: parseFloat(e.target.value) })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-cyan"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase">Offset</label>
                                    <input
                                        type="number"
                                        value={form.offset}
                                        onChange={e => setForm({ ...form, offset: parseFloat(e.target.value) })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-cyan"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={resetForm}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 text-white/60 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
                                >
                                    <X className="w-4 h-4" />
                                    CANCEL
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-brand-cyan text-black hover:bg-brand-cyan/80 rounded-xl text-xs font-bold transition-all"
                                >
                                    <Save className="w-4 h-4" />
                                    {editingId ? 'UPDATE' : 'SAVE MAPPING'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {canMappings.map((m) => (
                    <div 
                        key={m.id}
                        className="group relative p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between hover:border-brand-cyan/30 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20">
                                <span className="text-[10px] font-mono font-bold text-brand-cyan">{m.canId}</span>
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm tracking-tight">{m.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-mono text-white/40 uppercase">
                                        Bit {m.startBit}:{m.bitLength} • {m.byteOrder} • {m.scaling}x + {m.offset}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">
                                        {m.unit}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => startEdit(m)}
                                className="p-2 text-white/40 hover:text-brand-cyan transition-colors"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => removeCanMapping(m.id)}
                                className="p-2 text-white/40 hover:text-red-400 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {canMappings.length === 0 && !isAdding && (
                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                        <ArrowRightLeft className="w-8 h-8 mb-2" />
                        <p className="text-sm font-medium">No active CAN mappings</p>
                        <p className="text-[10px] uppercase tracking-widest mt-1">Define sensor offsets for real-time decoding</p>
                    </div>
                )}
            </div>
        </div>
    );
};
