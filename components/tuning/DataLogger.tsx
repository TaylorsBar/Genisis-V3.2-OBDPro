
import React, { useState, useMemo } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { LogSession, LoggingConfig, SensorDataPoint } from '../../types';
import { 
    Activity, 
    Save, 
    Trash2, 
    Download, 
    Settings, 
    Check, 
    X, 
    FileJson, 
    FileSpreadsheet, 
    Clock, 
    Gauge, 
    Search, 
    Filter,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Share2,
    Database,
    Cpu,
    Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AVAILABLE_CHANNELS: { id: keyof SensorDataPoint; name: string; unit: string; category: string }[] = [
    { id: 'rpm', name: 'Engine RPM', unit: 'RPM', category: 'Engine' },
    { id: 'turboBoost', name: 'Manifold Pressure', unit: 'Bar', category: 'Engine' },
    { id: 'engineLoad', name: 'Engine Load', unit: '%', category: 'Engine' },
    { id: 'throttlePos', name: 'Throttle Position', unit: '%', category: 'Engine' },
    { id: 'speed', name: 'Vehicle Speed', unit: 'km/h', category: 'Performance' },
    { id: 'lambda', name: 'Lambda (AFR)', unit: 'λ', category: 'Fuel' },
    { id: 'engineTemp', name: 'Coolant Temp', unit: '°C', category: 'Engine' },
    { id: 'inletAirTemp', name: 'Intake Air Temp', unit: '°C', category: 'Engine' },
    { id: 'timingAdvance', name: 'Ignition Timing', unit: '°', category: 'Engine' },
    { id: 'fuelPressure', name: 'Fuel Pressure', unit: 'kPa', category: 'Fuel' },
    { id: 'oilPressure', name: 'Oil Pressure', unit: 'kPa', category: 'Engine' },
    { id: 'batteryVoltage', name: 'System Voltage', unit: 'V', category: 'Electrical' },
    { id: 'knockLevel', name: 'Knock Intensity', unit: '%', category: 'Safety' },
    { id: 'gForceX', name: 'Longitudinal G', unit: 'G', category: 'Performance' },
    { id: 'gForceY', name: 'Lateral G', unit: 'G', category: 'Performance' },
    { id: 'maf', name: 'Mass Air Flow', unit: 'g/s', category: 'Engine' },
    { id: 'shortTermFuelTrim', name: 'STFT', unit: '%', category: 'Fuel' },
    { id: 'longTermFuelTrim', name: 'LTFT', unit: '%', category: 'Fuel' },
];

const CATEGORIES = Array.from(new Set(AVAILABLE_CHANNELS.map(c => c.category)));

const DataLogger: React.FC = () => {
    const isLogging = useVehicleStore(state => state.isLogging);
    const startLogging = useVehicleStore(state => state.startLogging);
    const stopLogging = useVehicleStore(state => state.stopLogging);
    const currentLog = useVehicleStore(state => state.currentLog);
    const savedLogs = useVehicleStore(state => state.savedLogs);
    const deleteLog = useVehicleStore(state => state.deleteLog);
    const renameLog = useVehicleStore(state => state.renameLog);
    const loggingConfig = useVehicleStore(state => state.loggingConfig);
    const setLoggingConfig = useVehicleStore(state => state.setLoggingConfig);
    const canMappings = useVehicleStore(state => state.canMappings);

    // Dynamically include custom CAN mappings in available channels
    const channels = useMemo(() => {
        const customChannels = canMappings.map(m => ({
            id: m.name as keyof SensorDataPoint, // Overriding as keyof but it's in customPids
            name: m.name,
            unit: m.unit,
            category: 'CAN Custom'
        }));
        return [...AVAILABLE_CHANNELS, ...customChannels];
    }, [canMappings]);

    const CATEGORIES = useMemo(() => Array.from(new Set(channels.map(c => c.category))), [channels]);

    const [currentSessionName, setCurrentSessionName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [activeTab, setActiveTab] = useState<'library' | 'monitor' | 'settings'>('library');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);
    const [insightReport, setInsightReport] = useState<{id: string, text: string} | null>(null);

    const filteredChannels = useMemo(() => {
        return channels.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(c.id).toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = !categoryFilter || c.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, categoryFilter, channels]);

    const handleAnalyzeLog = (log: LogSession) => {
        setAnalyzingLogId(log.id);
        setInsightReport(null);
        
        setTimeout(() => {
            // Simulated AI heuristic analysis over the logged data structure
            let notes = [];
            if (log.stats.maxRpm > 7500) notes.push("Extreme RPM band utilized. Valve float risk within limits.");
            if (log.stats.maxSpeed > 200) notes.push("High aero-load regions logged. Ensure downforce settings are adequate.");
            if (log.dataPoints.some(d => (d.knockLevel ?? 0) > 15)) {
                notes.push("CRITICAL: Knock events detected exceeding 15%. Retard ignition globally by 2 degrees immediately.");
            } else {
                notes.push("Combustion stability optimal. No significant knock signatures detected.");
            }
            if (log.dataPoints.some(d => (d.inletAirTemp ?? 0) > 60)) {
                notes.push("WARNING: IATs peaked above 60°C. Intercooler heat-soak likely.");
            }
            
            setInsightReport({
                id: log.id,
                text: notes.join(' ') + " DeepArchitect™ AI recommends fine-tuning VE map cells intersecting 4500-6000 RPM at WOT for smoother transient response."
            });
            setAnalyzingLogId(null);
        }, 3000);
    };

    const handleStart = () => {
        setCurrentSessionName(`Session_${new Date().getHours()}${new Date().getMinutes()}_${savedLogs.length + 1}`);
        startLogging();
    };

    const handleStop = () => {
        stopLogging(currentSessionName);
    };

    const handleDownload = (log: LogSession, formatOverride?: 'CSV' | 'JSON') => {
        const format = formatOverride || log.config?.format || loggingConfig.format;
        let content: string;
        let mimeType: string;
        let extension: string;

        if (format === 'JSON') {
            const exportPayload = {
                ...log,
                source: log.source || 'simulated_fallback'
            };
            content = JSON.stringify(exportPayload, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        } else {
            // CSV
            const fields = log.config?.selectedFields || loggingConfig.selectedFields;
            const metaHeader = `# Data Source: ${log.source || 'simulated_fallback'}\n# Log Name: ${log.name}\n# Timestamp: ${new Date(log.startTime).toISOString()}\n`;
            const headers = ['Time_ms', ...fields].join(',');
            const rows = log.dataPoints.map(d => {
                return [d.time, ...fields.map((f: string) => (d as any)[f]?.toFixed(3) || '0.000')].join(',');
            }).join('\n');
            content = metaHeader + headers + '\n' + rows;
            mimeType = 'text/csv';
            extension = 'csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${log.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const toggleChannel = (channelId: string) => {
        const isSelected = loggingConfig.selectedFields.includes(channelId);
        let newFields: string[];
        if (isSelected) {
            newFields = loggingConfig.selectedFields.filter((f: string) => f !== channelId);
        } else {
            newFields = [...loggingConfig.selectedFields, channelId];
        }
        setLoggingConfig({ selectedFields: newFields });
    };

    const formatDuration = (ms: number) => {
        const sec = Math.floor(ms / 1000);
        const min = Math.floor(sec / 60);
        const h = Math.floor(min / 60);
        if (h > 0) return `${h}h ${min % 60}m`;
        return `${min}:${(sec % 60).toString().padStart(2, '0')}`;
    };

    const startEditing = (log: LogSession) => {
        setEditingId(log.id);
        setEditName(log.name);
    };

    const saveEdit = () => {
        if (editingId && editName.trim()) {
            renameLog(editingId, editName);
        }
        setEditingId(null);
    };

    return (
        <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-4 lg:p-6 bg-[#050505] text-gray-200 overflow-hidden font-mono">
            {/* LEFT PANEL: LOGGER ENGINE */}
            <div className="lg:w-[400px] flex flex-col gap-6 shrink-0 relative z-10">
                {/* Main Session Control */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-cyan to-brand-red opacity-10 blur-xl group-hover:opacity-20 transition duration-1000"></div>
                    <div className="relative bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 overflow-hidden shadow-2xl flex flex-col items-center">
                        {/* Status Header */}
                        <div className="w-full flex justify-between items-center mb-10">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isLogging ? 'bg-brand-red animate-pulse' : 'bg-gray-700'}`}></div>
                                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isLogging ? 'text-brand-red' : 'text-gray-500'}`}>
                                    {isLogging ? 'Stream Active' : 'Standby'}
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-600 font-bold tracking-tighter">
                                UNIT_ID: NX-724
                            </div>
                        </div>

                        {/* Large Trigger Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={isLogging ? handleStop : handleStart}
                            className={`
                                relative w-56 h-56 rounded-full border-4 flex items-center justify-center transition-all duration-500
                                ${isLogging 
                                    ? 'bg-red-950/20 border-brand-red shadow-[0_0_80px_rgba(255,0,60,0.3)]' 
                                    : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-[#151515] shadow-inner'
                                }
                            `}
                        >
                            <AnimatePresence>
                                {isLogging && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 0.15, scale: 1.2 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className="absolute inset-0 rounded-full border-[10px] border-brand-red"
                                    />
                                )}
                            </AnimatePresence>

                            <div className="flex flex-col items-center gap-1 z-20">
                                {isLogging ? (
                                    <Trash2 className="w-8 h-8 text-brand-red mb-2 opacity-50" />
                                ) : (
                                    <Activity className="w-10 h-10 text-gray-500 mb-2" />
                                )}
                                <span className={`text-4xl font-display font-black italic tracking-tighter ${isLogging ? 'text-white' : 'text-gray-400'}`}>
                                    {isLogging ? 'END' : 'START'}
                                </span>
                                {isLogging && (
                                    <motion.span 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-xs text-brand-red font-bold"
                                    >
                                        {(currentLog.length / loggingConfig.frequency).toFixed(1)}s
                                    </motion.span>
                                )}
                            </div>
                        </motion.button>

                        {/* Real-time Session Meta */}
                        <div className="mt-10 w-full grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <span className="text-[8px] text-gray-500 uppercase block mb-1">Frequency</span>
                                <span className="text-lg font-black text-brand-cyan">{loggingConfig.frequency}Hz</span>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <span className="text-[8px] text-gray-500 uppercase block mb-1">Queue Size</span>
                                <span className="text-lg font-black text-white">{currentLog.length} <span className="text-[10px] text-gray-600 font-normal">PTS</span></span>
                            </div>
                        </div>

                        {isLogging && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full mt-6"
                            >
                                <input 
                                    type="text" 
                                    value={currentSessionName}
                                    onChange={(e) => setCurrentSessionName(e.target.value)}
                                    placeholder="Enter Session Label..."
                                    className="w-full bg-black/40 border border-brand-red/30 rounded-lg px-4 py-3 text-center text-sm text-white focus:outline-none focus:border-brand-red transition-all"
                                />
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Subsystem Health Indicator */}
                <div className="bg-[#0d0d0d] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20">
                            <Database className="w-5 h-5 text-brand-cyan" />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase">Flash Storage</h4>
                            <div className="w-32 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                                <div className="w-[15%] h-full bg-brand-cyan"></div>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-500 block">THROUGHPUT</span>
                        <span className="text-xs font-black text-white">4.2 <span className="text-gray-600">MB/s</span></span>
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: LIBRARY & SETTINGS */}
            <div className="flex-1 bg-[#0d0d0d] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
                {/* Custom Tab Header */}
                <div className="flex items-center justify-between p-2 border-b border-white/5 bg-black/40">
                    <div className="flex gap-1">
                        <button 
                            onClick={() => setActiveTab('library')}
                            className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Save className="w-3 h-3" />
                            Library
                        </button>
                        <button 
                            onClick={() => setActiveTab('monitor')}
                            className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${activeTab === 'monitor' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Gauge className="w-3 h-3" />
                            Monitor
                        </button>
                        <button 
                            onClick={() => setActiveTab('settings')}
                            className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Settings className="w-3 h-3" />
                            Config
                        </button>
                    </div>
                    <div className="px-4 text-[9px] font-bold text-brand-cyan truncate opacity-60">
                        {savedLogs.length} SESSIONS REGISTERED
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {/* TAB CONTENT: LIBRARY */}
                    {activeTab === 'library' && (
                        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {savedLogs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-700">
                                        <RefreshCw className="w-12 h-12 mb-4 animate-spin-slow opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest opacity-30">Archive Empty</p>
                                    </div>
                                ) : (
                                    savedLogs.map(log => (
                                        <motion.div 
                                            key={log.id}
                                            layout
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="group relative bg-[#111] hover:bg-[#151515] border border-white/5 hover:border-white/10 rounded-xl transition-all overflow-hidden"
                                        >
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-cyan opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            
                                            <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        {editingId === log.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="text" 
                                                                    value={editName}
                                                                    onChange={(e) => setEditName(e.target.value)}
                                                                    autoFocus
                                                                    className="bg-black/60 border border-brand-cyan/50 text-white text-xs px-2 py-1 rounded"
                                                                />
                                                                <button onClick={saveEdit} className="text-green-500"><Check className="w-4 h-4" /></button>
                                                                <button onClick={() => setEditingId(null)} className="text-red-500"><X className="w-4 h-4" /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 max-w-full">
                                                                <h4 className="text-sm font-black text-white truncate italic">{log.name}</h4>
                                                                {log.source === 'live_capture' ? (
                                                                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black tracking-widest uppercase rounded">
                                                                        ● LIVE CAPTURE
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px] font-black tracking-widest uppercase rounded">
                                                                        ▲ SIMULATED FALLBACK
                                                                    </span>
                                                                )}
                                                                <button onClick={() => startEditing(log)} className="p-1 opacity-0 group-hover:opacity-100 hover:text-brand-cyan transition-all">
                                                                    <RefreshCw className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <span className="text-[9px] font-bold text-gray-600 uppercase ml-auto shrink-0">
                                                            {new Date(log.startTime).toLocaleDateString()} @ {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] text-gray-500 uppercase">Duration</span>
                                                            <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                                                <Clock className="w-2.5 h-2.5 text-brand-cyan" /> {formatDuration(log.duration)}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] text-gray-500 uppercase">Points</span>
                                                            <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                                                <Activity className="w-2.5 h-2.5 text-brand-purple" /> {log.dataPoints.length}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] text-gray-500 uppercase">Peak RPM</span>
                                                            <span className="text-[11px] font-bold text-brand-red flex items-center gap-1">
                                                                <Zap className="w-2.5 h-2.5" /> {log.stats.maxRpm.toFixed(0)}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] text-gray-500 uppercase">Format</span>
                                                            <span className="text-[11px] font-bold text-brand-cyan uppercase">
                                                                {log.config?.format || 'CSV'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {analyzingLogId === log.id && (
                                                        <div className="mt-4 p-4 border border-brand-cyan/20 bg-brand-cyan/5 rounded-lg flex flex-col items-center justify-center">
                                                            <RefreshCw className="w-6 h-6 text-brand-cyan mb-2 animate-spin-slow opacity-50" />
                                                            <span className="text-[9px] font-black text-brand-cyan uppercase tracking-[0.2em] animate-pulse">DeepArchitect Scanning Telemetry...</span>
                                                        </div>
                                                    )}

                                                    {insightReport?.id === log.id && (
                                                        <div className="mt-4 p-4 border border-brand-purple/30 bg-[#0d0d0d] rounded-lg relative overflow-hidden">
                                                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-purple via-brand-cyan to-brand-purple opacity-50"></div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Cpu className="w-4 h-4 text-brand-purple" />
                                                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Post-Run Diagnostics</h5>
                                                            </div>
                                                            <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                                                                {insightReport.text}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4">
                                                    <button 
                                                        onClick={() => handleAnalyzeLog(log)}
                                                        className="h-10 px-4 bg-brand-purple/10 hover:bg-brand-purple hover:text-white text-brand-purple text-[10px] font-black uppercase tracking-widest rounded-lg border border-brand-purple/20 transition-all flex items-center gap-2"
                                                        disabled={analyzingLogId === log.id}
                                                    >
                                                        <Zap className="w-3 h-3" />
                                                        Analyze
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDownload(log)}
                                                        className="h-10 px-4 bg-brand-cyan/10 hover:bg-brand-cyan hover:text-black text-brand-cyan text-[10px] font-black uppercase tracking-widest rounded-lg border border-brand-cyan/20 transition-all flex items-center gap-2"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        Export
                                                    </button>
                                                    <div className="relative group/dl">
                                                        <button className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all">
                                                            <Share2 className="w-4 h-4 text-gray-400" />
                                                        </button>
                                                        <div className="absolute bottom-full right-0 mb-2 invisible group-hover/dl:visible bg-black border border-white/10 rounded-xl p-1 shadow-2xl z-50">
                                                            <button onClick={() => handleDownload(log, 'JSON')} className="whitespace-nowrap px-4 py-2 text-[9px] font-bold text-white hover:bg-white/5 rounded-lg block text-right w-full">JSON FORMAT</button>
                                                            <button onClick={() => handleDownload(log, 'CSV')} className="whitespace-nowrap px-4 py-2 text-[9px] font-bold text-white hover:bg-white/5 rounded-lg block text-right w-full">CSV SPREADSHEET</button>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => deleteLog(log.id)}
                                                        className="h-10 w-10 bg-red-950/20 rounded-lg flex items-center justify-center hover:bg-brand-red hover:text-white group transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-brand-red group-hover:text-white" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: MONITOR */}
                    {activeTab === 'monitor' && (
                        <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto no-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {loggingConfig.selectedFields.length === 0 ? (
                                    <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl">
                                        <Filter className="w-12 h-12 text-gray-700 mb-4" />
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No Channels Selected for Monitor</p>
                                        <button 
                                            onClick={() => setActiveTab('settings')}
                                            className="mt-4 text-[10px] text-brand-cyan hover:underline uppercase font-black"
                                        >
                                            Go to Config
                                        </button>
                                    </div>
                                ) : (
                                    loggingConfig.selectedFields.map(fieldId => {
                                        const channel = channels.find(c => c.id === fieldId);
                                        const latestData = useVehicleStore.getState().latestData;
                                        // Retrieve value from main data or customPids
                                        let value = (latestData as any)[fieldId];
                                        if (value === undefined && latestData.customPids) {
                                            value = latestData.customPids[fieldId];
                                        }
                                        
                                        return (
                                            <div key={fieldId} className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all flex flex-col justify-between group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{channel?.category || 'SENS'}</span>
                                                        <h4 className="text-[11px] font-black text-white uppercase italic group-hover:text-brand-cyan transition-colors">{channel?.name || fieldId}</h4>
                                                    </div>
                                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center">
                                                        <Activity className="w-3 h-3 text-brand-cyan opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-3xl font-black text-white tracking-tighter">
                                                        {typeof value === 'number' ? value.toFixed(2) : (value || '---')}
                                                    </span>
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">{channel?.unit || ''}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SETTINGS */}
                    {activeTab === 'settings' && (
                        <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-left-4 duration-500 overflow-y-auto no-scrollbar">
                            <div className="space-y-10">
                                {/* Global Engine Config */}
                                <section>
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="w-1 h-4 bg-brand-cyan"></div>
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Capture_Core</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-4">Export Protocol</h4>
                                            <div className="flex gap-2">
                                                {['CSV', 'JSON'].map((fmt) => (
                                                    <button 
                                                        key={fmt}
                                                        onClick={() => setLoggingConfig({ format: fmt as any })}
                                                        className={`flex-1 py-4 px-4 rounded-lg flex flex-col items-center gap-2 transition-all border ${loggingConfig.format === fmt ? 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}
                                                    >
                                                        {fmt === 'CSV' ? <FileSpreadsheet className="w-5 h-5" /> : <FileJson className="w-5 h-5" />}
                                                        <span className="text-[10px] font-black">{fmt}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-4">Frequency Response</h4>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-bold text-gray-400">SAMPLE RATE</span>
                                                    <span className="text-xl font-black text-brand-cyan">{loggingConfig.frequency} <span className="text-[10px] text-gray-600">Hz</span></span>
                                                </div>
                                                <input 
                                                    type="range"
                                                    min="1"
                                                    max="100"
                                                    step="1"
                                                    value={loggingConfig.frequency}
                                                    onChange={(e) => setLoggingConfig({ frequency: parseInt(e.target.value) })}
                                                    className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                                                />
                                                <div className="flex justify-between text-[8px] text-gray-700 font-black">
                                                    <span>DIAGNOSTIC (1Hz)</span>
                                                    <span>DYNAMIC (100Hz)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Channel Matrix */}
                                <section className="pb-10">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-4 bg-brand-purple"></div>
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Channel_Matrix</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                                                <input 
                                                    type="text" 
                                                    placeholder="LENS SEARCH..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    className="bg-black/60 border border-white/5 rounded-full pl-8 pr-4 py-2 text-[9px] w-48 focus:outline-none focus:border-brand-purple transition-all"
                                                />
                                            </div>
                                            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                                                <button 
                                                    onClick={() => setCategoryFilter(null)}
                                                    className={`px-3 py-1.5 rounded-full text-[8px] font-bold uppercase transition-all shrink-0 ${!categoryFilter ? 'bg-brand-purple text-white' : 'bg-white/5 text-gray-500'}`}
                                                >
                                                    ALL
                                                </button>
                                                {CATEGORIES.map(cat => (
                                                    <button 
                                                        key={cat}
                                                        onClick={() => setCategoryFilter(cat)}
                                                        className={`px-3 py-1.5 rounded-full text-[8px] font-bold uppercase transition-all shrink-0 ${categoryFilter === cat ? 'bg-brand-purple text-white' : 'bg-white/5 text-gray-500'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {filteredChannels.map(ch => {
                                            const active = loggingConfig.selectedFields.includes(ch.id);
                                            return (
                                                <button
                                                    key={ch.id}
                                                    onClick={() => toggleChannel(ch.id)}
                                                    className={`
                                                        p-4 rounded-xl border border-dashed transition-all flex flex-col items-start gap-2 relative group-toggle
                                                        ${active 
                                                            ? 'bg-brand-purple/10 border-brand-purple/40 text-white' 
                                                            : 'bg-black/40 border-white/5 text-gray-600 hover:border-white/20'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex justify-between w-full items-start">
                                                        <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-brand-purple' : 'text-gray-700'}`}>
                                                            {ch.category}
                                                        </span>
                                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${active ? 'bg-brand-purple border-brand-purple' : 'border-white/10'}`}>
                                                            {active && <Check className="w-2 h-2 text-white" />}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-start mt-1">
                                                        <span className="text-[11px] font-black italic truncate max-w-full uppercase">{ch.name}</span>
                                                        <span className="text-[9px] font-bold opacity-50 uppercase">{ch.unit}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    <div className="mt-8 p-6 bg-brand-cyan/5 border border-brand-cyan/20 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20">
                                                <Cpu className="w-6 h-6 text-brand-cyan" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-white uppercase italic">Neural Optimization Active</h4>
                                                <p className="text-[10px] text-gray-500 uppercase leading-snug max-w-md">DMA Engine is balancing bandwidth across {loggingConfig.selectedFields.length} active pipelines. Predictive latency correction enabled.</p>
                                            </div>
                                        </div>
                                        <div className="bg-black/60 px-4 py-2 rounded-lg border border-white/5">
                                            <span className="text-[9px] text-gray-600 font-black block">PAYLOAD_SIZE</span>
                                            <span className="text-sm font-black text-white">{(loggingConfig.selectedFields.length * 4 * loggingConfig.frequency / 1024).toFixed(2)} KB/s</span>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Ambient Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(0,240,255,0.05)_0%,_transparent_50%)] pointer-events-none z-0"></div>
        </div>
    );
};

export default DataLogger;
