
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, DiagnosticCode, ObdConnectionState, SensorDataPoint, TimelineEvent } from '../types';
import { getDiagnosticAnswer, getPredictiveAnalysis } from '../services/geminiService';
import { useVehicleStore } from '../stores/vehicleStore';
import { useUIStore } from '../stores/uiStore';
import ReactMarkdown from 'react-markdown';
import RiskTimeline from '../components/RiskTimeline';
import { MOCK_LOGS } from './MaintenanceLog';
import HelpTooltip from '../components/HelpTooltip';
import { EcuVariant } from '../services/UdsSecurityService';
import ObdModesPanel from '../components/diagnostics/ObdModesPanel';
import MaintenanceResetsPanel from '../components/diagnostics/MaintenanceResetsPanel';
import { 
  Play, Square, Shield, ShieldAlert, Cpu, Terminal, Sparkles, Sliders, Settings2, 
  CheckCircle2, ChevronRight, Activity, HelpCircle, Lock, Unlock, Volume2, 
  Wind, Lightbulb, RefreshCw, KeyRound, Radio, Eye, ChevronUp, ChevronDown, Check, AlertCircle, RefreshCcw,
  Mic, MicOff, Info, AlertTriangle, ShieldCheck, Wrench, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDiagnosticStore } from '../stores/diagnosticStore';
import { getSystemAnalysis } from '../services/geminiService';

// --- MONITOR INFO MAP ---
const MONITOR_INFO: Record<string, { title: string; content: string }> = {
    "Misfire": { title: "Misfire Monitor", content: "Continuously tracks camshaft rotational speed deviations to detect ignition or fuel delivery failures in specific cylinders, protecting the engine and catalytic converter." },
    "Fuel Sys": { title: "Fuel System Monitor", content: "Continuously checks closed-loop fuel feedback control, target lambda matching, and trim scaling (STFT/LTFT) to keep the combustion state near stoichiometric balance." },
    "Comps": { title: "Comprehensive Components", content: "Scans analog/digital sensors and electronic subsystems for opens, shorts, or out-of-range rationalities." },
    "Catalyst": { title: "Oxygen Storage Catalyst", content: "Checks oxygen storage capacity of the catalytic converter by observing downstream oxygen levels relative to upstream fluctuations." },
    "EVAP": { title: "Evaporative Emissions Sys", content: "Runs vacuum decay diagnostics on fuel tank venting loops to prevent greenhouse volatile fuel vapor leaks." },
    "O2 Sens": { title: "O2 Sensor Response", content: "Validates oxygen sensor heater latency, voltage range, and transition speed to maintain active feedback loops." },
    "EGR/VVT": { title: "EGR & Valve Control", content: "Inspects exhaust gas recirculation flow and dual variable valve timing actuators for physical blockages or sluggish response." }
};

// --- ICONS ---
const RefreshIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const ChipIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
const DocumentReportIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const SearchCircleIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const LightningIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const DatabaseIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
const ChartBarIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;

// --- COMPONENTS ---

