import React, { useState } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import TuningSlider from './TuningSlider';
import { ObdConnectionState } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ShieldCheck, Settings2, AlertTriangle } from 'lucide-react';

const RevLimiter: React.FC = () => {
    const obdState = useVehicleStore(state => state.obdState);
    const rpm = useVehicleStore(state => state.latestData.rpm);
    const writeKessParameter = useVehicleStore(state => state.writeKessParameter);
    
    // Local state for the properties that are missing in VehicleStoreState
    const [hardCut, setHardCutState] = useState({ enabled: true, rpm: 6500, type: 'hard' });
    const setHardCut = (enabled: boolean, rpm: number, type: string) => setHardCutState({ enabled, rpm, type });
    const [twoStep] = useState({ enabled: false });

    const [writeStatus, setWriteStatus] = useState<'idle' | 'writing' | 'success' | 'failed'>('idle');
    
    const isCutting = hardCut.enabled && rpm > hardCut.rpm;

    const handleDuratorqPreset = () => {
        setHardCut(true, 4500, 'smart');
    };

    const handleBarraTurboPreset = () => {
        setHardCut(true, 6200, 'popcorn');
    };

    const handleBarraNAPreset = () => {
        setHardCut(true, 6100, 'hard');
    };

    const handleApplyToEcu = async () => {
        if (obdState !== ObdConnectionState.Connected) return;
        
        setWriteStatus('writing');
        
        try {
            await Promise.all([
                writeKessParameter('70', hardCut.rpm),
                writeKessParameter('71', hardCut.enabled ? 1 : 0),
                writeKessParameter('72', hardCut.type === 'soft' ? 0 : (hardCut.type === 'hard' ? 1 : 2))
            ]);
            setWriteStatus('success');
            setTimeout(() => setWriteStatus('idle'), 3000);
        } catch (e) {
            console.error("ECU writing failed:", e);
            setWriteStatus('failed');
            setTimeout(() => setWriteStatus('idle'), 3000);
        }
    };


    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full flex flex-col lg:flex-row gap-4 md:gap-6 p-2 md:p-4 lg:p-6 h-full overflow-y-auto bg-[#020202]"
        >
            {/* Control Panel */}
            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col gap-6 md:gap-8 relative overflow-hidden group min-w-[300px] shadow-2xl">
                {/* Background FX */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600/0 via-red-600/30 to-red-600/0"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="flex justify-between items-start z-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-600/10 flex items-center justify-center border border-red-600/30 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
                            <Flame className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Rev<span className="text-red-600">Limiter</span></h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-[0.3em]">Fuel Cut Strategy</p>
                            </div>
                        </div>
                    </div>

                    {obdState === ObdConnectionState.Connected && (
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 px-4 py-1.5 bg-green-900/20 border border-green-500/30 rounded-lg"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">ECU Active</span>
                        </motion.div>
                    )}
                </div>

                <div className="space-y-8 z-10">
                    {/* Master Switch */}
                    <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/10 group/card hover:bg-white/10 transition-all">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-gray-400" />
                            <span className="text-sm font-black text-gray-300 uppercase tracking-widest">Limiter Active</span>
                        </div>
                        <button 
                            onClick={() => setHardCut(!hardCut.enabled, hardCut.rpm, hardCut.type)}
                            className={`w-12 h-6 rounded-full border flex items-center p-1 transition-all ${hardCut.enabled ? 'bg-red-600 border-red-500 justify-end shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-[#222] border-gray-600 justify-start'}`}
                        >
                            <motion.div 
                                layout
                                className={`w-4 h-4 rounded-full shadow-md bg-white`} 
                            />
                        </button>
                    </div>

                    {/* RPM Slider */}
                    <div className={`${!hardCut.enabled ? 'opacity-30 pointer-events-none grayscale' : ''} transition-all`}>
                        <TuningSlider 
                            label="Cut RPM" 
                            unit="RPM" 
                            value={hardCut.rpm} 
                            min={3000} 
                            max={7000} 
                            step={50} 
                            onChange={(v) => setHardCut(hardCut.enabled, v, hardCut.type)} 
                        />
                    </div>

                    {/* Mode Selectors */}
                    <div className={`space-y-4 ${!hardCut.enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-3">
                            <Settings2 className="w-5 h-5 text-gray-500" />
                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">Cut Strategy</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'soft', label: 'Soft', color: 'bg-white text-black border-white' },
                                { id: 'hard', label: 'Hard', color: 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]' },
                                { id: 'popcorn', label: 'Popcorn', color: 'bg-brand-yellow text-black border-brand-yellow shadow-[0_0_15px_rgba(252,238,10,0.4)]' }
                            ].map(mode => (
                                <button 
                                    key={mode.id}
                                    onClick={() => setHardCut(true, hardCut.rpm, mode.id as any)}
                                    className={`py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${hardCut.type === mode.id ? mode.color : 'bg-white/5 text-gray-500 border-white/10 hover:border-gray-500 hover:bg-white/10'}`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button 
                            onClick={handleDuratorqPreset}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            Diesel (Mondeo)
                        </button>
                        <button 
                            onClick={handleBarraTurboPreset}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-brand-cyan hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            Barra 4.0T
                        </button>
                        <button 
                            onClick={handleBarraNAPreset}
                            className="md:col-span-2 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-brand-yellow hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            Barra 4.0 N/A (Territory)
                        </button>
                    </div>

                    {/* ECU Write Button */}
                    <div className="pt-6 border-t border-white/10">
                        <button 
                            onClick={handleApplyToEcu}
                            disabled={obdState !== ObdConnectionState.Connected || writeStatus === 'writing'}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3 ${
                                obdState !== ObdConnectionState.Connected 
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
                                : (writeStatus === 'success' 
                                    ? 'bg-green-600 text-white border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                                    : (writeStatus === 'failed' ? 'bg-red-600 text-white border-red-500' : 'bg-brand-red text-white hover:bg-red-500 shadow-[0_0_25px_rgba(220,38,38,0.4)] border border-red-500'))
                            }`}
                        >
                            {writeStatus === 'writing' ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Writing to ECU...
                                </>
                            ) : (writeStatus === 'success' ? 'Write Confirmed' : (writeStatus === 'failed' ? 'Write Failed' : 'Apply to ECU'))}
                        </button>
                        {obdState !== ObdConnectionState.Connected && (
                            <div className="flex items-center justify-center gap-2 mt-3 opacity-50">
                                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                <p className="text-[9px] text-gray-500 text-center uppercase tracking-widest font-bold">Connect OBD to enable ECU write</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Visualizer */}
            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative shadow-2xl min-h-[350px] overflow-hidden">
                {/* Background Textures */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
                
                {/* Active Cut Indicator */}
                <AnimatePresence>
                    {isCutting && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-red-600/10 animate-[pulse_0.1s_infinite] z-0 pointer-events-none" 
                        />
                    )}
                </AnimatePresence>
                
                <div className="relative z-10 w-56 h-56 md:w-72 md:h-72 border-8 border-white/5 rounded-full flex items-center justify-center bg-black shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] group">
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-600 animate-[spin_0.5s_linear_infinite] opacity-30" style={{ animationDuration: isCutting ? '0.1s' : '2s' }}></div>
                    <div className="absolute inset-4 rounded-full border border-white/5"></div>
                    
                    <div className="text-center relative z-10">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2 block">Engine Speed</span>
                        <motion.span 
                            animate={isCutting ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.1, repeat: Infinity }}
                            className={`text-6xl md:text-7xl font-black font-mono tracking-tighter ${isCutting ? 'text-red-500' : 'text-white'} transition-colors duration-75 block`}
                        >
                            {rpm.toFixed(0)}
                        </motion.span>
                        <AnimatePresence>
                            {isCutting && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="text-[10px] font-black text-red-500 bg-red-900/30 px-3 py-1.5 rounded-lg mt-4 inline-block border border-red-500/30 tracking-widest"
                                >
                                    LIMIT REACHED
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="mt-12 w-full max-w-md bg-white/5 p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-3 font-mono font-bold uppercase tracking-widest">
                        <span>0</span>
                        <span className="text-red-500">Limit: {hardCut.rpm}</span>
                        <span>{twoStep.enabled ? 'Launch' : 'Max'}</span>
                    </div>
                    <div className="h-3 bg-black/40 rounded-full overflow-hidden relative border border-white/5 p-0.5">
                        {/* Limit Marker */}
                        <motion.div 
                            initial={false}
                            animate={{ left: `${(hardCut.rpm / 7500) * 100}%` }}
                            className="absolute top-0 bottom-0 w-1 bg-red-500 z-10 shadow-[0_0_10px_rgba(239,68,68,0.8)]" 
                        />
                        {/* RPM Bar */}
                        <motion.div 
                            initial={false}
                            animate={{ width: `${Math.min(100, (rpm / 7500) * 100)}%` }}
                            className={`h-full rounded-full transition-colors ${isCutting ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.5)]'}`} 
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default RevLimiter;
