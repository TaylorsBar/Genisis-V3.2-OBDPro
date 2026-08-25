import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { HaltechDataBlock, StatusPill } from '../../components/dashboard/DashboardWidgets';
import HaltechTachometer from '../../components/tachometers/HaltechTachometer';
import LiveTelemetryGraph from '../../components/dashboard/LiveTelemetryGraph';
import { VehicleDynamics, TireDynamicsModel } from '../../services/ATEngine';
import LiveAICoach from '../../components/widgets/LiveAICoach';

// Import newly modularized Genesis v5.0.4 components
import RpmTape from '../../components/dashboard/haltech/RpmTape';
import DragTree from '../../components/dashboard/haltech/DragTree';
import KnockDial from '../../components/dashboard/haltech/KnockDial';
import DynoLab from '../../components/dashboard/haltech/DynoLab';
import EcuScanner from '../../components/dashboard/haltech/EcuScanner';
import MpcEngine from '../../components/dashboard/haltech/MpcEngine';

const ConnectedHaltechTraceStats: React.FC = () => {
    const [stats, setStats] = useState({ maxRpm: 0, peakBoost: 0, avgLambda: 0, knockCount: 0 });

    useEffect(() => {
        let frameCount = 0;
        let rafId: number;
        
        const loop = () => {
            frameCount++;
            if (frameCount % 30 === 0) {
                const state = useVehicleStore.getState();
                const data = state.data;
                const latestData = state.latestData;
                
                if (data.length > 0) {
                    let maxRpm = 0;
                    let peakBoost = 0;
                    let sumLambda = 0;
                    
                    for (let i = 0; i < data.length; i++) {
                        const p = data[i];
                        if (p.rpm && p.rpm > maxRpm) maxRpm = p.rpm;
                        if (p.turboBoost && p.turboBoost > peakBoost) peakBoost = p.turboBoost;
                        if (p.o2SensorVoltage) sumLambda += p.o2SensorVoltage;
                    }
                    
                    const avgLambda = sumLambda / data.length;
                    
                    setStats({
                        maxRpm,
                        peakBoost,
                        avgLambda,
                        knockCount: latestData.knockCount || 0
                    });
                }
            }
            rafId = requestAnimationFrame(loop);
        };
        
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 mt-4">
            <HaltechDataBlock label="Max RPM" value={stats.maxRpm.toFixed(0)} unit="RPM" />
            <HaltechDataBlock label="Peak Boost" value={stats.peakBoost.toFixed(2)} unit="BAR" />
            <HaltechDataBlock label="Avg Lambda" value={stats.avgLambda.toFixed(2)} unit="LA" />
            <HaltechDataBlock label="Knock Count" value={stats.knockCount.toString()} unit="EVENTS" />
        </div>
    );
};

const ConnectedHaltechTireGrip: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
    const [grip, setGrip] = useState(0);

    useEffect(() => {
        let rafId: number;
        const loop = () => {
            const state = useVehicleStore.getState();
            const latestData = state.latestData;
            const currentGrip = VehicleDynamics.getGripUtilization(
                latestData.gForceX || 0, 
                latestData.gForceY || 0, 
                TireDynamicsModel.getDynamicFrictionLimit(latestData.speed || 0)
            );
            setGrip(prev => Math.abs(prev - currentGrip) > 0.5 ? currentGrip : prev);
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    return (
        <HaltechDataBlock label="Tire Grip" value={grip.toFixed(0)} unit="%" isWarning={grip > 95} barValue={grip} style={style} />
    );
};

const ConnectedHaltechBoost: React.FC = () => {
    const boost = useAnimatedValue("turboBoost");
    const [b, setB] = useState(0);
    
    useEffect(() => {
        return boost.on("change", (v) => setB(v));
    }, [boost]);

    const isVacuum = b < 0;
    const boostLabel = isVacuum ? "VACUUM" : "BOOST PRESSURE";
    const boostWarning = !isVacuum && b > 1.8;

    return (
        <HaltechDataBlock 
            label={boostLabel} 
            value={Math.abs(b).toFixed(2)} 
            unit="BAR" 
            maxBarValue={2.0} 
            isWarning={boostWarning}
            barValue={(Math.abs(b) / 2.0) * 100}
        />
    );
};

const WIDGET_REGISTRY: Record<string, React.ReactNode> = {
    'boost': <ConnectedHaltechBoost />,
    'oilPress': <HaltechDataBlock label="Oil Pressure" dataKey="oilPressure" unit="BAR" alertThreshold={1.0} alertCondition="less" maxBarValue={10} />,
    'fuelPress': <HaltechDataBlock label="Fuel Pressure" dataKey="fuelPressure" unit="BAR" maxBarValue={5} />,
    'battery': <HaltechDataBlock label="Battery" dataKey="batteryVoltage" unit="VOLTS" alertThreshold={11.5} alertCondition="less" maxBarValue={16} />,
    'lambda1': <HaltechDataBlock label="Lambda 1" dataKey="o2SensorVoltage" unit="LA" maxBarValue={1.5} />,
    'coolantTemp': <HaltechDataBlock label="Coolant Temp" dataKey="engineTemp" unit="°C" alertThreshold={105} alertCondition="greater" maxBarValue={120} />,
    'brakeTemp': <HaltechDataBlock label="Brake Temp" dataKey="brakeTemp" unit="°C" alertThreshold={600} alertCondition="greater" maxBarValue={800} />,
    'tireGrip': <ConnectedHaltechTireGrip />
};

const HaltechDashboard: React.FC = () => {
    const gpsActive = useVehicleStore(s => s.ekfStats.gpsActive);
    const hasActiveFault = useVehicleStore(s => s.hasActiveFault);
    const shiftLightRpm = useVehicleStore(s => s.shiftLightRpm);
    const setShiftLightRpm = useVehicleStore(s => s.setShiftLightRpm);
    const currentRpm = useVehicleStore(s => s.latestData.rpm || 0);
    const maxRpm = 9000;
    
    // Active Tab State (Genesis OS tabs)
    const [activeTab, setActiveTab] = useState<'COCKPIT' | 'RACE_PRO' | 'NEURAL_AI' | 'DYNO_LAB' | 'ECU_SCANNER' | 'MPC_PROP'>('COCKPIT');
    const [viewMode, setViewMode] = useState<'dash' | 'trace'>('dash');

    // Layout State
    const [leftWidgets, setLeftWidgets] = useState(['boost', 'oilPress', 'fuelPress', 'battery']);
    const [rightWidgets, setRightWidgets] = useState(['lambda1', 'coolantTemp', 'brakeTemp', 'tireGrip']);
    const [isHoveringDrag, setIsHoveringDrag] = useState(false);

    const handleSetShiftLight = () => {
        const val = prompt("Set Shift Light RPM Trigger:", shiftLightRpm.toString());
        if (val) {
            const num = parseInt(val);
            if (!isNaN(num) && num > 0 && num < 12000) {
                setShiftLightRpm(num);
            }
        }
    };

    return (
        <div className="w-full h-full bg-[#020202] flex flex-col overflow-hidden relative font-sans text-gray-200">
            {/* Ambient vignette background glow */}
            <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_95%)]"></div>

            {/* --- TOP BRANDING RAIL --- */}
            <div className="h-14 bg-[#080808]/90 border-b border-zinc-800/80 flex items-center justify-between px-6 z-20 shrink-0 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-technical font-black tracking-[0.05em] text-white italic leading-none">
                            GENESIS <span className="text-brand-cyan">OS v5.0.4</span>
                        </span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-[0.25em] uppercase mt-0.5">KARAPIRO CARTEL SYSTEMS</span>
                    </div>
                    
                    <div className="h-6 w-px bg-zinc-800 mx-2"></div>
                    
                    <div className="flex gap-2">
                        <StatusPill label="ECU" active={!hasActiveFault} color={hasActiveFault ? '#FF2A4D' : '#00FA9A'} />
                        <StatusPill label="GPS" active={gpsActive} />
                        <StatusPill label="RL" active={true} color="#a855f7" />
                    </div>
                </div>

                {/* Main View Mode Selector for Cockpit */}
                {activeTab === 'COCKPIT' && (
                    <div className="bg-[#111] p-1 rounded-lg border border-[#333] flex gap-1 z-30">
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setViewMode('dash')}
                            className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === 'dash' ? 'text-black font-black bg-brand-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Dash
                        </motion.button>
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setViewMode('trace')}
                            className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === 'trace' ? 'text-black font-black bg-brand-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Trace
                        </motion.button>
                    </div>
                )}
            </div>

            {/* --- TOP HIGH-FIDELITY RPM TAPE --- */}
            <RpmTape rpm={currentRpm} maxRpm={maxRpm} shiftLightRpm={shiftLightRpm} />

            {/* --- MAIN SPLIT CONTAINER: SIDEBAR NAVIGATION + VIEWPORT --- */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                
                {/* --- LEFT NAVIGATION RAIL (Genesis OS themed) --- */}
                <div className="w-48 bg-black/95 border-r border-zinc-900/80 p-3 flex flex-col gap-2 shrink-0 z-20">
                    <span className="text-[7px] text-zinc-600 font-mono tracking-[0.25em] uppercase px-3 mb-2 block leading-none">OS VIEWPORTS</span>
                    
                    {[
                        { id: 'COCKPIT', label: 'COCKPIT', color: 'border-l-brand-cyan text-brand-cyan' },
                        { id: 'RACE_PRO', label: 'RACE PRO', color: 'border-l-brand-yellow text-brand-yellow' },
                        { id: 'NEURAL_AI', label: 'NEURAL AI', color: 'border-l-purple-500 text-purple-400' },
                        { id: 'DYNO_LAB', label: 'DYNO LAB', color: 'border-l-orange-500 text-orange-400' },
                        { id: 'ECU_SCANNER', label: 'ECU SCANNER', color: 'border-l-brand-green text-brand-green' },
                        { id: 'MPC_PROP', label: 'MPC CONTROL', color: 'border-l-pink-500 text-pink-400' },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full text-left py-3 px-4 rounded-xl border border-transparent flex items-center transition-all ${
                                    isActive 
                                        ? `bg-zinc-900/80 border-zinc-800 border-l-4 ${tab.color} font-black` 
                                        : 'hover:bg-zinc-900/30 text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <span className="text-[10px] font-technical tracking-widest uppercase">{tab.label}</span>
                            </button>
                        );
                    })}

                    <div className="mt-auto p-3 bg-zinc-950/80 border border-zinc-900/60 rounded-xl text-center">
                        <span className="text-[7px] text-zinc-600 font-mono tracking-wider block">PRO TELEMETRY</span>
                        <span className="text-[10px] font-mono text-zinc-400 mt-1 block">ACTIVE_SESSION</span>
                    </div>
                </div>

                {/* --- CENTRAL WORKSPACE VIEWPORT --- */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-8 flex flex-col justify-start">
                    
                    {activeTab === 'COCKPIT' && (
                        <>
                            {viewMode === 'dash' && (
                                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px] lg:grid-cols-[260px_1fr_260px] min-h-full w-full gap-6 items-center justify-center animate-in fade-in duration-300">
                                    
                                    {/* Left Data Stack */}
                                    <div className="flex justify-center h-fit md:h-full overflow-y-visible no-scrollbar w-full shrink-0"
                                         onMouseEnter={() => setIsHoveringDrag(true)}
                                         onMouseLeave={() => setIsHoveringDrag(false)}>
                                        <Reorder.Group 
                                            axis={window.innerWidth >= 768 ? "y" : "x"} 
                                            values={leftWidgets} 
                                            onReorder={setLeftWidgets}
                                            className="flex flex-row md:flex-col gap-4 w-full"
                                        >
                                            {leftWidgets.map(id => (
                                                <Reorder.Item key={id} value={id} id={id} 
                                                              className={`min-w-[150px] lg:min-w-0 ${isHoveringDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                                              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}>
                                                    {WIDGET_REGISTRY[id]}
                                                </Reorder.Item>
                                            ))}
                                        </Reorder.Group>
                                    </div>

                                    {/* Center Tachometer */}
                                    <div className="h-full w-full flex items-center justify-center relative min-h-[300px] md:min-h-[450px]">
                                        <div className="absolute inset-0 blur-[120px] opacity-10 pointer-events-none rounded-full bg-brand-cyan"></div>
                                        <div className="w-full max-w-[450px] aspect-square flex items-center justify-center relative">
                                            <HaltechTachometer redline={shiftLightRpm} maxRpm={maxRpm} />
                                            <button 
                                                onClick={handleSetShiftLight}
                                                className="absolute inset-0 rounded-full opacity-0 cursor-pointer z-50 text-[0px]"
                                                aria-label="Set Shift Light"
                                            >
                                                Set Shift Light
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Data Stack */}
                                    <div className="flex justify-center h-fit md:h-full overflow-y-visible no-scrollbar w-full shrink-0"
                                         onMouseEnter={() => setIsHoveringDrag(true)}
                                         onMouseLeave={() => setIsHoveringDrag(false)}>
                                        <Reorder.Group 
                                            axis={window.innerWidth >= 768 ? "y" : "x"} 
                                            values={rightWidgets} 
                                            onReorder={setRightWidgets}
                                            className="flex flex-row md:flex-col gap-4 w-full"
                                        >
                                            {rightWidgets.map(id => (
                                                <Reorder.Item key={id} value={id} id={id} 
                                                              className={`min-w-[150px] lg:min-w-0 ${isHoveringDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                                              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}>
                                                    {WIDGET_REGISTRY[id]}
                                                </Reorder.Item>
                                            ))}
                                            <div className="mt-auto hidden lg:block shrink-0 w-full pointer-events-none">
                                                <LiveAICoach />
                                            </div>
                                        </Reorder.Group>
                                    </div>

                                </div>
                            )}

                            {viewMode === 'trace' && (
                                <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300">
                                    <div className="flex-1 bg-black/40 border border-zinc-850 rounded-2xl p-4 relative shadow-2xl overflow-hidden min-h-[350px]">
                                        <div className="absolute top-0 left-0 w-full h-10 bg-zinc-950/80 border-b border-zinc-800/60 flex items-center px-4 z-10">
                                            <span className="text-[9px] font-technical font-black uppercase tracking-[0.25em] text-brand-cyan">Live Telemetry Trace</span>
                                        </div>
                                        <div className="pt-8 w-full h-full">
                                            <LiveTelemetryGraph />
                                        </div>
                                    </div>
                                    <ConnectedHaltechTraceStats />
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'RACE_PRO' && (
                        <div className="animate-in fade-in duration-300 w-full">
                            <DragTree />
                        </div>
                    )}

                    {activeTab === 'NEURAL_AI' && (
                        <div className="animate-in fade-in duration-300 w-full">
                            <KnockDial />
                        </div>
                    )}

                    {activeTab === 'DYNO_LAB' && (
                        <div className="animate-in fade-in duration-300 w-full">
                            <DynoLab />
                        </div>
                    )}

                    {activeTab === 'ECU_SCANNER' && (
                        <div className="animate-in fade-in duration-300 w-full">
                            <EcuScanner />
                        </div>
                    )}

                    {activeTab === 'MPC_PROP' && (
                        <div className="animate-in fade-in duration-300 w-full">
                            <MpcEngine />
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
};

export default HaltechDashboard;
