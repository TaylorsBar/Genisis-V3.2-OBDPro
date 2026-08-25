import React, { useState, useMemo, useContext, useEffect, useRef, useCallback } from 'react';
import { 
    ResponsiveContainer, CartesianGrid, ComposedChart, Line, Area, XAxis, YAxis
} from 'recharts';
import { useRaceSession } from '../hooks/useRaceSession';
import { useVehicleStore } from '../stores/vehicleStore';
import { useLapTimerStore } from '../stores/lapTimerStore';
import { DragStripState, DragStats } from '../types';
import GForceMeter from '../components/widgets/GForceMeter';
import LiveAICoach from '../components/widgets/LiveAICoach';
import { RaceEngineerReport } from '../services/geminiService';
import { VehicleDynamics, TireDynamicsModel } from '../services/ATEngine';
import { KarapiroLogo } from '../components/KarapiroLogo';
import RaceCam from '../components/RaceCam';
import Immersive3DViewer from '../components/Immersive3DViewer';
import { AppearanceContext } from '../contexts/AppearanceContext';
import { LatencyEliminator } from '../services/ATEngine';

import { useFormattedVehicleData } from '../hooks/useFormattedVehicleData';
import { GGTraceDiagram } from '../components/widgets/GGTraceDiagram';
import { WithTelemetryOverlay } from '../components/dashboard/WithTelemetryOverlay';

// --- STYLED SUB-COMPONENTS ---

