
import React, { useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { processTuningCommand, analyzeFuelMap } from '../../services/geminiService';
import { VehicleConfig, TuningModification } from '../../types';

interface AITuningSidebarProps {
    onProposalStage?: (modification: TuningModification | null) => void;
}

const AITuningSidebar: React.FC<AITuningSidebarProps> = ({ onProposalStage }) => {
    const latestData = useVehicleStore(state => state.latestData);
    const applyTuningModification = useVehicleStore(state => state.applyTuningModification);
    const undoLastTuningChange = useVehicleStore(state => state.undoLastTuningChange);
    const tuningHistory = useVehicleStore(state => state.tuningHistory);
    const vehicleConfig = useVehicleStore(state => state.vehicleConfig);
    const setVehicleConfig = useVehicleStore(state => state.setVehicleConfig);
    const tuning = useVehicleStore(state => state.tuning);
    const [messages, setMessages] = useState<{role: 'ai'|'user', text: string, type?: 'analysis'|'proposal', proposal?: TuningModification}[]>([
        { role: 'ai', text: 'Math Kernel Online. Natural Language Matrix Mapping Active.' }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [rpmError, setRpmError] = useState<string | null>(null);
    const [stagedProposalId, setStagedProposalId] = useState<number | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input) return;
        
        const userCommand = input;
        setMessages(p => [...p, {role: 'user', text: userCommand}]);
        setInput('');
        setIsThinking(true);
        
        try {
            // Call Gemini RAG Engine with Config Context
            const result = await processTuningCommand(userCommand, latestData, vehicleConfig);
            
            if ('error' in result) {
                setMessages(p => [...p, {role: 'ai', text: `Error: ${result.error}`}]);
            } else {
                // Staging Phase (Simulate)
                const actionVerb = result.operation === 'add' ? 'Add' : (result.operation === 'multiply' ? 'Scale' : (result.operation === 'smooth' ? 'Smooth' : 'Set'));
                const table = result.targetTable.toUpperCase();
                const valStr = result.operation !== 'smooth' ? `${result.value}` : 'N/A';
                
                setMessages(p => [...p, {
                    role: 'ai', 
                    type: 'proposal',
                    proposal: result,
                    text: `PROPOSAL: ${actionVerb} ${valStr} on ${table}.\nRANGE: ${result.range.minRpm}-${result.range.maxRpm} RPM / ${result.range.minLoad}-${result.range.maxLoad}% Load.\nREASONING: ${result.reasoning}`
                }]);
            }
        } catch (e) {
            setMessages(p => [...p, {role: 'ai', text: 'System Error: Neural Link Failed.'}]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleStageProposal = (mod: TuningModification, index: number) => {
        setStagedProposalId(index);
        if (onProposalStage) onProposalStage(mod);
    };

    const handleExecuteProposal = (mod: TuningModification) => {
        applyTuningModification(mod);
        setMessages(p => [...p, {role: 'ai', text: 'Modification Applied via Math Kernel. Undo available.'}]);
        setStagedProposalId(null);
        if (onProposalStage) onProposalStage(null);
    }

    const handleAnalyze = async () => {
        setIsThinking(true);
        setMessages(p => [...p, {role: 'user', text: "Run full map analysis."}]);
        try {
            const result = await analyzeFuelMap(tuning.veTable, vehicleConfig);
            setMessages(p => [...p, {
                role: 'ai',
                text: `ANALYSIS COMPLETE:\n${result.summary}\n\nADVICE: ${result.suggestion}`,
                type: 'analysis'
            }]);
        } catch (e) {
            setMessages(p => [...p, {role: 'ai', text: "Analysis failed to converge."}]);
        } finally {
            setIsThinking(false);
        }
    }

    const handleConfigChange = (key: keyof VehicleConfig, val: any) => {
        setVehicleConfig({ [key]: val });
    }

    const handleMaxRpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        if (isNaN(val)) {
            setRpmError("Enter a valid number");
            handleConfigChange('maxRpm', 0);
        } else if (val < 0) {
            setRpmError("Cannot be negative");
        } else if (val > 10000) {
            setRpmError("Exceeds safe range (Max 10k)");
        } else {
            setRpmError(null);
            handleConfigChange('maxRpm', val);
        }
    }

    return (
        <div className="h-full flex flex-col bg-[#080808] border-t lg:border-t-0 lg:border-l border-white/10 font-mono text-xs">
            {/* Header */}
            <div className="p-3 lg:p-4 border-b border-white/10 bg-gradient-to-r from-brand-cyan/5 to-transparent flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-cyan/20 animate-pulse"></div>
                        <svg className="w-4 h-4 text-brand-cyan relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <div>
                        <h2 className="font-display font-bold text-white tracking-widest text-[10px] uppercase">Neural Core</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1 h-1 rounded-full ${isThinking ? 'bg-brand-purple animate-ping' : 'bg-green-500'} `}></div>
                            <span className="text-[8px] text-gray-500 tracking-wide">{isThinking ? 'PROCESSING...' : 'STANDBY'}</span>
                        </div>
                    </div>
                </div>
                <button onClick={() => setShowConfig(!showConfig)} className="p-2 hover:bg-white/5 rounded text-gray-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </div>

            {/* Vehicle Config Panel */}
            {showConfig && (
                <div className="bg-[#111] p-3 border-b border-white/10 space-y-2 animate-in slide-in-from-top-2">
                    <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">Vehicle Profile</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[8px] text-gray-500 block">Engine (L)</label>
                            <input 
                                type="number" 
                                value={Number.isNaN(vehicleConfig.displacement) || vehicleConfig.displacement === undefined || vehicleConfig.displacement === null ? '' : vehicleConfig.displacement} 
                                onChange={e => handleConfigChange('displacement', parseFloat(e.target.value))} 
                                className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white" 
                            />
                        </div>
                        <div>
                            <label className="text-[8px] text-gray-500 block">RPM Limit</label>
                            <input 
                                type="number" 
                                value={Number.isNaN(vehicleConfig.maxRpm) || vehicleConfig.maxRpm === undefined || vehicleConfig.maxRpm === null ? '' : vehicleConfig.maxRpm} 
                                onChange={handleMaxRpmChange} 
                                className={`w-full bg-black border ${rpmError ? 'border-red-500' : 'border-gray-700'} rounded px-2 py-1 text-white focus:outline-none`} 
                            />
                            {rpmError && <span className="text-[7px] text-red-500 block mt-0.5">{rpmError}</span>}
                        </div>
                        <div>
                            <label className="text-[8px] text-gray-500 block">Fuel</label>
                            <select value={vehicleConfig.fuelType} onChange={e => handleConfigChange('fuelType', e.target.value)} className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white">
                                <option>Pump 91</option><option>Pump 93</option><option>E85</option><option>Race Gas</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[8px] text-gray-500 block">Aspiration</label>
                            <select value={vehicleConfig.aspiration} onChange={e => handleConfigChange('aspiration', e.target.value)} className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white">
                                <option>NA</option><option>Turbo</option><option>Supercharged</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[8px] text-gray-500 block">Injectors (cc)</label>
                            <input 
                                type="number" 
                                value={Number.isNaN(vehicleConfig.injectors) || vehicleConfig.injectors === undefined || vehicleConfig.injectors === null ? '' : vehicleConfig.injectors} 
                                onChange={e => handleConfigChange('injectors', parseFloat(e.target.value))} 
                                className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white" 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 min-h-[300px] lg:min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#050505] relative">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, #222 25%, #222 26%, transparent 27%, transparent 74%, #222 75%, #222 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #222 25%, #222 26%, transparent 27%, transparent 74%, #222 75%, #222 76%, transparent 77%, transparent)', backgroundSize: '20px 20px' }}></div>
                
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-10`}>
                        <span className="text-[8px] text-gray-600 mb-1 uppercase font-bold tracking-wider px-1">
                            {m.role === 'user' ? 'OPERATOR' : 'SYS.CORE'}
                        </span>
                        <div className={`max-w-[90%] p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap ${
                            m.role === 'user' 
                            ? 'bg-[#1a1a1a] text-white border border-white/10 rounded-l-xl rounded-br-xl' 
                            : m.type === 'proposal'
                                ? 'bg-yellow-900/20 text-yellow-200 border border-yellow-500/30 rounded-r-xl rounded-bl-xl shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                : m.type === 'analysis' 
                                    ? 'bg-brand-purple/10 text-purple-200 border border-brand-purple/30 rounded-r-xl rounded-bl-xl shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                    : 'bg-brand-cyan/5 text-brand-cyan border border-brand-cyan/20 rounded-r-xl rounded-bl-xl shadow-[0_0_15px_rgba(0,240,255,0.05)]'
                        }`}>
                            {m.text}
                                {(m.type === 'proposal' && m.proposal) && (
                                    <div className="mt-2 pt-2 border-t border-yellow-500/20 space-y-3">
                                        {m.proposal.thoughtProcess && (
                                            <div className="bg-black/40 p-2 rounded border border-white/5">
                                                <span className="text-[9px] font-bold text-brand-cyan uppercase tracking-widest block mb-1">Thought Process</span>
                                                <p className="text-[10px] text-gray-400 italic leading-relaxed">{m.proposal.thoughtProcess}</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            {m.proposal.riskAssessment && (
                                                <div className="bg-red-900/10 p-2 rounded border border-red-500/20">
                                                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest block mb-1">Risk Assessment</span>
                                                    <p className="text-[10px] text-gray-400 leading-snug">{m.proposal.riskAssessment}</p>
                                                </div>
                                            )}
                                            {m.proposal.outcomePrediction && (
                                                <div className="bg-green-900/10 p-2 rounded border border-green-500/20">
                                                    <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest block mb-1">Outcome Projection</span>
                                                    <p className="text-[10px] text-gray-400 leading-snug">{m.proposal.outcomePrediction}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <button 
                                                onClick={() => handleStageProposal(m.proposal!, i)}
                                                className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] transition-all border ${
                                                    stagedProposalId === i 
                                                    ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-[0_0_10px_#00F0FF]' 
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                {stagedProposalId === i ? 'Staged' : 'Stage Preview'}
                                            </button>
                                            <button 
                                                onClick={() => handleExecuteProposal(m.proposal!)}
                                                className="bg-yellow-500 text-black px-4 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] hover:bg-yellow-400 transition-colors shadow-lg"
                                            >
                                                Execute Change
                                            </button>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                ))}
                
                {isThinking && (
                    <div className="flex gap-1 ml-4 items-center h-6">
                        <span className="text-brand-cyan text-[10px] mr-2">COMPUTING</span>
                        <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce delay-75"></div>
                        <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce delay-150"></div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-[#0a0a0a] shrink-0">
                 {/* Quick Tools */}
                 <div className="flex gap-2 mb-3">
                     <button 
                        onClick={undoLastTuningChange} 
                        disabled={tuningHistory.length === 0}
                        className="flex-1 py-2 bg-[#151515] border border-white/10 rounded text-[9px] font-bold text-gray-400 uppercase tracking-wider hover:bg-[#222] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-all"
                     >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                         Undo
                     </button>
                     <button 
                        onClick={handleAnalyze}
                        disabled={isThinking}
                        className="flex-1 py-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded text-[9px] font-bold text-brand-cyan uppercase tracking-wider hover:bg-brand-cyan hover:text-black transition-all disabled:opacity-50"
                     >
                         Analyze Map
                     </button>
                 </div>

                 <div className="relative">
                    <input 
                        className="w-full bg-[#111] border border-white/10 rounded-lg py-3 pl-4 pr-10 text-xs text-white focus:border-brand-cyan/50 focus:outline-none transition-all placeholder:text-gray-700 font-mono shadow-inner"
                        placeholder="Ex: 'Enrich idle by 5%'..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        disabled={isThinking}
                    />
                    <button 
                        onClick={handleSend} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-brand-cyan transition-colors"
                        disabled={isThinking}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default AITuningSidebar;
