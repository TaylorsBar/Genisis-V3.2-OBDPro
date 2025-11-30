
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, DiagnosticCode, EmissionsReadiness, ObdConnectionState } from '../types';
import { getDiagnosticAnswer } from '../services/geminiService';
import { useVehicleStore } from '../stores/vehicleStore';
import ReactMarkdown from 'react-markdown';

const MonitorBadge: React.FC<{ label: string; ready: boolean }> = ({ label, ready }) => (
    <div className={`flex items-center justify-between p-2 border rounded mb-2 ${ready ? 'bg-green-900/20 border-green-600/50' : 'bg-red-900/20 border-red-600/50'}`}>
        <span className="text-xs font-bold text-gray-300 uppercase">{label}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ready ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
            {ready ? 'READY' : 'NOT READY'}
        </span>
    </div>
);

const Diagnostics: React.FC = () => {
  const dtcs = useVehicleStore(state => state.dtcs);
  const readiness = useVehicleStore(state => state.readiness);
  const isScanning = useVehicleStore(state => state.isScanning);
  const scanVehicle = useVehicleStore(state => state.scanVehicle);
  const clearFaults = useVehicleStore(state => state.clearVehicleFaults);
  const obdState = useVehicleStore(state => state.obdState);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', text: "KC Diagnostic Core initialized. Connect OBD-II adapter and run a full system scan to populate fault codes.", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = overrideText || input;
    
    if (text.trim() === '' || isTyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      let query = text;
      if (dtcs.length > 0 && !text.includes("P")) {
          query += `\n[Context: Active DTCs: ${dtcs.map(d => d.code).join(', ')}]`;
      }

      const aiResponseText = await getDiagnosticAnswer(query);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponseText,
        sender: 'ai',
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Error: Uplink connection failed. Please retry transmission.",
        sender: 'ai',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAnalyzeCode = (code: string) => {
      handleSend(undefined, `Analyze failure code ${code}. What are the likely causes and fixes?`);
  };

  return (
    <div className="flex h-full bg-[#050508] relative overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      ></div>

      {/* --- LEFT PANE: Monitors & Scanner Controls --- */}
      <div className="w-72 flex flex-col border-r border-surface-border bg-[#0a0a0a] z-10">
          <div className="p-4 border-b border-surface-border bg-gradient-to-r from-brand-cyan/5 to-transparent">
              <div className="flex justify-between items-center">
                  <h2 className="text-sm font-display font-bold text-white tracking-widest uppercase">Scanner Control</h2>
                  {obdState === ObdConnectionState.Connected && (
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                  )}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">I/M Readiness & Controls</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {readiness ? (
                  <>
                    <MonitorBadge label="Misfire" ready={readiness.misfire} />
                    <MonitorBadge label="Fuel System" ready={readiness.fuelSystem} />
                    <MonitorBadge label="Components" ready={readiness.components} />
                    <MonitorBadge label="Catalyst" ready={readiness.catalyst} />
                    <MonitorBadge label="EVAP System" ready={readiness.evap} />
                    <MonitorBadge label="O2 Sensor" ready={readiness.o2Sensor} />
                    <MonitorBadge label="EGR / VVT" ready={readiness.egr} />
                  </>
              ) : (
                  <div className="text-center mt-10 opacity-50">
                      <div className="text-xs text-gray-500 font-mono mb-2">{obdState === ObdConnectionState.Connected ? 'SYSTEM CONNECTED' : 'SYSTEM OFFLINE'}</div>
                      <div className="text-[10px] text-gray-600 uppercase">Run Scan to View Monitors</div>
                  </div>
              )}
          </div>

          <div className="p-4 border-t border-surface-border bg-[#111] space-y-3">
              <button 
                onClick={() => scanVehicle()}
                disabled={isScanning}
                className={`w-full py-3 rounded font-bold text-xs uppercase tracking-widest transition-all ${
                    isScanning 
                    ? 'bg-brand-cyan/20 text-brand-cyan cursor-wait' 
                    : 'bg-brand-cyan text-black hover:bg-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                }`}
              >
                  {isScanning ? 'Scanning Bus...' : 'Scan Vehicle'}
              </button>
              
              <button 
                onClick={() => clearFaults()}
                disabled={obdState !== ObdConnectionState.Connected}
                className="w-full py-3 rounded font-bold text-xs uppercase tracking-widest bg-red-900/20 text-red-500 border border-red-900 hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  Clear Codes
              </button>
          </div>
      </div>

      {/* --- CENTER PANE: DTC List --- */}
      <div className="flex-1 flex flex-col min-w-[300px] border-r border-surface-border bg-[#080808] z-10">
          <div className="p-4 border-b border-surface-border flex justify-between items-center">
              <h2 className="text-sm font-display font-bold text-white tracking-widest uppercase">Active Faults</h2>
              <span className={`text-[10px] font-bold px-2 py-1 rounded ${dtcs.length > 0 ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>
                  {dtcs.length} CODES
              </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {dtcs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                      <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-xs font-mono uppercase">No Faults Detected</p>
                  </div>
              ) : (
                  dtcs.map((dtc, idx) => (
                      <div key={idx} className="bg-[#111] border-l-4 border-red-500 p-4 mb-3 rounded-r hover:bg-[#161616] transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-lg font-mono font-bold text-white">{dtc.code}</span>
                              <span className="text-[10px] text-gray-500 uppercase">{dtc.status}</span>
                          </div>
                          <p className="text-xs text-gray-400 mb-3">{dtc.description || "Unknown Manufacturer Fault"}</p>
                          <button 
                            onClick={() => handleAnalyzeCode(dtc.code)}
                            className="text-[10px] text-brand-cyan font-bold uppercase hover:underline flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity"
                          >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Analyze with AI
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* --- RIGHT PANE: AI Assistant --- */}
      <div className="flex-[1.2] flex flex-col bg-[#050505] z-10">
          <div className="p-4 border-b border-surface-border bg-black flex justify-between items-center">
              <div>
                  <h2 className="text-sm font-display font-bold text-brand-cyan tracking-widest uppercase">KC // Mechanic</h2>
                  <p className="text-[10px] text-gray-500">Diagnostic Analysis Engine</p>
              </div>
              <div className="flex gap-1">
                  <div className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse delay-75"></div>
                  <div className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse delay-150"></div>
              </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] p-4 rounded-lg text-sm leading-relaxed font-mono border ${
                        msg.sender === 'user' 
                        ? 'bg-brand-blue/10 border-brand-blue/30 text-white rounded-br-none' 
                        : 'bg-[#111] border-gray-800 text-gray-300 rounded-bl-none shadow-lg'
                    }`}>
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    <span className="text-[9px] text-gray-600 mt-1 uppercase tracking-wider">
                        {msg.sender === 'user' ? 'OPERATOR' : 'KC CORE'}
                    </span>
                </div>
            ))}
            {isTyping && (
                 <div className="flex items-center gap-2 text-xs text-brand-cyan animate-pulse px-4">
                    Processing telemetry...
                 </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-surface-border bg-[#0a0a0a]">
            <form onSubmit={(e) => handleSend(e)} className="flex gap-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a code or symptom..."
                className="flex-1 bg-[#111] border border-gray-700 rounded-l px-4 py-3 text-sm text-white focus:border-brand-cyan focus:outline-none transition-colors font-mono"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={isTyping}
                className="bg-brand-cyan/10 text-brand-cyan border border-l-0 border-brand-cyan/30 hover:bg-brand-cyan hover:text-black font-bold px-6 rounded-r transition-all disabled:opacity-50 uppercase tracking-widest text-xs"
              >
                Send
              </button>
            </form>
          </div>
      </div>

    </div>
  );
};

export default Diagnostics;
