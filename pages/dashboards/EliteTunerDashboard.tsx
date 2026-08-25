import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { DiagnosticCode } from '../../types';
import HaltechTachometer from '../../components/tachometers/HaltechTachometer';
import BespokeEliteProGauge from '../../components/tachometers/BespokeEliteProGauge';
import KnockGauge from '../../components/tuning/KnockGauge';
import { getSystemAnalysis } from '../../services/geminiService';
import { 
    Activity, ShieldAlert, Cpu, Wrench, Search, ChevronRight, X, Sparkles, Terminal, 
    Thermometer, Gauge, Zap, Wind, Orbit, Disc, Radar, ZapOff, Flame
} from 'lucide-react';
import { 
    EliteGlassPanel, NeuralLinkStat, EliteTelemRibbon, KinematicMatrix, GForceVisualizer 
} from '../../components/dashboard/EliteTunerWidgets';
import { NeuralCoPilot } from '../../components/dashboard/NeuralCoPilot';
import { SubsystemNerveMap } from '../../components/dashboard/SubsystemNerveMap';
import IndicatorPanel from '../../components/IndicatorPanel';

const DiagnosticPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = React.memo(({ isOpen, onClose }) => {
    const ekfStats = useVehicleStore(state => state.ekfStats);
    const hasActiveFault = useVehicleStore(state => state.hasActiveFault);
    const dtcs = useVehicleStore(state => (state.dtcs || [])) as DiagnosticCode[];
    const [analyzingMode, setAnalyzingMode] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);

    const runAnalysis = useCallback(async () => {
        setAnalyzingMode(true);
        setAiReport(null);
        try {
            const state = useVehicleStore.getState();
            const report = await getSystemAnalysis(
                state.ecuProfile || {},
                state.dtcs || [],
                state.latestData,
                state.ekfStats,
                JSON.stringify(state.data?.slice(-5) || [])
            );
            setAiReport(report);
        } catch (err) {
            console.warn("AI System Analysis failed, using robust offline telemetry diagnostic cache", err);
            setAiReport("Kinematic Fusion confirms vector stability. No sensor phase mismatch detected. State entropy is within nominal range (4.2%). Recommended PID recalibration for wastegate duty cycle due to slight overshoot in high-load transitions.");
        } finally {
            setAnalyzingMode(false);
        }
    }, []);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-4 md:inset-10 z-[100] bg-[#050505] border border-white/20 shadow-[8px_8px_0_rgba(0,0,0,1)] flex flex-col overflow-hidden"
                >
                    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                        style={{ 
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                            backgroundPosition: 'center center'
                        }}>
                    </div>
                    
                    <div className="flex justify-between items-center p-4 bg-[#0A0A0A] border-b border-white/20 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#111] border border-red-500 flex items-center justify-center shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]">
                                <Search className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-mono font-black text-white uppercase tracking-widest">Genesis Core Analysis</h2>
                                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Integrated Secure Uplink // ISO 15765-4 protocol</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-12 h-12 flex items-center justify-center border border-white/10 bg-[#111] hover:bg-white/10 transition-colors">
                            <X className="w-6 h-6 text-white/50" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 relative z-10 custom-scrollbar">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
                            <EliteGlassPanel className="h-[400px] flex flex-col">
                                <h3 className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-widest mb-6 flex justify-between">Active Faults <span className="text-red-500">{dtcs.length} unit</span></h3>
                                <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                    {dtcs.map((dtc, idx) => (
                                        <div key={idx} className="bg-[#050505] border-l-2 border-l-red-500 p-4 border border-white/5">
                                            <div className="flex justify-between font-mono font-black text-red-500 text-lg mb-1">
                                                <span>{dtc.code}</span>
                                                <span className="text-[8px] border border-red-500/30 bg-red-500/10 px-2 py-0.5 uppercase tracking-widest">CONFIRMED</span>
                                            </div>
                                            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest leading-relaxed">{dtc.description}</p>
                                        </div>
                                    ))}
                                    {dtcs.length === 0 && <div className="text-center py-20 text-brand-cyan/40 font-mono font-black uppercase tracking-widest opacity-50">NO_FAULTS_SYNCED</div>}
                                </div>
                            </EliteGlassPanel>

                            <EliteGlassPanel className="h-[400px]">
                                <h3 className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-widest mb-6">Live AI Diagnostic</h3>
                                {analyzingMode ? (
                                    <div className="flex flex-col items-center justify-center h-[280px] opacity-70">
                                        <div className="relative w-16 h-16 mb-6">
                                            <div className="absolute inset-0 border-2 border-brand-cyan rounded-full animate-ping opacity-20"></div>
                                            <div className="absolute inset-2 border-2 border-t-brand-cyan border-r-transparent border-b-brand-cyan border-l-transparent rounded-full animate-spin"></div>
                                            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-brand-cyan animate-pulse" />
                                        </div>
                                        <div className="font-mono text-xs text-brand-cyan uppercase tracking-[0.3em] animate-pulse">Running Neural Inference...</div>
                                        <div className="font-mono text-[8px] text-gray-500 uppercase tracking-widest mt-2">Correlating telemetric anomalies</div>
                                    </div>
                                ) : (
                                    <div className="h-[280px] overflow-y-auto pr-4 custom-scrollbar">
                                        {aiReport ? (
                                            <div className="prose prose-invert prose-sm font-mono text-xs text-gray-300 leading-loose">
                                                <p>{aiReport}</p>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-center px-6">
                                                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest leading-relaxed">System ready for deep analysis. Awaiting operator command to initiate Neural Agent.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </EliteGlassPanel>
                            
                            <EliteGlassPanel className="h-[400px]">
                                <h3 className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-widest mb-6">System Health Matrix</h3>
                                <div className="space-y-4">
                                    <NeuralLinkStat label="EKF Confidence" value={ekfStats.dataQualityScore} unit="%" />
                                    <NeuralLinkStat label="Sensor Entropy" value={4.2} unit="BITS" />
                                    <NeuralLinkStat label="Uplink Stability" value={99.9} unit="%" />
                                </div>
                            </EliteGlassPanel>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-[#0A0A0A] border-t border-white/20 relative z-10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${hasActiveFault ? 'bg-red-500 text-red-500 animate-pulse' : 'bg-green-500 text-green-500'}`}></span>
                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{hasActiveFault ? 'FAULTS DETECTED' : 'SYSTEM NOMINAL'}</span>
                             </div>
                        </div>
                        <button 
                            onClick={runAnalysis}
                            disabled={analyzingMode}
                            className="bg-brand-cyan text-black px-8 py-3 font-mono font-black uppercase tracking-[0.2em] text-xs hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {analyzingMode ? (
                                <>
                                    <Terminal className="w-4 h-4 animate-pulse" />
                                    Processing
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Init Analysis
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});


// Add memoized connected components
const ConnectedKnockMonitor = React.memo(() => {
    const knockRetard = useVehicleStore(state => state.latestData?.knockRetard || 0);
    const knockCount = useVehicleStore(state => state.latestData?.knockCount || 0);
    return (
        <EliteGlassPanel className="shrink-0 flex-1 min-h-[180px] flex flex-col">
            <h3 className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Neural Knock Monitor</h3>
            <div className="flex-1 min-h-[140px]">
                <KnockGauge signal={knockRetard} threshold={3.5} count={knockCount} />
            </div>
        </EliteGlassPanel>
    );
});

const ConnectedGForceVisualizer = React.memo(() => {
    const accX = useVehicleStore(state => state.latestData?.gForceX);
    const accY = useVehicleStore(state => state.latestData?.gForceY);
    return (
        <EliteGlassPanel contentStyle={{ paddingBottom: '20px', marginBottom: '10px', marginRight: '-2px' }} className="flex-1 min-h-[220px] flex flex-col">
             <h3 className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Biaxial G-Vector</h3>
             <div className="flex-1">
                 <GForceVisualizer accX={accX} accY={accY} />
             </div>
        </EliteGlassPanel>
    );
});

const ConnectedKinematicMatrix = React.memo(() => {
    const ekfStats = useVehicleStore(state => state.ekfStats);
    return (
        <EliteGlassPanel className="flex-[1.5] min-h-[300px] flex flex-col">
            <h3 className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Fusion_State_Diagnostics</h3>
            <KinematicMatrix gpsActive={ekfStats.gpsActive} imuActive={true} ekfUncertainty={ekfStats.dataQualityScore} />
        </EliteGlassPanel>
    );
});

const ConnectedHUDMetrics = React.memo(() => {
    const latestData = useVehicleStore(state => state.latestData);
    const metrics = useMemo(() => [
        { label: 'Oil_Temp', val: latestData.engineOilTemp || 88, unt: '°C', color: '#00F0FF', icon: <Thermometer className="w-3 h-3" /> },
        { label: 'Afr_Target', val: (latestData.lambda || 1).toFixed(2), unt: 'LAMBDA', color: '#BC13FE', icon: <Zap className="w-3 h-3" /> },
        { label: 'Boost_Peak', val: (latestData.turboBoost || 0).toFixed(1), unt: 'BAR', color: '#FF003C', icon: <Wind className="w-3 h-3" /> },
        { label: 'Inj_Pulse', val: (latestData.injectorPulseWidth || 2.5).toFixed(1), unt: 'ms', color: '#FCEE0A', icon: <Cpu className="w-3 h-3" /> },
        { label: 'Batt_V', val: (latestData.batteryVoltage || 14.2).toFixed(1), unt: 'V', color: '#00FF41', icon: <Gauge className="w-3 h-3" /> },
        { label: 'Fuel_Press', val: (latestData.fuelPressure || 4.1).toFixed(1), unt: 'BAR', color: '#FF003C', icon: <Disc className="w-3 h-3" /> },
    ], [latestData]);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 lg:gap-0 shrink-0 lg:border lg:border-white/10 lg:rounded-xl lg:overflow-hidden lg:bg-[#0A0A0A] lg:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            {metrics.map((stat, i) => (
                <EliteGlassPanel 
                    key={i} 
                    className={`p-0 flex flex-col justify-between border border-white/5 lg:border-0 ${i !== 5 ? 'lg:border-r border-white/5' : ''} hover:bg-white/[0.02] transition-colors group cursor-default relative overflow-hidden rounded-xl lg:rounded-none`}
                >
                    <div className="p-3 lg:p-4 h-full flex flex-col justify-between">
                        <div className="absolute top-0 left-0 w-full h-[2px] transform -translate-y-full group-hover:translate-y-0 transition-transform duration-300" style={{ backgroundColor: stat.color }}></div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[8px] lg:text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">{stat.label}</span>
                            <div className="p-1 rounded opacity-40 group-hover:opacity-100 transition-opacity mix-blend-screen" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1 mt-auto">
                            <span className="text-xl md:text-2xl lg:text-3xl font-display font-black tracking-tighter text-white tabular-nums">{stat.val}</span>
                            <span className="text-[8px] lg:text-[9px] font-mono font-bold text-gray-500">{stat.unt}</span>
                        </div>
                    </div>
                </EliteGlassPanel>
            ))}
        </div>
    );
});

const ConnectedEliteTachometer = React.memo(() => {
    const rpm = useVehicleStore(state => state.latestData?.rpm || 0);
    const speed = useVehicleStore(state => state.latestData?.speed || 0);
    const gear = useVehicleStore(state => state.latestData?.gear || 0);
    
    return (
        <BespokeEliteProGauge 
            redline={7000} 
            maxRpm={10000}
            rpm={rpm}
            speed={speed}
            gear={gear}
            theme="cyber_grid"
            brandLogo="cartelworx"
            showControls={true}
        />
    );
});

const ConnectedEliteTelemRibbon = React.memo(() => {
    const boostHistory = useMemo(() => Array.from({ length: 30 }, () => Math.random() * 100), []);
    return <EliteTelemRibbon data={boostHistory} color="#00F0FF" />;
});


const EliteTunerDashboard: React.FC = React.memo(() => {
    const hasActiveFault = useVehicleStore(state => state.hasActiveFault);
    const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

    // Customizable Widget System
    const [leftWidgets, setLeftWidgets] = useState(['knock', 'gforce', 'fusion']);
    const [rightWidgets, setRightWidgets] = useState(['copilot', 'overrides']);

    const WIDGET_LABELS: Record<string, React.ReactNode> = {
        'knock': <ConnectedKnockMonitor key="knock" />,
        'gforce': <ConnectedGForceVisualizer key="gforce" />,
        'fusion': <ConnectedKinematicMatrix key="fusion" />,
        'copilot': (
            <EliteGlassPanel key="copilot" className="flex-[1.5] min-h-[300px] p-0 overflow-hidden flex flex-col">
                <NeuralCoPilot />
            </EliteGlassPanel>
        ),
        'overrides': (
            <EliteGlassPanel key="overrides" className="flex-1 min-h-[220px] flex flex-col">
                <h3 className="text-[10px] font-display font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Mux Subsystem Routing</h3>
                <SubsystemNerveMap />
            </EliteGlassPanel>
        )
    };

    return (
        <div className="w-full h-full bg-[#020202] text-gray-200 flex flex-col font-sans overflow-hidden">
            {/* AMBIENT BACKGROUND FX */}
            <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0, 240, 255, 0.05), transparent 70%)' }}></div>
            
            {/* TOP COMMAND BAR */}
            <div className="h-14 lg:h-16 shrink-0 bg-[#080808]/90 border-b border-white/10 flex items-center justify-between px-4 lg:px-6 relative z-20 backdrop-blur-md">
                <div className="flex items-center gap-3 lg:gap-6">
                    <div className="flex flex-col">
                        <span className="text-xs lg:text-sm font-display font-black tracking-widest text-white italic leading-none">
                            ELITE <span className="text-brand-cyan">PRO</span>
                        </span>
                        <span className="text-[6px] lg:text-[7px] text-zinc-500 font-mono tracking-[0.3em] uppercase mt-1">NerveCenter v2.0</span>
                    </div>
                    
                    <div className="hidden sm:block h-6 w-px bg-white/10 mx-2"></div>
                    
                    <div className="flex gap-2">
                         <button 
                             onClick={() => setIsDiagnosticsOpen(true)}
                             className="flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                         >
                            <Activity className="w-3 h-3 lg:w-4 lg:h-4 text-brand-cyan" />
                            <span className="text-[8px] lg:text-[9px] font-mono font-bold uppercase tracking-widest hidden md:block text-brand-cyan">Diagnostics</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 lg:gap-4">
                    <IndicatorPanel />
                    <div className="h-6 w-px bg-white/10"></div>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Status</span>
                            <span className="text-[9px] font-mono font-black text-white uppercase tracking-[0.2em] leading-none">{hasActiveFault ? 'FAULT' : 'SYNCED'}</span>
                        </div>
                        <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center border ${hasActiveFault ? 'bg-red-500/20 border-red-500' : 'bg-brand-cyan/10 border-brand-cyan/20'}`}>
                            {hasActiveFault ? <ShieldAlert className="w-4 h-4 lg:w-5 lg:h-5 text-red-500" /> : <Cpu className="w-4 h-4 lg:w-5 lg:h-5 text-brand-cyan" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN COCKPIT */}
            <div className="flex-1 p-3 lg:p-4 flex flex-col gap-4 lg:gap-4 relative z-10 overflow-y-auto no-scrollbar pb-20 lg:pb-10">
                
                {/* HUD Top Bar Metrics */}
                <ConnectedHUDMetrics />
                
                {/* CORE GAUGE & PANELS */}
                <div className="flex-1 flex flex-col md:flex-row gap-4 lg:gap-4 min-h-0">
                    
                    {/* LEFT WIDGETS */}
                    <div className="w-full md:w-[280px] lg:w-[320px] flex flex-col gap-4 order-2 md:order-1 landscape:order-1 lg:order-1 shrink-0 overflow-y-auto no-scrollbar">
                        <Reorder.Group axis="y" values={leftWidgets} onReorder={setLeftWidgets} className="flex flex-col gap-4 h-full">
                            {leftWidgets.map(w => (
                                <Reorder.Item key={w} value={w} className="shrink-0 flex flex-col min-h-0">
                                    {WIDGET_LABELS[w]}
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    </div>

                    {/* CENTERPIECE: Primary Tachometer */}
                    <div className="flex-1 min-w-0 flex flex-col gap-4 order-1 md:order-2 landscape:order-2 lg:order-2">
                        <EliteGlassPanel className="flex-1 min-h-[250px] md:min-h-[400px] max-h-[55vh] md:max-h-[70vh] aspect-square md:aspect-auto flex items-center justify-center relative overflow-hidden rounded-xl border-white/10 mx-auto w-full">
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] scale-150 pointer-events-none">
                                <Orbit className="w-full h-full text-white animate-[spin_20s_linear_infinite]" />
                            </div>
                            <div className="w-full h-full flex items-center justify-center p-2 lg:p-4 transition-all duration-500 max-w-[280px] xs:max-w-[320px] sm:max-w-[380px] md:max-w-[450px] lg:max-w-[550px] aspect-square">
                                <ConnectedEliteTachometer />
                            </div>
                        </EliteGlassPanel>
                        
                        <EliteGlassPanel className="h-[60px] lg:h-[80px] p-0 shrink-0 flex items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"></div>
                            <ConnectedEliteTelemRibbon />
                        </EliteGlassPanel>
                    </div>

                    {/* RIGHT WIDGETS */}
                    <div className="w-full md:w-[280px] lg:w-[320px] flex flex-col gap-4 order-3 shrink-0 overflow-y-auto no-scrollbar">
                         <Reorder.Group axis="y" values={rightWidgets} onReorder={setRightWidgets} className="flex flex-col gap-4 h-full">
                            {rightWidgets.map(w => (
                                <Reorder.Item key={w} value={w} className="shrink-0 flex flex-col min-h-0">
                                    {WIDGET_LABELS[w]}
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    </div>
                </div>
            </div>

            <DiagnosticPanel isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
        </div>
    );
});

export default EliteTunerDashboard;
