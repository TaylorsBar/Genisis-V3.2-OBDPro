import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIStore } from '../stores/aiStore';
import { useVehicleStore } from '../stores/vehicleStore';
import { generateCopilotResponse } from '../services/geminiService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { AppearanceContext, Theme, ColorPalette } from '../contexts/AppearanceContext';
import MicrophoneIcon from './icons/MicrophoneIcon';
import { brokerCopilotAction } from '../services/ai/CopilotActionBroker';

const NeuralOrb: React.FC<{ state: string }> = ({ state }) => {
    return (
        <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Core Reactor */}
            <div className={`absolute w-16 h-16 rounded-full transition-all duration-700 blur-sm z-20
                ${state === 'speaking' ? 'bg-brand-cyan scale-110 shadow-[0_0_40px_#00F0FF]' : 
                  state === 'thinking' ? 'bg-brand-purple scale-90 shadow-[0_0_30px_#BC13FE]' : 
                  state === 'listening' ? 'bg-green-500 scale-125 shadow-[0_0_50px_#22c55e]' : 
                  'bg-cyan-900 scale-100 opacity-50'}
            `}></div>
            
            {/* Inner Ring (Fast Spin) */}
            <div className={`absolute inset-[30%] border border-white/20 rounded-full border-t-transparent border-l-transparent animate-[spin-slow_2s_linear_infinite] opacity-60 z-10
                ${state === 'thinking' ? 'border-brand-purple duration-500' : 'border-brand-cyan'}
            `}></div>

            {/* Middle Ring (Reverse) */}
            <div className="absolute inset-[15%] border border-dashed border-white/10 rounded-full animate-[spin-reverse_8s_linear_infinite] z-10"></div>

            {/* Outer HUD Ring (Static with Markers) */}
            <div className="absolute inset-0 border border-white/5 rounded-full flex items-center justify-center">
                <div className="absolute top-0 w-1 h-2 bg-white/20"></div>
                <div className="absolute bottom-0 w-1 h-2 bg-white/20"></div>
                <div className="absolute left-0 w-2 h-1 bg-white/20"></div>
                <div className="absolute right-0 w-2 h-1 bg-white/20"></div>
            </div>

            {/* Volumetric Field (Listening) */}
            {state === 'listening' && (
                <>
                    <div className="absolute inset-[-10%] border border-green-500/20 rounded-full animate-[pulse-ring_2s_linear_infinite]"></div>
                    <div className="absolute inset-[-10%] border border-green-500/10 rounded-full animate-[pulse-ring_2s_linear_infinite] delay-500"></div>
                </>
            )}
            
            {/* Text Overlay */}
            <div className="absolute -bottom-10 text-[10px] font-mono text-gray-500 tracking-[0.2em] uppercase">
                {state === 'idle' ? 'STANDBY' : 'PROCESSING'}
            </div>
        </div>
    );
};

export const GlobalAssistant: React.FC = () => {
    const { 
        isOpen, setIsOpen, mode, setMode, messages, addMessage, 
        state, setState, continuousMode, setContinuousMode, currentTask, setTask
    } = useAIStore();
    
    // Access full store for Deep Context
    const startLogging = useVehicleStore(state => state.startLogging);
    const stopLogging = useVehicleStore(state => state.stopLogging);
    const connectObd = useVehicleStore(state => state.connectObd);
    const scanVehicle = useVehicleStore(state => state.scanVehicle);
    const stageCopilotAction = useVehicleStore(state => state.stageCopilotAction);
    
    // Access UI Context
    const { theme, setTheme, colorPalette, setColorPalette, setIsImmersive } = useContext(AppearanceContext);

    const { speak, cancel } = useTextToSpeech();
    const navigate = useNavigate();
    
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const executeAction = async (intent: string, payload?: any): Promise<string | undefined> => {
        switch (intent) {
            case 'NAVIGATE':
                if (payload?.target) {
                    let path = payload.target;
                    if (!path.startsWith('/')) path = '/' + path;
                    navigate(path);
                }
                break;
            case 'UI_CONTROL':
                const uiTarget = payload?.target;
                const uiValue = payload?.value?.toLowerCase();
                
                if (uiTarget === 'theme' && uiValue) {
                    setTheme(uiValue as Theme);
                    navigate('/');
                } else if (uiTarget === 'colorPalette' && uiValue) {
                    setColorPalette(uiValue as ColorPalette);
                } else if (uiTarget === 'immersive') {
                    setIsImmersive(uiValue === 'true' || uiValue === true);
                }
                break;
            case 'VEHICLE_CONTROL':
                const proposal = brokerCopilotAction(
                    String(payload?.action ?? payload?.target ?? ''),
                    payload?.value,
                );
                if (proposal.authority === 'STAGE_ONLY') {
                    stageCopilotAction(proposal);
                    return `${proposal.kind.replace(/_/g, ' ')} staged for operator review. No vehicle command was sent.`;
                }
                if (proposal.authority === 'BLOCKED') return proposal.reason;
                if (proposal.kind === 'START_LOGGING') startLogging();
                else if (proposal.kind === 'STOP_LOGGING') await stopLogging();
                else if (proposal.kind === 'CONNECT_OBD') await connectObd();
                else if (proposal.kind === 'SCAN_DIAGNOSTICS') await scanVehicle();
                break;
            default:
                break;
        }
    };

    const handleSend = async (text: string) => {
        if (!text.trim()) return;
        
        const userMsg = text.trim();
        addMessage('user', userMsg);
        setInputValue('');
        setState('thinking');
        
        try {
            const vs = useVehicleStore.getState();
            const ctx = { ...vs, theme, colorPalette };
            const contextPayload = {
                telemetry: ctx.latestData,
                tuning: ctx.tuning,
                diagnostics: ctx.dtcs,
                currentRoute: window.location.pathname,
                isLogging: ctx.isLogging,
                ekfStats: ctx.ekfStats
            };
            
            const response = await generateCopilotResponse(userMsg, contextPayload);
            
            let actionNote: string | undefined;
            if (response.intent && response.intent !== 'GENERAL' && response.actionPayload) {
                actionNote = await executeAction(response.intent, response.actionPayload);
            }

            const responseText = typeof response === 'string'
                ? response
                : [response.speech, actionNote].filter(Boolean).join(' ') || 'Request processed.';
            addMessage('model', responseText);
            
            setState('speaking');
            speak(responseText, () => setState('idle'));
            
        } catch (error) {
            console.error(error);
            addMessage('model', 'System malfunction. Unable to process command.');
            setState('idle');
        }
    };

    const { isListening, startListening, stopListening, transcript } = useSpeechRecognition(handleSend);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[85vw] max-w-[320px] md:w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 flex flex-col font-sans transform transition-transform duration-300">
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse"></div>
                    <span className="text-white font-black text-sm tracking-widest uppercase">Genesis AI</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'bg-white/5 text-zinc-300 border border-white/10'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t border-white/10 bg-black/50 shrink-0">
                <div className="flex justify-center mb-6">
                    <NeuralOrb state={state} />
                </div>
                
                <div className="relative">
                    <input 
                        type="text" 
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend(inputValue)}
                        placeholder="Command KC..."
                        className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-cyan/50 transition-colors pr-12"
                    />
                    <button 
                        onClick={() => isListening ? stopListening() : startListening()}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded transition-colors ${isListening ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 hover:text-white'}`}
                    >
                        <MicrophoneIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalAssistant;
