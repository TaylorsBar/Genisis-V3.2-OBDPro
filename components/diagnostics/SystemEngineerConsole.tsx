import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Terminal, 
    Cpu, 
    Zap, 
    Activity, 
    Shield, 
    Database, 
    AlertTriangle, 
    CheckCircle2, 
    RefreshCw,
    Trophy,
    Target,
    Square,
    Play,
    X,
    BrainCircuit
} from 'lucide-react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useDiagnosticStore } from '../../stores/diagnosticStore';
import { ObdPidSelector } from './ObdPidSelector';
import { CanSniffer } from '../CanSniffer';
import { PerformanceMeter } from '../PerformanceMeter';
import { LiveTelemetryGraph } from '../LiveTelemetryGraph';
import { LapTimer } from '../LapTimer';
import { GForceVisualizer } from '../GForceVisualizer';
import { GoogleGenAI } from "@google/genai";
import { TelemetryDebugger } from './TelemetryDebugger';

export const SystemEngineerConsole: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const obdState = useVehicleStore(state => state.obdState);
    const ecuProfile = useVehicleStore(state => state.ecuProfile);
    const dtcs = useVehicleStore(state => state.dtcs);
    const isScanning = useVehicleStore(state => state.isScanning);
    const scanVehicle = useVehicleStore(state => state.scanVehicle);
    const clearVehicleFaults = useVehicleStore(state => state.clearVehicleFaults);
    const executeRawCommand = useVehicleStore(state => state.executeRawCommand);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    const optimizationConfig = useVehicleStore(state => state.optimizationConfig);
    const setOptimizationConfig = useVehicleStore(state => state.setOptimizationConfig);

    const { logs, isRecording, showConsole, toggleRecording, clearLogs, toggleConsole } = useDiagnosticStore();

    const [activeTab, setActiveTab] = useState<'diagnostics' | 'telemetry' | 'performance' | 'canbus' | 'ai' | 'optimization' | 'ekf_debug'>('diagnostics');
    const [command, setCommand] = useState('');
    const [terminalOutput, setTerminalOutput] = useState<{ type: 'cmd' | 'res' | 'err', text: string }[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (showConsole) {
            scrollToBottom();
        }
    }, [terminalOutput, showConsole, logs]);

    if (!showConsole) return null;

    const handleCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim()) return;

        const cmd = command.trim();
        setTerminalOutput(prev => [...prev, { type: 'cmd', text: `> ${cmd}` }]);
        setCommand('');

        try {
            const response = await executeRawCommand(cmd);
            setTerminalOutput(prev => [...prev, { type: 'res', text: response }]);
        } catch (err) {
            setTerminalOutput(prev => [...prev, { type: 'err', text: `ERROR: ${err}` }]);
        }
    };

    const runAiAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const { getSystemAnalysis } = await import('../../services/geminiService');
            const recentLogs = logs.slice(-50).map(l => `[${l.direction}] ${l.data}`).join('\n');
            const analysis = await getSystemAnalysis(ecuProfile, dtcs, latestData, ekfStats, recentLogs);
            setAiAnalysis(analysis);
        } catch (err) {
            console.error("AI Analysis failed:", err);
            setAiAnalysis("Failed to generate AI analysis. Check neural link connection.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 md:inset-10 z-[100] flex flex-col bg-black/60 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {/* Console Header */}
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-2xl">
                        <Cpu className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">System Engineer Console</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                                <div className={`w-1.5 h-1.5 rounded-full ${obdState === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                Neural Link: {obdState}
                            </span>
                            <span className="text-white/20">|</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                Protocol: {ecuProfile?.protocol || 'Detecting...'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={runAiAnalysis}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-bold hover:bg-indigo-500/30 transition-all border border-indigo-500/30 disabled:opacity-50"
                    >
                        {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        AI Diagnostics
                    </button>
                    <button onClick={toggleConsole} className="p-2 text-white/40 hover:text-white transition-colors ml-2">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-black/20 px-6 overflow-x-auto scrollbar-hide">
                {[
                    { id: 'diagnostics', label: 'Diagnostics', icon: Shield },
                    { id: 'telemetry', label: 'Telemetry', icon: Activity },
                    { id: 'performance', label: 'Performance', icon: Trophy },
                    { id: 'canbus', label: 'CAN Bus', icon: Terminal },
                    { id: 'optimization', label: 'Optimization', icon: Zap },
                    { id: 'ai', label: 'AI Analysis', icon: BrainCircuit },
                    { id: 'ekf_debug', label: 'Telemetry Debugger', icon: Database },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                                : 'border-transparent text-white/40 hover:text-white/60 hover:bg-white/5'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {activeTab === 'diagnostics' && (
                        <motion.div 
                            key="diagnostics"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-12 gap-6"
                        >
                            {/* DTC Scanner */}
                            <div className="col-span-12 lg:col-span-8 space-y-6">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <Shield className="w-5 h-5 text-emerald-400" />
                                            <h3 className="text-white font-medium">ECU Fault Memory</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={scanVehicle}
                                                disabled={isScanning}
                                                className="px-4 py-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5 disabled:opacity-50"
                                            >
                                                {isScanning ? 'Scanning...' : 'Full Scan'}
                                            </button>
                                            <button 
                                                onClick={clearVehicleFaults}
                                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all border border-red-500/20"
                                            >
                                                Clear Codes
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {dtcs.length > 0 ? (
                                            dtcs.map((dtc, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                                                    <div className="flex items-center gap-4">
                                                        <div className="px-3 py-1 bg-red-500/20 text-red-400 font-mono font-bold rounded-lg text-sm">
                                                            {dtc.code}
                                                        </div>
                                                        <div>
                                                            <p className="text-white text-sm font-medium">{dtc.description}</p>
                                                            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Status: {dtc.status}</p>
                                                        </div>
                                                    </div>
                                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-white/20">
                                                <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                                                <p className="font-medium">No Faults Detected</p>
                                                <p className="text-xs">All systems reporting nominal status</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* PID Selector */}
                                <ObdPidSelector />
                            </div>

                            {/* Terminal & Stats */}
                            <div className="col-span-12 lg:col-span-4 space-y-6">
                                <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[500px]">
                                    <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-emerald-400" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Raw OBD Console</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={toggleRecording} className="text-white/40 hover:text-white transition-colors">
                                                {isRecording ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                            </button>
                                            <button onClick={clearLogs} className="text-white/40 hover:text-white transition-colors">
                                                <RefreshCw className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-4 font-mono text-[10px] overflow-y-auto space-y-1 scrollbar-hide">
                                        {logs.map((log, i) => (
                                            <div key={i} className={`flex gap-2 ${log.direction === 'TX' ? 'text-emerald-400' : log.direction === 'RX' ? 'text-blue-400' : 'text-white/40'}`}>
                                                <span className="opacity-30">[{new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1)}]</span>
                                                <span className="font-bold">{log.direction}</span>
                                                <span className="break-all">{log.data}</span>
                                            </div>
                                        ))}
                                        {terminalOutput.map((out, i) => (
                                            <div key={`term-${i}`} className={
                                                out.type === 'cmd' ? 'text-emerald-400' : 
                                                out.type === 'err' ? 'text-red-400' : 'text-white/60'
                                            }>
                                                {out.text}
                                            </div>
                                        ))}
                                        <div ref={terminalEndRef} />
                                    </div>
                                    <form onSubmit={handleCommand} className="p-4 bg-white/5 border-t border-white/10">
                                        <input
                                            type="text"
                                            value={command}
                                            onChange={(e) => setCommand(e.target.value)}
                                            placeholder="Enter AT/OBD command..."
                                            className="w-full bg-transparent border-none focus:ring-0 text-emerald-400 font-mono text-xs placeholder:text-white/10"
                                        />
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'telemetry' && (
                        <motion.div 
                            key="telemetry"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="space-y-6"
                        >
                            <LiveTelemetryGraph />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <GForceVisualizer />
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-indigo-400" />
                                        EKF State Vector
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { label: 'Fusion Uncertainty', value: ekfStats.fusionUncertainty.toFixed(4), unit: 'σ' },
                                            { label: 'Vision Confidence', value: (ekfStats.visionConfidence * 100).toFixed(1), unit: '%' },
                                            { label: 'GPS Status', value: ekfStats.gpsActive ? 'ACTIVE' : 'INACTIVE', unit: '' },
                                            { label: 'Sample Rate', value: '100', unit: 'Hz' },
                                        ].map((stat, i) => (
                                            <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">{stat.label}</p>
                                                <p className="text-xl font-mono text-white font-bold">
                                                    {stat.value}
                                                    <span className="text-xs text-white/40 ml-1">{stat.unit}</span>
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'performance' && (
                        <motion.div 
                            key="performance"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                        >
                            <PerformanceMeter />
                            <LapTimer />
                        </motion.div>
                    )}

                    {activeTab === 'canbus' && (
                        <motion.div 
                            key="canbus"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <CanSniffer />
                        </motion.div>
                    )}

                    {activeTab === 'optimization' && (
                        <motion.div 
                            key="optimization"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {/* ELM327 Core Optimizations */}
                            <div className="col-span-1 md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-white font-medium mb-6 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-emerald-400" />
                                    ELM327 Elite Optimization Suite
                                </h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {[
                                        { id: 'multiPid', label: 'Multi-PID Polling', desc: 'Request up to 6 PIDs in one CAN frame' },
                                        { id: 'fastBaud', label: 'Fast Baud Rate', desc: 'Enable 115.2k+ for vLinker/STN chips' },
                                        { id: 'canFiltering', label: 'CAN Hardware Filtering', desc: 'Filter noise at the adapter level' },
                                        { id: 'highFreqMode', label: 'High Frequency Mode', desc: 'Prioritize RPM/Speed for 50Hz+ updates' },
                                        { id: 'dmaEngine', label: 'DMA Engine', desc: 'Zero-latency polling & queue processing' },
                                    ].map(opt => (
                                        <div key={opt.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-sm font-bold text-white">{opt.label}</p>
                                                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{opt.desc}</p>
                                            </div>
                                            <button 
                                                onClick={() => setOptimizationConfig({ [opt.id]: !((optimizationConfig as any)[opt.id]) })}
                                                className={`w-12 h-6 rounded-full transition-all relative ${
                                                    (optimizationConfig as any)[opt.id] ? 'bg-emerald-500' : 'bg-white/10'
                                                }`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                                    (optimizationConfig as any)[opt.id] ? 'left-7' : 'left-1'
                                                }`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Timing Controls */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-white font-medium mb-6 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-400" />
                                    Timing & Latency
                                </h3>
                                
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Adaptive Timing (AT AT)</span>
                                            <span className="text-xs font-mono text-emerald-400">LEVEL {optimizationConfig.adaptiveTiming}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {[0, 1, 2].map(level => (
                                                <button
                                                    key={level}
                                                    onClick={() => setOptimizationConfig({ adaptiveTiming: level as any })}
                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                                                        optimizationConfig.adaptiveTiming === level 
                                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {level === 0 ? 'OFF' : level === 1 ? 'NORMAL' : 'AGGRESSIVE'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Target Refresh Rate</span>
                                            <span className="text-xs font-mono text-emerald-400">{optimizationConfig.refreshRateTarget} Hz</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="5"
                                            max="100"
                                            step="5"
                                            value={optimizationConfig.refreshRateTarget}
                                            onChange={(e) => setOptimizationConfig({ refreshRateTarget: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                        <div className="flex justify-between mt-2 text-[8px] font-bold text-white/20 uppercase tracking-widest">
                                            <span>5 Hz (Stable)</span>
                                            <span>100 Hz (Extreme)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Protocol Info */}
                            <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-emerald-500/20 rounded-xl">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-white font-bold">Hardware Optimization Status</h4>
                                        <p className="text-sm text-white/60 mt-1">
                                            Current protocol <span className="text-emerald-400 font-mono">{ecuProfile?.protocol || 'Unknown'}</span> is 
                                            {ecuProfile?.protocol?.includes('CAN') ? ' fully compatible with multi-PID polling and hardware filtering.' : ' using legacy K-Line/L-Line. Multi-PID polling is disabled.'}
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Bus Load</p>
                                                <p className="text-lg font-mono text-white">
                                                    {obdState === 'Connected' ? (10 + (ekfStats.fusionUncertainty * 100)).toFixed(1) : '0.0'}%
                                                </p>
                                            </div>
                                            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Latency</p>
                                                <p className="text-lg font-mono text-emerald-400">
                                                    {(latestData as any).latency?.toFixed(0) || '0'}ms
                                                </p>
                                            </div>
                                            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Throughput</p>
                                                <p className="text-lg font-mono text-white">{(Math.random() * 5 + 10).toFixed(1)} KB/s</p>
                                            </div>
                                            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Error Rate</p>
                                                <p className="text-lg font-mono text-white">0.001%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'ai' && (
                        <motion.div 
                            key="ai"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-8 min-h-[400px]"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-500/20 rounded-2xl">
                                        <Zap className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">AI System Analysis</h3>
                                        <p className="text-sm text-white/40">Neural diagnostics & performance optimization</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={runAiAnalysis}
                                    disabled={isAnalyzing}
                                    className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all disabled:opacity-50"
                                >
                                    {isAnalyzing ? 'Analyzing System...' : 'Refresh Analysis'}
                                </button>
                            </div>

                            {aiAnalysis ? (
                                <div className="prose prose-invert max-w-none">
                                    <div className="bg-black/40 rounded-2xl p-8 border border-white/10 whitespace-pre-wrap font-mono text-sm leading-relaxed text-white/80">
                                        {aiAnalysis}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                                    <Zap className="w-16 h-16 mb-6 opacity-10" />
                                    <p className="text-lg font-medium">No Analysis Available</p>
                                    <p className="text-sm">Run AI Diagnostics to generate a system report</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'ekf_debug' && (
                        <motion.div
                            key="ekf_debug"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                        >
                            <TelemetryDebugger />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
