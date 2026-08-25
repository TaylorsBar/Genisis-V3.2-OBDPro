import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Play, Square, Download, Trash2, Filter, Search, Activity, Settings, HelpCircle, ArrowRightLeft, Sparkles } from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';
import { CanSnifferOnboarding } from './CanSnifferOnboarding';
import { CanMappingManager } from './CanMappingManager';
import { AgenticCanMapper } from './AgenticCanMapper';

interface CanFrame {
    id: string;
    data: string[];
    timestamp: number;
    count: number;
    delta: number;
    isChanged: boolean;
}

export const CanSniffer: React.FC = () => {
    const [isSniffing, setIsSniffing] = useState(false);
    const [frames, setFrames] = useState<Record<string, CanFrame>>({});
    const [filter, setFilter] = useState('');
    const [paused, setPaused] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [activeTab, setActiveTab ] = useState<'sniffer' | 'mappings' | 'ai-discovery'>('sniffer');
    const [preselectedFrameId, setPreselectedFrameId] = useState<string | null>(null);
    const snifferRef = useRef<NodeJS.Timeout | null>(null);
    const obdState = useVehicleStore(state => state.obdState);
    const startCanSniffing = useVehicleStore(state => state.startCanSniffing);
    const stopCanSniffing = useVehicleStore(state => state.stopCanSniffing);
    const canMappings = useVehicleStore(state => state.canMappings);

    const handleInspectWithAI = (id: string) => {
        setPreselectedFrameId(id);
        setActiveTab('ai-discovery');
    };

    const startSniffing = () => {
        setIsSniffing(true);
        if (obdState === 'Connected') {
            startCanSniffing((frame) => {
                if (paused) return;
                // Parse frame (e.g. "7E8 08 01 02 03 04 05 06 07 08")
                const parts = frame.split(' ');
                if (parts.length < 2) return;
                const id = parts[0];
                const newData = parts.slice(1); // might include length byte, just take rest
                
                setFrames(prev => {
                    const existing = prev[id];
                    const now = performance.now();
                    const isChanged = existing ? existing.data.join('') !== newData.join('') : true;
                    
                    return {
                        ...prev,
                        [id]: {
                            id,
                            data: newData,
                            timestamp: now,
                            count: (existing?.count || 0) + 1,
                            delta: existing ? now - existing.timestamp : 0,
                            isChanged
                        }
                    };
                });
            });
        } else {
            // Simulation fallback
            snifferRef.current = setInterval(() => {
                if (paused) return;

                const mockIds = ['0x1A0', '0x2B0', '0x3C0', '0x4D0', '0x5E0', '0x6F0', '0x7A1'];
                const id = mockIds[Math.floor(Math.random() * mockIds.length)];
                const newData = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase());

                setFrames(prev => {
                    const existing = prev[id];
                    const now = performance.now();
                    const isChanged = existing ? existing.data.join('') !== newData.join('') : true;
                    
                    return {
                        ...prev,
                        [id]: {
                            id,
                            data: newData,
                            timestamp: now,
                            count: (existing?.count || 0) + 1,
                            delta: existing ? now - existing.timestamp : 0,
                            isChanged
                        }
                    };
                });
            }, 50);
        }
    };

    const stopSniffing = () => {
        setIsSniffing(false);
        if (obdState === 'Connected') {
            stopCanSniffing();
        }
        if (snifferRef.current) clearInterval(snifferRef.current);
    };

    const clearFrames = () => setFrames({});

    const filteredFrames = Object.values(frames)
        .filter(f => f.id.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => a.id.localeCompare(b.id));

    useEffect(() => {
        return () => { if (snifferRef.current) clearInterval(snifferRef.current); };
    }, []);

    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[600px] relative">
            {showOnboarding && (
                <CanSnifferOnboarding 
                    onComplete={() => setShowOnboarding(false)} 
                    onClose={() => setShowOnboarding(false)} 
                />
            )}
            
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Activity className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">CAN Bus Sniffer</h3>
                        <p className="text-xs text-white/40">Real-time frame analysis & reverse engineering</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setActiveTab('sniffer')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'sniffer' ? 'bg-brand-cyan text-black' : 'text-white/40 hover:text-white'}`}
                    >
                        LIVE SNIFFER
                    </button>
                    <button 
                        onClick={() => setActiveTab('mappings')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'mappings' ? 'bg-brand-cyan text-black' : 'text-white/40 hover:text-white'}`}
                    >
                        SENSOR MAPS
                    </button>
                    <button 
                        onClick={() => setActiveTab('ai-discovery')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'ai-discovery' ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-400 border border-emerald-500/30' : 'text-white/40 hover:text-emerald-400'}`}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        AI COPILOT
                    </button>
                    <div className="h-4 w-[1px] bg-white/10 mx-1" />
                    <button
                        onClick={() => setShowOnboarding(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-xl text-sm font-medium transition-all"
                    >
                        <HelpCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Protocol Wizard</span>
                    </button>
                    {activeTab === 'sniffer' && (
                        <>
                            <button
                                onClick={isSniffing ? stopSniffing : startSniffing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                                    isSniffing 
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                }`}
                            >
                                {isSniffing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                {isSniffing ? 'Stop' : 'Start'}
                            </button>
                            <button 
                                onClick={() => setPaused(!paused)}
                                className={`p-2 rounded-xl transition-all ${paused ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                <Square className="w-5 h-5" />
                            </button>
                            <button onClick={clearFrames} className="p-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl transition-all">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'sniffer' ? (
                <>
                    {/* Toolbar */}
                    <div className="p-3 border-b border-white/10 flex gap-3 bg-black/20">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                placeholder="Filter by ID (e.g. 0x1A0)..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl text-sm transition-all border border-white/5">
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Export Trace</span>
                        </button>
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider border-b border-white/5">
                        <div className="col-span-2">ID</div>
                        <div className="col-span-6">Data (Hex)</div>
                        <div className="col-span-1 text-right">Count</div>
                        <div className="col-span-2 text-right">Delta (ms)</div>
                        <div className="col-span-1"></div>
                    </div>

                    {/* Frame List */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <div className="divide-y divide-white/5">
                            {filteredFrames.map((frame) => {
                                const hasMapping = canMappings.some(m => m.canId === frame.id.replace('0x', ''));
                                return (
                                    <motion.div
                                        key={frame.id}
                                        initial={false}
                                        animate={{ backgroundColor: frame.isChanged ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}
                                        transition={{ duration: 0.3 }}
                                        className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="col-span-2 flex items-center gap-2">
                                            <div className="font-mono text-emerald-400 font-bold">{frame.id}</div>
                                            {hasMapping && (
                                                <div className="w-2 h-2 rounded-full bg-brand-cyan shadow-[0_0_8px_#00F0FF]" />
                                            )}
                                        </div>
                                        <div className="col-span-6 flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                                            {frame.data.map((byte, i) => (
                                                <span 
                                                    key={i} 
                                                    className={`font-mono text-xs sm:text-sm ${frame.isChanged ? 'text-white' : 'text-white/60'}`}
                                                >
                                                    {byte}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="col-span-1 text-right font-mono text-[10px] sm:text-xs text-white/40">{frame.count}</div>
                                        <div className="col-span-2 text-right font-mono text-[10px] sm:text-xs text-white/40">{frame.delta.toFixed(1)}</div>
                                        <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                title="Reverse Engineer with AI"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleInspectWithAI(frame.id);
                                                }}
                                                className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                            {filteredFrames.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-white/20">
                                    <Terminal className="w-12 h-12 mb-4 opacity-20" />
                                    <p>No CAN traffic detected</p>
                                    <p className="text-xs">Start sniffing to see live bus data</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : activeTab === 'mappings' ? (
                <div className="flex-1 overflow-hidden p-6">
                    <CanMappingManager />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <AgenticCanMapper 
                        frames={frames} 
                        preselectedFrameId={preselectedFrameId} 
                        onNavigateToSniffer={() => setActiveTab('sniffer')} 
                    />
                </div>
            )}

            {/* Footer Status */}
            <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isSniffing ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
                        Status: {isSniffing ? 'Active' : 'Idle'}
                    </span>
                    <span>Total IDs: {Object.keys(frames).length}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>Bus Load: {isSniffing ? '12.4%' : '0%'}</span>
                    <span>Baud: 500kbps</span>
                </div>
            </div>
        </div>
    );
};
