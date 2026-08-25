
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Shield, Flame, Activity, Disc, Gauge, HelpCircle, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useUIStore } from '../../stores/uiStore';
import { LaunchControlSuite as LaunchConfig, ObdConnectionState } from '../../types';
import HelpTooltip from '../HelpTooltip';

const LaunchControlSuite: React.FC = () => {
    const launchControl = useVehicleStore(state => state.launchControl);
    const setLaunchControl = useVehicleStore(state => state.setLaunchControl);
    const vehicleConfig = useVehicleStore(state => state.vehicleConfig);
    const setVehicleConfig = useVehicleStore(state => state.setVehicleConfig);
    const uds = useVehicleStore(state => state.uds);
    const writeDid = useVehicleStore(state => state.writeDid);
    const latestData = useVehicleStore(state => state.latestData);
    const obdState = useVehicleStore(state => state.obdState);

    const updateLaunch = (patch: Partial<LaunchConfig>) => {
        setLaunchControl(patch);
    };

    const isSystemError = obdState === ObdConnectionState.Error || !uds.securityAccess;
    const isStationary = latestData.speed < 2;
    const isAtLaunchRpm = Math.abs(latestData.rpm - launchControl.launchRpm) < 200;
    const isLaunching = launchControl.enabled && isStationary && latestData.rpm > (launchControl.launchRpm - 300);

    const systemStatus = useMemo(() => {
        if (!launchControl.enabled) return 'OFFLINE';
        if (isSystemError) return 'ERROR';
        if (isAtLaunchRpm && isStationary) return 'ACTIVE';
        return 'ARMED';
    }, [launchControl.enabled, isSystemError, isAtLaunchRpm, isStationary]);

    const statusColor = {
        OFFLINE: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
        ARMED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        ACTIVE: 'text-orange-500 bg-orange-500/20 border-orange-500/40 animate-pulse',
        ERROR: 'text-brand-red bg-brand-red/10 border-brand-red/20'
    }[systemStatus];

    const handleSync = async (did: string, value: number, label: string) => {
        const showToast = useUIStore.getState().showToast;
        if (!uds.securityAccess) {
            showToast("Security Access Required. Please authenticate first via Protocol Intelligence.", "error");
            return;
        }
        const hex = value.toString(16).padStart(4, '0');
        const success = await writeDid(did, hex);
        if (success) {
            showToast(`${label} synchronized to ECU RAM successfully.`, "success");
        } else {
            showToast(`Failed to sync ${label}. Check physical link.`, "error");
        }
    };

    return (
        <div className="flex flex-col gap-6 p-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* --- STATUS HEADER --- */}
            <div className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-500 ${statusColor}`}>
                <div className="flex items-center gap-3">
                    {systemStatus === 'OFFLINE' && <Shield className="w-5 h-5 opacity-40" />}
                    {systemStatus === 'ARMED' && <CheckCircle2 className="w-5 h-5" />}
                    {systemStatus === 'ACTIVE' && <Flame className="w-5 h-5 animate-bounce" />}
                    {systemStatus === 'ERROR' && <AlertTriangle className="w-5 h-5 animate-pulse" />}
                    <div>
                        <h3 className="text-xs font-black tracking-widest uppercase italic">System {systemStatus}</h3>
                        <p className="text-[8px] font-mono opacity-60 uppercase tracking-wider">
                            {systemStatus === 'OFFLINE' && 'IGNITION READY - SYSTEM DISARMED'}
                            {systemStatus === 'ARMED' && 'STAGING READY - AWAITING THROTTLE INPUT'}
                            {systemStatus === 'ACTIVE' && 'LAUNCH ACTIVE - MAINTAINING TARGET RPM'}
                            {systemStatus === 'ERROR' && 'SECURITY NEGOTIATION FAILED - CHECK BUS'}
                        </p>
                    </div>
                </div>
                {launchControl.enabled && (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-mono font-bold tracking-tighter italic">{latestData.rpm.toFixed(0)} <span className="opacity-40">RPM</span></span>
                        <div className="w-16 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                            <motion.div 
                                className="h-full bg-current"
                                animate={{ width: `${Math.min(100, (latestData.rpm / vehicleConfig.maxRpm) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* --- REV LIMITER SECTION --- */}
            <section className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-red/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-2">
                        <Disc className="w-4 h-4 text-brand-red" />
                        <h2 className="text-xs font-black tracking-widest text-white uppercase italic">Rev Limiter Profile</h2>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-brand-red/10 border border-brand-red/20 shadow-[0_0_10px_rgba(255,0,60,0.1)]">
                        <span className="text-[9px] font-mono text-brand-red font-black tracking-tighter uppercase italic">Phase 1: Protection</span>
                    </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <span className="flex items-center gap-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Hard Cut Limit</label>
                                    <HelpTooltip title="Hard Cut Rev Limiter" content="The absolute rotational ceiling where fuel injection or spark spark-ignitions are directly interrupted. This forms a hard governor backstop protecting critical mechanical components from high-RPM stress." />
                                </span>
                                <span className="text-xl font-mono text-brand-red font-black italic tracking-tighter group-hover:drop-shadow-[0_0_8px_rgba(255,0,60,0.6)] transition-all">{vehicleConfig.maxRpm} <span className="text-[10px] not-italic text-gray-600">RPM</span></span>
                            </div>
                            <input 
                                type="range" min="4000" max="9000" step="50" 
                                value={vehicleConfig.maxRpm} 
                                onChange={(e) => setVehicleConfig({ maxRpm: Number(e.target.value) })}
                                className="w-full accent-brand-red h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[8px] font-mono text-gray-700">
                                <span>MIN: 4000</span>
                                <span>STOCK: 6800</span>
                                <span>MAX: 9000</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <span className="flex items-center gap-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Soft Cut (Retard)</label>
                                    <HelpTooltip title="Soft Timing Retard" content="The rotational threshold prior to hard cut where the ECU begins to selectively retard spark advance. This smoothly tapers engine power production and exhaust temperatures before reaching physical spark/fuel cuts." />
                                </span>
                                <span className="text-xl font-mono text-brand-cyan font-black italic tracking-tighter">{vehicleConfig.softCutRpm || 6600} <span className="text-[10px] not-italic text-gray-600">RPM</span></span>
                            </div>
                            <input 
                                type="range" min="4000" max={vehicleConfig.maxRpm} step="50" 
                                value={vehicleConfig.softCutRpm || 6600} 
                                onChange={(e) => setVehicleConfig({ softCutRpm: Number(e.target.value) })}
                                className="w-full accent-brand-cyan h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                            />
                            <p className="text-[8px] text-gray-500 italic uppercase tracking-wider">Dynamic retard maps will soften impact before physical fuel cut.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 justify-center">
                        <div className="bg-black/80 border border-white/5 rounded-lg p-5 flex flex-col items-center gap-2 overflow-hidden relative shadow-inner">
                            <Shield className="w-6 h-6 text-brand-red animate-pulse" />
                            <div className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-1">Safety Governor</div>
                            <div className="text-sm font-black text-white tracking-widest uppercase italic bg-brand-red/5 px-2 py-1 rounded">Active Protective Layer</div>
                        </div>
                        <button 
                            disabled={!uds.securityAccess}
                            onClick={() => handleSync('D001', vehicleConfig.maxRpm, 'Hard Limit')}
                            className={`w-full py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-xl group/btn ${
                                uds.securityAccess 
                                ? 'bg-brand-red text-black hover:bg-white hover:scale-[1.02] active:scale-95' 
                                : 'bg-gray-900 text-gray-700 border border-white/5 grayscale'
                            }`}
                        >
                            Commit Limit Profile (UDS 2E)
                        </button>
                    </div>
                </div>
            </section>

            {/* --- LAUNCH CONTROL SECTION --- */}
            <section className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl relative group/launch">
                {!launchControl.enabled && <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-20 pointer-events-none transition-all duration-700" />}
                
                <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex justify-between items-center relative z-30">
                    <div className="flex items-center gap-2">
                        <Flame className={`w-4 h-4 ${launchControl.enabled ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'text-gray-500'}`} />
                        <h2 className="text-xs font-black tracking-widest text-white uppercase italic">Launch Control Subsystem</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                            <Zap className={`w-3 h-3 ${vehicleConfig.aspiration === 'NA' ? 'text-brand-cyan' : 'text-gray-600'}`} />
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">N/A Opti</span>
                        </div>
                        <button 
                            onClick={() => updateLaunch({ enabled: !launchControl.enabled })}
                            className={`px-5 py-2 rounded-full border text-[9px] font-black tracking-[0.2em] uppercase transition-all active:scale-90 ${
                                launchControl.enabled 
                                ? 'bg-orange-500 border-orange-400 text-black shadow-[0_0_30_rgba(249,115,22,0.3)]' 
                                : 'bg-white/5 border-white/10 text-gray-500'
                            }`}
                        >
                            {launchControl.enabled ? 'ARMED & STAGED' : 'SYSTEM OFFLINE'}
                        </button>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                    <div className="flex flex-col items-center justify-center gap-6 border-r border-white/10 pr-8">
                        <div className="relative w-36 h-36 flex items-center justify-center group-hover/launch:scale-105 transition-transform duration-500">
                            {/* Dial Background */}
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle cx="72" cy="72" r="66" stroke="rgba(255,255,255,0.03)" strokeWidth="12" fill="transparent" />
                                <circle 
                                    cx="72" cy="72" r="66" 
                                    stroke="currentColor" strokeWidth="12" fill="transparent" 
                                    strokeDasharray={2 * Math.PI * 66} 
                                    strokeDashoffset={2 * Math.PI * 66 * (1 - (launchControl.launchRpm - 2000) / 6000)}
                                    className={`${launchControl.enabled ? 'text-orange-500' : 'text-gray-800'} transition-all duration-700 ease-out`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="flex flex-col items-center justify-center uppercase z-10">
                                <motion.span 
                                    key={launchControl.launchRpm}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-4xl font-mono font-black italic text-white tracking-tighter"
                                >
                                    {launchControl.launchRpm}
                                </motion.span>
                                <span className="text-[9px] font-black text-gray-500 tracking-widest mt-1 italic">Target RPM</span>
                            </div>
                        </div>
                        <div className="w-full space-y-2">
                             <input 
                                type="range" min="2000" max="8000" step="100" 
                                disabled={!launchControl.enabled}
                                value={launchControl.launchRpm} 
                                onChange={(e) => updateLaunch({ launchRpm: Number(e.target.value) })}
                                className="w-full accent-orange-500 h-1.5 bg-white/5 rounded-full appearance-none disabled:opacity-30 cursor-pointer"
                            />
                            <div className="flex justify-between text-[7px] font-mono text-gray-700 uppercase tracking-widest">
                                <span>2.0K</span>
                                <span className={vehicleConfig.aspiration === 'NA' ? 'text-brand-cyan animate-pulse' : ''}>OPTIMISED N/A PK</span>
                                <span>8.0K</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col gap-3">
                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3 text-brand-cyan" /> Activation Trigger
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['NEUTRAL', 'CLUTCH_SWITCH', 'SPEED_BASED', 'BRAKE_HOLD'] as const).map(method => (
                                    <button 
                                        key={method}
                                        disabled={!launchControl.enabled}
                                        onClick={() => updateLaunch({ activationMethod: method })}
                                        className={`py-3 px-1 rounded-lg border text-[8px] font-black tracking-widest transition-all ${
                                            launchControl.activationMethod === method 
                                            ? 'bg-orange-500 text-black border-orange-400' 
                                            : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                                        } disabled:opacity-20`}
                                    >
                                        {method.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                    <Flame className="w-3 h-3 text-brand-red" /> Anti-Lag (ALS)
                                </label>
                                <button 
                                    disabled={!launchControl.enabled}
                                    onClick={() => updateLaunch({ antiLagEnabled: !launchControl.antiLagEnabled })}
                                    className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase transition-all ${
                                        launchControl.antiLagEnabled ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-600'
                                    }`}
                                >
                                    {launchControl.antiLagEnabled ? 'ARMED' : 'BYPASS'}
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {(['IGNITION_CUT', 'FUEL_CUT', 'HYBRID'] as const).map(strat => (
                                    <button 
                                        key={strat}
                                        disabled={!launchControl.enabled}
                                        onClick={() => updateLaunch({ strategy: strat })}
                                        className={`py-3 px-1 rounded-lg border text-[8px] font-black transition-all ${
                                            launchControl.strategy === strat 
                                            ? 'bg-white/10 border-white/20 text-white' 
                                            : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                                        } disabled:opacity-20`}
                                    >
                                        {strat.split('_')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">ALS Timing Retard</span>
                                <span className="text-xs font-mono font-bold text-brand-red">-{launchControl.retardDeg}°</span>
                            </div>
                            <input 
                                type="range" min="0" max="45" 
                                disabled={!launchControl.enabled || !launchControl.antiLagEnabled}
                                value={launchControl.retardDeg} 
                                onChange={(e) => updateLaunch({ retardDeg: Number(e.target.value) })}
                                className="w-full accent-brand-red h-1 bg-white/10 rounded-full appearance-none disabled:opacity-30"
                            />
                        </div>
                    </div>

                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col justify-between shadow-inner">
                        <div className="space-y-5">
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Exit Velocity</span>
                                <span className="text-sm font-mono font-black text-brand-cyan">{launchControl.exitSpeed} <span className="text-[10px] text-gray-600 italic">KPH</span></span>
                            </div>
                            
                            <div className="space-y-4 pt-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Zap className={`w-3 h-3 ${launchControl.isStage2Active ? 'text-yellow-500' : 'text-gray-500'}`} />
                                        <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Stage-2 Mode</span>
                                    </div>
                                    <button 
                                        disabled={!launchControl.enabled || vehicleConfig.aspiration === 'NA'}
                                        onClick={() => updateLaunch({ isStage2Active: !launchControl.isStage2Active })}
                                        className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase transition-all ${
                                            launchControl.isStage2Active ? 'bg-yellow-500 text-black' : 'bg-white/5 text-gray-600'
                                        }`}
                                    >
                                        {launchControl.isStage2Active ? 'ACTIVE' : 'READY'}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[8px] font-mono text-gray-600">
                                        <span className="uppercase italic">Target Pressure</span>
                                        <span className="text-yellow-500 font-bold">{launchControl.stage2BoostTarget.toFixed(1)} <span className="text-gray-700">BAR</span></span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="3.0" step="0.1"
                                        disabled={!launchControl.enabled || !launchControl.isStage2Active || vehicleConfig.aspiration === 'NA'}
                                        value={launchControl.stage2BoostTarget} 
                                        onChange={(e) => updateLaunch({ stage2BoostTarget: Number(e.target.value) })}
                                        className="w-full accent-yellow-500 h-1 bg-white/10 rounded-full appearance-none disabled:opacity-30"
                                    />
                                </div>
                                {vehicleConfig.aspiration === 'NA' && <p className="text-[7px] text-gray-600 italic -mt-2 uppercase tracking-tight">Turbo hardware required for boost logic.</p>}
                            </div>
                            
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-mono text-white uppercase tracking-widest">Flames & Pops</span>
                                    <span className="text-[7px] text-gray-500 italic uppercase">Combustion Scavenging</span>
                                </div>
                                <button 
                                    disabled={!launchControl.enabled}
                                    onClick={() => updateLaunch({ flameOn: !launchControl.flameOn })}
                                    className={`w-10 h-5 rounded-full relative transition-all duration-300 ${launchControl.flameOn ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-gray-800 border border-white/5'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${launchControl.flameOn ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>

                        <button 
                            disabled={!launchControl.enabled || !uds.securityAccess}
                            onClick={() => handleSync('D101', launchControl.launchRpm, 'Launch RPM')}
                            className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 mt-6 shadow-2xl active:scale-95 ${
                                launchControl.enabled && uds.securityAccess
                                ? 'bg-white text-black hover:bg-orange-500 hover:text-white' 
                                : 'bg-white/5 text-gray-700 cursor-not-allowed grayscale border border-white/5'
                            }`}
                        >
                            <Save className="w-4 h-4" /> Finalize Setup
                        </button>
                    </div>
                </div>

                <div className="px-6 py-4 bg-orange-500/5 border-t border-white/5 flex gap-8 items-center">
                    <div className="flex items-center gap-2">
                        <Gauge className="w-3 h-3 text-orange-500" />
                        <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Stationary Static Limit Verification</span>
                    </div>
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-orange-500/40"
                            animate={{ width: launchControl.enabled ? '100%' : '0%' }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                    </div>
                    <span className={`text-[8px] font-mono uppercase tracking-tighter ${isLaunching ? 'text-orange-500 animate-pulse' : 'text-gray-600'}`}>
                        {isLaunching ? 'Engine Safe: GO for Launch' : 'Awaiting Engagement'}
                    </span>
                </div>
            </section>
        </div>
    );
};

export default LaunchControlSuite;
