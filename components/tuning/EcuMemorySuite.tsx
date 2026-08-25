
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Database, Search, Edit3, ChevronRight, Binary, Cpu, AlertTriangle } from 'lucide-react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useUIStore } from '../../stores/uiStore';
import { EcuVariant } from '../../services/UdsSecurityService';

const EcuMemorySuite: React.FC = () => {
    const [address, setAddress] = useState('0x00000000');
    const [size, setSize] = useState('16');
    const [isReading, setIsReading] = useState(false);
    const [memoryData, setMemoryData] = useState<Uint8Array | null>(null);
    const [isWriting, setIsWriting] = useState(false);
    const [writeValue, setWriteValue] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    
    const readMemory = useVehicleStore(state => state.readMemoryByAddress);
    const writeDid = useVehicleStore(state => state.writeDid);
    const uds = useVehicleStore(state => state.uds);
    const requestSecurityAccess = useVehicleStore(state => state.requestSecurityAccess);

    const showToast = useUIStore.getState().showToast;

    const handleRead = async () => {
        if (!uds.securityAccess) return;
        
        setIsReading(true);
        try {
            const addrInt = parseInt(address, 16);
            const sizeInt = parseInt(size, 10);
            const data = await readMemory(addrInt, sizeInt);
            setMemoryData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsReading(false);
        }
    };

    const handleWriteRequest = () => {
        if (!uds.securityAccess) {
            showToast("Security Access Required.", "error");
            return;
        }
        setShowConfirm(true);
    };

    const handleConfirmWrite = async () => {
        setIsWriting(true);
        setShowConfirm(false);
        try {
            // Service 0x2E expects DID (which we have in address) and data
            const success = await writeDid(address, writeValue.replace(/\s/g, ''));
            if (success) {
                showToast("Write request executed successfully.", "success");
            } else {
                throw new Error("ECU Write rejected or timed out.");
            }
        } catch (e) {
            showToast(`Write Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, "error");
        } finally {
            setIsWriting(false);
        }
    };

    const formatHex = (data: Uint8Array) => {
        return Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    };

    const formatAscii = (data: Uint8Array) => {
        return Array.from(data).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
    };


    return (
        <section className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl relative">
            <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-purple" />
                    <h2 className="text-xs font-black tracking-widest text-white uppercase italic">Direct Memory Access</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Cpu className={`w-3 h-3 ${uds.securityAccess ? 'text-green-500' : 'text-gray-600'}`} />
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">UDS 0x23 / 0x2E</span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {!uds.securityAccess && (
                    <div className="bg-brand-red/5 border border-brand-red/20 rounded-lg p-4 flex items-center gap-4">
                        <AlertTriangle className="w-5 h-5 text-brand-red shrink-0" />
                        <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                            <span className="text-brand-red font-black">SECURITY REQUIRED:</span> Level 3 Seed/Key authentication must be established before direct memory addressing is permitted.
                            <button onClick={() => requestSecurityAccess(EcuVariant.NISSAN_MR20DE)} className="block mt-2 text-brand-cyan underline">Authorize Now</button>
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Base Address (Hex)</label>
                        <div className="relative">
                            <Binary className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input 
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-brand-purple outline-none focus:border-brand-purple/50 transition-all"
                                placeholder="0x00000000"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Size (Bytes)</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input 
                                type="number"
                                value={size}
                                onChange={(e) => setSize(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-white outline-none focus:border-brand-purple/50 transition-all"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        disabled={!uds.securityAccess || isReading}
                        onClick={handleRead}
                        className="flex-1 py-3 bg-brand-purple/20 text-brand-purple border border-brand-purple rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand-purple hover:text-white"
                    >
                        Dump Memory
                    </button>
                    {!showConfirm && (
                        <div className="flex-1 flex gap-1">
                            <input type="text" value={writeValue} onChange={(e) => setWriteValue(e.target.value)} placeholder="Hex to Write" className="w-full bg-black/60 border border-white/10 rounded-lg px-2 text-xs font-mono text-white" />
                            <button onClick={handleWriteRequest} disabled={!uds.securityAccess || isWriting} className="px-4 bg-brand-red/20 text-brand-red border border-brand-red rounded-lg text-[10px] font-black uppercase">
                                Write
                            </button>
                        </div>
                    )}
                </div>

                {showConfirm && (
                    <div className="bg-brand-red/10 border border-brand-red/30 p-4 rounded-lg space-y-3">
                        <p className="text-[10px] text-brand-red font-black uppercase">Dangerous: Are you sure you want to write {writeValue} to {address}?</p>
                        <div className="flex gap-2">
                            <button onClick={handleConfirmWrite} className="flex-1 py-2 bg-brand-red text-black font-black uppercase text-[10px] rounded">Confirm</button>
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 bg-white/10 text-white font-black uppercase text-[10px] rounded">Cancel</button>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {memoryData && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="bg-black/80 rounded-xl border border-white/10 overflow-hidden">
                                <div className="bg-white/5 px-4 py-2 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Hex Dump</span>
                                    <div className="flex gap-2">
                                        <div className="w-2 h-2 rounded-full bg-brand-cyan shadow-glow-cyan"></div>
                                        <div className="w-2 h-2 rounded-full bg-brand-purple shadow-glow-purple"></div>
                                    </div>
                                </div>
                                <div className="p-4 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-brand-purple/90">
                                    {formatHex(memoryData)}
                                </div>
                                <div className="border-t border-white/5 p-4 font-mono text-[11px] text-gray-400 bg-black/40 italic">
                                    ASCII: {formatAscii(memoryData)}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
};

export default EcuMemorySuite;

