import React, { useState, useEffect } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { Activity, AlertTriangle, Cpu, Terminal, Disc, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';

export const HPTunersDiagnosticTool: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const latestData = useVehicleStore(state => state.latestData);
    const [dtcs, setDtcs] = useState<{ code: string; desc: string; status: string }[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    const handleScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            // Mock HP Tuners / Snap-on DTC pulls
            setDtcs([
                { code: 'P0234', desc: 'Turbocharger Engine Overboost Condition', status: 'Historical' },
                { code: 'P0171', desc: 'System Too Lean (Bank 1)', status: 'Pending' }
            ]);
            setIsScanning(false);
        }, 1500);
    };

    const clearCodes = () => {
        setDtcs([]);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 md:p-8" onClick={onClose}>
            <div className="w-full max-w-5xl bg-[#1e1e1e] border-2 border-gray-600 rounded-lg shadow-2xl flex flex-col h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header - VCM Scanner Vibe */}
                <div className="bg-[#2a2a2a] border-b border-gray-600 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-blue-400" />
                        <div>
                            <h2 className="text-white text-sm font-bold font-mono tracking-widest uppercase">VCM / Snap-On OS V9.4</h2>
                            <p className="text-gray-400 text-[10px] font-mono">Advanced OBD-II Parameter Monitor</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-4 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-bold uppercase transition">Close</button>
                </div>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Channels */}
                    <div className="w-64 bg-[#111] border-r border-gray-700 p-2 flex flex-col gap-1 overflow-y-auto hidden md:flex">
                        <div className="px-2 py-1 bg-blue-900/50 text-blue-200 text-xs font-bold uppercase rounded flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Live Channels
                        </div>
                        {Object.entries(latestData).filter(([k,v]) => typeof v === 'number').map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center py-1 px-2 hover:bg-gray-800 rounded group cursor-pointer">
                                <span className="text-gray-300 text-xs font-mono">{k}</span>
                                <span className="text-green-400 text-xs font-mono font-bold">{(v as number).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Right Side - Scanner and Codes */}
                    <div className="flex-1 flex flex-col bg-[#1a1a1a]">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#222]">
                            <h3 className="text-white font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                Diagnostic Trouble Codes (DTCs)
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={clearCodes} className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-100 rounded border border-red-700 text-[10px] font-bold uppercase transition">Clear DTCs</button>
                                <button onClick={handleScan} className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded border border-blue-700 text-[10px] font-bold uppercase flex items-center gap-2 transition">
                                    {isScanning ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Disc className="w-3 h-3" />}
                                    Read DTCs
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-4 overflow-y-auto">
                            {isScanning ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                    <RefreshCcw className="w-8 h-8 animate-spin mb-4" />
                                    <p className="font-mono text-sm uppercase tracking-widest">Querying ECU Protocols...</p>
                                </div>
                            ) : dtcs.length > 0 ? (
                                <div className="space-y-2">
                                    {dtcs.map((dtc, i) => (
                                        <div key={i} className="flex bg-[#252525] border border-gray-700 rounded p-3 gap-4">
                                            <div className="w-20 shrink-0 flex items-center justify-center bg-gray-800 rounded border border-gray-600">
                                                <span className="text-red-400 font-bold font-mono text-sm">{dtc.code}</span>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-center">
                                                <span className="text-gray-200 text-xs font-bold uppercase">{dtc.desc}</span>
                                                <span className="text-gray-500 text-[10px] font-mono mt-1">Status: {dtc.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-700 rounded-lg">
                                    <Cpu className="w-12 h-12 mb-4 opacity-50" />
                                    <p className="font-mono text-sm uppercase tracking-widest text-green-500">No DTCs Found</p>
                                    <p className="font-mono text-[10px]">ECU reports all systems operational.</p>
                                </div>
                            )}
                        </div>

                        {/* HP Tuners VCM style grid log at bottom */}
                        <div className="h-48 border-t border-gray-700 bg-black p-2 overflow-y-auto">
                            <table className="w-full text-left text-[10px] font-mono text-gray-400">
                                <thead className="text-gray-500 bg-gray-900">
                                    <tr>
                                        <th className="p-1">Time</th>
                                        <th className="p-1">Channel</th>
                                        <th className="p-1">Value</th>
                                        <th className="p-1">Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td className="p-1">0.000s</td><td className="p-1">Engine RPM</td><td className="p-1 text-green-400">{latestData.rpm?.toFixed(0)}</td><td className="p-1">rpm</td></tr>
                                    <tr><td className="p-1">0.000s</td><td className="p-1">Manifold AP</td><td className="p-1 text-blue-400">{latestData.turboBoost?.toFixed(2)}</td><td className="p-1">bar</td></tr>
                                    <tr><td className="p-1">0.000s</td><td className="p-1">TPS</td><td className="p-1 text-yellow-400">{latestData.throttlePos?.toFixed(1)}</td><td className="p-1">%</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
