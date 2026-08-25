import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, CheckCircle2, AlertTriangle, ChevronRight, HelpCircle, Zap, Search, Settings } from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';

interface Props {
    onComplete: () => void;
    onClose: () => void;
}

export const CanSnifferOnboarding: React.FC<Props> = ({ onComplete, onClose }) => {
    const [step, setStep] = useState(1);
    const obdState = useVehicleStore(state => state.obdState);
    const executeRawCommand = useVehicleStore(state => state.executeRawCommand);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    const runProtocolTest = async (protocol: string, initCommand: string) => {
        setIsTesting(true);
        setTestResult(null);
        try {
            await executeRawCommand("AT D"); // Reset
            await executeRawCommand(`AT SP ${protocol}`);
            if (initCommand) {
                const cmds = initCommand.split(',');
                for (const cmd of cmds) {
                    await executeRawCommand(cmd.trim());
                }
            }
            const res = await executeRawCommand("0100");
            if (res && res.replace(/[\s\r\n>]/g, '').includes("4100")) {
                setTestResult(`Success! Protocol ${protocol} responded to standard OBD2.`);
            } else {
                // Try Nissan Consult 2101
                const res21 = await executeRawCommand("2101");
                if (res21 && res21.replace(/[\s\r\n>]/g, '').includes("6101")) {
                     setTestResult(`Success! Protocol ${protocol} responded to Nissan Consult (2101).`);
                } else {
                     setTestResult(`Failed. Protocol ${protocol} did not return engine data. Response: ${res || 'Timeout'}`);
                }
            }
        } catch (e) {
            setTestResult(`Error during test: ${e}`);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Terminal className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">OBD Protocol Configuration</h2>
                            <p className="text-sm text-white/50">Acquire and configure your vehicle's communication protocol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                        <CheckCircle2 className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-start gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                    <HelpCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                                    <div>
                                        <h3 className="text-white font-medium mb-1">Why do I need to configure this?</h3>
                                        <p className="text-sm text-white/70 leading-relaxed">
                                            While standard OBD2 works for basic emissions data, advanced tuning and telemetry require manufacturer-specific protocols. Some vehicles, like the Nissan Dualis, use non-standard initialization sequences (like ATSH8112) over K-Line (Protocol 5) to access real engine data.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-white font-medium flex items-center gap-2">
                                        <Search className="w-4 h-4 text-emerald-400" />
                                        Current Connection Status
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Adapter Status</div>
                                            <div className="text-white font-medium flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${obdState === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {obdState === 'Connected' ? 'Connected' : 'Disconnected'}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Active Protocol</div>
                                            <div className="text-white font-medium font-mono">
                                                {obdState === 'Connected' ? 'Auto/Detected' : 'Unknown'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setStep(2)}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    Start Protocol Discovery <ChevronRight className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <h3 className="text-white font-medium mb-2">Select a Protocol Strategy to Test</h3>
                                    <p className="text-sm text-white/50 mb-4">Choose a specific initialization sequence to test against your ECU.</p>
                                </div>

                                <div className="space-y-3">
                                    {/* Nissan Dualis ATSH8112 */}
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="text-white font-medium">Nissan Dualis / J10 (K-Line)</h4>
                                                <p className="text-xs text-white/50 font-mono mt-1">AT SP 5, AT SH 81 12 F1, AT FI</p>
                                            </div>
                                            <button 
                                                onClick={() => runProtocolTest('5', 'AT AL, AT IB 10, AT IIA 12, AT SH 81 12 F1, AT WM 81 12 F1 3E, AT SW 32, AT FI')}
                                                disabled={isTesting || obdState !== 'Connected'}
                                                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                            >
                                                {isTesting ? 'Testing...' : 'Test Strategy'}
                                            </button>
                                        </div>
                                        <p className="text-xs text-white/40">Uses Protocol 5 (KWP2000 Fast Init) with specific ECU address 12 (Engine/Gateway) and Nissan Consult polling.</p>
                                    </div>

                                    {/* Generic CAN 11-bit 500k */}
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="text-white font-medium">Standard CAN (11-bit, 500k)</h4>
                                                <p className="text-xs text-white/50 font-mono mt-1">AT SP 6</p>
                                            </div>
                                            <button 
                                                onClick={() => runProtocolTest('6', '')}
                                                disabled={isTesting || obdState !== 'Connected'}
                                                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                            >
                                                {isTesting ? 'Testing...' : 'Test Strategy'}
                                            </button>
                                        </div>
                                        <p className="text-xs text-white/40">The most common protocol for vehicles 2008 and newer.</p>
                                    </div>

                                    {/* Generic KWP2000 Fast Init */}
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="text-white font-medium">Generic KWP2000 (Fast Init)</h4>
                                                <p className="text-xs text-white/50 font-mono mt-1">AT SP 5</p>
                                            </div>
                                            <button 
                                                onClick={() => runProtocolTest('5', 'AT FI')}
                                                disabled={isTesting || obdState !== 'Connected'}
                                                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                            >
                                                {isTesting ? 'Testing...' : 'Test Strategy'}
                                            </button>
                                        </div>
                                        <p className="text-xs text-white/40">Common for early 2000s Asian and European vehicles.</p>
                                    </div>
                                </div>

                                {testResult && (
                                    <div className={`p-4 rounded-xl border ${testResult.includes('Success') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                        <div className="flex items-start gap-3">
                                            {testResult.includes('Success') ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                            <p className="text-sm font-mono whitespace-pre-wrap">{testResult}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4 border-t border-white/10">
                                    <button 
                                        onClick={() => setStep(1)}
                                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        onClick={onComplete}
                                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all"
                                    >
                                        Apply & Close
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};
