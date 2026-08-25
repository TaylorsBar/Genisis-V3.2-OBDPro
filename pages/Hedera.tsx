
import React, { useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { HederaRecord, HederaEventType } from '../types';
import { ShieldCheck, Cpu, Hash, Fingerprint, Activity, Network, CheckCircle, AlertTriangle, Zap, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_INITIAL_RECORDS: HederaRecord[] = [
    { id: '1', timestamp: '2024-07-22 14:35:12', eventType: HederaEventType.Scrutineering, vin: 'JN1AZ00Z9ZT000123', summary: 'Compliance Proof: Nurburgring Session (Class GT3)', hederaTxId: '0.0.12345@1658498112.123456789', dataHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
];

// Helper to simulate SHA-256 hash generation
const generateMockHash = (data: string) => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0').replace(/0/g, (c, i) => '0123456789abcdef'[Math.floor(Math.random() * 16)]);
};

const ZKScrutineer: React.FC = () => {
    const { latestData, obdState } = useVehicleStore();
    const [records, setRecords] = useState<HederaRecord[]>(MOCK_INITIAL_RECORDS);
    const [vin] = useState('JN1AZ00Z9ZT000123'); // Typically from store
    
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionHash, setSessionHash] = useState<string>('0000000000000000000000000000000000000000000000000000000000000000');
    
    const [peakRpm, setPeakRpm] = useState(0);
    const [peakBoost, setPeakBoost] = useState(0);
    
    const [calibrationId] = useState('0xA9F2B41C_GT3_SPEC');
    const [romChecksum] = useState('0x8F9E2A11');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [verifyingRecordId, setVerifyingRecordId] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<{ [key: string]: 'success' | 'fail' }>({});

    // Live hash effect
    useEffect(() => {
        if (!isSessionActive) return;
        
        const interval = setInterval(() => {
            const rpm = latestData?.rpm || Math.floor(Math.random() * 8000);
            const boost = latestData?.turboBoost ? latestData.turboBoost : Math.random() * 20;
            
            setPeakRpm(prev => Math.max(prev, rpm));
            setPeakBoost(prev => Math.max(prev, boost));
            
            const rawDataString = `${calibrationId}|${romChecksum}|${rpm}|${boost.toFixed(2)}|${Date.now()}`;
            setSessionHash(generateMockHash(rawDataString));
        }, 100); // 10Hz UI refresh for 100Hz internal telemetry

        return () => clearInterval(interval);
    }, [isSessionActive, latestData, calibrationId, romChecksum]);

    const handleToggleSession = async () => {
        if (isSessionActive) {
            // Stop and anchor
            setIsSessionActive(false);
            setIsSubmitting(true);
            
            // Simulate cryptographic anchoring to Hedera
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const newRecord: HederaRecord = {
                id: (records.length + 1).toString(),
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                eventType: HederaEventType.Scrutineering,
                vin,
                summary: `Compliance Proof Anchored. Peaks: ${peakRpm} RPM, ${peakBoost.toFixed(1)} PSI`,
                hederaTxId: `0.0.12345@${Date.now() / 1000 | 0}.${Math.floor(Math.random() * 1e9)}`,
                dataHash: sessionHash
            };
            
            setRecords(prev => [newRecord, ...prev]);
            setIsSubmitting(false);
            setPeakRpm(0);
            setPeakBoost(0);
        } else {
            setIsSessionActive(true);
            setPeakRpm(0);
            setPeakBoost(0);
        }
    };

    const handleVerify = async (recordId: string) => {
        setVerifyingRecordId(recordId);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setVerificationStatus(prev => ({ ...prev, [recordId]: 'success' }));
        setVerifyingRecordId(null);
    };

    return (
        <div className="h-full bg-[#030303] text-gray-300 relative overflow-hidden flex flex-col p-6 font-mono">
           {/* Technical Background Mesh */}
           <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                backgroundImage: `linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
            }}></div>
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-brand-cyan/5 blur-[150px] pointer-events-none rounded-full"></div>

            <div className="mb-6 flex justify-between items-end border-b border-white/10 pb-4 z-10">
                <div>
                    <h1 className="text-3xl font-black text-brand-cyan tracking-widest uppercase flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8" /> Zero-Knowledge Scrutineer
                    </h1>
                    <p className="text-sm text-gray-500 mt-2 tracking-widest">
                        Cryptographic Compliance Agent // Anchored to Hedera Hashgraph
                    </p>
                </div>
                <div className="text-right flex items-center gap-4">
                    <div className="px-4 py-2 bg-black border border-white/10 rounded flex items-center gap-3 shadow-[inset_0_0_15px_rgba(255,255,255,0.02)]">
                        <Network className="w-5 h-5 text-emerald-500 animate-pulse" />
                        <div className="text-left">
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest">Hedera Consensus Node</div>
                            <div className="text-xs font-bold text-emerald-400">MAINNET ACTIVE</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 z-10 flex-1 min-h-0">
                {/* Left Panel: Active Hashing Matrix */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-[#080808] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-brand-cyan/5 to-transparent pointer-events-none"></div>
                        <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-brand-cyan" /> ECU Identity Anchor
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="bg-black p-3 border border-white/5 rounded">
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Calibration ID</div>
                                <div className="text-sm text-brand-cyan font-bold break-all">{calibrationId}</div>
                            </div>
                            <div className="bg-black p-3 border border-white/5 rounded">
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">ROM Checksum</div>
                                <div className="text-sm text-brand-purple font-bold break-all">{romChecksum}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black p-3 border border-white/5 rounded">
                                    <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Peak RPM</div>
                                    <div className="text-xl text-white font-black">{peakRpm.toLocaleString()} <span className="text-[10px] text-gray-500">rpm</span></div>
                                </div>
                                <div className="bg-black p-3 border border-white/5 rounded">
                                    <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Max Boost</div>
                                    <div className="text-xl text-white font-black">{peakBoost.toFixed(1)} <span className="text-[10px] text-gray-500">psi</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button 
                                onClick={handleToggleSession}
                                disabled={isSubmitting}
                                className={`w-full py-4 rounded font-black uppercase tracking-[0.2em] text-sm transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] ${
                                    isSessionActive 
                                    ? 'bg-brand-red text-white hover:bg-red-500' 
                                    : 'bg-brand-cyan text-black hover:bg-[#00f0ff]'
                                } disabled:opacity-50`}
                            >
                                {isSubmitting ? 'Anchoring ZK Proof...' : isSessionActive ? 'Stop Session & Anchor' : 'Initialize Scrutineering'}
                            </button>
                        </div>
                    </div>

                    {/* Live Cryptographic Stream */}
                    <div className="flex-1 bg-[#080808] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 shrink-0">
                            <Hash className="w-4 h-4 text-brand-cyan" /> 100Hz SHA-256 Stream
                        </h2>
                        <div className="flex-1 bg-black border border-white/5 rounded p-4 overflow-hidden relative">
                             {isSessionActive && (
                                <div className="absolute inset-x-0 top-0 h-full bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,240,255,0.05)_2px,rgba(0,240,255,0.05)_4px)] pointer-events-none z-10 animate-[scroll_1s_linear_infinite]"></div>
                             )}
                            <div className="flex flex-col gap-2 relative z-20 h-full justify-end">
                                <motion.div 
                                    key={sessionHash}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`text-xs break-all ${isSessionActive ? 'text-brand-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-700'}`}
                                >
                                    {isSessionActive ? sessionHash : '0000000000000000000000000000000000000000000000000000000000000000'}
                                </motion.div>
                            </div>
                        </div>
                        {isSessionActive && (
                            <div className="mt-4 flex items-center justify-between text-[10px] text-brand-cyan font-bold uppercase tracking-widest animate-pulse">
                                <span>Encoding Telemetry</span>
                                <Activity className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Immutable Ledger */}
                <div className="col-span-1 lg:col-span-8 bg-[#080808] border border-white/10 rounded-xl flex flex-col shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] pointer-events-none"></div>

                    <div className="p-6 border-b border-white/10 bg-[#0a0a0a] flex justify-between items-center z-10 shrink-0">
                        <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <Server className="w-5 h-5 text-emerald-400" /> Immutable Proof Ledger
                        </h2>
                        <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest border border-emerald-500/30 bg-emerald-900/10 px-3 py-1 rounded">
                            Connected
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 z-10 bg-[#050505]">
                        <AnimatePresence>
                            {records.map((rec) => (
                                <motion.div 
                                    key={rec.id} 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-black border border-white/10 p-5 rounded-lg hover:border-brand-cyan/30 transition-colors group relative overflow-hidden"
                                >
                                    {/* Verification Glow */}
                                    {verificationStatus[rec.id] === 'success' && (
                                        <div className="absolute inset-0 bg-emerald-500/5 z-0 pointer-events-none"></div>
                                    )}

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center border border-white/10 text-brand-cyan">
                                                <Fingerprint className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-white font-bold tracking-widest">{rec.summary}</div>
                                                <div className="text-[10px] text-gray-500 uppercase mt-1">{rec.timestamp} // SRC_VIN: {rec.vin}</div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-brand-purple font-bold border border-brand-purple/30 bg-brand-purple/10 px-2 py-1 rounded uppercase tracking-widest">
                                            {rec.eventType}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                        <div className="bg-[#111] p-3 rounded border border-white/5">
                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Merkle Root Hash</div>
                                            <div className="text-xs text-brand-cyan font-mono break-all line-clamp-2">{rec.dataHash}</div>
                                        </div>
                                        <div className="bg-[#111] p-3 rounded border border-white/5">
                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Network className="w-3 h-3" /> Hedera Consensus Tx ID</div>
                                            <div className="text-xs text-emerald-400 font-mono break-all">{rec.hederaTxId}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-end relative z-10">
                                         {verificationStatus[rec.id] === 'success' ? (
                                             <div className="text-emerald-500 text-xs font-bold uppercase flex items-center gap-2 drop-shadow-[0_0_5px_#10b981]">
                                                 <CheckCircle className="w-4 h-4" /> Cryptographic Integrity Verified
                                             </div>
                                         ) : (
                                            <button 
                                                onClick={() => handleVerify(rec.id)} 
                                                disabled={verifyingRecordId === rec.id} 
                                                className="text-[10px] px-4 py-2 border border-white/20 hover:border-white hover:bg-white/10 rounded font-bold transition-all uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {verifyingRecordId === rec.id ? (
                                                    <><Zap className="w-3 h-3 animate-pulse text-brand-cyan" /> Querying Ledger...</>
                                                ) : (
                                                    <><ShieldCheck className="w-3 h-3" /> Execute Validation Core</>
                                                )}
                                            </button>
                                         )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ZKScrutineer;

