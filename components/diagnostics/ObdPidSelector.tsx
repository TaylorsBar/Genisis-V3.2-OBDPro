
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { OBD_PIDS } from '../../services/ObdService';
import { PIDDefinition } from '../../types';
import { Check, Plus, X, Activity, Zap, Wind, Droplets, Settings } from 'lucide-react';

export const ObdPidSelector: React.FC = () => {
    const activePids = useVehicleStore(state => state.activePids);
    const setActivePids = useVehicleStore(state => state.setActivePids);
    const obdState = useVehicleStore(state => state.obdState);
    const [isOpen, setIsOpen] = React.useState(false);

    const togglePid = (pid: PIDDefinition) => {
        const isSelected = activePids.some(p => p.id === pid.id);
        if (isSelected) {
            setActivePids(activePids.filter(p => p.id !== pid.id));
        } else {
            setActivePids([...activePids, pid]);
        }
    };

    const categories = Array.from(new Set(OBD_PIDS.map(p => p.category)));

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Engine': return <Activity className="w-4 h-4" />;
            case 'Performance': return <Zap className="w-4 h-4" />;
            case 'Air': return <Wind className="w-4 h-4" />;
            case 'Fuel': return <Droplets className="w-4 h-4" />;
            default: return <Settings className="w-4 h-4" />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-lg text-brand-cyan hover:bg-brand-cyan/20 transition-colors"
            >
                <Activity className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-wider">Manage PIDs</span>
                <span className="ml-2 px-1.5 py-0.5 bg-brand-cyan/20 rounded text-[10px]">
                    {activePids.length || 'Default'}
                </span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-2 w-80 max-h-[500px] z-50 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-bottom border-white/10 bg-white/5 flex justify-between items-center">
                                <h3 className="text-sm font-display font-bold text-white uppercase tracking-widest">OBD-II Parameter Selection</h3>
                                <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                                {categories.map(cat => (
                                    <div key={cat} className="space-y-1">
                                        <div className="px-2 py-1 flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-tighter">
                                            {getCategoryIcon(cat)}
                                            {cat}
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            {OBD_PIDS.filter(p => p.category === cat).map(pid => {
                                                const isSelected = activePids.some(p => p.id === pid.id);
                                                return (
                                                    <button
                                                        key={pid.id}
                                                        onClick={() => togglePid(pid)}
                                                        className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                                                            isSelected 
                                                            ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan' 
                                                            : 'bg-white/5 border border-transparent text-white/60 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <div className="text-left">
                                                            <div className="text-xs font-bold leading-none">{pid.name}</div>
                                                            <div className="text-[9px] opacity-60 mt-1">{pid.description}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono opacity-40">{pid.mode}{pid.pid}</span>
                                                            {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 opacity-20" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-black/40 border-t border-white/10 text-[9px] text-white/40 italic">
                                * Polling too many PIDs simultaneously may reduce refresh rate on slower ELM327 adapters.
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