const AnalysisModal: React.FC<{ report: RaceEngineerReport, stats: DragStats, onClose: () => void }> = ({ report, stats, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[100] flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-700 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-6xl bg-[#080808] border border-white/10 rounded-3xl shadow-[0_0_120px_rgba(0,0,0,1)] flex flex-col lg:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Side: Key Metrics & Score */}
                <div className="w-full lg:w-96 bg-carbon bg-[length:12px_12px] p-10 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 shrink-0">
                    <KarapiroLogo className="h-12 w-auto mb-12 opacity-80" variant="monochrome" />
                    
                    <div className="mb-10 text-center">
                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-6">Performance Grade</span>
                        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="96" cy="96" r="90" fill="none" stroke="#111" strokeWidth="12" />
                                <circle 
                                    cx="96" cy="96" r="90" fill="none" stroke="#00F0FF" strokeWidth="12" 
                                    strokeDasharray={565} strokeDashoffset={565 - (report.score / 100 * 565)}
                                    strokeLinecap="round" className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-7xl font-display font-black text-white italic">{report.score}</span>
                                <span className="text-xs font-bold text-brand-cyan uppercase tracking-[0.2em]">Kinetic Index</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 group hover:border-brand-cyan transition-all flex justify-between items-center">
                            <div>
                                <span className="text-[10px] font-black text-gray-500 uppercase block mb-1 tracking-widest">1/4 Mile Time (E.T.)</span>
                                <span className="text-4xl font-mono font-bold text-white tabular-nums tracking-tighter">
                                    {stats.quarterMileTime?.toFixed(3) || '--.---'}
                                    <span className="text-sm ml-1 opacity-40 font-sans">s</span>
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-gray-500 uppercase block mb-1 tracking-widest">Trap Speed</span>
                                <span className="text-3xl font-mono font-bold text-white tabular-nums tracking-tighter">
                                    {stats.quarterMileSpeed?.toFixed(2) || '---.--'}
                                    <span className="text-sm ml-1 opacity-40 font-sans">km/h</span>
                                </span>
                            </div>
                        </div>

                        {/* NHRA Splits */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">Reaction Time</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.reactionTime ? stats.reactionTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">60 ft</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.sixtyFootTime ? stats.sixtyFootTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">330 ft</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.threeThirtyTime ? stats.threeThirtyTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">1/8 Mile Time</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.eighthMileTime ? stats.eighthMileTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">1/8 Mile Speed</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.eighthMileSpeed ? stats.eighthMileSpeed.toFixed(2) : '---'} <span className="text-[9px] text-gray-600">km/h</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">1000 ft</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.oneThousandTime ? stats.oneThousandTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">0-60 Mph</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.zeroToSixtyTime ? stats.zeroToSixtyTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">0-100 Mph</span>
                                <span className="text-sm font-mono font-bold text-white tabular-nums">{stats.zeroToHundredTime ? stats.zeroToHundredTime.toFixed(3) : '---'} <span className="text-[9px] text-gray-600">s</span></span>
                            </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 group hover:border-brand-purple transition-all mt-4">
                            <span className="text-[10px] font-black text-gray-500 uppercase block mb-1 tracking-widest">Launch Rating</span>
                            <span className={`text-5xl font-display font-black italic ${['A','B'].includes(report.metrics.launchGrade) ? 'text-green-500' : 'text-brand-red'}`}>
                                {report.metrics.launchGrade}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                <span className="text-[8px] font-black text-gray-600 uppercase block mb-1">Shift Efficiency</span>
                                <span className="text-lg font-mono font-bold text-brand-cyan">{report.metrics.shiftEfficiency}%</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                <span className="text-[8px] font-black text-gray-600 uppercase block mb-1">Density Altitude</span>
                                <span className="text-lg font-mono font-bold text-brand-cyan">{stats.densityAltitude.toFixed(0)} ft</span>
                            </div>
                        </div>
                    </div>

                    <button onClick={onClose} className="mt-10 w-full py-5 bg-brand-cyan text-black font-black uppercase tracking-[0.4em] rounded-xl text-xs hover:bg-white transition-all shadow-[0_0_40px_rgba(0,240,255,0.3)]">
                        Dismiss Debrief
                    </button>
                </div>

                {/* Main Content: AI Engineer Analysis */}
                <div className="flex-1 p-10 md:p-16 overflow-y-auto custom-scrollbar bg-gradient-to-br from-[#0a0a0a] to-[#030303] relative">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </div>

                    <div className="flex items-center gap-6 mb-12 border-b border-white/5 pb-8 relative z-10">
                        <div className="w-20 h-20 rounded-2xl bg-brand-purple/20 flex items-center justify-center border border-brand-purple/40 shadow-[0_0_30px_rgba(188,19,254,0.2)]">
                            <svg className="w-10 h-10 text-brand-purple animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-4xl font-display font-black text-white italic uppercase tracking-[0.1em] leading-none">NEURAL RACE ENGINEER</h2>
                            <p className="text-[11px] text-brand-purple font-mono uppercase tracking-[0.6em] mt-3 animate-pulse">ATE_CORE_V2.0 // DEEP_ANALYTICS_LINK</p>
                        </div>
                    </div>

                    <div className="mb-16 relative z-10">
                        <p className="text-2xl text-gray-100 leading-relaxed italic font-light border-l-8 border-brand-cyan pl-10 bg-brand-cyan/5 py-10 rounded-r-3xl">
                            "{report.summary}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        {report.coachingTips.map((tip, i) => (
                            <div key={i} className="bg-[#111]/80 backdrop-blur-md p-8 rounded-3xl border border-white/5 hover:border-brand-cyan/40 transition-all group shadow-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <span className="px-4 py-1.5 rounded-full bg-brand-cyan/10 text-brand-cyan text-[10px] font-black uppercase tracking-widest border border-brand-cyan/20 group-hover:bg-brand-cyan group-hover:text-black transition-all">
                                        {tip.category}
                                    </span>
                                    <div className="w-2.5 h-2.5 rounded-full bg-brand-cyan shadow-glow-cyan animate-pulse"></div>
                                </div>
                                <h4 className="text-white font-black uppercase tracking-tight text-xl mb-4 group-hover:text-brand-cyan transition-colors">{tip.advice}</h4>
                                <p className="text-sm text-gray-500 font-mono leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">{tip.technicalDetail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const RaceTree: React.FC<{ state: DragStripState }> = ({ state }) => {
    const stages = [
        { label: 'PRE', on: [DragStripState.PreStage, DragStripState.Stage, DragStripState.Amber1, DragStripState.Amber2, DragStripState.Amber3, DragStripState.Green, DragStripState.Running, DragStripState.Finished].includes(state), color: 'amber' },
        { label: 'STAGE', on: [DragStripState.Stage, DragStripState.Amber1, DragStripState.Amber2, DragStripState.Amber3, DragStripState.Green, DragStripState.Running, DragStripState.Finished].includes(state), color: 'amber' },
        { label: 'AMBER', on: [DragStripState.Amber1, DragStripState.Amber2, DragStripState.Amber3].includes(state), color: 'amber' },
        { label: 'AMBER', on: [DragStripState.Amber2, DragStripState.Amber3].includes(state), color: 'amber' },
        { label: 'AMBER', on: [DragStripState.Amber3].includes(state), color: 'amber' },
        { label: 'GREEN', on: [DragStripState.Green, DragStripState.Running, DragStripState.Finished].includes(state), color: 'green' },
        { label: 'RED', on: state === DragStripState.RedLight, color: 'red' }
    ];

    return (
        <div className="flex flex-col gap-4 p-10 bg-black/90 rounded-[48px] border border-white/10 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border-t-brand-cyan/20">
            {stages.map((st, i) => (
                <div key={i} className="flex items-center gap-8">
                    <div className={`w-16 h-16 rounded-full border-4 transition-all duration-75 flex items-center justify-center relative
                        ${st.on 
                            ? (st.color === 'amber' ? 'bg-brand-yellow border-yellow-200 shadow-[0_0_40px_#FCEE0A]' : (st.color === 'green' ? 'bg-green-500 border-green-200 shadow-[0_0_40px_#22c55e]' : 'bg-brand-red border-red-200 shadow-[0_0_40px_#FF003C]')) 
                            : 'bg-[#080808] border-black opacity-10'
                        }
                    `}>
                        <div className="w-full h-full rounded-full bg-gradient-to-tr from-black/50 to-transparent"></div>
                        {st.on && <div className="absolute inset-0 rounded-full animate-ping bg-current opacity-20"></div>}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${st.on ? 'text-white' : 'text-gray-800'}`}>{st.label}</span>
                </div>
            ))}
        </div>
    );
};

const RacePack: React.FC = () => {
    const { 
        session, 
        aiReport, 
        isAnalyzing, 
        isRecording, 
        toggleRecording, 
        setMode, 
        initLaunchSequence, 
        resetSession, 
        startCircuitSession,
        triggerStartLap,
        triggerMarkSector
    } = useRaceSession();
    const { isImmersive } = useContext(AppearanceContext);
    
    const [latestData, setLatestData] = useState<any>({
        rpm: 0, speed: 0, gear: 0, turboBoost: 0, throttlePos: 0, engineLoad: 0
    });

    // --- REAL-TIME PREDICTIVE DELTA CALCULATIONS ---
    const [sectorSpeedSum, setSectorSpeedSum] = useState(0);
    const [sectorSpeedCount, setSectorSpeedCount] = useState(0);
    
    const lastSplit1Ref = useRef<number | undefined>(undefined);
    const lastSplit2Ref = useRef<number | undefined>(undefined);
    const lastLapCountRef = useRef<number>(0);

    // Reset sector speed averages when sector transitions occur
    useEffect(() => {
        if (session.mode === 'CIRCUIT' && session.isActive) {
            const hasSplit1Changed = session.currentSplit1 !== lastSplit1Ref.current;
            const hasSplit2Changed = session.currentSplit2 !== lastSplit2Ref.current;
            const hasLapCountChanged = session.lapTimes.length !== lastLapCountRef.current;

            if (hasSplit1Changed || hasSplit2Changed || hasLapCountChanged) {
                setSectorSpeedSum(0);
                setSectorSpeedCount(0);
                
                lastSplit1Ref.current = session.currentSplit1;
                lastSplit2Ref.current = session.currentSplit2;
                lastLapCountRef.current = session.lapTimes.length;
            }
        }
    }, [session.currentSplit1, session.currentSplit2, session.lapTimes.length, session.mode, session.isActive]);

    // Accumulate real-time sector velocities
    useEffect(() => {
        if (session.mode === 'CIRCUIT' && session.isActive && latestData.speed > 0) {
            setSectorSpeedSum(prev => prev + latestData.speed);
            setSectorSpeedCount(prev => prev + 1);
        }
    }, [latestData.speed, session.mode, session.isActive]);

    // Compute real-time predictive delta comparing estimate finishing time vs best lap
    const predictiveDeltaData = useMemo(() => {
        if (session.mode !== 'CIRCUIT' || !session.isActive) return null;

        const currentLapTime = session.elapsedTime / 1000;
        const calculatedBestLap = session.lapTimes.length > 0 ? Math.min(...session.lapTimes.map(l => l.time)) : null;
        const bestLap = calculatedBestLap || 85.42; // standard benchmark reference

        const refS1 = useLapTimerStore.getState().bestSector1 || (bestLap * 0.3);
        const refS2 = useLapTimerStore.getState().bestSector2 || (bestLap * 0.4);
        const refS3 = useLapTimerStore.getState().bestSector3 || (bestLap * 0.3);

        const currentSpeed = latestData.speed || 10;
        const avgSectorSpeed = sectorSpeedCount > 0 ? (sectorSpeedSum / sectorSpeedCount) : currentSpeed;

        let currentSector: 1 | 2 | 3 = 1;
        let s1Est = refS1;
        let s2Est = refS2;
        let s3Est = refS3;

        // reference velocities
        const targetSpeedS1 = 90;
        const targetSpeedS2 = 140;
        const targetSpeedS3 = 110;

        if (session.currentSplit1 === undefined) {
            currentSector = 1;
            const remainingS1Percent = Math.max(0.05, 1 - (currentLapTime / refS1));
            const estRemainingS1 = refS1 * remainingS1Percent * (targetSpeedS1 / Math.max(20, avgSectorSpeed));
            s1Est = currentLapTime + estRemainingS1;
        } else if (session.currentSplit2 === undefined) {
            currentSector = 2;
            const s1Actual = session.currentSplit1;
            const s2Elapsed = currentLapTime - s1Actual;
            const remainingS2Percent = Math.max(0.05, 1 - (s2Elapsed / refS2));
            const estRemainingS2 = refS2 * remainingS2Percent * (targetSpeedS2 / Math.max(20, avgSectorSpeed));
            s1Est = s1Actual;
            s2Est = s2Elapsed + estRemainingS2;
        } else {
            currentSector = 3;
            const s1Actual = session.currentSplit1;
            const s2Actual = session.currentSplit2 - session.currentSplit1;
            const s3Elapsed = currentLapTime - session.currentSplit2;
            const remainingS3Percent = Math.max(0.05, 1 - (s3Elapsed / refS3));
            const estRemainingS3 = refS3 * remainingS3Percent * (targetSpeedS3 / Math.max(20, avgSectorSpeed));
            s1Est = s1Actual;
            s2Est = s2Actual;
            s3Est = s3Elapsed + estRemainingS3;
        }

        const estimatedTotalTime = s1Est + s2Est + s3Est;
        const delta = estimatedTotalTime - bestLap;

        return {
            estimatedTotalTime,
            delta,
            currentSector,
            avgSectorSpeed,
            bestLap
        };
    }, [session.mode, session.isActive, session.elapsedTime, session.currentSplit1, session.currentSplit2, session.lapTimes, latestData.speed, sectorSpeedSum, sectorSpeedCount]);

    // --- VOICE-ACTIVATED LAP TIMER LOGIC & STATES ---
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [actionNotification, setActionNotification] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const notificationTimeoutRef = useRef<any>(null);

    const triggerActionNotification = (text: string) => {
        if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
        setActionNotification(text);
        notificationTimeoutRef.current = setTimeout(() => {
            setActionNotification(null);
        }, 2200);
    };

    const startSpeechRecognition = useCallback(() => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setVoiceError("Speech API not supported");
            return;
        }

        try {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }

            const rec = new SpeechRecognitionAPI();
            rec.continuous = true;
            rec.interimResults = false;
            rec.lang = 'en-US';

            rec.onstart = () => {
                setVoiceError(null);
                setVoiceFeedback("Ready for commands...");
            };

            rec.onresult = (event: any) => {
                const lastResultIndex = event.resultIndex;
                const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
                
                console.log("Voice command:", transcript);

                if (transcript.includes("start lap") || transcript.includes("lap start") || transcript.includes("start")) {
                    triggerStartLap();
                    triggerActionNotification("START LAP");
                    setVoiceFeedback("Action: START LAP!");
                } else if (transcript.includes("mark sector") || transcript.includes("sector") || transcript.includes("split") || transcript.includes("mark")) {
                    triggerMarkSector();
                    triggerActionNotification("MARK SECTOR");
                    setVoiceFeedback("Action: MARK SECTOR!");
                } else {
                    setVoiceFeedback(`Heard: "${transcript}"`);
                }
            };

            rec.onerror = (e: any) => {
                console.error("Speech Recognition Error:", e);
                if (e.error !== 'no-speech' && e.error !== 'aborted') {
                    setVoiceError(`Error: ${e.error}`);
                }
            };

            rec.onend = () => {
                // Auto-restart if we are still active
                if (isVoiceActive && recognitionRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.error("Auto-restart failed", e);
                    }
                }
            };

            recognitionRef.current = rec;
            rec.start();
        } catch (e: any) {
            console.error("Failed to initialize speech recognition:", e);
            setVoiceError("Init failed");
        }
    }, [isVoiceActive, triggerStartLap, triggerMarkSector]);

    const stopSpeechRecognition = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {}
            recognitionRef.current = null;
        }
        setVoiceFeedback(null);
    }, []);

    useEffect(() => {
        if (isVoiceActive) {
            startSpeechRecognition();
        } else {
            stopSpeechRecognition();
        }
        return () => {
            stopSpeechRecognition();
        };
    }, [isVoiceActive, startSpeechRecognition, stopSpeechRecognition]);

    useEffect(() => {
        let rafId: number;
        let frameCount = 0;
        const loop = () => {
            frameCount++;
            if (frameCount % 3 === 0) { // 20Hz update rate
                const state = useVehicleStore.getState();
                setLatestData(state.latestData);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);
    
    const lastThrottleRef = React.useRef(latestData.throttlePos || 0);
    const predictedData = useMemo(() => {
        const { predictedRpm, predictedLoad } = LatencyEliminator.predictState(
            latestData.rpm,
            latestData.engineLoad || 0,
            latestData.throttlePos || 0,
            lastThrottleRef.current
        );
        lastThrottleRef.current = latestData.throttlePos || 0;
        return { ...latestData, rpm: predictedRpm, engineLoad: predictedLoad };
    }, [latestData]);

    const d = useFormattedVehicleData(predictedData);

    const [viewMode, setViewMode] = useState<'HUD' | 'CAM' | '3D'>('HUD');
    const [telemetryTab, setTelemetryTab] = useState<'STRIP' | 'GG' | 'CHANNELS'>('STRIP');

    // --- ACCELERATION / BENCHMARK MODULE STATE ---
    const [perfMode, setPerfMode] = useState<'0-100' | '1/4_MILE' | 'ROLL_RACE'>('0-100');
    const [perfStatus, setPerfStatus] = useState<'IDLE' | 'STAGING' | 'COUNTDOWN' | 'ARMED' | 'RECORDING' | 'FINISHED'>('IDLE');
    const [rollStartSpeed, setRollStartSpeed] = useState(60);
    const [rollEndSpeed, setRollEndSpeed] = useState(130);
    const [perfCurrentTime, setPerfCurrentTime] = useState(0);
    const [perfCountdownTime, setPerfCountdownTime] = useState<number | null>(null);
    const [perfPeakG, setPerfPeakG] = useState(0);
    const [perfStartDistance, setPerfStartDistance] = useState(0);
    const [perfStartTimestamp, setPerfStartTimestamp] = useState<number | null>(null);
    const [perfRuns, setPerfRuns] = useState<any[]>(() => {
        try {
            const saved = localStorage.getItem('racepack_performance_runs');
            return saved ? JSON.parse(saved) : [];
        } catch (_) { return []; }
    });

    // Save performance runs to localStorage when they update
    useEffect(() => {
        localStorage.setItem('racepack_performance_runs', JSON.stringify(perfRuns));
    }, [perfRuns]);

    // Active Performance Tracking Effect
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (session.mode !== 'BENCHMARK') return;

        const speed = latestData.speed;
        const gForce = Math.sqrt((latestData.gForceX || 0)**2 + (latestData.gForceY || 0)**2);

        if (perfStatus === 'RECORDING' && gForce > perfPeakG) {
            setPerfPeakG(gForce);
        }

        // Auto-start on throttle movement (0-100 & 1/4 Mile)
        if (perfStatus === 'STAGING' && (perfMode === '0-100' || perfMode === '1/4_MILE')) {
            if (speed > 2) {
                setPerfStatus('RECORDING');
                setPerfStartTimestamp(performance.now());
                setPerfStartDistance(latestData.distance || 0);
                setPerfPeakG(gForce);
            }
        }

        // Armed Roll Race
        if (perfStatus === 'ARMED' && perfMode === 'ROLL_RACE') {
            if (speed >= rollStartSpeed) {
                setPerfStatus('RECORDING');
                setPerfStartTimestamp(performance.now());
                setPerfPeakG(gForce);
            }
        }

        // Active run recording
        if (perfStatus === 'RECORDING' && perfStartTimestamp) {
            const now = performance.now();
            const elapsed = (now - perfStartTimestamp) / 1000;
            setPerfCurrentTime(elapsed);

            let isFinished = false;
            let metricsStr = "";

            if (perfMode === '0-100') {
                if (speed >= 100) {
                    isFinished = true;
                    metricsStr = "0-100 KM/H";
                }
            } else if (perfMode === '1/4_MILE') {
                const distCovered = (latestData.distance || 0) - perfStartDistance;
                const QUARTER_MILE_METERS = 402.336;
                if (distCovered >= QUARTER_MILE_METERS) {
                    isFinished = true;
                    metricsStr = "1/4 MILE";
                }
            } else if (perfMode === 'ROLL_RACE') {
                if (speed >= rollEndSpeed) {
                    isFinished = true;
                    metricsStr = `${rollStartSpeed}-${rollEndSpeed} KM/H`;
                }
            }

            if (isFinished) {
                setPerfStatus('FINISHED');
                const newRun = {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    mode: perfMode,
                    time: elapsed,
                    peakG: perfPeakG > 0 ? perfPeakG : gForce,
                    metrics: metricsStr
                };
                setPerfRuns(prev => [newRun, ...prev].slice(0, 15));
            }
        }
    }, [latestData.speed, latestData.distance, perfStatus, perfMode, session.mode]);

    const startRollCountdown = () => {
        setPerfStatus('COUNTDOWN');
        setPerfCountdownTime(3);
        let count = 3;

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            count--;
            if (count > 0) {
                setPerfCountdownTime(count);
            } else if (count === 0) {
                setPerfCountdownTime(0); // Display "GO"
            } else {
                if (timerRef.current) clearInterval(timerRef.current);
                setPerfCountdownTime(null);
                setPerfStatus('ARMED');
            }
        }, 1000);
    };

    const handlePerfAction = () => {
        if (perfStatus === 'IDLE' || perfStatus === 'FINISHED') {
            if (perfMode === 'ROLL_RACE') {
                startRollCountdown();
            } else {
                setPerfStatus('STAGING');
                setPerfCurrentTime(0);
                setPerfPeakG(0);
            }
        } else {
            setPerfStatus('IDLE');
            if (timerRef.current) clearInterval(timerRef.current);
            setPerfCountdownTime(null);
            setPerfCurrentTime(0);
        }
    };

    const clearPerfRuns = () => {
        setPerfRuns([]);
    };

    // --- GPS PRECISION LAP TIMER INTEGRATION ---
    const [startFinishLine, setStartFinishLine] = useState<{ lat: number; lon: number } | null>(() => {
        try {
            const saved = localStorage.getItem('racepack_gps_line');
            return saved ? JSON.parse(saved) : null;
        } catch (_) { return null; }
    });

    useEffect(() => {
        if (startFinishLine) {
            localStorage.setItem('racepack_gps_line', JSON.stringify(startFinishLine));
        } else {
            localStorage.removeItem('racepack_gps_line');
        }
    }, [startFinishLine]);

    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // in metres
    };

    const currentGpsDistance = useMemo(() => {
        if (!startFinishLine || !latestData.latitude || !latestData.longitude) return null;
        return haversineDistance(latestData.latitude, latestData.longitude, startFinishLine.lat, startFinishLine.lon);
    }, [latestData.latitude, latestData.longitude, startFinishLine]);

    const circuitLaps = useMemo(() => {
        const best = session.lapTimes.length > 0 ? Math.min(...session.lapTimes.map(l => l.time)) : null;
        return session.lapTimes.map(lap => {
            let sectors: number[] = [];
            const hasSplit1 = typeof lap.split1 === 'number';
            const hasSplit2 = typeof lap.split2 === 'number';

            if (hasSplit1 && hasSplit2) {
                sectors = [
                    lap.split1!,
                    lap.split2! - lap.split1!,
                    Math.max(0, lap.time - lap.split2!)
                ];
            } else if (hasSplit1) {
                sectors = [
                    lap.split1!,
                    Math.max(0, lap.time - lap.split1!),
                    0
                ];
            } else {
                sectors = [lap.time * 0.3, lap.time * 0.4, lap.time * 0.3];
            }

            return {
                id: lap.lap.toString(),
                number: lap.lap,
                time: lap.time,
                sectors,
                isBest: lap.time === best,
                isRealSplit: hasSplit1
            };
        });
    }, [session.lapTimes]);

    const bestLapTime = useMemo(() => {
        return session.lapTimes.length > 0 ? Math.min(...session.lapTimes.map(l => l.time)) : null;
    }, [session.lapTimes]);

    const isRunning = session.dragState === DragStripState.Running || 
                      session.dragState === DragStripState.Green || 
                      (session.mode === 'CIRCUIT' && session.isActive) ||
                      (session.mode === 'BENCHMARK' && perfStatus === 'RECORDING');
                      
    const isDragFinished = session.dragState === DragStripState.Finished;

    return (
        <div className="h-full w-full bg-[#020202] flex flex-col font-sans text-gray-200 overflow-hidden relative selection:bg-brand-cyan">
            
            {/* VOICE ACTION HUD FLASH OVERLAY */}
            {actionNotification && (
                <div className="absolute inset-0 bg-brand-cyan/5 backdrop-blur-xs flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                    <div className="bg-black/95 border border-brand-cyan/40 p-10 sm:p-14 rounded-[32px] shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col items-center gap-5 max-w-xs text-center">
                        <div className="relative">
                            <div className="w-16 h-16 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full flex items-center justify-center animate-ping absolute inset-0 opacity-50"></div>
                            <div className="w-16 h-16 bg-brand-cyan/10 border border-brand-cyan/40 rounded-full flex items-center justify-center relative">
                                <svg className="w-8 h-8 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-1 mt-2">
                            <span className="text-[8px] font-black tracking-[0.4em] text-brand-cyan/80 uppercase block">VOICE COMMAND TRIGGERED</span>
                            <h3 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase">{actionNotification}</h3>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 1. ANALYSIS LAYER */}
            {aiReport && !isAnalyzing && (
                <AnalysisModal report={aiReport} stats={session.dragStats} onClose={() => resetSession()} />
            )}

            {/* 2. HEADER HUD */}
            {!isImmersive && (
                <div className="h-14 sm:h-20 bg-[#080808]/95 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-3 sm:px-10 shrink-0 z-40 animate-in slide-in-from-top duration-700 relative">
                    <div className="flex items-center gap-3 sm:gap-12">
                        <div className="flex flex-col">
                            <KarapiroLogo className="h-6 sm:h-10 w-auto mb-0.5 sm:mb-1" variant="full" />
                            <span className="text-[7px] sm:text-[9px] text-gray-600 font-mono uppercase tracking-[0.2em] sm:tracking-[0.5em]">RacePack Pro</span>
                        </div>
                        
                        <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
                        
                        <div className="flex bg-black/60 p-1 rounded-xl sm:rounded-2xl border border-white/5 shadow-inner">
                            <button 
                                onClick={() => setMode('DRAG')} 
                                disabled={isRunning}
                                className={`px-3 sm:px-6 py-1.5 sm:py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all active:scale-95 ${session.mode === 'DRAG' ? 'bg-brand-red text-white shadow-[0_0_20px_rgba(255,0,60,0.3)]' : 'text-gray-600 hover:text-white disabled:opacity-30'}`}
                            >
                                DRAG
                            </button>
                            <button 
                                onClick={() => setMode('CIRCUIT')} 
                                disabled={isRunning}
                                className={`px-3 sm:px-6 py-1.5 sm:py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all active:scale-95 ${session.mode === 'CIRCUIT' ? 'bg-brand-cyan text-black shadow-[0_0_20px_rgba(0,240,255,0.3)]' : 'text-gray-600 hover:text-white disabled:opacity-30'}`}
                            >
                                CIRCUIT
                            </button>
                            <button 
                                onClick={() => setMode('BENCHMARK')} 
                                disabled={isRunning}
                                className={`px-3 sm:px-6 py-1.5 sm:py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all active:scale-95 ${session.mode === 'BENCHMARK' ? 'bg-brand-purple text-white shadow-[0_0_20px_rgba(188,19,254,0.3)]' : 'text-gray-600 hover:text-white disabled:opacity-30'}`}
                            >
                                BENCHMARK
                            </button>
                        </div>
                    </div>

                    <div className="hidden sm:flex bg-black/60 p-1.5 rounded-2xl border border-white/5 gap-2">
                        <div className="bg-brand-purple/20 px-6 py-3 rounded-xl border border-brand-purple/40">
                            <span className="text-[10px] font-black text-brand-purple uppercase block mb-1">Gear</span>
                            <span className="text-4xl font-black text-white italic">{d.gear.display}</span>
                        </div>
                        <WithTelemetryOverlay dataKey="shortTermFuelTrim" title="Short Term Fuel Trim" className="bg-black/50 px-6 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                            <span className="text-[9px] font-black text-gray-500 uppercase">STFT</span>
                            <span className={`text-xl font-mono font-bold ${d.shortTermFuelTrim.value > 0 ? 'text-green-500' : 'text-brand-red'}`}>
                                {d.shortTermFuelTrim.formatted}%
                            </span>
                        </WithTelemetryOverlay>
                        <WithTelemetryOverlay dataKey="longTermFuelTrim" title="Long Term Fuel Trim" className="bg-black/50 px-6 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                            <span className="text-[9px] font-black text-gray-500 uppercase">LTFT</span>
                            <span className={`text-xl font-mono font-bold ${d.longTermFuelTrim.value > 0 ? 'text-green-500' : 'text-brand-red'}`}>
                                {d.longTermFuelTrim.formatted}%
                            </span>
                        </WithTelemetryOverlay>
                    </div>
                    <div className="flex bg-black/60 p-1 rounded-xl border border-white/5 shadow-inner">
                        <button 
                            onClick={() => setViewMode('HUD')}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'HUD' ? 'bg-brand-cyan text-black font-bold shadow-[0_0_15px_rgba(0,240,255,0.35)]' : 'text-gray-600 hover:text-white'}`}
                        >
                            HUD
                        </button>
                        <button 
                            onClick={() => setViewMode('CAM')}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'CAM' ? 'bg-brand-cyan text-black font-bold shadow-[0_0_15px_rgba(0,240,255,0.35)]' : 'text-gray-600 hover:text-white'}`}
                        >
                            TrackCam
                        </button>
                        <button 
                            onClick={() => setViewMode('3D')}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === '3D' ? 'bg-brand-cyan text-black font-bold shadow-[0_0_15px_rgba(0,240,255,0.35)]' : 'text-gray-600 hover:text-white'}`}
                        >
                            3D Twin
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* VOICE TIMING TRIGGER CONTROLLER */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsVoiceActive(!isVoiceActive)}
                                className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-95 ${isVoiceActive ? 'bg-brand-cyan/10 border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.25)] text-brand-cyan' : 'bg-black border-white/10 text-gray-500 hover:text-white hover:bg-white/5'}`}
                                title={voiceError || (isVoiceActive ? "Voice Lap Timer listening. Click to disable." : "Click to enable voice lap timer")}
                            >
                                <div className="relative">
                                    {isVoiceActive && (
                                        <span className="absolute -inset-1 rounded-full bg-brand-cyan/40 animate-ping"></span>
                                    )}
                                    <svg className={`w-4 h-4 ${isVoiceActive ? 'text-brand-cyan' : 'text-gray-500 group-hover:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col items-start leading-none text-left">
                                    <span className={`text-[9px] font-black tracking-widest uppercase ${isVoiceActive ? 'text-brand-cyan' : 'text-gray-500 group-hover:text-white'}`}>
                                        {isVoiceActive ? 'VOICE ON' : 'VOICE OFF'}
                                    </span>
                                    {isVoiceActive && (
                                        <span className="text-[7px] font-mono text-gray-500 uppercase mt-0.5 animate-pulse truncate max-w-[85px]">
                                            {voiceFeedback || 'LISTENING...'}
                                        </span>
                                    )}
                                </div>
                            </button>

                            {/* COMPANION MANUAL SHORTCUTS FOR ACCESSIBILITY AND TESTING */}
                            {isVoiceActive && (
                                <div className="flex gap-1 bg-black/50 p-1 rounded-xl border border-white/5 shadow-inner">
                                    <button
                                        onClick={triggerStartLap}
                                        className="px-2.5 py-1.5 bg-brand-cyan/20 border border-brand-cyan/30 hover:bg-brand-cyan hover:text-black transition-all text-[8px] font-bold uppercase rounded-lg"
                                        title="Simulate speaking 'Start Lap'"
                                    >
                                        Lap
                                    </button>
                                    <button
                                        onClick={triggerMarkSector}
                                        className="px-2.5 py-1.5 bg-brand-cyan/20 border border-brand-cyan/30 hover:bg-brand-cyan hover:text-black transition-all text-[8px] font-bold uppercase rounded-lg"
                                        title="Simulate speaking 'Mark Sector'"
                                    >
                                        Sector
                                    </button>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={toggleRecording}
                            className={`group flex items-center gap-4 px-6 py-3 rounded-xl border-2 transition-all active:scale-95 ${isRecording ? 'bg-red-600 border-red-400 animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.4)]' : 'bg-black border-white/10 hover:bg-white/5 hover:border-white/20'}`}
                        >
                            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-red-600 shadow-[0_0_8px_#dc2626]'}`}></div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${isRecording ? 'text-white' : 'text-gray-500 group-hover:text-white'}`}>
                                {isRecording ? 'RECORDING' : 'START LOG'}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* 3. MAIN WORKSPACE */}
            <div className="flex-1 relative flex overflow-hidden">
                
                {viewMode === '3D' && (
                    <div className="flex-1 flex overflow-hidden relative">
                        <Immersive3DViewer />
                    </div>
                )}
                
                {viewMode === 'HUD' ? (
                    <div className="flex-1 flex overflow-hidden relative">
                        <div className="absolute inset-0 bg-carbon opacity-10 pointer-events-none"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.04)_0%,transparent_80%)] pointer-events-none"></div>

                        {/* LEFT: Chassis Telemetry */}
                        {!isRunning && !isDragFinished && (
                            <div className="w-[360px] hidden lg:flex flex-col p-10 gap-12 border-r border-white/5 bg-black/20 backdrop-blur-xl z-30 animate-in slide-in-from-left duration-700">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em] mb-10">Friction Circle</span>
                                    <GForceMeter x={latestData.gForceX} y={latestData.gForceY} speedKph={latestData.speed} size={280} transparent />
                                </div>
                                
                                <div className="space-y-10 pt-10 border-t border-white/10">
                                    <WithTelemetryOverlay dataKey="tireGrip" title="Tire Grip" className="group">
                                        <div className="flex justify-between items-baseline mb-3">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-brand-cyan transition-colors">Grip Utilization</span>
                                            <span className="text-xs font-mono font-bold text-white">
                                                {VehicleDynamics.getGripUtilization(latestData.gForceX, latestData.gForceY, TireDynamicsModel.getDynamicFrictionLimit(latestData.speed)).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-[#111] rounded-full overflow-hidden p-0.5 border border-white/5">
                                            <div className="h-full bg-brand-cyan shadow-[0_0_15px_#00F0FF] rounded-full transition-all duration-300" 
                                                 style={{ width: `${Math.min(100, VehicleDynamics.getGripUtilization(latestData.gForceX, latestData.gForceY, TireDynamicsModel.getDynamicFrictionLimit(latestData.speed)))}%` }}></div>
                                        </div>
                                    </WithTelemetryOverlay>
                                    <WithTelemetryOverlay dataKey="gForceX" title="Lateral G Force & Slip Angle" className="group">
                                        <div className="flex justify-between items-baseline mb-3">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-brand-yellow transition-colors">Est. Slip Angle</span>
                                            <span className="text-xs font-mono font-bold text-white">
                                                {Math.abs(VehicleDynamics.estimateSlipAngle(latestData.gForceX, latestData.speed)).toFixed(1)}°
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-[#111] rounded-full overflow-hidden p-0.5 border border-white/5">
                                            <div className="h-full bg-yellow-400 shadow-[0_0_15px_#FBBF24] rounded-full transition-all duration-300" 
                                                 style={{ width: `${Math.min(100, Math.abs(VehicleDynamics.estimateSlipAngle(latestData.gForceX, latestData.speed)) * 10)}%` }}></div>
                                        </div>
                                    </WithTelemetryOverlay>
                                    <WithTelemetryOverlay dataKey="engineTemp" title="Thermal Envelope" className="group">
                                        <div className="flex justify-between items-baseline mb-3">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-brand-red transition-colors">Thermal Envelope</span>
                                            <span className="text-xs font-mono font-bold text-white">{d.engineTemp.formatted}°C</span>
                                        </div>
                                        <div className="h-2 w-full bg-[#111] rounded-full overflow-hidden p-0.5 border border-white/5">
                                            <div className="h-full bg-brand-red shadow-[0_0_15px_#FF003C] rounded-full transition-all duration-300" style={{ width: `${d.engineTemp.barValue}%` }}></div>
                                        </div>
                                    </WithTelemetryOverlay>
                                    
                                    <div className="pt-6 border-t border-white/10">
                                        <LiveAICoach />
                                    </div>
                                </div>
                            </div>
                        )}
                                  {/* CENTER: CORE COCKPIT HUD */}
                        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-10 relative overflow-hidden min-h-0 w-full">
                            {session.mode === 'DRAG' && session.dragState === DragStripState.Idle && !session.isActive ? (
                                <div className="flex flex-col items-center gap-4 sm:gap-8 lg:gap-16 animate-in fade-in duration-1000 w-full max-w-4xl px-4 text-center">
                                    <div className="relative">
                                        <div className="absolute -inset-10 bg-brand-cyan/5 blur-3xl rounded-full"></div>
                                        <h2 className="text-3xl xs:text-5xl sm:text-7xl lg:text-8xl font-display font-black text-white uppercase italic tracking-tighter mb-2 lg:mb-6 leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">SYSTEM READY</h2>
                                        <p className="text-[7px] sm:text-xs lg:text-sm font-mono text-gray-600 uppercase tracking-[0.4em] lg:tracking-[0.8em]">Pre-Flight Checks Nominal // ATE_CORE ACTIVE</p>
                                    </div>
                                    <div className="flex gap-4 sm:gap-6 z-10 w-full justify-center">
                                        <button 
                                            onClick={initLaunchSequence}
                                            className="group relative w-full sm:w-auto px-6 sm:px-24 py-4 sm:py-8 bg-white text-black font-black uppercase tracking-[0.3em] lg:tracking-[0.5em] rounded-xl sm:rounded-2xl shadow-[0_30px_60px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-all overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-brand-cyan translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                            <span className="relative z-10 group-hover:text-black text-[10px] sm:text-base">INITIATE LAUNCH</span>
                                        </button>
                                    </div>
                                </div>
                            ) : session.mode === 'CIRCUIT' && !session.isActive ? (
                                <div className="flex flex-col items-center gap-6 sm:gap-10 animate-in fade-in duration-1000 w-full max-w-4xl px-4 text-center relative z-10 animate-in">
                                    <div className="relative">
                                        <div className="absolute -inset-10 bg-brand-cyan/5 blur-3xl rounded-full"></div>
                                        <h2 className="text-3xl sm:text-6xl font-display font-black text-white uppercase italic tracking-tighter leading-none">CIRCUIT TIMING</h2>
                                        <p className="text-xs font-mono text-brand-cyan uppercase tracking-[0.3em] mt-3">GPS PRECISION LAP BENCHMARKS</p>
                                    </div>

                                    {/* GPS Split Line Status */}
                                    <div className="bg-[#111]/80 border border-white/5 p-8 rounded-3xl max-w-xl w-full flex flex-col items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${startFinishLine ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-brand-yellow shadow-[0_0_10px_#FCEE0A] animate-pulse'}`}></div>
                                            <span className="text-xs font-mono uppercase tracking-widest text-gray-300">
                                                {startFinishLine ? 'GPS LAP LINE RECORDED' : 'AWAITING LAP LINE'}
                                            </span>
                                        </div>
                                        {startFinishLine ? (
                                            <div className="text-left font-mono text-[11px] text-gray-400 space-y-1">
                                                <p>GATE LAT: {startFinishLine.lat.toFixed(6)}</p>
                                                <p>GATE LON: {startFinishLine.lon.toFixed(6)}</p>
                                                {latestData.latitude && (
                                                    <p className="text-brand-cyan font-bold mt-2">CURRENT DISTANCE: {currentGpsDistance !== null ? `${currentGpsDistance.toFixed(1)}m` : '---'}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] font-mono text-gray-500 uppercase leading-relaxed text-center">
                                                Press the button below to register the start-finish gate at your current coordinates. Auto-timing starts when you cross it.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-lg">
                                        <button 
                                            onClick={() => {
                                                if (latestData.latitude && latestData.longitude) {
                                                    setStartFinishLine({ lat: latestData.latitude, lon: latestData.longitude });
                                                } else {
                                                    setStartFinishLine({ lat: -37.9012, lon: 175.4012 }); // Default simulate Lat/Lon
                                                }
                                            }}
                                            className="px-6 py-4 border border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan hover:text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all"
                                        >
                                            {startFinishLine ? "UPDATE BASE COORDS" : "SET BASE GPS GATE"}
                                        </button>
                                        <button 
                                            onClick={startCircuitSession}
                                            className="px-10 py-4 bg-brand-cyan text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-white transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                                        >
                                            START TIMING
                                        </button>
                                    </div>
                                </div>
                            ) : session.mode === 'BENCHMARK' && (perfStatus === 'IDLE' || perfStatus === 'FINISHED' || perfStatus === 'STAGING' || perfStatus === 'COUNTDOWN' || perfStatus === 'ARMED') ? (
                                <div className="flex flex-col items-center gap-6 sm:gap-10 animate-in fade-in duration-1000 w-full max-w-4xl px-4 text-center relative z-10 font-mono">
                                    <div className="relative">
                                        <h2 className="text-3xl sm:text-6xl font-display font-black text-brand-purple uppercase italic tracking-tighter leading-none">BENCHMARK RUNS</h2>
                                        <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.3em] mt-3">Industry Standard Sprint Calibration</p>
                                    </div>

                                    {/* Segmented Mode Selector */}
                                    <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/5 max-w-md w-full justify-between shadow-inner">
                                        <button 
                                            onClick={() => { setPerfMode('0-100'); setPerfStatus('IDLE'); }}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${perfMode === '0-100' ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(188,19,254,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            0-100 KPH
                                        </button>
                                        <button 
                                            onClick={() => { setPerfMode('1/4_MILE'); setPerfStatus('IDLE'); }}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${perfMode === '1/4_MILE' ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(188,19,254,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            1/4 Mile
                                        </button>
                                        <button 
                                            onClick={() => { setPerfMode('ROLL_RACE'); setPerfStatus('IDLE'); }}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${perfMode === 'ROLL_RACE' ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(188,19,254,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            Roll Race
                                        </button>
                                    </div>

                                    {/* Mode Specific Controller Context */}
                                    <div className="bg-[#111]/80 border border-white/5 p-6 sm:p-8 rounded-3xl max-w-xl w-full flex flex-col items-center gap-4">
                                        {perfMode === 'ROLL_RACE' ? (
                                            <div className="w-full space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Speed Bounds</span>
                                                    <span className="text-sm font-bold text-white font-mono">{rollStartSpeed} - {rollEndSpeed} KM/H</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] text-gray-600 block uppercase">START KPH</label>
                                                        <input 
                                                            type="range" min="40" max="100" step="5"
                                                            value={rollStartSpeed} 
                                                            onChange={(e) => {
                                                                const v = Number(e.target.value);
                                                                setRollStartSpeed(v);
                                                                if (rollEndSpeed <= v) setRollEndSpeed(v + 30);
                                                            }}
                                                            className="w-full accent-brand-purple"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] text-gray-600 block uppercase">END KPH</label>
                                                        <input 
                                                            type="range" min="110" max="250" step="5"
                                                            value={rollEndSpeed} 
                                                            onChange={(e) => setRollEndSpeed(Math.max(rollStartSpeed + 10, Number(e.target.value)))}
                                                            className="w-full accent-brand-purple"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] font-mono text-gray-500 uppercase leading-relaxed text-center">
                                                {perfMode === '0-100' 
                                                    ? "Continuous 200Hz tracking monitors throttle and crankshaft angle speed. Recording triggers instantly once vehicle velocity crosses 2 KPH."
                                                    : "Quarter mile (402.3 meters) calibration sequence. Triggers on launch; registers trap speed and NHRA splits dynamically to local log archives."
                                                }
                                            </p>
                                        )}

                                        {/* Run Result Showcase after finishing */}
                                        {perfStatus === 'FINISHED' && perfRuns[0] && (
                                            <div className="w-full border-t border-white/5 pt-4 mt-2 grid grid-cols-3 gap-2">
                                                <div className="text-center">
                                                    <span className="text-[8px] text-gray-500 block uppercase">TIME</span>
                                                    <span className="text-xl font-bold font-mono text-brand-purple">{perfRuns[0].time.toFixed(3)}s</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[8px] text-gray-500 block uppercase">PEAK G</span>
                                                    <span className="text-xl font-bold font-mono text-white">{perfRuns[0].peakG.toFixed(2)}G</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[8px] text-gray-500 block uppercase">METRIC</span>
                                                    <span className="text-xs font-bold font-mono text-gray-300 block leading-tight mt-1">{perfRuns[0].metrics}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Arming Trigger Button */}
                                    <div className="w-full max-w-sm">
                                        {perfStatus === 'COUNTDOWN' ? (
                                            <div className="w-24 h-24 rounded-full border-4 border-brand-purple flex items-center justify-center mx-auto bg-brand-purple/10 animate-pulse">
                                                <span className="text-4xl font-black text-white italic">{perfCountdownTime === 0 ? "GO!" : perfCountdownTime}</span>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={handlePerfAction}
                                                className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all italic active:scale-95 ${
                                                    perfStatus === 'STAGING' 
                                                        ? 'bg-brand-yellow text-black animate-pulse shadow-[0_0_20px_#FCEE0A]' 
                                                        : perfStatus === 'ARMED' 
                                                        ? 'bg-green-500 text-white animate-pulse shadow-[0_0_20px_#22c55e]'
                                                        : 'bg-brand-purple text-white shadow-[0_0_20px_rgba(188,19,254,0.3)]'
                                                }`}
                                            >
                                                {perfStatus === 'STAGING' 
                                                    ? 'STAGED // LAUNCH ON THROTTLE' 
                                                    : perfStatus === 'ARMED'
                                                    ? 'ARMED // REACH SPEED BOUNDARY'
                                                    : 'ARM BENCHMARK RUN'
                                                }
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : isRunning ? (
                                <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 relative py-4 sm:py-8 px-4 min-h-0">
                                    <div className="relative mb-0 sm:mb-4 lg:mb-6 flex flex-col items-center">
                                        <div className="relative transition-all duration-300 transform scale-75 sm:scale-100">
                                             <span className="font-display font-black text-white italic leading-none drop-shadow-[0_0_80px_rgba(255,255,255,0.15)] tracking-tighter block text-center" style={{ fontSize: 'clamp(4rem, 45vh, 24rem)' }}>
                                                {d.speed.formatted}
                                             </span>
                                             <span className="absolute -bottom-1 sm:-bottom-4 lg:-bottom-10 left-1/2 -translate-x-1/2 text-[10px] sm:text-xl lg:text-4xl font-display font-black text-brand-cyan tracking-[0.4em] lg:tracking-[0.6em] uppercase italic opacity-70 whitespace-nowrap">KM/H</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 sm:gap-12 lg:gap-24 mt-2 sm:mt-12 lg:mt-16 w-full max-w-5xl justify-center px-4 flex-wrap sm:flex-nowrap">
                                        {/* 1. GEAR */}
                                        <div className="flex flex-col items-center group shrink-0 min-w-[70px]">
                                            <span className="text-[7px] sm:text-[9px] lg:text-[11px] font-black text-gray-600 tracking-[0.2em] sm:tracking-[0.5em] uppercase mb-0.5 sm:mb-4 group-hover:text-brand-yellow transition-colors">Trans</span>
                                            <span className="text-3xl sm:text-6xl lg:text-9xl font-display font-black text-brand-yellow italic leading-none drop-shadow-glow-yellow">{d.gear.display}</span>
                                        </div>

                                        {/* 2. LAP TIME */}
                                        <div className="flex flex-col items-center bg-white/5 border border-white/10 px-4 sm:px-10 lg:px-12 py-2 sm:py-8 lg:py-10 rounded-xl sm:rounded-[32px] lg:rounded-[40px] backdrop-blur-3xl relative overflow-hidden group hover:border-brand-cyan/40 transition-all flex-grow max-w-[340px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50"></div>
                                            {isRecording && <div className="absolute top-1.5 sm:top-6 right-2 sm:right-8 w-1 sm:w-3 h-1 sm:h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_#dc2626]"></div>}
                                            <span className="text-[7px] sm:text-[9px] lg:text-[11px] font-black text-gray-500 tracking-[0.2em] sm:tracking-[0.5em] uppercase mb-0.5 sm:mb-4 relative z-10">
                                                {session.mode === 'BENCHMARK' ? 'Benchmark Time' : 'Run Time'}
                                            </span>
                                            <span className="text-xl sm:text-4xl lg:text-7xl font-mono font-bold text-white tabular-nums leading-none relative z-10">
                                                {session.mode === 'BENCHMARK' 
                                                    ? perfCurrentTime.toFixed(2)
                                                    : (session.elapsedTime / 1000).toFixed(2)
                                                }<span className="text-[10px] sm:text-xl lg:text-2xl text-gray-700 ml-0.5 sm:ml-2">s</span>
                                            </span>
                                        </div>

                                        {/* 3. PREDICTIVE DELTA (Circuit Mode exclusive) */}
                                        {session.mode === 'CIRCUIT' && predictiveDeltaData && (
                                            <div className="flex flex-col items-center bg-zinc-950/90 border border-white/10 px-4 sm:px-10 lg:px-12 py-2 sm:py-8 lg:py-10 rounded-xl sm:rounded-[32px] lg:rounded-[40px] backdrop-blur-3xl relative overflow-hidden group hover:border-brand-cyan/40 transition-all flex-grow max-w-[340px] animate-in slide-in-from-right duration-500">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-30"></div>
                                                <span className="text-[7px] sm:text-[9px] lg:text-[11px] font-black text-brand-cyan tracking-[0.2em] sm:tracking-[0.5em] uppercase mb-0.5 sm:mb-4 relative z-10">
                                                    Predictive Delta
                                                </span>
                                                <span className={`text-xl sm:text-4xl lg:text-7xl font-mono font-black tabular-nums leading-none relative z-10 ${
                                                    predictiveDeltaData.delta < 0 ? 'text-[#00F0FF] drop-shadow-[0_0_20px_rgba(0,240,255,0.4)]' : 'text-brand-red drop-shadow-[0_0_20px_rgba(255,0,60,0.4)]'
                                                }`}>
                                                    {predictiveDeltaData.delta < 0 ? '' : '+'}{predictiveDeltaData.delta.toFixed(2)}<span className="text-[10px] sm:text-xl lg:text-2xl text-gray-700 ml-0.5 sm:ml-2">s</span>
                                                </span>

                                                {/* MoTeC-style center-aligned live delta meter */}
                                                <div className="w-full mt-4 sm:mt-6 h-2 sm:h-3 bg-[#111] rounded-full overflow-hidden p-0.5 border border-[#ffffff10] relative z-10">
                                                    {/* Central 0.0s division line */}
                                                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/20 z-10"></div>
                                                    
                                                    {/* Color fill based on delta value (clamped between -2s and +2s) */}
                                                    {predictiveDeltaData.delta < 0 ? (
                                                        <div 
                                                            className="absolute top-0.5 bottom-0.5 bg-[#00F0FF] shadow-[0_0_10px_#00F0FF] rounded-l-full transition-all duration-300"
                                                            style={{
                                                                right: '50%',
                                                                width: `${Math.min(50, (Math.abs(predictiveDeltaData.delta) / 2) * 50)}%`
                                                            }}
                                                        ></div>
                                                    ) : (
                                                        <div 
                                                            className="absolute top-0.5 bottom-0.5 bg-brand-red shadow-[0_0_10px_#FF003C] rounded-r-full transition-all duration-300"
                                                            style={{
                                                                left: '50%',
                                                                width: `${Math.min(50, (predictiveDeltaData.delta / 2) * 50)}%`
                                                            }}
                                                        ></div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between w-full text-[8px] font-mono text-zinc-600 mt-2 uppercase tracking-widest relative z-10">
                                                    <span>-2.0s</span>
                                                    <span className="text-[9px] text-zinc-400 font-bold">Sector {predictiveDeltaData.currentSector} ({predictiveDeltaData.avgSectorSpeed.toFixed(0)} KPH)</span>
                                                    <span>+2.0s</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Aggressive RPM Progress Rail */}
                                    <div className="absolute bottom-2 sm:bottom-6 lg:bottom-10 left-4 sm:left-10 lg:left-20 right-4 sm:right-10 lg:left-20 h-4 sm:h-8 lg:h-10 bg-[#080808] rounded-full overflow-hidden border border-white/5 p-0.5 lg:p-1.5 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]">
                                        <div 
                                            className={`h-full transition-all duration-75 rounded-full relative overflow-hidden ${d.rpm.isRedline ? 'bg-brand-red animate-[pulse_0.1s_infinite] shadow-[0_0_40px_#FF003C]' : 'bg-brand-cyan shadow-[0_0_30px_#00F0FF]'}`} 
                                            style={{ width: `${Math.min((d.rpm.value / 9000) * 100, 100)}%` }}
                                        >
                                            <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,white_10px,white_20px)]"></div>
                                        </div>
                                    </div>
                                </div>
                            ) : isDragFinished || isAnalyzing ? (
                                <div className="flex flex-col items-center gap-12 animate-in zoom-in-105 duration-1000">
                                    <div className="relative w-56 h-56">
                                        <div className="absolute inset-0 border-8 border-brand-purple/10 rounded-full"></div>
                                        <div className="absolute inset-0 border-8 border-brand-purple border-t-transparent rounded-full animate-[spin_2s_linear_infinite]"></div>
                                        <div className="absolute inset-8 border-4 border-brand-cyan/20 border-b-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <KarapiroLogo className="w-24 h-auto opacity-20" variant="icon-only" />
                                        </div>
                                    </div>
                                    <div className="text-center space-y-6">
                                        <h2 className="text-5xl font-display font-black text-white uppercase italic tracking-[0.2em] animate-pulse">Processing Analysis</h2>
                                        <p className="text-sm font-mono text-gray-600 uppercase tracking-[0.6em] max-w-lg mx-auto leading-relaxed">Synthesizing 200Hz high-frequency sensor buffer with ATE Core v2.0 physics kernel...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-12">
                                    <div className="animate-in slide-in-from-bottom-20 duration-1000">
                                        <RaceTree state={session.dragState} />
                                    </div>
                                    {session.dragState === DragStripState.RedLight && (
                                        <div className="text-brand-red font-display font-black text-8xl italic tracking-tighter animate-bounce drop-shadow-[0_0_40px_rgba(255,0,60,0.5)]">FOUL START</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: High-BW Telemetry & Records */}
                        {!isRunning && !isDragFinished && (
                            <div className="w-[420px] hidden xl:flex flex-col border-l border-white/5 bg-black/20 backdrop-blur-xl z-30 animate-in slide-in-from-right duration-700">
                                {/* DYNAMIC TELEMETRY TABS */}
                                <div className="flex bg-[#0b0b0b] border-b border-white/5 p-1.5 gap-1 shrink-0">
                                    <button 
                                        onClick={() => setTelemetryTab('STRIP')}
                                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${telemetryTab === 'STRIP' ? 'bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Strip Charts
                                    </button>
                                    <button 
                                        onClick={() => setTelemetryTab('GG')}
                                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${telemetryTab === 'GG' ? 'bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        G-G Friction
                                    </button>
                                    <button 
                                        onClick={() => setTelemetryTab('CHANNELS')}
                                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${telemetryTab === 'CHANNELS' ? 'bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Live Channels
                                    </button>
                                </div>

                                <div className="h-[360px] border-b border-white/5 relative bg-black/40 flex flex-col justify-center overflow-hidden">
                                    {telemetryTab === 'STRIP' && (
                                        <div className="w-full h-full p-4 flex flex-col gap-3">
                                            {/* Stacked Chart 1: SPEED & THROTTLE */}
                                            <div className="flex-1 min-h-0 relative select-none">
                                                <div className="absolute top-1 left-2 z-10 text-[8px] font-mono font-bold text-brand-cyan uppercase tracking-wider">Speed & Throttle</div>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={session.data.slice(-150)}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                                                        <XAxis dataKey="time" hide />
                                                        <YAxis yAxisId="speed" hide domain={[0, 250]} />
                                                        <YAxis yAxisId="throttle" hide domain={[0, 100]} />
                                                        <Area yAxisId="speed" type="monotone" dataKey="speed" fill="#00F0FF" fillOpacity={0.06} stroke="#00F0FF" strokeWidth={2} dot={false} isAnimationActive={false} />
                                                        <Line yAxisId="throttle" type="monotone" dataKey="throttlePos" stroke="#BC13FE" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.5} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Stacked Chart 2: RPM & ENGINE LOAD */}
                                            <div className="flex-1 min-h-0 relative select-none border-t border-white/5 pt-2">
                                                <div className="absolute top-2 left-2 z-10 text-[8px] font-mono font-bold text-brand-yellow uppercase tracking-wider">RPM & Core Load</div>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={session.data.slice(-150)}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                                                        <XAxis dataKey="time" hide />
                                                        <YAxis yAxisId="rpm" hide domain={[0, 9000]} />
                                                        <YAxis yAxisId="load" hide domain={[0, 100]} />
                                                        <Line yAxisId="rpm" type="monotone" dataKey="rpm" stroke="#FCEE0A" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                        <Area yAxisId="load" type="monotone" dataKey="engineLoad" fill="#FF003C" fillOpacity={0.04} stroke="#FF003C" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} opacity={0.3} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {telemetryTab === 'GG' && (
                                        <div className="p-4 h-full">
                                            <GGTraceDiagram gForceX={latestData.gForceX || 0} gForceY={latestData.gForceY || 0} history={session.data} />
                                        </div>
                                    )}

                                    {telemetryTab === 'CHANNELS' && (
                                        <div className="w-full h-full p-6 flex flex-col justify-center gap-4">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[9px] font-mono tracking-wider">
                                                    <span className="text-gray-500 uppercase font-black">THROTTLE POSITION</span>
                                                    <span className="text-brand-cyan font-bold">{d.throttlePos.formatted}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                    <div className="h-full bg-brand-cyan shadow-glow-cyan rounded-full transition-all duration-150" style={{ width: `${d.throttlePos.barValue}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[9px] font-mono tracking-wider">
                                                    <span className="text-gray-500 uppercase font-black">ENGINE CALIBRATED LOAD</span>
                                                    <span className="text-brand-yellow font-bold">{d.engineLoad.formatted}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                    <div className="h-full bg-brand-yellow shadow-glow-yellow rounded-full transition-all duration-150" style={{ width: `${d.engineLoad.barValue}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[9px] font-mono tracking-wider">
                                                    <span className="text-gray-500 uppercase font-black">BOOST PRESSURE MANIFOLD</span>
                                                    <span className="text-brand-purple font-bold">{(latestData.turboBoost || 0).toFixed(1)} PSI</span>
                                                </div>
                                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                    <div className="h-full bg-brand-purple rounded-full transition-all duration-150" style={{ width: `${Math.min(100, ((latestData.turboBoost || 0) / 30) * 100)}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[9px] font-mono tracking-wider">
                                                    <span className="text-gray-500 uppercase font-black">ESTIMATED SLIP ANGLE</span>
                                                    <span className="text-white font-bold">{(Math.abs(VehicleDynamics.estimateSlipAngle(latestData.gForceX, latestData.speed))).toFixed(1)}°</span>
                                                </div>
                                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                    <div className="h-full bg-white/20 rounded-full transition-all duration-150" style={{ width: `${Math.min(100, Math.abs(VehicleDynamics.estimateSlipAngle(latestData.gForceX, latestData.speed)) * 10)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 flex flex-col p-12 overflow-hidden">
                                    <div className="flex justify-between items-baseline border-b border-white/5 pb-6 mb-10">
                                        <h3 className="text-[12px] font-black text-gray-600 uppercase tracking-[0.4em]">
                                            {session.mode === 'BENCHMARK' ? 'BENCHMARK RUNS' : 'Session Archives'}
                                        </h3>
                                        {session.mode === 'BENCHMARK' && perfRuns.length > 0 && (
                                            <button 
                                                onClick={clearPerfRuns}
                                                className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest"
                                            >
                                                CLEAR RUNS
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-4 animate-in">
                                        {session.mode === 'BENCHMARK' ? (
                                            perfRuns.length > 0 ? (
                                                perfRuns.map((run, i) => (
                                                    <div key={run.id} className="p-6 bg-[#111]/40 rounded-[24px] border border-white/5 flex justify-between items-center group hover:border-brand-purple/20 transition-all">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] group-hover:text-brand-purple transition-colors">{run.metrics} Run</span>
                                                            <span className="text-2xl font-mono font-bold text-white tracking-tighter mt-1">{run.time.toFixed(3)}<span className="text-xs ml-1 font-sans text-gray-600 uppercase">s</span></span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[9px] font-black text-gray-700 uppercase block tracking-widest mb-1">Peak Gs</span>
                                                            <span className="text-sm font-mono font-black text-brand-purple italic uppercase tracking-widest">{run.peakG.toFixed(2)}G</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6 text-center">
                                                    <svg className="w-16 h-16 text-brand-purple animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Ready to capture sprint logs</p>
                                                </div>
                                            )
                                        ) : session.mode === 'CIRCUIT' ? (
                                            circuitLaps.length > 0 ? (
                                                circuitLaps.slice().reverse().map((lap, i) => (
                                                    <div key={lap.id} className={`p-6 bg-[#111]/40 rounded-[28px] border transition-all ${lap.isBest ? 'border-brand-cyan bg-brand-cyan/5' : 'border-white/5 hover:bg-brand-cyan/5 hover:border-brand-cyan/25'}`}>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">LAP {lap.number}</span>
                                                                <span className="text-3xl font-mono font-bold text-white tracking-tighter mt-1">{lap.time.toFixed(3)}<span className="text-xs ml-1 text-gray-600 font-sans">s</span></span>
                                                            </div>
                                                            {lap.isBest && (
                                                                <span className="px-3 py-1 bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan rounded-full text-[9px] font-black uppercase tracking-wider italic animate-pulse">
                                                                    ★ BEST LAP
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-1 mt-4 pt-4 border-t border-white/5 font-mono text-[9px]">
                                                            <div>
                                                                <span className="text-gray-600 block">{lap.isRealSplit ? 'S1 (Voice)' : 'S1 (30%)'}</span>
                                                                <span className="text-gray-300 font-bold">{lap.sectors[0].toFixed(3)}s</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-600 block">{lap.isRealSplit ? 'S2 (Voice)' : 'S2 (40%)'}</span>
                                                                <span className="text-gray-300 font-bold">{lap.sectors[1].toFixed(3)}s</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-600 block">{lap.isRealSplit ? 'S3 (Voice)' : 'S3 (30%)'}</span>
                                                                <span className="text-gray-300 font-bold">{lap.sectors[2].toFixed(3)}s</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                                                    <svg className="w-16 h-16 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center">Ready to register circuit laps</p>
                                                </div>
                                            )
                                        ) : (
                                            session.lapTimes.length > 0 ? (
                                                session.lapTimes.slice().reverse().map((lap, i) => (
                                                    <div key={i} className="p-7 bg-[#111]/40 rounded-[32px] border border-white/5 flex justify-between items-center group hover:bg-brand-cyan/5 hover:border-brand-cyan/20 transition-all cursor-pointer">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] group-hover:text-brand-cyan transition-colors">Lap #0{lap.lap}</span>
                                                            <span className="text-3xl font-mono font-bold text-white tabular-nums tracking-tighter mt-1">{lap.time.toFixed(3)}<span className="text-sm ml-1 font-sans text-gray-600 uppercase">s</span></span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-black text-gray-700 uppercase block tracking-widest mb-1">Status</span>
                                                            <span className="text-xs font-mono font-black text-brand-purple italic uppercase tracking-widest">OPTIMAL</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                                                    <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-center">Waiting for telemetry lock</p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* --- TRACKCAM VIEWPORT --- */
                    <div className="flex-1 relative z-10 animate-in fade-in duration-700">
                        <RaceCam />
                        
                        {!isRunning && !isDragFinished && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-20">
                                <div className="text-center p-16 bg-black/90 rounded-[56px] border border-white/10 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-brand-cyan/5 pointer-events-none"></div>
                                    <h2 className="text-5xl font-display font-black text-white uppercase italic tracking-tighter mb-6">TrackCam Overlay</h2>
                                    <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.6em] mb-12">Optical Sensor Link Established</p>
                                    <button 
                                        onClick={session.mode === 'DRAG' ? initLaunchSequence : startCircuitSession}
                                        className="px-16 py-6 bg-brand-cyan text-black font-black uppercase tracking-[0.5em] rounded-2xl hover:bg-white transition-all shadow-[0_0_50px_rgba(0,240,255,0.4)] active:scale-95"
                                    >
                                        Initiate
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 4. SYSTEM STATUS RAIL */}
            <div className="h-8 sm:h-12 bg-[#050505] border-t border-white/5 flex items-center justify-between px-3 sm:px-10 z-50 shrink-0 relative">
                <div className="flex items-center gap-4 sm:gap-10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_#FF003C]"></div>
                        <span className="text-[7px] sm:text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest shrink-0">Link High-BW</span>
                    </div>
                    <div className="hidden xs:flex items-center gap-3 opacity-60">
                        <span className="text-[7px] sm:text-[10px] font-mono text-gray-600 uppercase tracking-widest">200Hz</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-10">
                    <div className="hidden sm:flex items-center gap-4">
                         <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Engine:</span>
                         <span className="px-4 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono font-black text-brand-yellow uppercase tracking-widest italic shadow-inner">ATE_V2_PRO</span>
                    </div>
                    <div className="h-3 sm:h-5 w-px bg-white/10 hidden sm:block"></div>
                    <span className="text-[7px] sm:text-[10px] font-mono text-gray-500 uppercase tracking-widest">AI Core: <span className="text-brand-purple font-black italic">G_PRO</span></span>
                </div>
            </div>

            <style>{`
                .shadow-glow-cyan { text-shadow: 0 0 15px rgba(0, 240, 255, 0.6); }
                .drop-shadow-glow-yellow { filter: drop-shadow(0 0 20px rgba(252, 238, 10, 0.4)); }
                .shadow-glow-red { box-shadow: 0 0 15px rgba(255, 0, 60, 0.3); }
            `}</style>
        </div>
    );
};

export default RacePack;