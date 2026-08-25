import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Activity, Cpu, Gauge, Thermometer, Database, Zap, Sparkles, AlertTriangle, 
    CheckCircle2, Flame, RefreshCw, Layers, TrendingUp, Grid, TrendingDown, Play, Square,
    Wrench, Info, ZapOff, Anchor, Compass
} from 'lucide-react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { MathEngineService } from '../../services/MathEngineService';
import LiveTelemetryGraph from '../../components/dashboard/LiveTelemetryGraph';
import IndicatorPanel from '../../components/IndicatorPanel';

// Dynamic Math Equation type
interface CosworthMathChannel {
    id: string;
    name: string;
    equationString: string;
    description: string;
    unit: string;
    color: string;
    baseValue: number;
}

export const MotecCosworthDashboard: React.FC = () => {
    // Collect vehicle parameters
    const latestData = useVehicleStore(state => state.latestData);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    const hasActiveFault = useVehicleStore(state => state.hasActiveFault);
    const dtcs = useVehicleStore(state => state.dtcs || []);

    // MoTeC i2 Diagnostics Views
    const [viewMode, setViewMode] = useState<'realtime' | 'analysis' | 'calibrator'>('realtime');
    const [selectedChannel, setSelectedChannel] = useState<string>('slip_ratio');

    // Dynamic Math Channel Custom Formulas for Cosworth engine
    const [mathChannels, setMathChannels] = useState<CosworthMathChannel[]>([
        {
            id: 'slip_ratio',
            name: 'Dynamic Slip Ratio Coeff',
            equationString: '((wheelSpeedFL - wheelSpeedRL) / (wheelSpeedRL + 1.0)) * 100',
            description: 'Calculates active tire slip percentage between front and rear axles.',
            unit: '%',
            color: '#FF003C',
            baseValue: 0
        },
        {
            id: 'tractive_force',
            name: 'Estimated Tractive Force',
            equationString: '((rpm * turboBoost) / (speed + 1.2)) * 1.5',
            description: 'Derives instantaneous tractive force effort at the tires.',
            unit: 'kN',
            color: '#00F0FF',
            baseValue: 0
        },
        {
            id: 'thermal_load',
            name: 'Thermal Load Quotient',
            equationString: '(engineTemp * (maf + 1.5)) / 100',
            description: 'Calculates real-time engine cylinder thermal expansion stress and airflow load correlation.',
            unit: 'TLQ',
            color: '#FCEE0A',
            baseValue: 0
        },
        {
            id: 'aero_downforce',
            name: 'Aerodynamic Drag Index',
            equationString: 'speed * speed * 0.0035',
            description: 'Approximates aerodynamic loading and ground cohesion as a factor of road speed.',
            unit: 'kgf',
            color: '#BC13FE',
            baseValue: 0
        }
    ]);

    // Active custom formula editor state
    const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
    const [tempFormula, setTempFormula] = useState('');
    const [formulaError, setFormulaError] = useState<string | null>(null);

    // AI calibration advisor text
    const [aiAdvisorMsg, setAiAdvisorMsg] = useState<string>("Initializing Cosworth Neural calibration link... Ready to monitor live CAN telemetry parameters.");
    const [isThinking, setIsThinking] = useState(false);

    // Manual mechanical parameter overrides
    const [alsSeverity, setAlsSeverity] = useState(4); // 0-10
    const [wmiRatio, setWmiRatio] = useState(15);      // % water methanol injection ratio
    const [ignTrims, setIgnTrims] = useState(0);       // timing adjustment

    // Local state variables for plotting
    const mathEngine = useMemo(() => MathEngineService.getInstance(), []);
    const [xyScatterPoints, setXyScatterPoints] = useState<{x: number, y: number}[]>([]);

    // Run active evaluations for custom MoTeC mathematical channels
    const evaluatedChannels = useMemo(() => {
        return mathChannels.map(channel => {
            let result = 0;
            try {
                // Incorporate fallback values for dynamic fields
                const dataPoint = {
                    ...latestData,
                    wheelSpeedFL: latestData.wheelSpeedFL || latestData.speed * 1.02,
                    wheelSpeedRL: latestData.wheelSpeedRL || latestData.speed * 0.98,
                    wheelSpeedFR: latestData.wheelSpeedFR || latestData.speed * 1.01,
                    wheelSpeedRR: latestData.wheelSpeedRR || latestData.speed * 0.99,
                    maf: latestData.maf || 12.4,
                    rpm: latestData.rpm || 1000,
                    turboBoost: latestData.turboBoost || 0,
                    speed: latestData.speed || 0,
                    engineTemp: latestData.engineTemp || 85
                };
                result = mathEngine.evaluate(channel.equationString, dataPoint);
            } catch (err) {
                result = 0;
            }
            return {
                ...channel,
                currentValue: isNaN(result) || !isFinite(result) ? 0 : result
            };
        });
    }, [latestData, mathChannels, mathEngine]);

    // Generate scatter plot points in real-time to mimic MoTeC i2 scatter analysis
    useEffect(() => {
        const xVal = latestData.rpm || 2000;
        const currentChannel = evaluatedChannels.find(c => c.id === selectedChannel);
        const yVal = currentChannel ? currentChannel.currentValue : latestData.turboBoost || 0;

        setXyScatterPoints(prev => {
            const updated = [...prev, { x: xVal, y: yVal }];
            return updated.slice(-40); // Keep last 40 points
        });
    }, [latestData.rpm, selectedChannel, evaluatedChannels]);

    // Fast response AI calibration engineer updates
    const queryAiAdvisor = async () => {
        setIsThinking(true);
        try {
            const { getSystemAnalysis } = await import('../../services/geminiService');
            const dataDump = {
                currentData: latestData,
                mathEvaluation: evaluatedChannels.map(c => ({ id: c.id, value: c.currentValue.toFixed(4) })),
                alsLevel: alsSeverity,
                wmiRatio: wmiRatio,
                ignitionTrim: ignTrims,
            };

            const systemContext = `You are the chief MoTeC & Cosworth chassis design calibrator. Provide a succinct 2-sentence mechanical and physics insight based on the current vehicle telemetry, specifically evaluating the mathematical channels: ${evaluatedChannels.map(c => `${c.name}: ${c.currentValue.toFixed(2)}${c.unit}`).join(', ')}. Offer precise engineering advice.`;
            
            // Call Gemini service helper
            const report = await getSystemAnalysis(
                { vin: 'COSWORTH_SIGMA_V2', protocol: 'UDS_CAN_STN2120' },
                dtcs,
                latestData,
                ekfStats,
                JSON.stringify(dataDump)
            );
            
            setAiAdvisorMsg(report || "Nominal state vector verified. Math engine operating within precision delta limit.");
        } catch (err) {
            setAiAdvisorMsg("AI Advisory Service offline. Neural link fallback active. Check secondary CAN bus impedance.");
        } finally {
            setIsThinking(false);
        }
    };

    // Auto update AI Advisor on mode change or custom overrides
    useEffect(() => {
        const timeout = setTimeout(() => {
            queryAiAdvisor();
        }, 1500);
        return () => clearTimeout(timeout);
    }, [alsSeverity, wmiRatio, ignTrims, selectedChannel]);

    // Handle editing custom formulas
    const handleStartEditing = (ch: CosworthMathChannel) => {
        setEditingChannelId(ch.id);
        setTempFormula(ch.equationString);
        setFormulaError(null);
    };

    const handleSaveFormula = () => {
        if (!tempFormula.trim()) {
            setFormulaError("Formula cannot be blank");
            return;
        }
        
        // Verify evaluation safety using dummy data
        try {
            const dummyPoint = {
                rpm: 2000,
                speed: 60,
                turboBoost: 1.2,
                wheelSpeedFL: 61,
                wheelSpeedRL: 59,
                engineTemp: 90,
                maf: 15
            };
            const testResult = mathEngine.evaluate(tempFormula, dummyPoint as any);
            if (isNaN(testResult)) {
                setFormulaError("Operation evaluation returned NaN");
                return;
            }
        } catch (e: any) {
            setFormulaError(`Syntax Error: ${e?.message || 'Invalid formula'}`);
            return;
        }

        // Successfully updated
        setMathChannels(prev => prev.map(ch => {
            if (ch.id === editingChannelId) {
                return { ...ch, equationString: tempFormula };
            }
            return ch;
        }));
        setEditingChannelId(null);
        setFormulaError(null);
    };

    return (
        <div className="w-full h-full bg-[#030303] flex flex-col font-mono text-gray-200 overflow-hidden relative" id="motec-root">
            {/* Holographic matrix grids */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-5"
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                     backgroundSize: '25px 25px',
                     backgroundPosition: 'center'
                 }}>
            </div>

            {/* Shift Indicators */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 scale-75 lg:scale-100 origin-top">
                <IndicatorPanel />
            </div>

            {/* --- TOP HIGH-DEFINITION MOTEC NAVIGATION RAIL --- */}
            <header className="h-16 shrink-0 bg-[#090909]/90 border-b border-white/[0.08] backdrop-blur-xl flex items-center justify-between px-6 z-20 relative select-none">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-10 h-10 bg-black border border-[#FF003C] flex items-center justify-center rounded-lg shadow-[0_0_15px_rgba(255,0,60,0.25)]">
                            <span className="text-[#FF003C] font-black italic text-lg tracking-tighter">M</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-white italic tracking-tighter leading-none uppercase">
                                MoTeC // COSWORTH
                            </h2>
                            <span className="text-[8px] bg-[#FF003C] text-white px-1.5 py-0.5 font-bold rounded uppercase tracking-widest">
                                i2 ELITE
                            </span>
                        </div>
                        <span className="text-[8px] text-zinc-500 uppercase tracking-[0.4em] block mt-0.5 leading-none">
                            Proprietary Vehicle Dynamics Matrix
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Workspace Selector Tabs */}
                    <div className="bg-black border border-white/10 p-1 rounded-lg flex gap-1 text-[9px] font-bold uppercase tracking-widest">
                        <button 
                            onClick={() => setViewMode('realtime')}
                            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${viewMode === 'realtime' ? 'bg-[#FF003C] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            Live Matrix
                        </button>
                        <button 
                            onClick={() => setViewMode('analysis')}
                            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${viewMode === 'analysis' ? 'bg-[#FF003C] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            i2 Diagnostics
                        </button>
                        <button 
                            onClick={() => setViewMode('calibrator')}
                            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${viewMode === 'calibrator' ? 'bg-[#FF003C] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            AI Overrides
                        </button>
                    </div>
                </div>
            </header>

            {/* --- CORE WORKSPACE VIEWPORT --- */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 gap-6 grid grid-cols-12 relative z-10">

                {/* LEFT RAIL: Interactive Mathematical Equations Engine */}
                <div className="col-span-12 xl:col-span-4 flex flex-col gap-5 h-full min-h-0">
                    <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-5 flex flex-col flex-1 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF003C]/5 rounded-full blur-[40px] pointer-events-none"></div>
                        
                        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-[#FF003C]" />
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Cosworth Mathematics Engine</h3>
                            </div>
                            <span className="text-[8px] font-mono font-bold bg-[#FF003C]/10 text-[#FF003C] border border-[#FF003C]/20 px-2 py-0.5 rounded uppercase">
                                Real-time Calc
                            </span>
                        </div>

                        <p className="text-[10px] text-zinc-500 mb-4 leading-normal uppercase">
                            Continuous algorithmic projection evaluating fused physical vectors. Inject, compile, or override complex telemetry channels dynamically.
                        </p>

                        {/* Equation Blocks */}
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1 select-none no-scrollbar">
                            {evaluatedChannels.map(ch => {
                                const isEditing = editingChannelId === ch.id;
                                return (
                                    <div 
                                        key={ch.id}
                                        className={`p-3.5 rounded-lg border transition-all ${
                                            selectedChannel === ch.id 
                                                ? 'bg-[#111111] border-[#FF003C]/40 shadow-[0_4px_15px_rgba(255,0,0,0.05)]' 
                                                : 'bg-black/40 border-white/[0.05] hover:border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div onClick={() => setSelectedChannel(ch.id)} className="cursor-pointer">
                                                <div className="text-[10px] font-bold text-zinc-300 hover:text-white uppercase tracking-wider flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ch.color }}></span>
                                                    {ch.name}
                                                </div>
                                                <p className="text-[9px] text-zinc-500 mt-1 lowercase font-mono pr-2 line-clamp-1">
                                                    {ch.description}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => handleStartEditing(ch)}
                                                className="text-[9px] font-black uppercase text-zinc-500 hover:text-[#FF003C] border border-white/5 hover:border-[#FF003C]/30 px-1.5 py-0.5 rounded transition-all"
                                            >
                                                Edit
                                            </button>
                                        </div>

                                        {isEditing ? (
                                            <div className="mt-2.5 p-2 bg-black border border-white/10 rounded space-y-2">
                                                <input 
                                                    type="text"
                                                    value={tempFormula}
                                                    onChange={(e) => setTempFormula(e.target.value)}
                                                    className="w-full bg-black/60 border border-white/10 text-xs font-mono text-[#00F0FF] px-2 py-1 focus:outline-none focus:border-[#FF003C]"
                                                />
                                                {formulaError && (
                                                    <p className="text-[8px] text-[#FF003C] uppercase tracking-wider">{formulaError}</p>
                                                )}
                                                <div className="flex items-center gap-2 pt-0.5">
                                                    <button 
                                                        onClick={handleSaveFormula}
                                                        className="px-2 py-1 bg-[#FF003C] text-white text-[9px] font-bold uppercase rounded hover:bg-[#d00030]"
                                                    >
                                                        Compile
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingChannelId(null)}
                                                        className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[9px] font-bold uppercase rounded hover:bg-zinc-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/[0.04]">
                                                <div className="text-[9px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                                                    <code className="text-[#FF003C]/70">{ch.equationString}</code>
                                                </div>
                                                <div className="text-right leading-none">
                                                    <span className="text-lg font-black tracking-tight" style={{ color: ch.color }}>
                                                        {ch.currentValue.toFixed(2)}
                                                    </span>
                                                    <span className="text-[8px] font-mono text-zinc-500 uppercase ml-1">{ch.unit}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* MIDDLE & RIGHT VIEWPORTS */}
                <div className="col-span-12 xl:col-span-8 flex flex-col gap-5 h-full min-h-0">
                    
                    {/* Dynamic View Selector Content */}
                    <AnimatePresence mode="wait">
                        
                        {/* VIEW_1: Real-time MoTeC Canvas / Live Telemetry Matrix */}
                        {viewMode === 'realtime' && (
                            <motion.div 
                                key="realtime"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col gap-5 h-full"
                            >
                                {/* Grid Widget Blocks */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'E-Engine Speed', val: latestData.rpm || 0, unt: 'RPM', color: '#00F0FF', icon: <Cpu className="w-3.5 h-3.5" /> },
                                        { label: 'Boost Pressure', val: (latestData.turboBoost || 0).toFixed(2), unt: 'BAR', color: '#FF003C', icon: <Gauge className="w-3.5 h-3.5" /> },
                                        { label: 'Fuel Injection Pulse', val: (latestData.injectorPulseWidth || 2.4).toFixed(1), unt: 'MS', color: '#FCEE0A', icon: <Thermometer className="w-3.5 h-3.5" /> },
                                        { label: 'Sensory O2 Lambda', val: (latestData.lambda || 1.0).toFixed(2), unt: 'LAMBDA', color: '#BC13FE', icon: <Zap className="w-3.5 h-3.5" /> }
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group select-none">
                                            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: stat.color }}></div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                                                <span className="text-zinc-600 group-hover:text-white transition-colors">
                                                    {stat.icon}
                                                </span>
                                            </div>
                                            <div className="flex items-end gap-1">
                                                <span className="text-xl font-black tracking-tight" style={{ color: stat.color }}>
                                                    {stat.val}
                                                </span>
                                                <span className="text-[8px] font-mono text-zinc-500 uppercase font-bold mb-1">{stat.unt}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Custom Large MoTeC Real-time Stream Graph */}
                                <div className="bg-[#0a0a0a] border border-white/[0.08] p-5 rounded-xl flex-1 flex flex-col min-h-[380px] shadow-2xl relative">
                                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4 select-none">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-emerald-400" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">Cosworth High-Frequency Telemetry Stream</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10B981]"></div>
                                            <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-widest">100Hz Direct Feed</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-[320px]">
                                        <LiveTelemetryGraph />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* VIEW_2: MoTeC i2 Diagnostics Analysis Space (Scatter plots + Correlations) */}
                        {viewMode === 'analysis' && (
                            <motion.div 
                                key="analysis"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-[#0a0a0a] border border-white/[0.08] p-5 rounded-xl flex-1 flex flex-col min-h-[400px] shadow-2xl relative"
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF003C]/5 rounded-full blur-[60px] pointer-events-none"></div>

                                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-5 select-none">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-[#FF003C]" />
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">MoTeC i2 Scatter Correlation Plot</h3>
                                            <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Aero Cohesion & Dynamic Slip Phase Vector Analysis</span>
                                        </div>
                                    </div>

                                    {/* Channel select dropdown */}
                                    <select 
                                        value={selectedChannel}
                                        onChange={(e) => setSelectedChannel(e.target.value)}
                                        className="bg-black border border-white/10 text-xs font-bold text-zinc-300 font-mono py-1 px-2.5 uppercase focus:outline-none focus:border-[#FF003C] rounded cursor-pointer"
                                    >
                                        {mathChannels.map(ch => (
                                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <p className="text-[10px] text-zinc-500 mb-6 leading-normal uppercase">
                                    CORRELATION FIELD: Mapping live <b className="text-zinc-300">Engine Speed (RPM)</b> on the X-Axis against the derived variable <b className="text-zinc-300">{mathChannels.find(c => c.id === selectedChannel)?.name}</b> on the Y-Axis to locate dynamic chassis traction anomalies.
                                </p>

                                {/* High-Fidelity Scatter / Phase Map Canvas */}
                                <div className="flex-1 bg-black/60 border border-white/5 rounded-xl p-5 relative overflow-hidden min-h-[300px]">
                                    {/* Grid markers */}
                                    <div className="absolute inset-0 z-0 opacity-15 flex flex-col justify-between p-4 pointer-events-none select-none">
                                        <div className="border-b border-dashed border-zinc-600 w-full h-[1px]"></div>
                                        <div className="border-b border-dashed border-zinc-600 w-full h-[1px]"></div>
                                        <div className="border-b border-dashed border-zinc-600 w-full h-[1px]"></div>
                                        <div className="border-b border-dashed border-zinc-600 w-full h-[1px]"></div>
                                    </div>
                                    <div className="absolute inset-0 z-0 opacity-15 flex justify-between p-4 pointer-events-none select-none">
                                        <div className="border-r border-dashed border-zinc-600 h-full w-[1px]"></div>
                                        <div className="border-r border-dashed border-zinc-600 h-full w-[1px]"></div>
                                        <div className="border-r border-dashed border-zinc-600 h-full w-[1px]"></div>
                                        <div className="border-r border-dashed border-zinc-600 h-full w-[1px]"></div>
                                    </div>

                                    {/* Axis indicator */}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-bold text-[8px] text-[#FF003C]/60 tracking-widest uppercase">
                                        Engine Shaft RPM (x-axis)
                                    </div>
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-[8px] text-[#FF003C]/60 tracking-widest uppercase origin-left [transform:rotate(-90deg)translate(-50%,-50%)] whitespace-nowrap">
                                        Evaluated Vector (y-axis)
                                    </div>

                                    {/* Actual plot points */}
                                    <div className="absolute inset-6 z-10">
                                        {xyScatterPoints.map((pt, index) => {
                                            // Scale points to viewport
                                            const minX = 600, maxX = 8000;
                                            const currentCh = mathChannels.find(c => c.id === selectedChannel);
                                            const channelMax = currentCh?.id === 'slip_ratio' ? 80 : currentCh?.id === 'tractive_force' ? 5 : currentCh?.id === 'thermal_load' ? 200 : 80;
                                            const minY = 0, maxY = channelMax || 100;

                                            // Linear conversion
                                            const pctX = ((pt.x - minX) / (maxX - minX)) * 100;
                                            const pctY = ((pt.y - minY) / (maxY - minY)) * 100;

                                            const color = currentCh?.color || '#FF003C';

                                            return (
                                                <motion.div 
                                                    key={index}
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="absolute w-2 h-2 rounded-full cursor-pointer shadow-[0_0_8px_currentColor]"
                                                    style={{ 
                                                        left: `${Math.max(0, Math.min(100, pctX))}%`, 
                                                        bottom: `${Math.max(0, Math.min(100, pctY))}%`,
                                                        backgroundColor: color,
                                                        color: color,
                                                        opacity: (index / xyScatterPoints.length) * 0.9 + 0.1 
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* No points fallback */}
                                    {xyScatterPoints.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs font-black uppercase tracking-widest">
                                            Awaiting Sensor Shaft Spin...
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* VIEW_3: AI Neural Engine Calibrator Overrides */}
                        {viewMode === 'calibrator' && (
                            <motion.div 
                                key="calibrator"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col gap-5 h-full"
                            >
                                {/* Mechanical parameter controls */}
                                <div className="bg-[#0a0a0a] border border-white/[0.08] p-5 rounded-xl shadow-2xl relative">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[40px] pointer-events-none"></div>

                                    <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 mb-5">
                                        <Cpu className="w-4 h-4 text-[#FF003C]" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Mechanical Actuator Calibrations</h3>
                                    </div>

                                    <div className="space-y-6">
                                        {/* ALS severity slider */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">ALS Severity (Ignition Cut Duration)</span>
                                                </div>
                                                <span className="text-xs font-bold text-orange-400 font-mono">{alsSeverity} / 10 Sec</span>
                                            </div>
                                            <input 
                                                type="range"
                                                min="0"
                                                max="10"
                                                step="1"
                                                value={alsSeverity}
                                                onChange={(e) => setAlsSeverity(parseInt(e.target.value))}
                                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FF003C]"
                                            />
                                        </div>

                                        {/* WMI ratio slider */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Zap className="w-3.5 h-3.5 text-[#00F0FF]" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">WMI Flow Target Ratio</span>
                                                </div>
                                                <span className="text-xs font-bold text-[#00F0FF] font-mono">{wmiRatio} Vol%</span>
                                            </div>
                                            <input 
                                                type="range"
                                                min="0"
                                                max="30"
                                                step="1"
                                                value={wmiRatio}
                                                onChange={(e) => setWmiRatio(parseInt(e.target.value))}
                                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                                            />
                                        </div>

                                        {/* Timing slider */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <RefreshCw className="w-3.5 h-3.5 text-[#33FF33]" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ignition Timing Correction Offset</span>
                                                </div>
                                                <span className={`text-xs font-bold font-mono ${ignTrims > 0 ? 'text-[#33FF33]' : ignTrims < 0 ? 'text-[#FF003C]' : 'text-zinc-500'}`}>
                                                    {ignTrims > 0 ? `+${ignTrims}` : ignTrims} Deg
                                                </span>
                                            </div>
                                            <input 
                                                type="range"
                                                min="-10"
                                                max="10"
                                                step="0.5"
                                                value={ignTrims}
                                                onChange={(e) => setIgnTrims(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#33FF33]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* AI CO-CALIBRATION CONSOLE (ALWAYS VISIBLE BELOW VIEWS) */}
                    <div className="bg-[#0c0c0c] border border-white/[0.08] p-5 rounded-xl shadow-2xl relative flex flex-col justify-between gap-4">
                        <div className="absolute top-0 left-0 w-[4px] h-full bg-[#BC13FE]"></div>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#BC13FE]" />
                                <div>
                                    <h4 className="text-xs font-mono font-black text-zinc-200 uppercase tracking-widest leading-none">Cosworth Neural Calibrator</h4>
                                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1 block">Domain-Specific Generative ECU Audit</span>
                                </div>
                            </div>

                            <button 
                                onClick={queryAiAdvisor}
                                disabled={isThinking}
                                className="px-3 py-1.5 bg-[#BC13FE]/15 border border-[#BC13FE]/30 hover:bg-[#BC13FE] hover:text-black hover:font-bold text-[#BC13FE] font-bold text-[9px] uppercase tracking-widest rounded transition-all flex items-center gap-1.5"
                            >
                                {isThinking ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3 h-3" />
                                )}
                                Refresh Advice
                            </button>
                        </div>

                        <div className="bg-black/60 border border-white/5 p-4 rounded-lg font-mono text-xs leading-relaxed text-[#BC13FE] whitespace-pre-wrap uppercase tracking-wide">
                            {isThinking ? (
                                <span className="animate-pulse flex items-center gap-2 text-zinc-500">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    [ENGINEERING UPLINK SYNCING CORRELATION MODELS...]
                                </span>
                            ) : (
                                aiAdvisorMsg
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fused telemetry metadata footer */}
            <footer className="fixed bottom-12 lg:bottom-0 left-0 right-0 h-8 shrink-0 bg-[#090909] border-t border-white/[0.05] flex items-center px-6 justify-between z-40 select-none">
                <div className="flex items-center gap-6 text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-[#FF003C] rounded-full animate-ping"></span>
                        Calibrator State: Secured
                    </span>
                    <span className="hidden md:inline">Telemetry Bridge: ISO-TP UDS CAN</span>
                    <span>Uncertainty score: {ekfStats.fusionUncertainty.toFixed(4)} σ</span>
                </div>
                <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest italic leading-none">
                    © COSWORTH MOTORSPORT ENGINE INTERFACE V2.5
                </div>
            </footer>
        </div>
    );
};

export default MotecCosworthDashboard;
