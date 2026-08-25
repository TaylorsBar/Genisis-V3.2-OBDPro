import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { 
    Send, Bot, User, Cpu, Terminal, Sparkles, 
    MessageSquare, Command, ChevronRight, Zap, 
    Activity, ShieldAlert, Mic, MicOff
} from 'lucide-react';

export const NeuralCoPilot: React.FC = () => {
    const coPilot = useVehicleStore(state => state.coPilot);
    const sendCoPilotMessage = useVehicleStore(state => state.sendCoPilotMessage);
    const clearCoPilotLog = useVehicleStore(state => state.clearCoPilotLog);
    
    const [inputValue, setInputValue] = useState('');
    const [isSpeakMode, setIsSpeakMode] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [coPilot.messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        sendCoPilotMessage(inputValue);
        setInputValue('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="flex flex-col h-full bg-[#0A0A0A]/40 backdrop-blur-3xl rounded-2xl border border-white/5 overflow-hidden font-display relative shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            {/* Header / Subsystem Link Status */}
            <div className="p-4 border-b border-brand-cyan/20 bg-brand-cyan/5 flex justify-between items-center bg-gradient-to-r from-brand-cyan/10 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full border border-brand-cyan/40 flex items-center justify-center bg-black/40">
                            <Bot className="w-4 h-4 text-brand-cyan" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-green rounded-full shadow-[0_0_8px_#00FF00] animate-pulse"></div>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Genesis ASI</h3>
                        <span className="text-[8px] font-mono text-brand-cyan uppercase tracking-widest">Neural Link: ACTIVE</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="px-2 py-1 bg-black/40 border border-white/10 rounded flex items-center gap-2">
                        <Activity className="w-3 h-3 text-brand-green" />
                        <span className="text-[8px] font-mono text-gray-500 uppercase">Coherence: 99.4%</span>
                    </div>
                    <button 
                        onClick={clearCoPilotLog}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        <Terminal className="w-3 h-3 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar scroll-smooth relative">
                {/* Visual Accent Curves */}
                <div className="absolute top-0 right-0 w-32 h-64 bg-brand-cyan/5 blur-[80px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-64 bg-brand-purple/5 blur-[80px] pointer-events-none"></div>

                <AnimatePresence>
                    {coPilot.messages.map((msg, idx) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20, y: 10 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[85%] group ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                <div className={`px-4 py-3 rounded-none border border-white/5 relative ${
                                    msg.role === 'user' 
                                    ? 'bg-brand-cyan/10 border-r-2 border-r-brand-cyan' 
                                    : 'bg-[#111] border-l-2 border-l-brand-purple'
                                }`}>
                                    <span className="text-[10px] text-white leading-relaxed font-mono block">
                                        {msg.text}
                                    </span>
                                    
                                    {/* Sub-text labels */}
                                    <div className="mt-2 flex items-center justify-between opacity-30 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[7px] font-mono text-gray-400 uppercase tracking-widest">
                                            {msg.role === 'user' ? 'Driver_Uplink' : 'ASI_Synthetic'}
                                        </span>
                                        <span className="text-[7px] font-mono text-gray-500 uppercase">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {coPilot.isThinking && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                    >
                        <div className="bg-white/5 px-4 py-3 border-l-2 border-brand-cyan/40">
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce"></div>
                                <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce [animation-delay:-.3s]"></div>
                                <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce [animation-delay:-.5s]"></div>
                            </div>
                        </div>
                    </motion.div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-[#0A0A0A] relative shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                <div className="flex gap-0">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="TRANSMIT_COMMAND_TO_ASI..."
                            className="w-full h-full bg-[#111] border border-white/10 rounded-none px-4 text-[10px] font-mono text-brand-cyan placeholder:text-gray-700 focus:outline-none focus:border-brand-cyan/40 transition-all uppercase tracking-widest shadow-inner shadow-black"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <Command className="w-3 h-3 text-brand-cyan/30" />
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setIsSpeakMode(!isSpeakMode)}
                        className={`w-12 h-12 flex items-center justify-center border-y border-r transition-all ${isSpeakMode ? 'border-brand-purple bg-brand-purple/20' : 'bg-[#141414] border-white/10 hover:bg-[#1A1A1A]'}`}
                    >
                        {isSpeakMode ? <Mic className="w-4 h-4 text-brand-purple animate-pulse" /> : <MicOff className="w-4 h-4 text-gray-500" />}
                    </button>

                    <button
                        onClick={handleSend}
                        className="w-16 h-12 flex items-center justify-center bg-brand-cyan/20 border border-brand-cyan/40 hover:bg-brand-cyan/30 transition-all"
                    >
                        <Send className="w-4 h-4 text-brand-cyan filter drop-shadow-[0_0_5px_#00F0FF]" />
                    </button>
                </div>
                
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['Status Report', 'Increase Boost', 'Calibrate Sensors', 'Run Diagnostics', 'Arm Launch'].map((suggest) => (
                        <button
                            key={suggest}
                            onClick={() => sendCoPilotMessage(suggest)}
                            className="shrink-0 text-[7px] font-mono text-gray-400 bg-white/5 uppercase tracking-widest border border-white/10 px-3 py-1.5 hover:border-brand-cyan/40 hover:text-brand-cyan hover:bg-brand-cyan/5 transition-colors"
                        >
                            {suggest}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
