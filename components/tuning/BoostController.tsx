import React, { useState, useEffect } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import TuningSlider from './TuningSlider';
import ApexiBoostGauge from '../tachometers/ApexiBoostGauge';
import { ObdConnectionState } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Activity, Settings2, Cpu } from 'lucide-react';

const BoostController: React.FC = () => {
    const obdState = useVehicleStore(state => state.obdState);
    const latestData = useVehicleStore(state => state.latestData);
    const writeKessParameter = useVehicleStore(state => state.writeKessParameter);

    const [boostTarget, setBoostTarget] = useState(14.5);
    const [boostWarning, setBoostWarning] = useState(18);
    const [pidGains, setPidGainsState] = useState({ kp: 1.5, ki: 0.1, kd: 0.2 });
    const setPidGains = (kp: number, ki: number, kd: number) => setPidGainsState({ kp, ki, kd });
    const [twoStep, setTwoStepState] = useState({ enabled: false, limitRpm: 4000, activationThreshold: 90 });
    const setTwoStep = (enabled: boolean, limitRpm: number) => setTwoStepState(prev => ({ ...prev, enabled, limitRpm }));
    
    // Fallbacks for data properties that might not exist in SensorDataPoint
    const turboVgtDuty = (latestData as any).turboVgtDuty ?? 0;
    const turboBoost = (latestData as any).turboBoost ?? 0;
    const boostDuty = (latestData as any).boostDuty ?? 0;

    const mpcState = {
        optimalDuty: 45,
        isLearning: true,
        learnedParams: { a: 0.8, b: 1.2 },
        cost: 0.05,
        prediction: [1, 2, 4, 3, 2]
    };

    const [isScramble, setIsScramble] = useState(false);
    const [showMpcShadow, setShowMpcShadow] = useState(true);
    const [liveLinkActive, setLiveLinkActive] = useState(false);
    const [isSweeping, setIsSweeping] = useState(false);

    // Sync Live Link with Actual VGT Control
    useEffect(() => {
        if (liveLinkActive && obdState === ObdConnectionState.Connected) {
            const duty = turboVgtDuty ?? 0;
            writeKessParameter('80', duty);
        } else {
            if (obdState === ObdConnectionState.Connected) {
                writeKessParameter('81', 0);
            }
        }
    }, [liveLinkActive, turboVgtDuty, obdState, writeKessParameter]);

    const handleScramble = (active: boolean) => {
        if (active && !isScramble) {
            setBoostTarget(boostTarget + 5);
            setIsScramble(true);
        } else if (!active && isScramble) {
            setBoostTarget(boostTarget - 5);
            setIsScramble(false);
        }
    };

    const handlePresetMondeo = () => {};
    const handlePresetBarra = () => {};

    const handleVgtSweep = async () => {
        if (obdState !== ObdConnectionState.Connected) return;
        setIsSweeping(true);
        setLiveLinkActive(false); // Disable normal link to take manual control
        
        // Sweep Logic: 0 -> 100 -> 0 over 3 seconds
        const steps = [0, 25, 50, 75, 100, 75, 50, 25, 0];
        
        for (const step of steps) {
            writeKessParameter('80', step);
            await new Promise(r => setTimeout(r, 400));
        }
        
        writeKessParameter('81', 0);
        setIsSweeping(false);
    };

    const isStaged = twoStep.enabled && latestData.speed < 5 && latestData.engineLoad > twoStep.activationThreshold;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full flex flex-col lg:flex-row h-full gap-4 md:gap-6 p-2 md:p-4 lg:p-6 overflow-y-auto lg:overflow-hidden bg-[#020202]"
        >
            {/* Control Module */}
            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col justify-start gap-6 md:gap-8 relative overflow-y-auto custom-scrollbar group min-w-[300px] shadow-2xl">
                {/* Background Textures & Glows */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-cyan/0 via-brand-cyan/30 to-brand-cyan/0"></div>
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex justify-between items-start z-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
                            <Zap className="w-6 h-6 text-brand-cyan" />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Boost<span className="text-brand-cyan">Controller</span></h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></div>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-[0.3em]">Closed Loop VGT Management</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {obdState === ObdConnectionState.Connected ? (
                            <>
                                <button 
                                    onClick={handleVgtSweep}
                                    disabled={isSweeping}
                                    className={`px-4 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${isSweeping ? 'bg-yellow-500 text-black border-yellow-500 animate-pulse' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    {isSweeping ? 'Sweeping...' : 'Test Actuator'}
                                </button>
                                <button 
                                    onClick={() => setLiveLinkActive(!liveLinkActive)}
                                    disabled={isSweeping}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all ${liveLinkActive ? 'bg-red-600/20 border-red-500 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-green-900/20 border-green-500/30'}`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${liveLinkActive ? 'bg-red-500' : 'bg-green-500'} shadow-[0_0_8px_currentColor]`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${liveLinkActive ? 'text-red-400' : 'text-green-400'}`}>
                                        {liveLinkActive ? 'Live Write' : 'Read Only'}
                                    </span>
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Offline</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-8 relative z-10 font-mono">
                    <TuningSlider 
                        label="Target Pressure" 
                        unit="PSI" 
                        value={boostTarget - (isScramble ? 5 : 0)} 
                        min={5} 
                        max={35} 
                        step={0.5} 
                        onChange={(v) => isScramble ? setBoostTarget(v+5) : setBoostTarget(v)} 
                        tooltipTitle="Boost Pressure Target"
                        helpContent="Standard static manifold relative pressure target. For street tuning, 12-18 PSI is optimal; values above 22 PSI require a reinforced block, optimized MAP rationalization, and increased fuel volume delivery."
                    />
                    
                    {/* Launch Control / 2-Step */}
                    <div className="bg-white/5 p-6 rounded-2xl border border-brand-cyan/20 space-y-6 relative overflow-hidden group/card">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
                        {isStaged && <div className="absolute inset-0 bg-brand-cyan/10 animate-pulse pointer-events-none"></div>}
                        
                        <div className="flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                                <Activity className="w-5 h-5 text-brand-cyan" />
                                <span className="text-sm font-black text-white uppercase tracking-widest">2-Step Launch Control</span>
                            </div>
                            <button 
                                onClick={() => setTwoStep(!twoStep.enabled, twoStep.limitRpm)}
                                className={`w-12 h-6 rounded-full border flex items-center p-1 transition-all ${twoStep.enabled ? 'bg-brand-cyan border-brand-cyan justify-end shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-[#222] border-gray-600 justify-start'}`}
                            >
                                <motion.div 
                                    layout
                                    className={`w-4 h-4 rounded-full shadow-md ${twoStep.enabled ? 'bg-black' : 'bg-gray-500'}`} 
                                />
                            </button>
                        </div>
                        
                        <div className={`${!twoStep.enabled ? 'opacity-30 pointer-events-none grayscale' : ''} transition-all relative z-10`}>
                            <TuningSlider 
                                label="Launch RPM" 
                                unit="RPM" 
                                value={twoStep.limitRpm} 
                                min={2000} 
                                max={5000} 
                                step={100} 
                                onChange={(v) => setTwoStep(twoStep.enabled, v)} 
                            />
                            
                            <div className="flex justify-between text-[10px] text-gray-500 uppercase mt-4 font-mono font-bold tracking-widest">
                                <span className="flex items-center gap-2">
                                    Status: {isStaged ? <span className="text-brand-cyan animate-pulse">Staged / Building Boost</span> : <span className="text-gray-400">Ready</span>}
                                </span>
                                <span>TPS Trig: &gt;95%</span>
                            </div>
                        </div>
                    </div>

                    {/* PID Section */}
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6 relative group/card">
                        <div className="flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                                <Settings2 className="w-5 h-5 text-gray-400" />
                                <span className="text-sm font-black text-gray-400 uppercase tracking-widest">PID Calibration</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handlePresetMondeo} className="text-[9px] px-3 py-1.5 bg-white/5 hover:bg-brand-cyan hover:text-black border border-white/10 rounded-lg text-gray-400 uppercase font-black tracking-widest transition-all">
                                    Mondeo 2.0
                                </button>
                                <button onClick={handlePresetBarra} className="text-[9px] px-3 py-1.5 bg-white/5 hover:bg-brand-cyan hover:text-black border border-white/10 rounded-lg text-gray-400 uppercase font-black tracking-widest transition-all">
                                    Barra 4.0
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-4 font-mono">
                            <TuningSlider 
                                label="Proportional (Kp)" 
                                unit="" 
                                value={pidGains.kp} 
                                min={0} 
                                max={5} 
                                step={0.1} 
                                onChange={(v) => setPidGains(v, pidGains.ki, pidGains.kd)} 
                                tooltipTitle="Proportional Gain (Kp)"
                                helpContent="Controls the aggressive response to immediate boost deviation. Excess Kp leads to hard manifold overshoots or wastegate flutter, while low Kp results in sluggish spool-up latency."
                            />
                            <TuningSlider 
                                label="Integral (Ki)" 
                                unit="" 
                                value={pidGains.ki} 
                                min={0} 
                                max={1} 
                                step={0.01} 
                                onChange={(v) => setPidGains(pidGains.kp, v, pidGains.kd)} 
                                tooltipTitle="Integral Gain (Ki)"
                                helpContent="Steadily corrects any remaining target deviation over time. Helps match boost targets perfectly flat at high-RPM runs. High values produce strong overshoots and oscillation instabilities."
                            />
                            <TuningSlider 
                                label="Derivative (Kd)" 
                                unit="" 
                                value={pidGains.kd} 
                                min={0} 
                                max={2} 
                                step={0.05} 
                                onChange={(v) => setPidGains(pidGains.kp, pidGains.ki, v)} 
                                tooltipTitle="Derivative Gain (Kd)"
                                helpContent="Dampens the wastegate/VGT response by measuring the speed of boost pressure rise. Prevents overshoots when transitioning from spool-up to peak-boost target."
                            />
                        </div>
                    </div>

                    {/* VGT Duty Cycle & MPC Shadow */}
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6 relative group/card">
                        <div className="flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                                <Cpu className="w-5 h-5 text-gray-400" />
                                <span className="text-sm font-black text-gray-400 uppercase tracking-widest">VGT Actuator</span>
                            </div>
                            <label className="flex items-center gap-3 text-[10px] font-black text-gray-500 cursor-pointer uppercase tracking-widest">
                                <input type="checkbox" checked={showMpcShadow} onChange={(e) => setShowMpcShadow(e.target.checked)} className="w-4 h-4 rounded border-white/10 bg-black text-brand-cyan focus:ring-0" />
                                MPC Shadow
                            </label>
                        </div>
                        
                        <div className="space-y-6">
                            {/* PID Duty */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">
                                    <span>PID Out / Vane Pos</span>
                                    <span className={liveLinkActive || isSweeping ? "text-red-500 animate-pulse" : "text-brand-cyan"}>
                                        {turboVgtDuty?.toFixed(0) ?? boostDuty.toFixed(0)}%
                                        {liveLinkActive && " [Override]"}
                                        {isSweeping && " [Test]"}
                                    </span>
                                </div>
                                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 p-0.5">
                                    <motion.div 
                                        initial={false}
                                        animate={{ width: `${turboVgtDuty ?? boostDuty}%` }}
                                        className={`h-full rounded-full transition-colors ${liveLinkActive || isSweeping ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-brand-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]'}`} 
                                    />
                                </div>
                            </div>

                            {/* MPC Shadow Duty */}
                            <AnimatePresence>
                                {showMpcShadow && mpcState && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-2 overflow-hidden"
                                    >
                                        <div className="flex justify-between text-[10px] font-mono font-bold text-brand-purple uppercase tracking-widest">
                                            <span>MPC Optimal</span>
                                            <span>{mpcState.optimalDuty.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden relative border border-white/5 p-0.5">
                                            <motion.div 
                                                initial={false}
                                                animate={{ width: `${mpcState.optimalDuty}%` }}
                                                className="h-full bg-brand-purple rounded-full shadow-[0_0_10px_rgba(188,19,254,0.5)]" 
                                            />
                                            {/* PID Reference Ghost */}
                                            <motion.div 
                                                initial={false}
                                                animate={{ left: `${boostDuty}%` }}
                                                className="absolute top-0 bottom-0 w-1 bg-white/30 z-10" 
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <button 
                    className={`w-full py-8 mt-4 font-black uppercase tracking-[0.4em] rounded-2xl border transition-all duration-200 flex items-center justify-center gap-4 text-sm ${isScramble ? 'bg-red-600 border-red-500 text-white shadow-[0_0_40px_rgba(220,38,38,0.6)] scale-[0.98]' : 'bg-white/5 border-white/10 text-red-500 hover:bg-white/10 hover:border-red-500/50'}`}
                    onMouseDown={() => handleScramble(true)}
                    onMouseUp={() => handleScramble(false)}
                    onMouseLeave={() => handleScramble(false)}
                    onTouchStart={() => handleScramble(true)}
                    onTouchEnd={() => handleScramble(false)}
                >
                    <Zap className={`w-6 h-6 ${isScramble ? 'animate-bounce' : ''}`} />
                    <span>{isScramble ? 'Scramble Active (+5 PSI)' : 'Hold for Scramble'}</span>
                </button>
            </div>

            {/* Monitoring Module */}
            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center relative shadow-2xl min-h-[350px] group overflow-hidden">
                {/* Background FX */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,240,255,0.05)_0%,_transparent_70%)] pointer-events-none"></div>
                
                <div className="w-full max-w-[320px] lg:max-w-[400px] aspect-square relative z-10 mb-8 transform scale-100 lg:scale-110">
                    <ApexiBoostGauge 
                        value={turboBoost}
                        dataKey="map"
                        warningAt={boostWarning}
                        onWarningChange={setBoostWarning}
                        size="100%"
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm z-10">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center group/stat hover:bg-white/10 transition-all">
                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-2 group-hover/stat:text-brand-cyan transition-colors">Error Delta</span>
                        <span className={`text-2xl font-mono font-black ${(turboBoost - (boostTarget/14.5)) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {(turboBoost - (boostTarget/14.5)).toFixed(2)}
                        </span>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center group/stat hover:bg-white/10 transition-all">
                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-2 group-hover/stat:text-brand-cyan transition-colors">Target</span>
                        <span className="text-2xl font-mono font-black text-white">{(boostTarget/14.5).toFixed(2)} <span className="text-xs text-gray-500">BAR</span></span>
                    </div>
                </div>

                {/* MPC Analytics Panel */}
                <AnimatePresence>
                    {showMpcShadow && mpcState && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="mt-8 w-full max-w-sm bg-brand-purple/5 border border-brand-purple/20 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-brand-purple" />
                                    <span className="text-[11px] font-black text-brand-purple uppercase tracking-[0.2em]">MPC Analytics</span>
                                </div>
                                {mpcState.isLearning && (
                                    <div className="flex items-center gap-2 bg-brand-purple text-black px-2 py-1 rounded-lg text-[9px] font-black animate-pulse">
                                        <div className="w-1 h-1 rounded-full bg-black animate-ping" />
                                        LEARNING
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">
                                <div>
                                    <span className="block opacity-50 mb-1">Lag (A)</span>
                                    <span className="text-white text-sm">{mpcState.learnedParams.a.toFixed(3)}</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 mb-1">Gain (B)</span>
                                    <span className="text-white text-sm">{mpcState.learnedParams.b.toFixed(3)}</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 mb-1">Cost (J)</span>
                                    <span className="text-white text-sm">{mpcState.cost.toFixed(4)}</span>
                                </div>
                            </div>
                            {/* Predicted Trajectory Mini-Sparkline */}
                            <div className="mt-6 h-12 w-full flex items-end gap-1.5 opacity-40">
                                {mpcState.prediction.map((p, i) => (
                                    <motion.div 
                                        key={i} 
                                        initial={{ height: 0 }}
                                        animate={{ height: `${Math.min(100, Math.max(10, (p / 2.5) * 100))}%` }}
                                        className="flex-1 bg-brand-purple rounded-t-sm" 
                                    />
                                ))}
                            </div>
                            <div className="text-[9px] font-black text-center mt-3 text-brand-purple/40 uppercase tracking-[0.3em]">Predicted Horizon (5 Steps)</div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default BoostController;