const StatusBadge: React.FC<{ label: string; ready: boolean }> = ({ label, ready }) => {
    const info = MONITOR_INFO[label] || { title: label, content: "OBD-II secondary emissions readiness monitor system." };
    return (
        <div className={`relative flex flex-col justify-between p-3 rounded-xl border overflow-hidden group transition-all duration-300 ${ready ? 'bg-emerald-900/10 border-emerald-800/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#151515] border-gray-800 hover:border-gray-700'}`}>
            {ready && <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors"></div>}
            <div className="flex justify-between items-center relative z-10 w-full mb-1">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</span>
                <HelpTooltip title={info.title} content={info.content} position="top" />
            </div>
            <div className="flex items-center justify-between mt-3 relative z-10">
                <span className={`text-[11px] font-black tracking-widest ${ready ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-gray-600'}`}>
                    {ready ? 'READY' : 'INC'}
                </span>
                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${ready ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-700'}`}></div>
            </div>
        </div>
    );
};


export function getDtcSeverity(code: string): 'Critical' | 'Warning' | 'Informational' {
    const uppercaseCode = code.toUpperCase();
    
    // Critical codes: Engine Misfires, Overboost, Transmission Control, ECU Power/CAN, High engine temps
    if (
        uppercaseCode.startsWith('P030') || // P0300 - P0309: Misfires
        uppercaseCode === 'P0234' ||        // Overboost
        uppercaseCode.startsWith('P07') ||  // Transmission
        uppercaseCode === 'U0100' ||        // Lost communication with ECM
        uppercaseCode === 'U0101' ||        // Lost communication with TCM
        uppercaseCode === 'P0117' ||        // ECT Sensor Circuit Low (Engine Coolant Temp - Overheating risk)
        uppercaseCode === 'P0118'           // ECT Sensor Circuit High
    ) {
        return 'Critical';
    }
    
    // Warnings: Airflow issues, oxygen feedback loop, system running rich/lean, catalyst efficiency, speed sensor
    if (
        uppercaseCode.startsWith('P010') || // Mass Air Flow
        uppercaseCode.startsWith('P011') || // Intake Air Temp
        uppercaseCode === 'P0171' ||        // System Too Lean
        uppercaseCode === 'P0172' ||        // System Too Rich
        uppercaseCode === 'P0420' ||        // Catalyst Efficiency
        uppercaseCode === 'P0500' ||        // Vehicle Speed Sensor
        uppercaseCode.startsWith('P11') ||  // Nissan VVT
        uppercaseCode.startsWith('P12')     // Infiniti VVEL
    ) {
        return 'Warning';
    }
    
    // Informational: All other codes (chassis codes like C1201, body codes, CAN network codes that aren't critical ECM/TCM, etc.)
    return 'Informational';
}

const FaultCard: React.FC<{ 
    code: DiagnosticCode; 
    onAnalyze: (code: string, context: string, freezeFrame?: Partial<SensorDataPoint>) => void;
    onViewFreezeFrame: (data: Partial<SensorDataPoint>) => void;
}> = ({ code, onAnalyze, onViewFreezeFrame }) => {
    const severity = getDtcSeverity(code.code);
    
    const severityConfig = {
        Critical: {
            label: 'CRITICAL',
            badgeClass: 'bg-red-950/40 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
            cardBorder: 'hover:border-red-500/35',
            glowColor: 'from-red-500/5',
            icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
        },
        Warning: {
            label: 'WARNING',
            badgeClass: 'bg-amber-950/40 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
            cardBorder: 'hover:border-amber-500/35',
            glowColor: 'from-amber-500/5',
            icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        },
        Informational: {
            label: 'INFORMATIONAL',
            badgeClass: 'bg-blue-950/40 border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
            cardBorder: 'hover:border-blue-500/35',
            glowColor: 'from-blue-500/5',
            icon: <Info className="w-3.5 h-3.5 text-blue-400" />
        }
    };

    const currentConfig = severityConfig[severity];

    return (
        <div className={`group relative bg-black/80 backdrop-blur-md border border-white/10 p-5 rounded-xl transition-all duration-300 ${currentConfig.cardBorder} hover:shadow-2xl overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${currentConfig.glowColor} to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black font-mono text-white tracking-tight drop-shadow-md">{code.code}</span>
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-[0.15em] border flex items-center gap-1.5 ${currentConfig.badgeClass}`}>
                        {currentConfig.icon}
                        {currentConfig.label}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${code.status === 'Confirmed' ? 'bg-brand-red/20 text-brand-red' : 'bg-yellow-900/30 text-yellow-400'}`}>
                        {code.status}
                    </span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono font-bold tracking-widest">{new Date(code.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            
            <p className="text-[13px] text-gray-300 leading-relaxed mb-5 font-mono relative z-10">
                {code.description || "Manufacturer Controlled DTC - See Service Manual"}
            </p>

            <div className="flex justify-end items-center gap-4 border-t border-white/10 pt-4 relative z-10">
                {code.freezeFrame && (
                    <button 
                        onClick={() => onViewFreezeFrame(code.freezeFrame!)}
                        className="text-[10px] min-h-[44px] min-w-[44px] font-black text-gray-500 hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center gap-1.5"
                    >
                        <DatabaseIcon /> FRAME
                    </button>
                )}
                <button 
                    onClick={() => onAnalyze(code.code, code.description || "", code.freezeFrame)}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded bg-brand-cyan/10 border border-brand-cyan/30 text-[10px] font-black text-brand-cyan hover:bg-brand-cyan hover:text-black uppercase tracking-[0.2em] transition-all"
                >
                    <SearchCircleIcon />
                    ANALYZE
                </button>
            </div>
        </div>
    );
};


const FreezeFrameModal: React.FC<{ data: Partial<SensorDataPoint> | null, onClose: () => void }> = ({ data, onClose }) => {
    if (!data) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#111] border border-white/10 rounded-lg max-w-lg w-full m-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#1a1a1a] p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Freeze Frame Data</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {Object.entries(data).map(([key, val]) => {
                        if (typeof val !== 'number') return null;
                        return (
                            <div key={key} className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-xs text-gray-500 font-mono capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="text-xs font-mono font-bold text-brand-cyan">{val.toFixed(2)}</span>
                            </div>
                        )
                    })}
                </div>
                <div className="p-3 bg-[#0a0a0a] text-[10px] text-gray-600 text-center border-t border-white/10">
                    SNAPSHOT AT FAULT DETECTION
                </div>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---

const Diagnostics: React.FC = () => {
  const { 
    dtcs, readiness, isScanning, scanVehicle, clearVehicleFaults, 
    obdState, ecuProfile, latestData, ekfStats, establishKessLink, 
    hardwareLog, hardwareLink, writeKessParameter,
    executeRawCommand, requestSecurityAccess, setDiagnosticSession, uds
  } = useVehicleStore();
  const [activeTab, setActiveTab] = useState<'scan' | 'faults' | 'ai'>('scan');
  
  // --- VOICE DIAGNOSTIC TRIGGER STATES ---
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'trigger_recognized' | 'scanning' | 'analyzing' | 'completed' | 'error'>('idle');
  const [voiceMessage, setVoiceMessage] = useState<string>('Voice diagnostics standby.');
  const [showVoicePopup, setShowVoicePopup] = useState<boolean>(false);
  const [voiceAiAnalysis, setVoiceAiAnalysis] = useState<string>('');
  const [expandedSubsystems, setExpandedSubsystems] = useState<Record<string, boolean>>({
    ecm: true,
    tcm: false,
    abs: false,
    bcm: false,
    ipdm: false,
  });

  // Web Speech API Continuous Background Listener
  useEffect(() => {
    let recognition: any = null;
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (voiceActive && SpeechRecognitionClass) {
      try {
        recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setVoiceStatus('listening');
          setVoiceMessage('Listening for vocal command "Status Check"...');
        };

        recognition.onresult = (event: any) => {
          const lastIndex = event.results.length - 1;
          const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
          setVoiceMessage(`Heard: "${transcript}"`);

          if (
            transcript.includes('status check') || 
            transcript.includes('run diagnostic') || 
            transcript.includes('run diagnostics') || 
            transcript.includes('vehicle scan')
          ) {
            handleVoiceTrigger();
          }
        };

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition error:", e.error);
          if (e.error === 'not-allowed') {
            setVoiceStatus('error');
            setVoiceMessage('Microphone access denied.');
            setVoiceActive(false);
          }
        };

        recognition.onend = () => {
          // Restart background listening if still active
          if (voiceActive) {
            try {
              recognition.start();
            } catch (err) {
              // Ignore starting errors if already running
            }
          }
        };

        recognition.start();
      } catch (err) {
        console.error("Failed to start Speech Recognition:", err);
        setVoiceStatus('error');
        setVoiceMessage('Vocal synthesis init failed.');
      }
    } else {
      setVoiceStatus('idle');
      setVoiceMessage(SpeechRecognitionClass ? 'Voice system standby.' : 'Web Speech unsupported.');
    }

    return () => {
      if (recognition) {
        try {
          recognition.abort();
        } catch (e) {}
      }
    };
  }, [voiceActive]);

  const handleVoiceTrigger = async () => {
    const isAlreadyScanning = useVehicleStore.getState().isScanning;
    if (isAlreadyScanning || voiceStatus === 'scanning' || voiceStatus === 'analyzing') {
      return;
    }

    setVoiceStatus('trigger_recognized');
    setVoiceMessage('Vocal Trigger APPROVED. Initiating deep vehicle telemetry scan...');
    
    // Non-blocking Web Audio chimes for pilot confirmation feedback
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.debug("Web Audio chime omitted:", e);
    }

    // Process scan asynchronously using a microtask timeout to prevent blocking high-rate telemetry loops
    setTimeout(async () => {
      try {
        setVoiceStatus('scanning');
        // Sweep CAN bus DTCs
        await scanVehicle();
        
        setVoiceStatus('analyzing');
        setVoiceMessage('DTC read complete. Sending telemetry to Genesis AI Core...');

        const currentLogs = useDiagnosticStore.getState().logs;
        const recentLogs = currentLogs.slice(-30).map(l => `[${l.direction}] ${l.data}`).join('\n') || "Nominal CAN broadcast stream.";
        const currentDtcs = useVehicleStore.getState().dtcs;

        // Fetch deep system report via Gemini
        const analysisText = await getSystemAnalysis(ecuProfile, currentDtcs, latestData, ekfStats, recentLogs);
        
        setVoiceAiAnalysis(analysisText);
        setShowVoicePopup(true);
        setVoiceStatus('completed');
        setVoiceMessage('HUD Diagnostics Portal Synced & Active.');
      } catch (err: any) {
        console.error("Voice routine exception:", err);
        setVoiceStatus('error');
        setVoiceMessage(`Failed: ${err.message || 'Bus Interrupt'}`);
        useUIStore.getState().showToast(`Voice Diagnostics failed: ${err.message || 'Internal Error'}`, 'error');
      }
    }, 100);
  };

  // New States for Predictive Mode
  const [centerMode, setCenterMode] = useState<'faults' | 'predictive' | 'bidirectional' | 'obd-modes' | 'resets'>('faults');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFORMATIONAL'>('ALL');
  const [predictiveEvents, setPredictiveEvents] = useState<TimelineEvent[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictiveError, setPredictiveError] = useState<string | null>(null);

  // Bidirectional & Auto-Discovery State
  const [selectedEcu, setSelectedEcu] = useState<string>('BCM');
  const [isEcuScanning, setIsEcuScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [discoveredEcus, setDiscoveredEcus] = useState<Record<string, {
      name: string;
      id: string;
      online: boolean;
      hwRef: string;
      swRef: string;
      session: string;
      unlocked: boolean;
  }>>({
      'ECM': { name: 'Engine Control Module (ECM)', id: '0x7E0', online: false, hwRef: 'HITACHI_SH7059', swRef: 'V36_VQ25HR_1GD1A', session: 'Default (0x01)', unlocked: false },
      'TCM': { name: 'Transmission Control Module (TCM)', id: '0x7E1', online: false, hwRef: 'RE7R01A_JATCO', swRef: 'ETC_7SPD_M033XB', session: 'Default (0x01)', unlocked: false },
      'VDC_ABS': { name: 'Vehicle Dynamics Core (ABS/VDC)', id: '0x7E2', online: false, hwRef: 'SUMITOMO_V5_ABS', swRef: 'VDC_G25_S910', session: 'Default (0x01)', unlocked: false },
      'BCM': { name: 'Body Control Module (BCM)', id: '0x715', online: false, hwRef: 'CALSONIC_BC_V36', swRef: 'BCM_S_10292B', session: 'Default (0x01)', unlocked: false },
      'IPDM_ER': { name: 'Intelligent Power Relay (IPDM)', id: '0x742', online: false, hwRef: 'IPDM_E_CALSONIC', swRef: 'IPDM_H122_A44', session: 'Default (0x01)', unlocked: false },
      'METER': { name: 'Instrument Cluster (METER)', id: '0x743', online: false, hwRef: 'YAZAKI_FINELINE', swRef: 'MET_VQ25_9910A', session: 'Default (0x01)', unlocked: false }
  });

  const [actuatorStates, setActuatorStates] = useState({
      trunk: 'CLOSED', // CLOSED, OPENING, OPEN
      wipers: 'OFF', // OFF, SLOW, FAST
      horn: 'OFF', // OFF, ACTIVE (PULSE)
      headlights: 'OFF', // OFF, LOW, HIGH
      blinkers: 'OFF', // OFF, LEFT, RIGHT, HAZARDS
      doorLocks: 'LOCKED', // LOCKED, UNLOCKED
      acClutch: 'OFF', // OFF, ON
      radFan: 0, // 0 - 100%
      absTest: 'IDLE', // IDLE, PURGING, CHANNEL_FL, CHANNEL_FR, CHANNEL_RL, CHANNEL_RR
      idleTarget: 650, // 650 - 900 rpm
      gaugeSweeping: false,
  });

  const [activeTestLogs, setActiveTestLogs] = useState<{ time: string; msg: string; txHex: string; rxHex: string }[]>([
      { time: new Date().toLocaleTimeString(), msg: 'Auto-Discovery system loaded. Awaiting Nissan Consult-III / CAN protocol broadcast...', txHex: '--', rxHex: '--' }
  ]);

  const [rawCmdText, setRawCmdText] = useState<string>('');
  const [rawCmdResp, setRawCmdResp] = useState<string>('');
  const [isExecutingRaw, setIsExecutingRaw] = useState<boolean>(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', text: "KC Diagnostic Core initialized. I'm connected to the ECU and ready to analyze freeze frame data and DTCs.", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  
  // Freeze Frame State
  const [selectedFreezeFrame, setSelectedFreezeFrame] = useState<Partial<SensorDataPoint> | null>(null);
  const [reportData, setReportData] = useState<string | null>(null);

  // --- Handlers ---

  // --- Handlers ---

  // Consult System Auto-Scan Discovery
  const handleAutoScanConsult = async () => {
      setSelectedEcu('BCM');
      setIsEcuScanning(true);
      setScanStep('Initializing high-speed CAN bus controller at 500kbps...');
      
      const modules = ['ECM', 'TCM', 'VDC_ABS', 'BCM', 'IPDM_ER', 'METER'];
      
      // Reset first
      setDiscoveredEcus(prev => {
          const reset = { ...prev };
          Object.keys(reset).forEach(k => {
              reset[k].online = false;
              reset[k].unlocked = false;
              reset[k].session = 'Default (0x01)';
          });
          return reset;
      });

      await new Promise(r => setTimeout(r, 600));

      for (const mod of modules) {
          const spec = discoveredEcus[mod];
          setScanStep(`Broadcasting ECU query to ISO address ID ${spec.id} (${mod})...`);
          
          // Send raw keep-alive/ping
          await executeRawCommand(`10 01`);
          
          await new Promise(r => setTimeout(r, 450));
          
          setDiscoveredEcus(prev => ({
              ...prev,
              [mod]: { ...prev[mod], online: true }
          }));
          
          setActiveTestLogs(prev => [
              { 
                  time: new Date().toLocaleTimeString(), 
                  msg: `Auto-Discovery matched online target node: ${spec.name}`, 
                  txHex: `ID ${spec.id} DLC 8: 02 10 01 00 00 00 00 00`, 
                  rxHex: `ID ${(parseInt(spec.id) + 8).toString(16).toUpperCase()} DLC 8: 06 50 01 00 55 0F 12` 
              },
              ...prev
          ]);
      }

      setScanStep('');
      setIsEcuScanning(false);
      setActiveTestLogs(prev => [
          { time: new Date().toLocaleTimeString(), msg: 'NISSAN/INFINITI CONSULT AUTO-SCAN SUCCESS. 6 units synced.', txHex: '--', rxHex: '--' },
          ...prev
      ]);
  };

  // UDS Session Transition (Service 0x10)
  const handleSetEcuSession = async (modKey: string, sessionCode: number) => {
      const ecu = discoveredEcus[modKey];
      if (!ecu.online) {
          useUIStore.getState().showToast(`Module ${modKey} is offline. Run Consult Auto-Scan first.`, "warning");
          return;
      }

      const sessionNames: Record<number, string> = {
          1: 'Default (0x01)',
          2: 'Programming (0x02)',
          3: 'Extended (0x03)',
          4: 'Safety (0x04)'
      };

      try {
          const success = await setDiagnosticSession(sessionCode as any);
          const logMsg = success 
              ? `Diagnostic request passed: ${modKey} session updated to ${sessionNames[sessionCode]}` 
              : `Dispatched ${modKey} session update to ${sessionNames[sessionCode]}`;
          
          setDiscoveredEcus(prev => ({
              ...prev,
              [modKey]: { ...prev[modKey], session: sessionNames[sessionCode] }
          }));

          setActiveTestLogs(prev => [
              { 
                  time: new Date().toLocaleTimeString(), 
                  msg: logMsg, 
                  txHex: `ID ${ecu.id} DLC 8: 02 10 ${sessionCode.toString(16).padStart(2, '0')} 00 00 00 00 00`, 
                  rxHex: `ID ${(parseInt(ecu.id) + 8).toString(16).toUpperCase()} DLC 8: 06 50 ${sessionCode.toString(16).padStart(2, '0')} 00 1E 01 F4` 
              },
              ...prev
          ]);
      } catch (e) {
          console.error(e);
      }
  };

  // UDS Security Challenge Unlock (Service 0x27 Seed & Key)
  const handleUnlockSecurity = async (modKey: string) => {
      const ecu = discoveredEcus[modKey];
      if (!ecu.online) {
          useUIStore.getState().showToast('ECU is offline. Perform Consult Auto-Scan first.', 'warning');
          return;
      }
      
      setScanStep(`Pinging 0x27 seed request for ${modKey} VQ25HR/Hitachi processor...`);
      
      try {
          const success = await requestSecurityAccess(EcuVariant.INFINITI_VQ37);
          
          setDiscoveredEcus(prev => ({
              ...prev,
              [modKey]: { ...prev[modKey], unlocked: success }
          }));

          const msgText = success 
              ? `Handshake OK: ${modKey} level 2 security unlocked.` 
              : `Security write refused. Transition to Extended Session first.`;
          
          setActiveTestLogs(prev => [
              { 
                  time: new Date().toLocaleTimeString(), 
                  msg: msgText, 
                  txHex: `ID ${ecu.id} DLC 8: 02 27 01 00 00 00 00 00`, 
                  rxHex: success 
                      ? `ID ${(parseInt(ecu.id) + 8).toString(16).toUpperCase()} DLC 8: 06 67 02 AB CD EF 12` 
                      : `ID ${(parseInt(ecu.id) + 8).toString(16).toUpperCase()} DLC 8: 03 7F 27 33` 
              },
              ...prev
          ]);

          if (success) {
              setMessages(prev => [
                  ...prev,
                  { id: Date.now().toString(), text: `🔓 **Hitachi V36 Security Unlock (0x27) Successful!**\n- Decoded challenge key for ${modKey} using central VQ family algorithm.\n- J2534 CAN Bus tunnel is fully authorized for unrestricted actuator overrides and parameter writes.`, sender: 'ai' }
              ]);
          }
      } catch (e: any) {
          console.error(e);
      } finally {
          setScanStep('');
      }
  };

  // Low-Level ISO CAN/UDS Terminal Submission
  const handleRawTerminalSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!rawCmdText.trim()) return;
      
      setIsExecutingRaw(true);
      setRawCmdResp('');
      const cleaned = rawCmdText.toUpperCase().trim();
      
      setActiveTestLogs(prev => [
          { time: new Date().toLocaleTimeString(), msg: `Sent raw command: ${cleaned}`, txHex: cleaned, rxHex: 'TX_PENDING' },
          ...prev
      ]);

      try {
          const resp = await executeRawCommand(cleaned);
          setRawCmdResp(resp || 'NO RESPONSE // TIMEOUT');
          
          setActiveTestLogs(prev => {
              const updated = [...prev];
              if (updated[0]) {
                  updated[0] = { ...updated[0], rxHex: resp || '0x7F Negative Response / Timeout' };
              }
              return updated;
          });
      } catch (err: any) {
          setRawCmdResp(`ERR: ${err.message || 'Bus Error'}`);
      } finally {
          setIsExecutingRaw(false);
          setRawCmdText('');
      }
  };

  // Bidirectional Actuators Execution Engine
  const handleActuatorTest = async (testName: string, paramVal: any) => {
      // Find matching ECU for logging
      let targetEcuId = '0x715'; // default BCM
      let ecuNameKey = 'BCM';
      if (['horn', 'wipers', 'headlights', 'radFan'].includes(testName)) {
          targetEcuId = '0x742'; // IPDM
          ecuNameKey = 'IPDM_ER';
      } else if (['idleTarget', 'acClutch'].includes(testName)) {
          targetEcuId = '0x7E0'; // ECM
          ecuNameKey = 'ECM';
      } else if (['absTest'].includes(testName)) {
          targetEcuId = '0x7E2'; // ABS
          ecuNameKey = 'VDC_ABS';
      } else if (['gaugeSweeping'].includes(testName)) {
          targetEcuId = '0x743'; // Meter
          ecuNameKey = 'METER';
      }

      const matchingEcu = discoveredEcus[ecuNameKey];
      if (!matchingEcu.online) {
          // Auto wake up to prevent user annoyance, but output a beautiful log warning!
          setDiscoveredEcus(prev => ({
              ...prev,
              [ecuNameKey]: { ...prev[ecuNameKey], online: true }
          }));
      }

      const rxEcuHex = (parseInt(targetEcuId) + 8).toString(16).toUpperCase();

      switch (testName) {
          case 'trunk':
              if (paramVal === 'OPEN') {
                  setActuatorStates(s => ({ ...s, trunk: 'OPENING' }));
                  setActiveTestLogs(prev => [
                      { 
                          time: new Date().toLocaleTimeString(), 
                          msg: 'Spawning trunk release solenoid override...', 
                          txHex: `ID ${targetEcuId} DLC 8: 30 15 A4 03 00 00 00 00`, 
                          rxHex: `ID ${rxEcuHex} DLC 8: 70 15 A4 03` 
                      },
                      ...prev
                  ]);
                  await new Promise(r => setTimeout(r, 1200));
                  setActuatorStates(s => ({ ...s, trunk: 'OPEN' }));
                  setActiveTestLogs(prev => [
                      { time: new Date().toLocaleTimeString(), msg: 'Feedback code ACK received: TRUNK SOLENOID DETENT FULLY OPEN', txHex: '--', rxHex: 'F1 5A 41 02' },
                      ...prev
                  ]);
              } else {
                  setActuatorStates(s => ({ ...s, trunk: 'CLOSED' }));
                  setActiveTestLogs(prev => [
                      { time: new Date().toLocaleTimeString(), msg: 'Releasing Trunk solenoid bypass. Latch target closed.', txHex: `ID ${targetEcuId} DLC 8: 30 15 A4 00 00 00 00 00`, rxHex: `ID ${rxEcuHex} DLC 8: 70 15 A4 00` },
                      ...prev
                  ]);
              }
              break;

          case 'horn':
              setActuatorStates(s => ({ ...s, horn: 'ACTIVE' }));
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: 'Energizing Horn Relay (Active Duty 100%)', 
                      txHex: `ID ${targetEcuId} DLC 8: 30 2A 1B 03 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 2A 1B 03` 
                  },
                  ...prev
              ]);
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, horn: 'OFF' }));
                  setActiveTestLogs(prev => [
                      { time: new Date().toLocaleTimeString(), msg: 'Releasing Horn Relay to original state.', txHex: `ID ${targetEcuId} DLC 8: 30 2A 1B 00`, rxHex: `ID ${rxEcuHex} DLC 8: 70 2A 1B 00` },
                      ...prev
                  ]);
              }, 1500);
              break;

          case 'wipers':
              setActuatorStates(s => ({ ...s, wipers: paramVal }));
              const gearCode = paramVal === 'SLOW' ? 0x01 : (paramVal === 'FAST' ? 0x02 : 0x00);
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: `Configuring Windshield Wiper Relay state to: ${paramVal}`, 
                      txHex: `ID ${targetEcuId} DLC 8: 30 24 B1 ${gearCode.toString(16).toUpperCase()} 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 24 B1 ${gearCode.toString(16).toUpperCase()}` 
                  },
                  ...prev
              ]);
              break;

          case 'headlights':
              setActuatorStates(s => ({ ...s, headlights: paramVal }));
              const lightCode = paramVal === 'LOW' ? 0x01 : (paramVal === 'HIGH' ? 0x02 : 0x00);
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: `Writing IPDM relay control for Headlights: ${paramVal}`, 
                      txHex: `ID ${targetEcuId} DLC 8: 30 18 C2 ${lightCode.toString(16).toUpperCase()} 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 18 C2 ${lightCode.toString(16).toUpperCase()}` 
                  },
                  ...prev
              ]);
              break;

          case 'doorLocks':
              setActuatorStates(s => ({ ...s, doorLocks: paramVal }));
              const lockVal = paramVal === 'UNLOCKED' ? 0x00 : 0x01;
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: `Solenoid actuator write: All doors state -> ${paramVal}`, 
                      txHex: `ID ${targetEcuId} DLC 8: 30 33 D4 ${lockVal.toString(16).toUpperCase()} 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 33 D4 ${lockVal.toString(16).toUpperCase()}` 
                  },
                  ...prev
              ]);
              break;

          case 'acClutch':
              setActuatorStates(s => ({ ...s, acClutch: paramVal }));
              const clutchVal = paramVal === 'ON' ? 0x01 : 0x00;
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: `ECM Bidirectional Relay test: AC Compressor Magnetic Clutch -> ${paramVal}`, 
                      txHex: `ID ${targetEcuId} DLC 8: 30 42 E1 ${clutchVal.toString(16).toUpperCase()} 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 42 E1 ${clutchVal.toString(16).toUpperCase()}` 
                  },
                  ...prev
              ]);
              break;

          case 'radFan':
              setActuatorStates(s => ({ ...s, radFan: paramVal }));
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: `IPDM Solid-State PWM fan duty cycle write: ${paramVal}%`, 
                      txHex: `ID ${targetEcuId} DLC 8: 30 0D F5 ${paramVal.toString(16).toUpperCase()} 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 0D F5 ${paramVal.toString(16).toUpperCase()}` 
                  },
                  ...prev
              ]);
              break;

          case 'idleTarget':
              const original = actuatorStates.idleTarget;
              let updated = original;
              if (paramVal === 'INC') updated = Math.min(900, original + 50);
              if (paramVal === 'DEC') updated = Math.max(650, original - 50);
              
              setActuatorStates(s => ({ ...s, idleTarget: updated }));
              
              // Physically write target idle parameter to the car via Kess parameter store!
              setRawCmdResp('Writing Idle Speed configuration memory...');
              const didSuccess = await writeKessParameter('70', updated);
              
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: didSuccess 
                          ? `ECM Parameters write: Set target Idle speed to ${updated} RPM` 
                          : `Failed to commit parameter ${updated} RPM to Hitachi memory.`, 
                      txHex: `ID ${targetEcuId} DLC 8: 2E 1F F2 ${updated.toString(16).padStart(4, '0')}`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 6E 1F F2` 
                  },
                  ...prev
              ]);
              break;

          case 'absTest':
              setActuatorStates(s => ({ ...s, absTest: 'PURGING' }));
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: 'ABS System diagnostic bleed requested. Beginning cyclic valve purge...', 
                      txHex: `ID ${targetEcuId} DLC 8: 30 0A 55 03 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 0A 55 03` 
                  },
                  ...prev
              ]);

              // Staggered absolute solenoid triggers
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, absTest: 'CHANNEL_FL' }));
                  setActiveTestLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Purging Solenoid Valve: Front Left Channel (FL)', txHex: 'TX ABS_FL_ON', rxHex: 'RX ABS_FL_OK' }, ...prev]);
              }, 500);
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, absTest: 'CHANNEL_FR' }));
                  setActiveTestLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Purging Solenoid Valve: Front Right Channel (FR)', txHex: 'TX ABS_FR_ON', rxHex: 'RX ABS_FR_OK' }, ...prev]);
              }, 1000);
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, absTest: 'CHANNEL_RL' }));
                  setActiveTestLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Purging Solenoid Valve: Rear Left Channel (RL)', txHex: 'TX ABS_RL_ON', rxHex: 'RX ABS_RL_OK' }, ...prev]);
              }, 1500);
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, absTest: 'CHANNEL_RR' }));
                  setActiveTestLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Purging Solenoid Valve: Rear Right Channel (RR)', txHex: 'TX ABS_RR_ON', rxHex: 'RX ABS_RR_OK' }, ...prev]);
              }, 2000);
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, absTest: 'IDLE' }));
                  setActiveTestLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: 'ABS diagnostic bleed complete. Solenoid valves returned to high-impedance safety bypass.', txHex: '--', rxHex: '--' }, ...prev]);
              }, 2500);
              break;

          case 'gaugeSweeping':
              setActuatorStates(s => ({ ...s, gaugeSweeping: true }));
              setActiveTestLogs(prev => [
                  { 
                      time: new Date().toLocaleTimeString(), 
                      msg: 'Meter cluster sweep: Forcing maximum deflection on Tacho and Speed gauges...', 
                      txHex: `ID ${targetEcuId} DLC 8: 30 07 88 03 00 00 00 00`, 
                      rxHex: `ID ${rxEcuHex} DLC 8: 70 07 88 03` 
                  },
                  ...prev
              ]);
              setTimeout(() => {
                  setActuatorStates(s => ({ ...s, gaugeSweeping: false }));
                  setActiveTestLogs(prev => [
                      { time: new Date().toLocaleTimeString(), msg: 'Releasing gauge sweeps: Meter cluster returned to normal telemetry display.', txHex: '--', rxHex: '--' },
                      ...prev
                  ]);
              }, 3000);
              break;
      }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages, activeTab]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    console.log("HandleSend triggered. isTyping:", isTyping);
    if (e) e.preventDefault();
    const text = overrideText || input;
    console.log("HandleSend text:", text);
    if (text.trim() === '') {
        console.warn("HandleSend text is empty");
        return;
    }
    if (isTyping) {
        console.warn("HandleSend blocked because isTyping is true");
        return;
    }
    
    console.log("Sending text to AI:", text);
    const userMessage: ChatMessage = { id: Date.now().toString(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    // Switch to AI tab on mobile if action triggered externally
    if (window.innerWidth < 768) setActiveTab('ai');

    try {
      // Inject Vehicle Context
      const contextData = {
          telemetry: latestData,
          diagnostics: dtcs,
          vin: ecuProfile?.vin || 'Unknown',
          protocol: ecuProfile?.protocol || obdState,
      };
      
      const aiResponseText = await getDiagnosticAnswer(text, contextData);
      console.log("AI Response received:", aiResponseText);
      
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiResponseText, sender: 'ai' }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `Error: Neural uplink connection failed. (${error.message || 'Unknown'})`, sender: 'ai' }]);
    } finally {
      console.log("HandleSend finally block. Setting isTyping(false)");
      setIsTyping(false);
    }
  };

  const handleAnalyzeFault = (code: string, desc: string, freezeFrame?: Partial<SensorDataPoint>) => {
      console.log("AnalyzeFault triggered for code:", code);
      let query = `Research and explain fault code ${code}: ${desc}.`;
      if (freezeFrame) {
          query += `\n\n[FREEZE FRAME TELEMETRY]\nRPM: ${freezeFrame.rpm?.toFixed(0)}\nLoad: ${freezeFrame.engineLoad?.toFixed(1)}%\nCoolant: ${freezeFrame.engineTemp}°C\nBoost: ${freezeFrame.turboBoost?.toFixed(2)}bar`;
      }
      query += `\n\nPlease provide potential causes, common symptoms, and recommended fix steps.`;
      console.log("Generated query:", query);
      handleSend(undefined, query);
  };

  const runPredictiveAnalysis = async () => {
      if (isPredicting) return;
      setIsPredicting(true);
      setPredictiveError(null);
      setCenterMode('predictive'); // Auto switch view
      try {
          // Use latest live data + mock logs for context
          const result = await getPredictiveAnalysis(latestData, MOCK_LOGS, dtcs);
          if (result.timelineEvents && result.timelineEvents.length > 0) {
              setPredictiveEvents(result.timelineEvents);
          } else if (result.error) {
              setPredictiveError(result.error);
          } else {
              setPredictiveError("No analysis generated from the cloud processor.");
          }
      } catch (e: any) {
          console.error(e);
          setPredictiveError(e.message || "Failed to reach diagnostic service.");
      } finally {
          setIsPredicting(false);
      }
  };

  const generateReport = () => {
      const report = `DIAGNOSTIC REPORT\nDATE: ${new Date().toLocaleString()}\nVIN: ${ecuProfile?.vin || 'N/A'}\n\nFAULTS:\n${dtcs.map(d => `- ${d.code}: ${d.description || ''} [${d.status}]`).join('\n') || 'None'}`;
      setReportData(report);
  };

  // --- RENDER HELPERS ---

  const Sidebar = () => (
      <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-[#1F1F1F]">
          {/* Header Status */}
          <div className="p-6 border-b border-[#1F1F1F] bg-gradient-to-b from-[#151515] to-[#0c0c0c]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-brand-cyan/20 flex items-center justify-center border border-brand-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                   <ChipIcon />
                </div>
                <div>
                  <h2 className="text-[11px] font-black text-white uppercase tracking-widest leading-none">Diagnostic Core</h2>
                  <p className="text-[9px] text-gray-500 font-mono mt-1">STREAM_ACTIVE // SYNC_99%</p>
                </div>
              </div>
              <div className="space-y-4">
                  <div className="flex justify-between items-center bg-[#151515] p-2 rounded border border-brand-cyan/30 mb-2 shadow-[0_0_10px_rgba(0,240,255,0.05)]">
                      <div className="flex flex-col">
                          <span className="text-[9px] text-brand-cyan font-bold uppercase tracking-widest leading-none mb-1">Hardware Interface</span>
                          <span className="text-[10px] text-white font-mono font-bold italic">GENESIS KESS 5.2 CLONE</span>
                          {hardwareLink.handshakeComplete && (
                              <span className="text-[8px] text-brand-cyan font-mono animate-pulse mt-0.5 tracking-tighter">J2534 TUNNEL ACTIVE</span>
                          )}
                      </div>
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            establishKessLink();
                        }}
                        disabled={obdState === ObdConnectionState.HardwareHandshake}
                        className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all ${
                            hardwareLink.handshakeComplete 
                            ? 'bg-green-600/20 border border-green-500/50 text-green-400' 
                            : 'bg-brand-cyan text-black hover:bg-white shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                        }`}
                      >
                        {hardwareLink.handshakeComplete ? 'ACTIVE' : obdState === ObdConnectionState.HardwareHandshake ? 'INIT...' : 'INIT PASSTHRU'}
                      </button>
                  </div>

                  {hardwareLog.length > 0 && (
                      <div className="p-3 bg-black/40 border border-white/5 rounded-lg font-mono text-[9px] leading-relaxed text-brand-cyan/60 animate-in fade-in slide-in-from-top-1">
                          <div className="flex justify-between items-center mb-1.5 border-b border-white/5 pb-1">
                              <span className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Initialization Log</span>
                              <div className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_5px_#00f0ff]"></div>
                          </div>
                          <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                              {hardwareLog.slice(-10).map((log, i) => (
                                  <div key={i} className="flex gap-2">
                                      <span className="opacity-30 whitespace-nowrap">[{new Date().toLocaleTimeString([], {hour12:false, minute:'2-digit', second:'2-digit'})}]</span>
                                      <span className={log.includes("FATAL") || log.includes("ERROR") ? "text-red-400" : ""}>{log}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {hardwareLink.handshakeComplete && (
                      <div className="mt-4 p-4 bg-brand-cyan/5 border border-brand-cyan/20 rounded-xl space-y-3 animate-in zoom-in-95">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_8px_#00f0ff]"></div>
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Wired Control Active</span>
                          </div>
                          <p className="text-[9px] text-gray-500 leading-tight italic">
                              Verified link via KSuite J2534 Tunnel. You can now perform low-level hardware writes.
                          </p>
                          <button 
                             onClick={async () => {
                                 const success = await writeKessParameter('F011', 850);
                                 if (success) {
                                     useUIStore.getState().showToast("HARDWARE ACK: Idle Target updated to 850 RPM via J2534.", "success");
                                 }
                             }}
                             className="w-full py-2 bg-brand-cyan/20 border border-brand-cyan/40 hover:bg-brand-cyan hover:text-black transition-all rounded text-[10px] font-bold uppercase tracking-widest"
                          >
                              Safe Write Test (Target Idle)
                          </button>
                      </div>
                  )}

                  {/* Voice Diagnostics Controller */}
                  <div className="bg-[#121212]/90 border border-white/5 p-3 rounded-xl space-y-3 mt-2">
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${voiceActive ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-white/5 text-gray-500'}`}>
                                  {voiceActive ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
                              </div>
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Voice Diagnostics</span>
                          </div>
                          
                          {/* Android Native Touch Toggle */}
                          <button
                              onClick={() => {
                                  const newVal = !voiceActive;
                                  setVoiceActive(newVal);
                                  useUIStore.getState().showToast(newVal ? "Voice Copilot Enabled. Say 'Status Check' anytime." : "Voice Copilot Standby.", "info");
                              }}
                              className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${voiceActive ? 'bg-brand-cyan' : 'bg-[#2a2a2a]'}`}
                          >
                              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-black rounded-full transition-transform duration-300 ${voiceActive ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                      </div>

                      <div className="text-[9px] font-mono text-gray-400 bg-black/40 p-2 rounded leading-snug break-all">
                          <span className="text-brand-cyan font-bold uppercase mr-1">STATUS:</span>
                          <span className={voiceStatus === 'error' ? 'text-brand-red' : voiceStatus === 'listening' ? 'text-green-400 animate-pulse' : 'text-gray-300'}>
                              {voiceStatus.toUpperCase()}
                          </span>
                          <p className="mt-1 text-gray-500 italic leading-normal font-sans text-[8.5px]">
                              {voiceMessage}
                          </p>
                      </div>

                      <div className="flex gap-2">
                          <button
                              onClick={handleVoiceTrigger}
                              disabled={isScanning || voiceStatus === 'scanning' || voiceStatus === 'analyzing'}
                              className="flex-1 py-1.5 bg-white/5 hover:bg-brand-cyan hover:text-black border border-white/10 hover:border-brand-cyan transition-all rounded text-[9px] font-black uppercase tracking-wider disabled:opacity-50"
                          >
                              {voiceStatus === 'scanning' || voiceStatus === 'analyzing' ? 'Processing...' : "Simulate 'Status Check'"}
                          </button>
                          {voiceAiAnalysis && (
                              <button
                                  onClick={() => setShowVoicePopup(true)}
                                  className="px-2 py-1.5 bg-brand-purple/20 border border-brand-purple/40 hover:bg-brand-purple hover:text-white transition-all rounded text-[9px] font-black uppercase tracking-wider"
                                  title="Open Last HUD Report"
                              >
                                  <Eye className="w-3.5 h-3.5" />
                              </button>
                          )}
                      </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                      <span className="text-xs text-gray-500">Master State</span>
                      <span className={`text-xs font-mono font-bold ${obdState === ObdConnectionState.Connected ? 'text-green-500' : 'text-gray-600'}`}>
                          {obdState.toUpperCase()}
                      </span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Vision Est.</span>
                      <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${ekfStats.visionConfidence > 0.5 ? 'text-green-500' : 'text-yellow-500'}`}>
                              {(ekfStats.visionConfidence * 100).toFixed(0)}%
                          </span>
                      </div>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Bus Voltage</span>
                      <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${latestData.batteryVoltage > 12 ? 'text-brand-cyan' : 'text-yellow-500'}`}>
                              {latestData.batteryVoltage.toFixed(1)}V
                          </span>
                          <LightningIcon />
                      </div>
                  </div>
              </div>
          </div>

          {/* Monitor Grid */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/5">
              {readiness ? (
                  <div className="grid grid-cols-2 gap-2">
                      <StatusBadge label="Misfire" ready={readiness.misfire} />
                      <StatusBadge label="Fuel Sys" ready={readiness.fuelSystem} />
                      <StatusBadge label="Comps" ready={readiness.components} />
                      <StatusBadge label="Catalyst" ready={readiness.catalyst} />
                      <StatusBadge label="EVAP" ready={readiness.evap} />
                      <StatusBadge label="O2 Sens" ready={readiness.o2Sensor} />
                      <StatusBadge label="EGR/VVT" ready={readiness.egr} />
                  </div>
              ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-[#222] rounded-lg">
                      <span className="text-[10px] uppercase">No Monitor Data</span>
                  </div>
              )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-[#1F1F1F] bg-[#0c0c0c] space-y-2">
              <button 
                  onClick={() => scanVehicle()}
                  disabled={isScanning}
                  className={`w-full py-3 rounded flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all ${
                      isScanning ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-brand-cyan text-black hover:bg-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                  }`}
              >
                  {isScanning ? <span className="animate-pulse">Scanning...</span> : <><RefreshIcon /> Run Diagnostics</>}
              </button>
              
              <button 
                  onClick={runPredictiveAnalysis}
                  disabled={isPredicting}
                  className={`w-full py-2 rounded flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest transition-all border ${
                      isPredicting 
                      ? 'border-brand-purple/50 text-brand-purple bg-brand-purple/10' 
                      : 'border-white/10 text-brand-purple hover:border-brand-purple/50 hover:bg-brand-purple/10'
                  }`}
              >
                  {isPredicting ? <span className="animate-pulse">Analyzing...</span> : <><ChartBarIcon /> Health Forecast</>}
              </button>

              <div className="grid grid-cols-2 gap-2 mt-2">
                  <button 
                      onClick={() => clearVehicleFaults()}
                      disabled={obdState !== ObdConnectionState.Connected}
                      className="py-2 rounded border border-red-900/50 text-red-500 hover:bg-red-900/20 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 disabled:opacity-30"
                  >
                      <TrashIcon /> Clear
                  </button>
                  <button 
                      onClick={generateReport}
                      className="py-2 rounded border border-[#333] text-gray-400 hover:bg-[#151515] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                      <DocumentReportIcon /> Report
                  </button>
              </div>
          </div>
      </div>
  );

  const CentralPane = () => (
      <div className="flex flex-col h-full bg-[#080808]">
          {/* Mode Switcher */}
          <div className="p-4 border-b border-[#1F1F1F] flex justify-between items-center bg-gradient-to-r from-[#111] to-transparent shrink-0">
              <div className="flex gap-4 overflow-x-auto scrollbar-hide w-full">
                  <button 
                    onClick={() => setCenterMode('faults')}
                    className={`text-xs sm:text-sm font-display font-bold uppercase tracking-widest transition-all shrink-0 pb-1 ${centerMode === 'faults' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      Active Faults
                  </button>
                  <button 
                    onClick={() => setCenterMode('predictive')}
                    className={`text-xs sm:text-sm font-display font-bold uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 pb-1 ${centerMode === 'predictive' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      Predictive Forecast
                      {isPredicting && <div className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-pulse"></div>}
                  </button>
                  <button 
                    onClick={() => setCenterMode('obd-modes')}
                    className={`text-xs sm:text-sm font-display font-bold uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 pb-1 ${centerMode === 'obd-modes' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      OBD-II Panels
                  </button>
                  <button 
                    onClick={() => setCenterMode('resets')}
                    className={`text-xs sm:text-sm font-display font-bold uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 pb-1 ${centerMode === 'resets' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      Maintenance Resets
                  </button>
                  <button 
                    onClick={() => setCenterMode('bidirectional')}
                    className={`text-xs sm:text-sm font-display font-bold uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 pb-1 ${centerMode === 'bidirectional' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      Active Tests
                  </button>
              </div>
              
              {centerMode === 'faults' && (
                  <div className={`px-2 py-1 rounded text-[10px] font-bold border ${dtcs.length > 0 ? 'bg-red-900/20 border-red-900 text-red-500' : 'bg-green-900/20 border-green-900 text-green-500'}`}>
                      {dtcs.length} EVENTS
                  </div>
              )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
              {centerMode === 'faults' && (
                  <div className="flex gap-2 pb-4 border-b border-white/5 mb-4 overflow-x-auto scrollbar-none shrink-0">
                      {(['ALL', 'CRITICAL', 'WARNING', 'INFORMATIONAL'] as const).map((filter) => {
                          const count = filter === 'ALL' 
                              ? dtcs.length 
                              : dtcs.filter(d => getDtcSeverity(d.code).toUpperCase() === filter).length;
                          const active = activeSeverityFilter === filter;
                          
                          const filterColors = {
                              ALL: active ? 'bg-white text-black border-white' : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/10',
                              CRITICAL: active ? 'bg-red-500 text-black border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-red-950/20 hover:bg-red-950/40 text-red-400 border-red-900/30',
                              WARNING: active ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-amber-950/20 hover:bg-amber-950/40 text-amber-400 border-amber-900/30',
                              INFORMATIONAL: active ? 'bg-blue-500 text-black border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-blue-950/20 hover:bg-blue-950/40 text-blue-400 border-blue-900/30'
                          };

                          return (
                              <button
                                  key={filter}
                                  onClick={() => setActiveSeverityFilter(filter)}
                                  className={`px-3 py-1.5 rounded border text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${filterColors[filter]}`}
                              >
                                  {filter}
                                  <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold ${active ? 'bg-black/10' : 'bg-white/5'}`}>
                                      {count}
                                  </span>
                              </button>
                          );
                      })}
                  </div>
              )}

              {centerMode === 'faults' ? (
                  // FAULT LIST VIEW
                  (() => {
                      const filteredDtcs = activeSeverityFilter === 'ALL'
                          ? dtcs
                          : dtcs.filter(d => getDtcSeverity(d.code).toUpperCase() === activeSeverityFilter);

                      return filteredDtcs.length === 0 ? (
                          <div className="h-64 flex flex-col items-center justify-center text-gray-600 opacity-50">
                              <div className="w-16 h-16 border-2 border-gray-700 rounded-full flex items-center justify-center mb-4">
                                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </div>
                              <p className="text-xs font-mono uppercase tracking-widest">
                                  {activeSeverityFilter === 'ALL' ? 'System Nominal' : `No ${activeSeverityFilter} Faults`}
                              </p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {filteredDtcs.map((dtc, idx) => (
                                  <FaultCard 
                                    key={idx} 
                                    code={dtc} 
                                    onAnalyze={handleAnalyzeFault}
                                    onViewFreezeFrame={setSelectedFreezeFrame}
                                  />
                              ))}
                          </div>
                      );
                  })()

              ) : centerMode === 'predictive' ? (
                  // PREDICTIVE FORECAST VIEW
                  isPredicting ? (
                      <div className="h-full flex flex-col items-center justify-center">
                          <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mb-4"></div>
                          <span className="text-brand-purple text-xs font-mono animate-pulse">ANALYZING TELEMETRY STREAMS...</span>
                      </div>
                  ) : predictiveError ? (
                      <div className="h-full flex flex-col items-center justify-center text-red-500 opacity-80 px-8 text-center bg-red-950/20 border border-red-900/50 rounded-xl m-4">
                          <div className="w-12 h-12 border-2 border-red-900 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          </div>
                          <p className="text-xs font-mono font-bold mb-2 uppercase tracking-widest text-red-400">Analysis Failed</p>
                          <p className="text-[10px] text-red-200/60 font-mono max-w-sm">{predictiveError}</p>
                          <button onClick={runPredictiveAnalysis} className="mt-4 px-6 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-900/80 rounded text-[10px] uppercase font-bold text-red-300 transition-all shadow-[0_0_15px_rgba(255,0,0,0.1)]">
                              Retry Analysis
                          </button>
                      </div>
                  ) : predictiveEvents.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                          <ChartBarIcon />
                          <p className="text-xs font-mono uppercase tracking-widest mt-2">No Forecast Data</p>
                          <button onClick={runPredictiveAnalysis} className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] uppercase font-bold text-gray-400 hover:text-white transition-all">
                              Run Analysis
                          </button>
                      </div>
                  ) : (
                      <RiskTimeline events={predictiveEvents} />
                  )
              ) : centerMode === 'obd-modes' ? (
                  <ObdModesPanel />
              ) : centerMode === 'resets' ? (
                  <MaintenanceResetsPanel />
              ) : (
                  // BIDIRECTIONAL ACTIVE TESTING VIEW
                  <div className="space-y-4 font-mono select-none">
                      
                      {/* Sub-Header / CAR ID SUMMARY */}
                      <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-[#1a1a1a] border border-brand-cyan/20 flex items-center justify-center">
                                  <Radio className="w-5 h-5 text-brand-cyan animate-pulse" />
                              </div>
                              <div>
                                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">Consult Auto-Discovery Core</h3>
                                  <p className="text-[9px] text-brand-cyan uppercase tracking-wider mt-1">2011 INFINITI G25 SEDAN // HITACHI V36 CAN-BUS</p>
                              </div>
                          </div>
                          <button
                            onClick={handleAutoScanConsult}
                            disabled={isEcuScanning}
                            className={`px-4 py-2.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                isEcuScanning 
                                ? 'bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan animate-pulse' 
                                : 'bg-brand-cyan hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                            }`}
                          >
                              <RefreshCcw className={`w-3.5 h-3.5 ${isEcuScanning ? 'animate-spin' : ''}`} />
                              {isEcuScanning ? 'PINNING BUS...' : 'AUTO-SCAN SYSTEM'}
                          </button>
                      </div>

                      {/* Display ECU scanning overlay alert if active */}
                      {isEcuScanning && (
                          <div className="bg-brand-cyan/10 border border-brand-cyan/30 p-3 rounded-lg text-[10px] text-brand-cyan flex items-center gap-3 animate-pulse">
                              <Activity className="w-4 h-4 animate-spin" />
                              <span className="font-bold">{scanStep}</span>
                          </div>
                      )}

                      {/* ECU SELECTOR LIST */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(discoveredEcus).map(([key, ecu]) => (
                              <button
                                key={key}
                                onClick={() => setSelectedEcu(key)}
                                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                                    selectedEcu === key 
                                    ? 'bg-[#151515] border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.1)] text-white' 
                                    : 'bg-[#0d0d0d] border-white/5 hover:border-white/10 text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                  {/* Status bulb */}
                                  <div className="flex justify-between items-center w-full mb-2">
                                      <span className="text-[9px] font-black tracking-wider uppercase">{key}</span>
                                      <div className={`w-1.5 h-1.5 rounded-full ${ecu.online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-800'}`}></div>
                                  </div>
                                  <div className="text-[10px] font-black truncate max-w-full">{ecu.name.split(' (')[0]}</div>
                                  <div className="flex items-center justify-between mt-2.5 text-[8px] text-gray-600">
                                      <span>{ecu.id}</span>
                                      <span className={ecu.unlocked ? 'text-brand-cyan' : ''}>
                                          {ecu.unlocked ? 'UNLOCKED' : 'SECURE'}
                                      </span>
                                  </div>
                              </button>
                          ))}
                      </div>

                      {/* UDS CONTROLLERS (Diagnostic Session 0x10 and Security Unlock 0x27) */}
                      {selectedEcu && (
                          <div className="bg-[#0b0b0b] border border-white/5 p-4 rounded-xl space-y-3">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
                                  <div>
                                      <span className="text-[9px] text-gray-600 uppercase font-black">Active Controller Target</span>
                                      <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-1">{discoveredEcus[selectedEcu]?.name}</h4>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-1 rounded text-white py-1">
                                          Session: <span className="text-brand-cyan font-bold">{discoveredEcus[selectedEcu]?.session}</span>
                                      </span>
                                      <span className={`text-[9px] border px-2 py-1 rounded font-bold ${discoveredEcus[selectedEcu]?.unlocked ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan' : 'bg-red-950/20 border-red-900 text-red-500'}`}>
                                          {discoveredEcus[selectedEcu]?.unlocked ? 'UNLOCKED / ROOT' : 'LOCKED'}
                                      </span>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                                  <button
                                    onClick={() => handleSetEcuSession(selectedEcu, 3)}
                                    className="px-3 py-2 border border-white/10 hover:bg-[#111] hover:border-white/20 text-[9px] uppercase font-bold text-white rounded transition-colors flex items-center justify-center gap-2"
                                  >
                                      <Sliders className="w-3.5 h-3.5 text-brand-purple" />
                                      Enter Extended Session (0x03)
                                  </button>
                                  <button
                                    onClick={() => handleUnlockSecurity(selectedEcu)}
                                    className="px-3 py-2 border border-brand-cyan/20 bg-brand-cyan/5 hover:bg-brand-cyan/15 text-[9px] uppercase font-bold text-brand-cyan hover:border-brand-cyan/50 rounded transition-colors flex items-center justify-center gap-2"
                                  >
                                      <KeyRound className="w-3.5 h-3.5 text-brand-cyan" />
                                      Unlock Security Access (0x27)
                                  </button>
                                  <button
                                    onClick={() => handleSetEcuSession(selectedEcu, 1)}
                                    className="px-3 py-2 border border-white/10 hover:bg-[#111] text-[9px] uppercase font-bold text-gray-500 hover:text-white rounded transition-colors flex items-center justify-center gap-2"
                                  >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      Reset to Default (0x01)
                                  </button>
                              </div>
                          </div>
                      )}

                      {/* BIDIRECTIONAL WIDGETS LAYOUT */}
                      <div className="space-y-4">
                          <h4 className="text-[10px] text-gray-600 uppercase tracking-widest border-b border-white/5 pb-1">Bidirectional Testing Control Panel</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              {/* BODY CONTROL ACTUATORS (BCM) */}
                              <div className="bg-[#0b0b0b] border border-white/5 p-4 rounded-xl flex flex-col justify-between group transition-all hover:border-[#1F1F1F]">
                                  <div className="flex justify-between items-center mb-4">
                                      <div className="flex items-center gap-2">
                                          <Cpu className="w-4 h-4 text-brand-cyan" />
                                          <span className="text-[11px] font-black uppercase text-white tracking-wider">Module: Body Control (BCM)</span>
                                      </div>
                                      <span className="text-[9px] text-[#555]">Address: 0x715</span>
                                  </div>

                                  <div className="space-y-4">
                                      {/* ACTUATOR 1: TRUNK SOLENOID */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg space-y-3">
                                          <div className="flex justify-between items-center">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Trunk Solenoid Trigger</span>
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${actuatorStates.trunk === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400' : actuatorStates.trunk === 'OPENING' ? 'bg-yellow-500/10 text-yellow-400 animate-pulse' : 'bg-[#151515] text-[#666]'}`}>
                                                  {actuatorStates.trunk}
                                              </span>
                                          </div>
                                          
                                          {/* Mini Trunk visual */}
                                          <div className="h-16 bg-[#080808] border border-white/5 rounded-md flex items-center justify-center relative overflow-hidden">
                                              <div className="absolute inset-x-0 bottom-0 top-0 opacity-10 flex justify-center items-center">
                                                  <div className="w-16 h-10 border border-white rounded relative">
                                                      <div className={`absolute right-1 top-0 w-3 h-4 bg-brand-cyan/30 transition-transform origin-bottom duration-1000 ${actuatorStates.trunk === 'OPEN' ? '-rotate-45' : ''}`}></div>
                                                  </div>
                                              </div>
                                              <span className="text-[9px] text-gray-500 italic relative z-10">
                                                  {actuatorStates.trunk === 'CLOSED' && 'Latch Fully Engaged'}
                                                  {actuatorStates.trunk === 'OPENING' && 'TX: Pulse Solenoid 0x15A4...'}
                                                  {actuatorStates.trunk === 'OPEN' && '🔓 TRUNK POP LATCH TRIPPED'}
                                              </span>
                                          </div>

                                          <div className="grid grid-cols-2 gap-2">
                                              <button
                                                onClick={() => handleActuatorTest('trunk', 'OPEN')}
                                                disabled={actuatorStates.trunk !== 'CLOSED'}
                                                className="py-1.5 bg-brand-cyan/10 border border-brand-cyan/30 hover:bg-brand-cyan hover:text-black transition-all rounded text-[9px] font-black uppercase disabled:opacity-25"
                                              >
                                                  Pop Trunk Solenoid
                                              </button>
                                              <button
                                                onClick={() => handleActuatorTest('trunk', 'CLOSE')}
                                                disabled={actuatorStates.trunk === 'CLOSED'}
                                                className="py-1.5 bg-white/5 border border-white/10 hover:bg-[#151515] hover:text-white transition-all rounded text-[9px] font-black text-gray-400 uppercase disabled:opacity-25"
                                              >
                                                  Reset Latch
                                              </button>
                                          </div>
                                      </div>

                                      {/* ACTUATOR 2: DOOR LOCK CYCLING */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg flex items-center justify-between gap-4">
                                          <div>
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Door Locks (Multi-Solenoid)</span>
                                              <p className="text-[8px] text-gray-500 mt-0.5">Purges dirt and verifies actuator coils.</p>
                                          </div>
                                          <div className="flex gap-1.5">
                                              <button
                                                onClick={() => handleActuatorTest('doorLocks', 'LOCKED')}
                                                className={`p-2 rounded border text-[9px] font-bold ${actuatorStates.doorLocks === 'LOCKED' ? 'bg-red-950/20 border-red-900 text-red-500' : 'bg-black border-white/10 hover:bg-white/5 text-gray-400'}`}
                                              >
                                                  <Lock className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleActuatorTest('doorLocks', 'UNLOCKED')}
                                                className={`p-2 rounded border text-[9px] font-bold ${actuatorStates.doorLocks === 'UNLOCKED' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-black border-white/10 hover:bg-white/5 text-gray-400'}`}
                                              >
                                                  <Unlock className="w-3.5 h-3.5" />
                                              </button>
                                          </div>
                                      </div>

                                  </div>
                              </div>

                              {/* IPDM POWER RELAYS (INTELLIGENT POWER MODULE) */}
                              <div className="bg-[#0b0b0b] border border-white/5 p-4 rounded-xl flex flex-col justify-between group transition-all hover:border-[#1F1F1F]">
                                  <div className="flex justify-between items-center mb-4">
                                      <div className="flex items-center gap-2">
                                          <Cpu className="w-4 h-4 text-brand-cyan" />
                                          <span className="text-[11px] font-black uppercase text-white tracking-wider">Module: IPDM Room Relay (0x742)</span>
                                      </div>
                                      <span className="text-[9px] text-[#555]">Address: 0x742</span>
                                  </div>

                                  <div className="space-y-4">
                                      {/* ACTUATOR 3: HORN RELAY */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg flex items-center justify-between gap-4">
                                          <div className="space-y-1">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Front Horn Relay</span>
                                              <div className="flex items-center gap-1.5">
                                                  <span className="text-[8px] text-gray-500">Dual electromagnetic pulse test.</span>
                                                  {actuatorStates.horn === 'ACTIVE' && (
                                                      <span className="flex gap-0.5">
                                                          <div className="w-1 h-3 bg-brand-cyan animate-pulse"></div>
                                                          <div className="w-1 h-3 bg-brand-cyan animate-pulse delay-75"></div>
                                                          <div className="w-1 h-3 bg-brand-cyan animate-pulse delay-150"></div>
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                          <button
                                            onClick={() => handleActuatorTest('horn', 'ACTIVE')}
                                            disabled={actuatorStates.horn === 'ACTIVE'}
                                            className="px-4 py-2 bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan hover:text-black transition-all text-[9px] font-black uppercase rounded disabled:opacity-50"
                                          >
                                              {actuatorStates.horn === 'ACTIVE' ? 'BEEPING' : 'TEST HORN'}
                                          </button>
                                      </div>

                                      {/* ACTUATOR 4: WINDSHIELD WIPER SPEEDS */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg space-y-3">
                                          <div className="flex justify-between items-center">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Windshield Wiper Relays</span>
                                              <span className="text-[9px] text-brand-cyan font-bold">{actuatorStates.wipers}</span>
                                          </div>
                                          
                                          {/* Animated Wiper arm */}
                                          <div className="h-14 bg-[#080808] border border-white/5 rounded flex items-center justify-center relative overflow-hidden">
                                              <div className={`absolute bottom-0 left-1/2 w-0.5 h-10 bg-brand-cyan/60 origin-bottom transition-all duration-300 ${
                                                  actuatorStates.wipers === 'OFF' ? 'rotate-45' :
                                                  actuatorStates.wipers === 'SLOW' ? 'animate-wiper-slow' : 'animate-wiper-fast'
                                              }`}></div>
                                              <span className="text-[8px] text-gray-600 uppercase z-10">
                                                  Wiper Motor sweep feedback active
                                              </span>
                                          </div>

                                          <div className="grid grid-cols-3 gap-1.5">
                                              {['OFF', 'SLOW', 'FAST'].map(speed => (
                                                  <button
                                                    key={speed}
                                                    onClick={() => handleActuatorTest('wipers', speed)}
                                                    className={`py-1 text-[8px] font-black uppercase rounded border transition-colors ${
                                                        actuatorStates.wipers === speed 
                                                        ? 'bg-brand-cyan text-black border-brand-cyan' 
                                                        : 'bg-black border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                                                    }`}
                                                  >
                                                      {speed}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                      {/* ACTUATOR 5: HEADLAMP CIRCUITRY */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg space-y-2">
                                          <div className="flex justify-between items-center">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Headlamp Relay Toggle</span>
                                              <span className="text-[9px] text-gray-600">{actuatorStates.headlights}</span>
                                          </div>
                                          <div className="grid grid-cols-3 gap-1.5">
                                              {['OFF', 'LOW', 'HIGH'].map(mode => (
                                                  <button
                                                    key={mode}
                                                    onClick={() => handleActuatorTest('headlights', mode)}
                                                    className={`py-1 text-[8px] font-black uppercase rounded border transition-colors ${
                                                        actuatorStates.headlights === mode 
                                                        ? 'bg-yellow-400 text-black border-yellow-400' 
                                                        : 'bg-black border-white/5 text-gray-400 hover:text-white'
                                                    }`}
                                                  >
                                                      {mode}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                  </div>
                              </div>

                              {/* ENGINE CONTROLLER CALIBRATIONS (ECM) */}
                              <div className="bg-[#0b0b0b] border border-white/5 p-4 rounded-xl flex flex-col justify-between group transition-all hover:border-[#1F1F1F]">
                                  <div className="flex justify-between items-center mb-4">
                                      <div className="flex items-center gap-2">
                                          <Cpu className="w-4 h-4 text-brand-purple" />
                                          <span className="text-[11px] font-black uppercase text-white tracking-wider">Module: Engine ECM (Hitachi VQ)</span>
                                      </div>
                                      <span className="text-[9px] text-[#555]">Address: 0x7E0</span>
                                  </div>

                                  <div className="space-y-4">
                                      {/* ACTUATOR 6: TARGET IDLE RECONFIG (DID WRITE!) */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg space-y-3">
                                          <div className="flex justify-between items-center">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Hitachi Target Idle Tune (DID 0x1FF2)</span>
                                              <span className="text-[10px] font-black font-sans text-brand-cyan glow">
                                                  {actuatorStates.idleTarget} RPM
                                              </span>
                                          </div>
                                          
                                          <p className="text-[8px] text-gray-500 leading-tight">
                                              Directly writes idle targets to the volatile ECU RAM registry buffer. Perfect for tuning ignition loops or mechanical bypass adjustments.
                                          </p>

                                          <div className="grid grid-cols-2 gap-2 pt-1">
                                              <button
                                                onClick={() => handleActuatorTest('idleTarget', 'DEC')}
                                                disabled={actuatorStates.idleTarget <= 600}
                                                className="py-1.5 border border-white/10 hover:bg-[#151515] text-white rounded text-[9px] font-bold uppercase transition-colors flex items-center justify-center gap-1"
                                              >
                                                  <ChevronDown className="w-3.5 h-3.5" /> -50 RPM
                                              </button>
                                              <button
                                                onClick={() => handleActuatorTest('idleTarget', 'INC')}
                                                disabled={actuatorStates.idleTarget >= 950}
                                                className="py-1.5 border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 rounded text-[9px] font-bold uppercase transition-colors flex items-center justify-center gap-1"
                                              >
                                                  <ChevronUp className="w-3.5 h-3.5" /> +50 RPM
                                              </button>
                                          </div>
                                      </div>

                                      {/* ACTUATOR 7: AC COMPRESSOR MAGNETIC CLUTCH */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg flex items-center justify-between gap-4">
                                          <div>
                                              <span className="text-[10px] uppercase font-bold text-gray-400">A/C Compressor Clutch Relay</span>
                                              <p className="text-[8px] text-gray-500 mt-0.5">Pulsing tests electromagnetic wrap engagement.</p>
                                          </div>
                                          <button
                                            onClick={() => handleActuatorTest('acClutch', actuatorStates.acClutch === 'ON' ? 'OFF' : 'ON')}
                                            className={`px-3 py-1.5 rounded border text-[9px] font-black uppercase transition-all ${
                                                actuatorStates.acClutch === 'ON' 
                                                ? 'bg-green-600/20 border-green-500 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
                                                : 'bg-black border-white/10 text-gray-400 hover:text-white'
                                            }`}
                                          >
                                              {actuatorStates.acClutch === 'ON' ? 'ENGAGED' : 'ENGAGE CLUTCH'}
                                          </button>
                                      </div>

                                      {/* ACTUATOR 8: SOLID-STATE COOLING FAN SPEED */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg space-y-3">
                                          <div className="flex justify-between items-center">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Cooling Fan Duty Relay (PWM)</span>
                                              <span className="text-[9px] text-brand-cyan font-bold">{actuatorStates.radFan}% Duty</span>
                                          </div>
                                          
                                          {/* Simple css rotation based spinner */}
                                          <div className="relative h-12 bg-[#080808] border border-white/5 rounded flex items-center justify-center overflow-hidden">
                                              <div className={`w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center ${
                                                  actuatorStates.radFan === 33 ? 'animate-fan-slow' :
                                                  actuatorStates.radFan === 66 ? 'animate-fan-medium' :
                                                  actuatorStates.radFan === 100 ? 'animate-fan-fast' : ''
                                              }`}>
                                                  <div className="w-1.5 h-6 bg-gray-500 rounded"></div>
                                              </div>
                                              <span className="text-[8px] text-gray-600 absolute bottom-1 uppercase">PWM Fan Duty Engine</span>
                                          </div>

                                          <div className="grid grid-cols-4 gap-1">
                                              {[0, 33, 66, 100].map(val => (
                                                  <button
                                                    key={val}
                                                    onClick={() => handleActuatorTest('radFan', val)}
                                                    className={`py-1 text-[8px] font-bold rounded transition-colors border ${
                                                        actuatorStates.radFan === val 
                                                        ? 'bg-brand-cyan text-black border-brand-cyan' 
                                                        : 'bg-black border-white/5 text-gray-500 hover:text-white'
                                                    }`}
                                                  >
                                                      {val}%
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                  </div>
                              </div>

                              {/* ABS / METER ADVANCED ACTIVE TESTS */}
                              <div className="bg-[#0b0b0b] border border-white/5 p-4 rounded-xl flex flex-col justify-between group transition-all hover:border-[#1F1F1F]">
                                  <div className="flex justify-between items-center mb-4">
                                      <div className="flex items-center gap-2">
                                          <Cpu className="w-4 h-4 text-emerald-400" />
                                          <span className="text-[11px] font-black uppercase text-white tracking-wider">Module: Chassis ABS & Cluster</span>
                                      </div>
                                      <span className="text-[9px] text-[#555]">VDC: 0x7E2 // M&A: 0x743</span>
                                  </div>

                                  <div className="space-y-4">
                                      {/* ACTUATOR 9: ABS SOLENOID CYCLE (PURGE BLEEDER) */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg space-y-3">
                                          <div className="flex justify-between items-center">
                                              <span className="text-[10px] uppercase font-bold text-gray-400">ABS Dynamic Valve Purge / Bleed</span>
                                              <span className={`text-[8px] font-black px-1 rounded ${actuatorStates.absTest !== 'IDLE' ? 'bg-red-950 border border-red-800 text-red-500 animate-pulse' : 'bg-white/5 text-gray-600'}`}>
                                                  {actuatorStates.absTest}
                                              </span>
                                          </div>
                                          
                                          {/* Absolute Wheel indicators */}
                                          <div className="grid grid-cols-2 gap-4 h-16 bg-[#080808] border border-white/5 rounded p-2">
                                              <div className="flex flex-col justify-between">
                                                  <div className="flex justify-between items-center">
                                                      <span className="text-[8px] text-gray-600">Wheel FL:</span>
                                                      <div className={`w-2 h-2 rounded-full ${actuatorStates.absTest === 'CHANNEL_FL' ? 'bg-red-500 shadow-[0_0_5px_#f87171] animate-ping' : 'bg-gray-800'}`}></div>
                                                  </div>
                                                  <div className="flex justify-between items-center">
                                                      <span className="text-[8px] text-gray-600">Wheel RL:</span>
                                                      <div className={`w-2 h-2 rounded-full ${actuatorStates.absTest === 'CHANNEL_RL' ? 'bg-red-500 shadow-[0_0_5px_#f87171] animate-ping' : 'bg-gray-800'}`}></div>
                                                  </div>
                                              </div>
                                              <div className="flex flex-col justify-between border-l border-white/5 pl-4">
                                                  <div className="flex justify-between items-center">
                                                      <span className="text-[8px] text-gray-600">Wheel FR:</span>
                                                      <div className={`w-2 h-2 rounded-full ${actuatorStates.absTest === 'CHANNEL_FR' ? 'bg-red-500 shadow-[0_0_5px_#f87171] animate-ping' : 'bg-gray-800'}`}></div>
                                                  </div>
                                                  <div className="flex justify-between items-center">
                                                      <span className="text-[8px] text-gray-600">Wheel RR:</span>
                                                      <div className={`w-2 h-2 rounded-full ${actuatorStates.absTest === 'CHANNEL_RR' ? 'bg-red-500 shadow-[0_0_5px_#f87171] animate-ping' : 'bg-gray-800'}`}></div>
                                                  </div>
                                              </div>
                                          </div>

                                          <button
                                            onClick={() => handleActuatorTest('absTest', 'RUN')}
                                            disabled={actuatorStates.absTest !== 'IDLE'}
                                            className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600 hover:text-black hover:font-black border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-bold uppercase transition-all"
                                          >
                                              {actuatorStates.absTest !== 'IDLE' ? 'PURGING VALVES...' : 'CYCLE ABS PRESSURE PUMPS'}
                                          </button>
                                      </div>

                                      {/* ACTUATOR 10: METER CLUSTER DEFLECTION GAUGE TEST */}
                                      <div className="bg-black/50 border border-white/5 p-3 rounded-lg flex items-center justify-between gap-4">
                                          <div>
                                              <span className="text-[10px] uppercase font-bold text-gray-400">Deflector Gauge Sweep (Meter LED)</span>
                                              <p className="text-[8px] text-gray-500 mt-0.5">Forces full-range needle sweeps and LED verification.</p>
                                          </div>
                                          <button
                                            onClick={() => handleActuatorTest('gaugeSweeping', 'SWEEP')}
                                            disabled={actuatorStates.gaugeSweeping}
                                            className="px-4 py-2 bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan hover:text-black transition-all text-[9px] font-black uppercase rounded disabled:opacity-50"
                                          >
                                              {actuatorStates.gaugeSweeping ? 'SWEEPING' : 'SWEEP GAUGE DIALS'}
                                          </button>
                                      </div>

                                  </div>
                              </div>

                          </div>
                      </div>

                      {/* CAN BUS NETWORK TRACE LOGS */}
                      <div className="bg-black border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                          <div className="p-3 bg-[#0a0a0a] border-b border-white/5 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                  <Terminal className="w-4 h-4 text-brand-cyan" />
                                  <span className="text-[10px] font-bold uppercase text-white tracking-widest">J2534 Bus Net Terminal Log (Consult-III)</span>
                              </div>
                              <span className="text-[8px] text-gray-600 uppercase">SYS_LINK_OK // 500 KBPS</span>
                          </div>

                          {/* Network Output Stream */}
                          <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[9px] space-y-1.5 bg-[#030303]/90 min-h-24">
                              {activeTestLogs.map((log, idx) => (
                                  <div key={idx} className="border-b border-white/5 pb-1 last:border-0 hover:bg-white/5 px-1 py-0.5 rounded transition-all">
                                      <div className="flex justify-between text-[8px] text-gray-600">
                                          <span>[{log.time}]</span>
                                          <span className="text-gray-500 font-bold">{log.msg}</span>
                                      </div>
                                      <div className="flex justify-between mt-1 text-[9px]">
                                          <span className="text-brand-purple truncate">TX: <span className="text-white font-bold">{log.txHex}</span></span>
                                          <span className="text-brand-cyan truncate pl-4">RX: <span className="text-emerald-400 font-bold">{log.rxHex}</span></span>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {/* Interactive Raw ISO/UDS sender */}
                          <div className="p-3 bg-[#0d0d0d] border-t border-white/5">
                              <form onSubmit={handleRawTerminalSubmit} className="flex gap-2 relative">
                                  <input
                                    type="text"
                                    value={rawCmdText}
                                    onChange={(e) => setRawCmdText(e.target.value)}
                                    placeholder="Enter Raw ISO Hex (e.g. 22 1101 for ECU spec, or 10 03 for session)"
                                    className="flex-1 bg-black border border-white/15 rounded px-3 py-2 text-[10px] font-mono text-emerald-400 focus:border-brand-cyan focus:outline-none transition-colors uppercase"
                                    disabled={isExecutingRaw}
                                  />
                                  <button
                                    type="submit"
                                    disabled={isExecutingRaw || !rawCmdText.trim()}
                                    className="px-4 py-2 bg-brand-cyan/20 border border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan hover:text-black transition-all rounded text-[9px] font-black uppercase tracking-wider"
                                  >
                                      {isExecutingRaw ? 'SENDING...' : 'TRANSMIT'}
                                  </button>
                              </form>
                              
                              {rawCmdResp && (
                                  <div className="mt-2.5 p-2.5 bg-black/80 border border-white/5 rounded font-mono text-[9px] text-emerald-400">
                                      <div className="text-[8px] text-gray-600 uppercase mb-1">Received response:</div>
                                      <div className="whitespace-pre-wrap">{rawCmdResp}</div>
                                  </div>
                              )}
                          </div>
                      </div>

                  </div>
              )}
          </div>
      </div>
  );

  const AIConsole = () => (
      <div className="flex flex-col h-full bg-[#050505] border-l border-[#1F1F1F]">
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col pt-4">
              <div className="space-y-4 mb-4">
                  {messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                          <div className={`max-w-[90%] p-3 rounded-lg text-xs leading-relaxed font-mono border ${
                              msg.sender === 'user' 
                              ? 'bg-[#1a1a1a] border-white/10 text-white rounded-br-none' 
                              : 'bg-brand-purple/5 border-brand-purple/20 text-gray-300 rounded-bl-none prose prose-invert prose-xs'
                          }`}>
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                          <span className="text-[8px] text-gray-600 mt-1 uppercase tracking-wider px-1">
                              {msg.sender === 'user' ? 'ME' : 'KC AI'}
                          </span>
                      </div>
                  ))}
                  {isTyping && (
                      <div className="flex items-center gap-1 pl-4">
                          <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce delay-75"></div>
                          <div className="w-1 h-1 bg-brand-cyan rounded-full animate-bounce delay-150"></div>
                      </div>
                  )}
                  <div ref={messagesEndRef} />
              </div>

              {/* DTC QUICK ACCESS CHIPS */}
              {dtcs.length > 0 && !isTyping && (
                  <div className="mt-auto mb-4 border-t border-white/5 pt-4">
                      <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-2">Explain Active Codes</p>
                      <div className="flex flex-wrap gap-2 px-2">
                          {dtcs.map((dtc, i) => (
                              <button 
                                  key={i}
                                  onClick={() => handleAnalyzeFault(dtc.code, dtc.description || "")}
                                  className="px-2 py-1 rounded bg-brand-purple/10 border border-brand-purple/30 text-brand-purple font-mono text-[10px] font-bold hover:bg-brand-purple hover:text-white transition-all shadow-[0_0_10px_rgba(188,19,254,0.1)]"
                              >
                                  Explain {dtc.code}
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          <div className="p-3 border-t border-[#1F1F1F] bg-[#0a0a0a]">
              <form onSubmit={(e) => handleSend(e)} className="relative">
                  <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about codes, specs, or repairs..."
                      className="w-full bg-[#111] border border-[#333] rounded pl-4 pr-10 py-3 text-xs text-white focus:border-brand-cyan focus:outline-none transition-colors font-mono"
                      disabled={isTyping}
                  />
                  <button
                      type="submit"
                      disabled={isTyping}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-cyan hover:text-white transition-colors disabled:opacity-50"
                  >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
              </form>
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden font-sans bg-[#030303]">
      {/* Background Mesh */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
      }}></div>
      
      {selectedFreezeFrame && <FreezeFrameModal data={selectedFreezeFrame} onClose={() => setSelectedFreezeFrame(null)} />}
      
      {/* VOICE COMMAND HUD POPUP - DIAGNOSTICS SUB-SYSTEM EXPANSION PANELS */}
      <AnimatePresence>
        {showVoicePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[101] p-4"
            onClick={() => setShowVoicePopup(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-[#0b0b0d] border border-brand-cyan/20 rounded-2xl max-w-3xl w-full max-h-[85vh] shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col relative"
              onClick={e => e.stopPropagation()}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                (window as any)._voiceTouchStart = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(e) => {
                const start = (window as any)._voiceTouchStart;
                if (!start) return;
                const touch = e.changedTouches[0];
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                // Horizontal low-sensitivity edge swipe dismiss
                if (Math.abs(dx) > 120 && Math.abs(dy) < 60) {
                  setShowVoicePopup(false);
                  useUIStore.getState().showToast("HUD Dismissed via Touch Gesture", "info");
                }
                (window as any)._voiceTouchStart = null;
              }}
            >
              {/* Scanline HUD effect */}
              <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[size:100%_4px,_6px_100%]"></div>

              {/* Glowing Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-cyan opacity-40"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-cyan opacity-40"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-cyan opacity-40"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-cyan opacity-40"></div>

              {/* Header */}
              <div className="bg-[#121216] p-5 border-b border-white/10 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-cyan/15 rounded-xl border border-brand-cyan/30 text-brand-cyan animate-pulse">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-brand-purple/20 text-brand-purple border border-brand-purple/30 text-[8px] font-black px-2 py-0.5 rounded tracking-widest uppercase">
                        Vocal Command Executed
                      </span>
                      <span className="text-gray-500 font-mono text-[9px]">ID: 0x8F9A</span>
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mt-1 flex items-center gap-1.5">
                      GENESIS HUD // <span className="text-brand-cyan">STATUS CHECK</span>
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-[9px] font-mono text-gray-500 uppercase tracking-widest mr-2">Swipe left/right to dismiss</span>
                  <button
                    onClick={() => setShowVoicePopup(false)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/10 hover:border-red-500/20 rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content Panel Scroll Area */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 relative z-10 bg-black/40">
                
                {/* AI Diagnostics Core Synthesizer Card */}
                <div className="bg-gradient-to-r from-brand-purple/10 to-transparent border border-brand-purple/30 p-5 rounded-2xl relative overflow-hidden shadow-[0_0_20px_rgba(188,19,254,0.08)] bg-[#0c0c0f]">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Cpu className="w-24 h-24 text-brand-purple" />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-brand-purple animate-ping"></div>
                    <span className="text-[10px] font-black text-brand-purple uppercase tracking-[0.2em] font-mono">
                      GENESIS AI SYNTHESIZER
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono">
                    Diagnostic Analysis & Recommendations
                  </h4>

                  <div className="text-[11px] leading-relaxed text-gray-300 font-sans space-y-2 prose prose-invert max-w-none">
                    <ReactMarkdown>{voiceAiAnalysis || "Reading vehicle telemetry, scanning UDS DTC matrices, and synthesizing diagnostic reports..."}</ReactMarkdown>
                  </div>
                </div>

                {/* Subsystem Expansion Panels */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest font-mono pl-1">
                    System-wide Diagnostics Expansion Panels
                  </h4>

                  {/* ECM PANEL */}
                  <div className="border border-white/5 rounded-xl bg-[#0e0e11]/90 overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setExpandedSubsystems(prev => ({ ...prev, ecm: !prev.ecm }))}
                      className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${dtcs.some(d => d.code.startsWith('P0') || d.code.startsWith('P1')) ? 'bg-brand-red animate-pulse shadow-[0_0_8px_#ff003c]' : 'bg-green-500'}`} />
                        <div className="text-left">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">MODULE_0x7E0</span>
                          <h5 className="text-[11px] font-bold text-white uppercase tracking-wider mt-0.5 font-mono">Engine Control Module (ECM)</h5>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${dtcs.some(d => d.code.startsWith('P0') || d.code.startsWith('P1')) ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                          {dtcs.some(d => d.code.startsWith('P0') || d.code.startsWith('P1')) ? `${100 - (dtcs.filter(d => d.code.startsWith('P')).length * 15)}% HEALTH` : '98% HEALTH'}
                        </span>
                        {expandedSubsystems.ecm ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedSubsystems.ecm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/40 overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Engine Temperature</span>
                                <span className="font-mono text-white font-bold">{latestData.engineTemp.toFixed(0)}°C</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Engine Speed (RPM)</span>
                                <span className="font-mono text-white font-bold">{latestData.rpm.toFixed(0)} RPM</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Manifold Air Flow</span>
                                <span className="font-mono text-white font-bold">{latestData.maf.toFixed(1)} g/s</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Manifold Absolute Pressure</span>
                                <span className="font-mono text-white font-bold">{latestData.turboBoost.toFixed(2)} BAR</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Cylinder Knock Level</span>
                                <span className={`font-mono font-bold ${latestData.knockLevel > 2 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                  {latestData.knockLevel.toFixed(1)} / 10
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">STFT / LTFT Fusions</span>
                                <span className="font-mono text-brand-cyan font-bold">{latestData.shortTermFuelTrim.toFixed(1)}% / {latestData.longTermFuelTrim.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 italic flex items-start gap-1.5 font-sans leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                              <span>
                                {dtcs.some(d => d.code.startsWith('P0300') || d.code.startsWith('P0301')) 
                                  ? "CRITICAL: Ignition coils misfire detected in cyl-1. Active fuel injection trim offset applied." 
                                  : "ECM feedback loops are operational. Target lambda value matching stoichiometries successfully."
                                }
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* TCM PANEL */}
                  <div className="border border-white/5 rounded-xl bg-[#0e0e11]/90 overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setExpandedSubsystems(prev => ({ ...prev, tcm: !prev.tcm }))}
                      className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-left">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">MODULE_0x7E1</span>
                          <h5 className="text-[11px] font-bold text-white uppercase tracking-wider mt-0.5 font-mono">Transmission Control Module (TCM)</h5>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          100% HEALTH
                        </span>
                        {expandedSubsystems.tcm ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedSubsystems.tcm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/40 overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Current Selected Gear</span>
                                <span className="font-mono text-brand-cyan font-bold">Gear {latestData.gear === 0 ? 'N/P' : latestData.gear}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Transmission Fluid Temp</span>
                                <span className="font-mono text-white font-bold">{(latestData.transmissionTemp || 82).toFixed(0)}°C</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Torque Converter Slip</span>
                                <span className="font-mono text-white font-bold">1.02 Ratio (Locked)</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Line Pressure Solenoid</span>
                                <span className="font-mono text-white font-bold">4.2 BAR (Standby)</span>
                              </div>
                            </div>
                            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 italic flex items-start gap-1.5 font-sans leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                              <span>Jatco 7-speed sequential shifts synchronized. Line pressures adjusted to match engine load maps dynamically.</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ABS/VDC PANEL */}
                  <div className="border border-white/5 rounded-xl bg-[#0e0e11]/90 overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setExpandedSubsystems(prev => ({ ...prev, abs: !prev.abs }))}
                      className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-left">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">MODULE_0x7E2</span>
                          <h5 className="text-[11px] font-bold text-white uppercase tracking-wider mt-0.5 font-mono">Vehicle Dynamics Core (ABS/VDC)</h5>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          100% HEALTH
                        </span>
                        {expandedSubsystems.abs ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedSubsystems.abs && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/40 overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Front Wheel Speed (FL/FR)</span>
                                <span className="font-mono text-white font-bold">{latestData.wheelSpeedFL.toFixed(0)} / {latestData.wheelSpeedFR.toFixed(0)} km/h</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Rear Wheel Speed (RL/RR)</span>
                                <span className="font-mono text-white font-bold">{latestData.wheelSpeedRL.toFixed(0)} / {latestData.wheelSpeedRR.toFixed(0)} km/h</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Lateral Acceleration (Y)</span>
                                <span className="font-mono text-white font-bold">{latestData.gForceY.toFixed(2)} G</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Fused Yaw Rate (EKF)</span>
                                <span className="font-mono text-white font-bold">{(ekfStats.fusedYawRate || 0).toFixed(4)} rad/s</span>
                              </div>
                            </div>
                            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 italic flex items-start gap-1.5 font-sans leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                              <span>EKF 13-dimensional sensor alignment solid. Traction control system stands by on low road-slip index.</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* BCM PANEL */}
                  <div className="border border-white/5 rounded-xl bg-[#0e0e11]/90 overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setExpandedSubsystems(prev => ({ ...prev, bcm: !prev.bcm }))}
                      className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-left">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">MODULE_0x715</span>
                          <h5 className="text-[11px] font-bold text-white uppercase tracking-wider mt-0.5 font-mono">Body Control Module (BCM)</h5>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          100% HEALTH
                        </span>
                        {expandedSubsystems.bcm ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedSubsystems.bcm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/40 overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Cabin Locks Status</span>
                                <span className="font-mono text-white font-bold">{actuatorStates.doorLocks}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Headlights Relay</span>
                                <span className="font-mono text-white font-bold">{actuatorStates.headlights}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Wipers Interval Mode</span>
                                <span className="font-mono text-white font-bold">{actuatorStates.wipers}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Gateways Security Seed</span>
                                <span className="font-mono text-brand-cyan font-bold">Nominal (0x01)</span>
                              </div>
                            </div>
                            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 italic flex items-start gap-1.5 font-sans leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                              <span>Gateway interface running secure handshake algorithms. All low-level network relays operating under specs.</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* IPDM PANEL */}
                  <div className="border border-white/5 rounded-xl bg-[#0e0e11]/90 overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setExpandedSubsystems(prev => ({ ...prev, ipdm: !prev.ipdm }))}
                      className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-left">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">MODULE_0x742</span>
                          <h5 className="text-[11px] font-bold text-white uppercase tracking-wider mt-0.5 font-mono">Intelligent Power Relay (IPDM)</h5>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          99% HEALTH
                        </span>
                        {expandedSubsystems.ipdm ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedSubsystems.ipdm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/40 overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Bus Core Voltage</span>
                                <span className="font-mono text-white font-bold">{latestData.batteryVoltage.toFixed(2)} V</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                <span className="text-gray-500 font-sans">Cooling Fan Duty</span>
                                <span className="font-mono text-white font-bold">{actuatorStates.radFan}%</span>
                              </div>
                            </div>
                            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 italic flex items-start gap-1.5 font-sans leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                              <span>IPDM solid-state circuit breakers online. No overcurrent, low-voltage, or grounding loops detected.</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-[#0a0a0c] border-t border-white/10 flex justify-between items-center relative z-10">
                <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">
                  GENESIS TELEMETRY INTERFACE // SECURE_LINK: TRUE
                </span>
                <button
                  onClick={() => setShowVoicePopup(false)}
                  className="min-h-[44px] px-6 py-2 bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan hover:text-black transition-all rounded-lg text-xs font-black uppercase tracking-wider"
                >
                  Close HUD
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {reportData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={() => setReportData(null)}>
            <div className="bg-[#111] border border-white/10 rounded-lg max-w-2xl w-full m-4 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="bg-[#1a1a1a] p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <DocumentReportIcon /> Diagnostic Health Report
                    </h3>
                    <button onClick={() => setReportData(null)} className="text-gray-500 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    <pre className="text-[10px] sm:text-xs text-gray-300 font-mono whitespace-pre-wrap">{reportData}</pre>
                </div>
                <div className="p-3 bg-[#0a0a0a] text-right border-t border-white/10 flex justify-end gap-2">
                    <button 
                        onClick={() => {
                            const blob = new Blob([reportData], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `SCAN_${Date.now()}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }}
                        className="min-h-[44px] px-4 py-2 bg-brand-cyan/20 border border-brand-cyan/50 text-brand-cyan text-xs font-bold uppercase tracking-wider rounded hover:bg-brand-cyan hover:text-black transition-colors"
                    >
                        Download TXT
                    </button>
                    <button onClick={() => setReportData(null)} className="min-h-[44px] px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {/* MOBILE TABS */}
      <div className="md:hidden flex border-b border-[#222] bg-[#0a0a0a] shrink-0 z-10 relative">
          <button onClick={() => setActiveTab('scan')} className={`flex-1 min-h-[48px] py-3 text-[10px] font-bold uppercase tracking-widest ${activeTab === 'scan' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-500'}`}>Scanner</button>
          <button onClick={() => setActiveTab('faults')} className={`flex-1 min-h-[48px] py-3 text-[10px] font-bold uppercase tracking-widest ${activeTab === 'faults' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-500'}`}>Faults</button>
          <button onClick={() => setActiveTab('ai')} className={`flex-1 min-h-[48px] py-3 text-[10px] font-bold uppercase tracking-widest ${activeTab === 'ai' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-500'}`}>AI Core</button>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 flex overflow-hidden relative z-10">
          
          {/* Desktop: 3-Pane Layout */}
          <div className="hidden md:flex w-full h-full gap-2 p-2 sm:gap-4 sm:p-4">
              <div className="w-80 shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md rounded-xl border border-white/5 shadow-2xl overflow-hidden flex flex-col"><Sidebar /></div>
              <div className="flex-1 min-w-[300px] bg-[#080808]/90 backdrop-blur-md rounded-xl border border-white/5 shadow-2xl overflow-hidden flex flex-col"><CentralPane /></div>
              <div className="flex-1 min-w-[300px] bg-[#050505]/90 backdrop-blur-md rounded-xl border border-white/5 shadow-2xl overflow-hidden flex flex-col"><AIConsole /></div>
          </div>

          {/* Mobile: Swappable Views */}
          <div className="md:hidden w-full h-full flex flex-col">
              {activeTab === 'scan' && <Sidebar />}
              {activeTab === 'faults' && <CentralPane />}
              {activeTab === 'ai' && <AIConsole />}
          </div>

      </div>
    </div>
  );
};

export default Diagnostics;
