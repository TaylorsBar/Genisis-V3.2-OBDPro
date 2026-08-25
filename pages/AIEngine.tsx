import { HyperScoutService } from '../services/HyperScoutService';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import RiskTimeline from '../components/RiskTimeline';
import { useVehicleStore } from '../stores/vehicleStore';
import { getPredictiveAnalysis, getNeuroCoreCausality } from '../services/geminiService';
import { GenesisEKFUltimate } from '../utils/GenesisEKFUltimate';
import { MOCK_LOGS } from './MaintenanceLog';
import { TimelineEvent, ObdConnectionState } from '../types';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { 
  Brain, 
  Activity, 
  Cpu, 
  Radar, 
  Eye, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Search, 
  LineChart as ChartIcon, 
  FileText,
  ScanFace,
  Sliders,
  Terminal,
  Signal,
  Flame,
  AlertTriangle,
  Fingerprint,
  HardDrive
} from 'lucide-react';

// Signal Chart Component
const SignalChart: React.FC<{ data: any[], dataKey: string, color: string, label: string }> = ({ data, dataKey, color, label }) => (
    <div className="relative bg-[#0d0d12] border border-white/[0.08] rounded-xl p-3 flex flex-col h-28 overflow-hidden group hover:border-white/20 transition-all shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none z-0"></div>
        <div className="flex justify-between items-center mb-1.5 relative z-10">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] font-mono">{label}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color }}>
                {data.length > 0 && data[data.length - 1][dataKey] !== undefined ? Number(data[data.length - 1][dataKey]).toFixed(1) : '---'}
            </span>
        </div>
        <div className="flex-1 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <Line 
                        type="monotone" 
                        dataKey={dataKey} 
                        stroke={color} 
                        strokeWidth={1.5} 
                        dot={false} 
                        isAnimationActive={false} 
                        style={{ filter: `drop-shadow(0px 0px 4px ${color}80)` }}
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <XAxis hide />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#050508', border: '1px solid rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: 'monospace' }}
                        itemStyle={{ color: color }}
                        labelStyle={{ display: 'none' }}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-5 style-grid" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '15px 15px' }}></div>
    </div>
);

const AIEngine: React.FC = () => {
    const { vehicleConfig, setVehicleConfig, dtcs, obdState, connectObd, cognitiveState, setCognitiveState, dataSourceMode, setDataSourceMode } = useVehicleStore();
    
    const isConnected = obdState === ObdConnectionState.Connected;
    const isConnecting = obdState === ObdConnectionState.Connecting || obdState === ObdConnectionState.Initializing;
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [rpmError, setRpmError] = useState<string | null>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [history, setHistory] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'neurocore' | 'workload' | 'hyperscout' | 'ekf' | 'forecasting'>('neurocore');

    // ----------------------------------------------------
    // TAB 1: GENESIS NEUROCORE & KC CO-PILOT STATE
    // ----------------------------------------------------
    const [neuroReport, setNeuroReport] = useState<string | null>(null);
    const [activeCausality, setActiveCausality] = useState<string | null>(null);
    const [causalityLoading, setCausalityLoading] = useState(false);
    const [customQuery, setCustomQuery] = useState('');
    const [attentionWeights, setAttentionWeights] = useState<number[]>(Array(64).fill(0.1).map(() => Math.random()));
    const [systemCoherence, setSystemCoherence] = useState(99.4);

    // ----------------------------------------------------
    // TAB 2: INTENT PREDICTION & COGNITIVE WORKLOAD STATE
    // ----------------------------------------------------
    const { selectedTask, uiRegulationActive, simulatedCognitiveLoad, pupilDilation, heartRate, gsrValue } = cognitiveState || {
        selectedTask: 'torque',
        uiRegulationActive: true,
        simulatedCognitiveLoad: 48,
        pupilDilation: 3.4,
        heartRate: 76,
        gsrValue: 4.2
    };

    // ----------------------------------------------------
    // TAB 3: HYPER-SCOUT & GENA.I RE STATE
    // ----------------------------------------------------
    const [selectedMapAddress, setSelectedMapAddress] = useState<string>('0x6E21');
    const [fuzzerTerminal, setFuzzerTerminal] = useState<string[]>([
        '[SYSTEM] Hyper-Scout engine standby. Listening to CAN protocol pipeline...',
        '[PASSIVE] ISO 15765-4 broadcasts sniffed at 500kbps.',
        '[INFO] Baseline Shannon Entropy parsed: ~5.1 bits.'
    ]);
    const [isFuzzing, setIsFuzzing] = useState(false);
    const [dmaUnlocked, setDmaUnlocked] = useState(false);

    // ----------------------------------------------------
    // TAB 4: GENESIS EKF & PHYSICS KERNEL STATE
    // ----------------------------------------------------
    const ekfRef = useRef(new GenesisEKFUltimate());
    const [ekfStateOutput, setEkfStateOutput] = useState<number[]>(ekfRef.current.getState());
    const [gnssOutage, setGnssOutage] = useState(false);
    const [throttlePedal, setThrottlePedal] = useState(12);
    const [digitalTwinHistory, setDigitalTwinHistory] = useState<any[]>([]);
    const [stompActive, setStompActive] = useState(false);
    const [ekfVarianceX, setEkfVarianceX] = useState(0.01);
    const [ekfVarianceY, setEkfVarianceY] = useState(0.01);

    // ----------------------------------------------------
    // TAB 5: FORECASTING AGENT & HARMONIC DEGRADATION
    // ----------------------------------------------------
    const [spectralSource, setSpectralSource] = useState<'alternator' | 'fuel_pressure' | 'injector_latency'>('fuel_pressure');
    const [spectralHistory, setSpectralHistory] = useState<any[]>([]);
    const [mitigations, setMitigations] = useState<any[]>([
        { time: '14:20:05', system: 'CYLINDER_3', action: 'Timing trim adjusted by -1.5° (Knock variance predicted)', status: 'ACTIVE' },
        { time: '14:20:30', system: 'RAIL_PRESSURE', action: 'PID feed-forward coefficient smoothed (+5% dump damping)', status: 'ACTIVE' },
        { time: '14:21:15', system: 'WASTEGATE', action: 'Duty cycle flutter suppression filter active', status: 'ACTIVE' }
    ]);
    const [anomaliesSigma, setAnomaliesSigma] = useState(2.1);

    // Run actual multi-rate EKF prediction and update loops
    useEffect(() => {
        let frame = 0;
        const fusionLoop = setInterval(() => {
            frame++;
            const ekf = ekfRef.current;
            
            // 100Hz IMU Prediction (10ms dt)
            // Simulated sensor data with noise
            const ax = Math.sin(frame * 0.01) * 2 + (Math.random()-0.5)*0.1;
            const ay = Math.cos(frame * 0.01) * 1.5 + (Math.random()-0.5)*0.1;
            const az = 9.81 + (Math.random()-0.5)*0.2;
            const gx = (Math.random()-0.5)*0.05;
            const gy = (Math.random()-0.5)*0.05;
            const gz = 0.5 + (Math.random()-0.5)*0.05;
            
            const timestamp = frame * 10;
            ekf.predictIMU(ax, ay, az, gx, gy, gz, 0.01, timestamp);
            
            // 30Hz Visual Odometry Update
            if (frame % 3 === 0) {
                const s = ekf.getState();
                const vx = s[3] * 0.98 + (Math.random()-0.5)*0.1;
                const vy = s[4] * 0.98 + (Math.random()-0.5)*0.1;
                const vz = s[5] * 0.98;
                
                // Simulate 20ms network/processing latency for VO
                setTimeout(() => {
                    ekf.updateVisualOdometry(vx, vy, vz, timestamp);
                }, 20);
            }
            
            // 10Hz GNSS Update
            if (frame % 10 === 0) {
                if (gnssOutage) {
                    ekf.simulateDegradedGNSS();
                } else {
                    const s = ekf.getState();
                    const px = s[0] + (Math.random()-0.5)*1.2;
                    const py = s[1] + (Math.random()-0.5)*1.2;
                    const pz = s[2] + (Math.random()-0.5)*2.5; 
                    const vx = s[3] + (Math.random()-0.5)*0.3; 
                    const vy = s[4] + (Math.random()-0.5)*0.3;
                    const vz = s[5] + (Math.random()-0.5)*0.5;
                    
                    // Simulate 80ms transmission/satellite latency for GNSS (Asynchronous back-dated correction)
                    setTimeout(() => {
                        ekf.updateGNSS(px, py, pz, vx, vy, vz, timestamp);
                    }, 80);
                }
                
                // Commit to React state ONLY at 10Hz to save render bandwidth
                // Delay state commit slightly so we capture the back-dated corrections
                setTimeout(() => {
                    setEkfStateOutput(ekf.getState());
                    setEkfVarianceX(ekf.varianceX);
                    setEkfVarianceY(ekf.varianceY);
                }, 90);
            }
            
        }, 10); // Loop executes roughly every 10ms (100Hz)
        
        return () => clearInterval(fusionLoop);
    }, [gnssOutage]);

    // Dynamic attention weights update simulator
    useEffect(() => {
        const interval = setInterval(() => {
            setAttentionWeights(prev => prev.map(w => {
                const diff = (Math.random() - 0.5) * 0.3;
                return Math.max(0.02, Math.min(1, w + diff));
            }));
            const scale = Math.random() > 0.5 ? 1 : -1;
            setSystemCoherence(c => Math.max(98.1, Math.min(100, parseFloat((c + scale * 0.05).toFixed(2)))));
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    // Simulated Bio-markers matching tasks
    useEffect(() => {
        if (selectedTask === 'welding') {
            setCognitiveState({ simulatedCognitiveLoad: 84, pupilDilation: 4.9, heartRate: 118, gsrValue: 7.8 });
        } else if (selectedTask === 'torque') {
            setCognitiveState({ simulatedCognitiveLoad: 54, pupilDilation: 3.6, heartRate: 84, gsrValue: 4.8 });
        } else {
            setCognitiveState({ simulatedCognitiveLoad: 22, pupilDilation: 2.8, heartRate: 68, gsrValue: 2.1 });
        }
    }, [selectedTask, setCognitiveState]);

    // Digital twin simulation timing loops
    useEffect(() => {
        let clock = 0;
        const interval = setInterval(() => {
            clock++;
            setDigitalTwinHistory(prev => {
                const baseThrottle = stompActive ? 100 : (throttlePedal + Math.sin(clock * 0.4) * 3);
                // Digital Twin reacts immediately
                const twinResponse = baseThrottle * 1.15 + (stompActive ? 5 : 0);
                // Standard OBD lag response (lagged by 3 steps ~ 150ms)
                const lagIndex = prev.length - 3;
                const obdResponse = lagIndex >= 0 ? prev[lagIndex].twinValue * 0.88 : 0;
                
                const nextPoint = {
                    time: clock,
                    throttle: baseThrottle,
                    twinValue: twinResponse,
                    obdValue: Math.max(0, obdResponse)
                };
                const updated = [...prev, nextPoint];
                if (updated.length > 50) updated.shift();
                return updated;
            });
        }, 80);
        return () => clearInterval(interval);
    }, [throttlePedal, stompActive]);

    // Spectral density spectrum generator for TAB 5 Predictive Harmonic Degradation
    useEffect(() => {
        const generateSpectrum = (source: string) => {
            const arr = [];
            const peaks = source === 'fuel_pressure' ? [120, 360] : source === 'alternator' ? [60, 180, 300] : [80, 240];
            for (let f = 10; f <= 500; f += 10) {
                let basePsd = Math.exp(-f / 150) * 15;
                peaks.forEach(peak => {
                    const width = 20;
                    const amplitude = source === 'fuel_pressure' ? 45 : source === 'alternator' ? 35 : 55;
                    basePsd += Math.exp(-Math.pow(f - peak, 2) / (2 * Math.pow(width, 2))) * amplitude;
                });
                basePsd += Math.random() * 2.5;
                arr.push({
                    frequency: `${f}Hz`,
                    psd: parseFloat(basePsd.toFixed(2))
                });
            }
            return arr;
        };

        setSpectralHistory(generateSpectrum(spectralSource));

        const interval = setInterval(() => {
            setSpectralHistory(prev => prev.map(pt => {
                const f = parseInt(pt.frequency, 10);
                const peaks = spectralSource === 'fuel_pressure' ? [120, 360] : spectralSource === 'alternator' ? [60, 180, 300] : [80, 240];
                let basePsd = Math.exp(-f / 150) * 15;
                peaks.forEach(peak => {
                    const width = 20;
                    const amplitude = spectralSource === 'fuel_pressure' ? 45 : spectralSource === 'alternator' ? 35 : 55;
                    const varianceScale = stompActive ? 1.8 : 1.0;
                    basePsd += Math.exp(-Math.pow(f - peak, 2) / (2 * Math.pow(width, 2))) * amplitude * varianceScale;
                });
                basePsd += Math.random() * 3.5;
                return {
                    frequency: pt.frequency,
                    psd: parseFloat(basePsd.toFixed(2))
                };
            }));
            
            setAnomaliesSigma(s => {
                const delta = (Math.random() - 0.5) * 0.15;
                return Math.max(1.5, Math.min(3.8, parseFloat((s + delta).toFixed(2))));
            });
        }, 150);

        return () => clearInterval(interval);
    }, [spectralSource, stompActive]);

    // Feed vehicle telemetry
    useEffect(() => {
        let rafId: number;
        let frameCount = 0;
        const loop = () => {
            frameCount++;
            if (frameCount % 6 === 0) { // 10Hz update rate
                const state = useVehicleStore.getState();
                setHistory(state.data.slice(-100)); // Keep last 100 points for charts
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    // Progress bar for overall scan
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAnalyzing) {
            setScanProgress(0);
            interval = setInterval(() => {
                setScanProgress(p => Math.min(p + (Math.random() * 15), 99));
            }, 200);
        } else {
            setScanProgress(100);
        }
        return () => clearInterval(interval);
    }, [isAnalyzing]);

    const handleConnect = () => connectObd();

    const handleAnalyze = async () => {
        if (!isConnected || !history) return;
        setIsAnalyzing(true);
        setError(null);
        setTimelineEvents([]);

        try {
            const result = await getPredictiveAnalysis(history, MOCK_LOGS, dtcs);
            if (result.error) {
                setError(result.error);
                setTimelineEvents([]);
            } else {
                setTimelineEvents(result.timelineEvents || []);
            }
        } catch (e) {
            setError("Neural Link failure during predictive sequence.");
            setTimelineEvents([]);
        } finally {
            setIsAnalyzing(false);
            setScanProgress(100);
        }
    };

    // Prompt presets logic for Causality Simulator
    const playCausalityScan = async (title: string, userQuery: string) => {
        setCausalityLoading(true);
        setActiveCausality(title);
        setNeuroReport(null);
        setAttentionWeights(prev => prev.map(() => Math.random() * 0.9 + 0.1));
        
        try {
            const result = await getNeuroCoreCausality(userQuery, history, dtcs);
            setNeuroReport(result.report);
        } catch (err) {
            setNeuroReport("*** [SYSTEM LOGIC FAILURE] ***\n\nUnable to reach NeuroCore.");
        } finally {
            setCausalityLoading(false);
        }
    };

    const handleCustomTransmit = () => {
        if (!customQuery.trim()) return;
        const query = customQuery.substring(0, 80);
        playCausalityScan(`Custom Inquiry: "${query}..."`, query);
        setCustomQuery('');
    };

    const handleMaxRpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        if (isNaN(val)) {
            setRpmError("Invalid number");
            setVehicleConfig({ maxRpm: 0 });
        } else if (val < 0) {
            setRpmError("Cannot be negative");
        } else if (val > 10000) {
            setRpmError("Max 10,000 RPM allowed");
        } else {
            setRpmError(null);
            setVehicleConfig({ maxRpm: val });
        }
    };

    // Shannon Entropy Simulation parameters
    const entropyData = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 40; i++) {
            const addStr = `0x${(i * 1411 + 12000).toString(16).toUpperCase()}`;
            // Intentionally place a spike in the middle of calibration tables
            const midRange = i >= 17 && i <= 26;
            const entropy = midRange ? (4.8 + Math.random() * 1.0) : (1.2 + Math.random() * 1.8);
            const varSq = midRange ? (550 + Math.random() * 800) : (40 + Math.random() * 180);
            arr.push({
                index: i,
                address: addStr,
                entropy: parseFloat(entropy.toFixed(3)),
                variance: Math.floor(varSq),
                isCalTable: midRange && entropy >= 4.5 && entropy <= 5.8
            });
        }
        return arr;
    }, []);

    // Map matrix definitions based on Selection (Hex map values)
    const activeMapMatrix = useMemo(() => {
        const size = 8;
        const grid: number[][] = [];
        let seed = selectedMapAddress === '0x6E21' ? 24 : (selectedMapAddress === '0x4B3A' ? 14 : 6);
        for (let r = 0; r < size; r++) {
            const row: number[] = [];
            for (let c = 0; c < size; c++) {
                const distFromCtr = Math.sqrt(Math.pow(r - 4, 2) + Math.pow(c - 4, 3));
                const value = Math.max(10, Math.floor(seed * (8 - distFromCtr) * (1 + Math.sin(c * 0.7) * 0.15)));
                row.push(value);
            }
            grid.push(row);
        }
        return grid;
    }, [selectedMapAddress]);

    // Heuristic CAN Fuzzer Handshake Simulation
    const runFuzzerSecurityAccess = () => {
        if (isFuzzing) return;
        setIsFuzzing(true);
        setDmaUnlocked(false);
        setFuzzerTerminal(prev => [...prev, '[PULSE] Initiating passive protocol challenge probing...']);
        
        const logs = [
            'Probing baud candidate: ISO 15765 CAN Bus (500kbps) -> Active',
            'Broadcasting Session Init frame: [18 DA F1 10] > 02 10 03 (Extended Diagnostic Session)',
            'Received ECU acknowledgement: [18 DA 10 F1] < 06 50 03 00 32 01 F4',
            'Broadcasting Security Challenge key request: [18 DA F1 10] > 02 27 01',
            'Received security seed challenge from host: [18 DA 10 F1] < 04 67 01 AA FB // Cryptographic challenge computed',
            'Hashing key with Shannon inverse coefficient matrix: Seed: 0xAAFB -> Result: 0x4DE9',
            'Injecting Cryptographic handshake response: [18 DA F1 10] > 04 27 02 4D E9',
            'Success! Direct Memory Access (DMA) channel authorized & established. Address block 0x3000-0xCFFF UNLOCKED // Security authorization state verified.'
        ];

        logs.forEach((log, index) => {
            setTimeout(() => {
                setFuzzerTerminal(prev => [...prev, `[DMA-DMA] ${log}`]);
                if (index === logs.length - 1) {
                    setIsFuzzing(false);
                    setDmaUnlocked(true);
                }
            }, (index + 1) * 800);
        });
    };

    // Stomp throttle simulation trigger
    const executeThrottleStomp = () => {
        setStompActive(true);
        setTimeout(() => {
            setStompActive(false);
        }, 1200);
    };

    const signalData = useMemo(() => history.slice(-50), [history]);

    // Dimming CSS dynamic layout based on Workload Balancer mode
    const dimmingClass = (uiRegulationActive && selectedTask === 'welding') 
        ? 'brightness-50 saturate-75 bg-[#010103] transition-all duration-1000' 
        : 'transition-all duration-1000';

    return (
        <div className={`space-y-6 max-w-[1600px] mx-auto min-h-screen relative pb-16 px-4 ${dimmingClass}`}>
            
            {/* Atmospheric Background Ambient Glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-cyan/8 blur-[130px] rounded-full mix-blend-screen"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-purple/8 blur-[130px] rounded-full mix-blend-screen"></div>
                {uiRegulationActive && selectedTask === 'welding' && (
                    <div className="absolute inset-x-0 top-0 h-40 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                )}
            </div>

            {/* Main Header Display (High-fidelity display styling) */}
            <header className="relative z-10 pt-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/[0.06] pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-gradient-to-br from-brand-cyan/20 to-brand-purple/20 border border-brand-cyan/40 rounded-xl">
                            <Brain className="w-5 h-5 text-brand-cyan" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-mono font-black text-white uppercase tracking-[0.2em]">GENESIS NEUROCORE</h1>
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold font-mono animate-pulse">
                                    NODE ACTIVE
                                </span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono tracking-wider mt-0.5">THE SENTIENT OPERATING ECOSYSTEM & CAUSALITY COMPANION // SYSTEM IDENT: KC v3.0</p>
                        </div>
                    </div>
                </div>
                
                {/* Global Tab Switcher */}
                <div className="bg-[#09090d]/90 border border-white/[0.08] p-1 rounded-xl flex overflow-x-auto no-scrollbar gap-1 font-mono text-xs shadow-2xl relative z-10">
                    <button 
                        onClick={() => setActiveTab('neurocore')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-bold ${activeTab === 'neurocore' ? 'bg-gradient-to-r from-brand-cyan/15 to-brand-purple/15 text-brand-cyan border border-brand-cyan/25' : 'text-gray-400 hover:text-white border border-transparent'}`}
                    >
                        <Brain className="w-3.5 h-3.5" />
                        NeuroCore & KC Co-Pilot
                    </button>
                    <button 
                        onClick={() => setActiveTab('workload')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-bold ${activeTab === 'workload' ? 'bg-gradient-to-r from-brand-cyan/15 to-brand-purple/15 text-brand-cyan border border-brand-cyan/25' : 'text-gray-400 hover:text-white border border-transparent'}`}
                    >
                        <ScanFace className="w-3.5 h-3.5" />
                        Intent & Workload Balancer
                    </button>
                    <button 
                        onClick={() => setActiveTab('hyperscout')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-bold ${activeTab === 'hyperscout' ? 'bg-gradient-to-r from-brand-cyan/15 to-brand-purple/15 text-brand-cyan border border-brand-cyan/25' : 'text-gray-400 hover:text-white border border-transparent'}`}
                    >
                        <Terminal className="w-3.5 h-3.5" />
                        Hyper-Scout (Gena.I RE)
                    </button>
                    <button 
                        onClick={() => setActiveTab('ekf')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-bold ${activeTab === 'ekf' ? 'bg-gradient-to-r from-brand-cyan/15 to-brand-purple/15 text-brand-cyan border border-brand-cyan/25' : 'text-gray-400 hover:text-white border border-transparent'}`}
                    >
                        <Sliders className="w-3.5 h-3.5" />
                        GenesisEKF & Physics Twin
                    </button>
                    <button 
                        onClick={() => setActiveTab('forecasting')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-bold ${activeTab === 'forecasting' ? 'bg-gradient-to-r from-brand-cyan/15 to-brand-purple/15 text-brand-cyan border border-brand-cyan/25' : 'text-gray-400 hover:text-white border border-transparent'}`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Forecasting & Degradation
                    </button>
                </div>
            </header>

            <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* LEFT CONTEXT: Live Telemetry Pipeline (Available on all tabs, ensuring deep integration with vehicle physical dynamics) */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    
                    {/* Connection Controller */}
                    <div className="bg-gradient-to-b from-[#0a0a0f] to-[#050508]/98 p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-brand-cyan via-brand-purple to-transparent opacity-60"></div>
                        
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.25em] flex items-center gap-2 font-mono">
                                <Cpu className="w-3.5 h-3.5 text-brand-cyan" />
                                Operational Telemetry Pipeline
                            </h2>
                            <span className="text-[8px] font-mono text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">UPLINK HZ: 100</span>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Standard Connection Card */}
                            <div className="group relative bg-[#07070a] border border-white/[0.05] p-3.5 rounded-xl overflow-hidden transition-all hover:border-brand-cyan/30 flex justify-between items-center">
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                                        <Signal className="w-4 h-4 text-brand-cyan" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-200 uppercase tracking-wide">OBD-II Stream Link</span>
                                        <span className="text-[9px] text-gray-500 font-mono mt-0.5">HIGH-FREQ BI-DIRECTIONAL BUFFER</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 relative z-10">
                                    <span className={`text-[10px] font-mono font-black tracking-wider ${isConnected ? 'text-brand-cyan' : 'text-gray-500'}`}>
                                        {isConnected ? 'ACTIVE' : 'STANDBY'}
                                    </span>
                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-brand-cyan shadow-[0_0_8px_rgba(0,240,255,1)] animate-pulse' : 'bg-gray-700'}`}></div>
                                </div>
                            </div>

                            {/* Configuration Limit Panel */}
                            <div className="bg-[#07070a] border border-white/[0.05] p-4 rounded-xl space-y-4">
                                <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                                    <span className="font-bold text-gray-300 text-xs uppercase tracking-wider font-mono">Chassis Configuration</span>
                                    <span className="text-[9px] text-brand-purple font-mono bg-brand-purple/10 border border-brand-purple/20 px-2 py-0.5 rounded-sm">MEM LOCK</span>
                                </div>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 font-mono block">Dynamic Redline Limit (RPM)</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={vehicleConfig.maxRpm}
                                                onChange={handleMaxRpmChange}
                                                className={`w-full bg-[#0d0d12] border ${rpmError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-brand-cyan/50'} rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-colors`}
                                            />
                                            {rpmError && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-red-500 font-bold uppercase">{rpmError}</span>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                                        <div className="bg-[#0e0e14] border border-white/[0.04] p-2 rounded-lg">
                                            <span className="text-[8px] text-gray-500 uppercase tracking-widest block mb-0.5">Induction Map</span>
                                            <span className="text-[10px] text-white font-black uppercase">{vehicleConfig.aspiration}</span>
                                        </div>
                                        <div className="bg-[#0e0e14] border border-white/[0.04] p-2 rounded-lg">
                                            <span className="text-[8px] text-gray-500 uppercase tracking-widest block mb-0.5">Ethanol Grade</span>
                                            <span className="text-[10px] text-white font-black uppercase">{vehicleConfig.fuelType}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Connection/Scan Execution Button */}
                        <div className="mt-5">
                            {!isConnected ? (
                                <button onClick={handleConnect} disabled={isConnecting} className="w-full relative group overflow-hidden rounded-xl p-[1px] shadow-lg">
                                    <span className="absolute inset-0 bg-gradient-to-r from-brand-cyan/40 via-brand-purple/40 to-brand-cyan/40 rounded-xl opacity-70 group-hover:opacity-100 transition-opacity"></span>
                                    <div className="relative bg-[#0b0b10] px-4 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all group-hover:bg-[#11111a]">
                                        <span className="text-[10px] font-bold text-gray-200 uppercase tracking-[0.2em] font-mono">
                                            {isConnecting ? 'Linking Transceiver...' : 'Initialize Telemetry Link'}
                                        </span>
                                    </div>
                                </button>
                            ) : (
                                <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full relative group overflow-hidden rounded-xl p-[1px] shadow-xl">
                                    <span className="absolute inset-0 bg-gradient-to-r from-brand-cyan via-brand-purple to-brand-cyan rounded-xl opacity-80 group-hover:opacity-100 transition-opacity animate-[spin_4s_linear_infinite]"></span>
                                    <div className="relative bg-black px-4 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all group-hover:bg-[#07070d]">
                                        <svg className={`w-3.5 h-3.5 text-brand-cyan ${isAnalyzing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                        <span className="text-[10px] font-bold text-white uppercase tracking-[0.25em] font-mono">
                                            {isAnalyzing ? 'Fusing Sensor Array...' : 'Run Diagnostics Analysis'}
                                        </span>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Fused Real-time Feeds */}
                    <div className="bg-gradient-to-b from-[#0a0a0f] to-[#050508]/98 p-5 rounded-2xl border border-white/10 shadow-2xl">
                        <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 flex items-center gap-2 font-mono">
                            <Activity className="w-3.5 h-3.5 text-brand-purple animate-pulse" />
                            Pre-Filter Signal Streams
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <SignalChart data={signalData} dataKey="batteryVoltage" color="#00F0FF" label="System Bus V" />
                            <SignalChart data={signalData} dataKey="oilPressure" color="#FCEE0A" label="Oil Sump P" />
                            <SignalChart data={signalData} dataKey="engineTemp" color="#FF003C" label="Engine Temp" />
                            <SignalChart data={signalData} dataKey="shortTermFuelTrim" color="#BC13FE" label="Transient Fuel Offset" />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: MAIN TAB SELECTION WORKSPACE */}
                {/* Incorporating fully responsive pixel-perfect bento architecture */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    
                    {/* TAB 1: GENESIS NEUROCORE & KC CO-PILOT */}
                    {activeTab === 'neurocore' && (
                        <div className="bg-gradient-to-b from-[#0a0a0f] to-[#040407]/98 p-6 rounded-2xl border border-white/10 shadow-2xl relative min-h-[640px] flex flex-col">
                            {/* Accent graphics */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-cyan/5 rounded-full blur-2xl pointer-events-none"></div>
                            
                            <div className="border-b border-white/[0.08] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-brand-cyan" />
                                        Minds-Eye: Multimodal Data Causality
                                    </h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">UNDERSTANDING THE PHYSICS ENVELOPE INSTEAD OF TRIVIAL ERROR CODES</p>
                                </div>
                                <div className="flex items-center gap-3 bg-[#07070a] border border-white/[0.06] p-1.5 rounded-lg">
                                    <span className="text-[9px] font-mono text-gray-400 uppercase font-black px-2">Core Coherence:</span>
                                    <span className="text-[10px] font-mono font-black text-brand-cyan px-2 bg-brand-cyan/10 rounded-sm">
                                        {systemCoherence.toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
                                
                                {/* Left Causality Trigger Grid */}
                                <div className="md:col-span-4 flex flex-col gap-4">
                                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-1 block">Causality Focus Prompts</span>
                                    
                                    <button 
                                        onClick={() => playCausalityScan(
                                            "Analyze Cylinder #3 Thermal Runaway (P3012 Misfire Physics)",
                                            "Analyze the physics of Cylinder #3 misfire and thermal runaway based on active P3012 DTC and localized thermal data."
                                        )}
                                        className={`w-full p-3.5 rounded-xl border text-left font-mono transition-all flex flex-col hover:scale-[1.02] ${activeCausality?.includes("Thermal") ? 'bg-[#0f0b14]/90 border-brand-purple/50 text-brand-purple shadow-xl' : 'bg-[#060609] border-white/[0.05] text-gray-300 hover:border-white/10'}`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className="text-[10px] font-black uppercase">Cylinder #3 Physics</span>
                                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                                        </div>
                                        <span className="text-[8px] text-gray-500 mt-1 uppercase">Thermal / Micro-Fluctuation P3012</span>
                                    </button>

                                    <button 
                                        onClick={() => playCausalityScan(
                                            "Evaluate Sump Bearing Shearing (Low Oil Pressure)",
                                            "Evaluate the drop in sump pressure to 1.2 BAR and explain the physical shearing limit boundary of the lubricant."
                                        )}
                                        className={`w-full p-3.5 rounded-xl border text-left font-mono transition-all flex flex-col hover:scale-[1.02] ${activeCausality?.includes("Sump") ? 'bg-[#0b0f14]/90 border-brand-cyan/50 text-brand-cyan shadow-xl' : 'bg-[#060609] border-white/[0.05] text-gray-300 hover:border-white/10'}`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className="text-[10px] font-black uppercase">Viscosity Shearing</span>
                                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                                        </div>
                                        <span className="text-[8px] text-gray-500 mt-1 uppercase">Main Journal Viscosity Collapse</span>
                                    </button>

                                    <button 
                                        onClick={() => playCausalityScan(
                                            "Analyze Transient AFR Wall-Wetting Lean Spike",
                                            "Analyze the physics of a lean AFR spike during a rapid wide open throttle tip-in event and explain fuel wall-wetting."
                                        )}
                                        className={`w-full p-3.5 rounded-xl border text-left font-mono transition-all flex flex-col hover:scale-[1.02] ${activeCausality?.includes("AFR") ? 'bg-[#100e12]/90 border-brand-purple/40 text-brand-purple shadow-xl' : 'bg-[#060609] border-white/[0.05] text-gray-300 hover:border-white/10'}`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className="text-[10px] font-black uppercase">Transit Wall-Wetting</span>
                                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                                        </div>
                                        <span className="text-[8px] text-gray-500 mt-1 uppercase">Lambda 1.14 Tau Film Delay</span>
                                    </button>
                                </div>

                                {/* Center: Deep Report Analyzer Output */}
                                <div className="md:col-span-5 bg-[#06060a] border border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between min-h-[400px]">
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex justify-between items-center text-[10px] font-mono border-b border-white/[0.04] pb-2 mb-3">
                                            <span className="text-gray-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                                                <FileText className="w-3.5 h-3.5 text-brand-cyan" />
                                                Causality Logic stream
                                            </span>
                                            <span className="text-[9px] text-gray-500 font-bold">MODE: PHYS_CO_LOGIC</span>
                                        </div>

                                        <div className="flex-1 custom-scrollbar overflow-y-auto max-h-[350px] pr-1.5 font-mono text-[11px] leading-relaxed select-text text-gray-300 space-y-3">
                                            {causalityLoading ? (
                                                <div className="h-full flex flex-col justify-center items-center py-12 gap-3 text-center">
                                                    <div className="w-8 h-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin"></div>
                                                    <span className="text-[9px] uppercase tracking-widest text-brand-cyan animate-pulse">Reconciling Spatial Engine Data...</span>
                                                </div>
                                            ) : neuroReport ? (
                                                <div className="whitespace-pre-wrap font-sans leading-relaxed text-gray-300 border-l border-brand-cyan/20 pl-3">
                                                    {neuroReport.split('\n\n').map((para, i) => (
                                                        <p key={i} className="mb-2 text-justify text-xs text-stone-300">
                                                            {para.startsWith('***') ? (
                                                                <span className="block font-sans font-black text-brand-cyan mb-3 border-b border-brand-cyan/10 pb-1">{para}</span>
                                                            ) : para.startsWith('*   **') ? (
                                                                <span className="block italic text-brand-purple">{para}</span>
                                                            ) : para}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-20 text-gray-600 uppercase tracking-widest text-[10px]">
                                                    Awaiting Causality Trigger or Live Query Input
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Direct Operator Query Input */}
                                    <div className="border-t border-white/[0.06] pt-3 flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Ask KC Co-pilot regarding anomalies... (e.g. cylinder knock limits)" 
                                            value={customQuery}
                                            onChange={(e) => setCustomQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCustomTransmit()}
                                            className="flex-1 bg-[#0b0b10] border border-white/[0.08] rounded-xl px-3 py-2 text-stone-200 font-mono text-[10px] focus:outline-none focus:border-brand-cyan/50"
                                        />
                                        <button 
                                            onClick={handleCustomTransmit}
                                            className="px-3 py-2 bg-gradient-to-r from-brand-cyan to-brand-purple rounded-xl text-white font-mono text-[9px] font-bold uppercase hover:opacity-90"
                                        >
                                            Inquire
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Attention Heatmap Weight matrix */}
                                <div className="md:col-span-3 bg-[#06060a] border border-white/[0.04] rounded-2xl p-4 flex flex-col">
                                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-3 block">
                                        Active Attention Activation
                                    </span>
                                    <div className="grid grid-cols-8 gap-1.5 flex-1 items-center justify-center p-2 bg-[#030305] rounded-xl border border-white/[0.02]">
                                        {attentionWeights.map((w, idx) => (
                                            <div 
                                                key={idx} 
                                                className="aspect-square rounded-[3px] transition-all duration-300 relative group"
                                                style={{ 
                                                    backgroundColor: `rgba(0, 240, 255, ${w * 0.85})`,
                                                    boxShadow: w > 0.65 ? `0 0 6px rgba(0, 240, 255, ${w * 0.4})` : 'none'
                                                }}
                                            >
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-[7px] text-white px-1.5 py-0.5 rounded border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                    N-{idx} : {w.toFixed(2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 text-[9px] font-mono text-gray-500 uppercase flex justify-between">
                                        <span>Nodes: 64 Trans</span>
                                        <span>Sync: Epsilon 1e-6</span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}


                    {/* TAB 2: INTENT PREDICTION & COGNITIVE WORKLOAD BALANCER */}
                    {activeTab === 'workload' && (
                        <div className="bg-gradient-to-b from-[#0a0a0f] to-[#040407]/98 p-6 rounded-2xl border border-white/10 shadow-2xl relative min-h-[640px] flex flex-col">
                            <div className="border-b border-white/[0.08] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <ScanFace className="w-4 h-4 text-brand-cyan" />
                                        Skeletal Tracking & Cognitive Balancer
                                    </h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">ANTICIPATORY SCHEMATICS & BIO-SENSORY AMBIENT OVERRIDE</p>
                                </div>
                                <div className="flex gap-2">
                                    {(['idle', 'torque', 'welding'] as const).map(task => (
                                        <button
                                            key={task}
                                            onClick={() => setCognitiveState({ selectedTask: task })}
                                            className={`px-3 py-1 rounded-lg font-mono text-[9px] font-black uppercase transition-all ${selectedTask === task ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30' : 'bg-white/5 text-gray-400 border border-transparent'}`}
                                        >
                                            {task} Task
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
                                
                                {/* Left Column: 3D Skeletal Tracking Simulator SVG */}
                                <div className="md:col-span-5 bg-[#06060a] border border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-3 block flex justify-between">
                                            <span>Skeletal tracking Uplink</span>
                                            <span className="text-brand-purple animate-pulse">L-CV-UPLINK</span>
                                        </span>

                                        <div className="border border-white/[0.06] rounded-xl bg-[#030305] aspect-square flex items-center justify-center relative overflow-hidden p-6">
                                            {/* Camera framing decor */}
                                            <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/20"></div>
                                            <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/20"></div>
                                            <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-white/20"></div>
                                            <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-white/20"></div>
                                            
                                            {/* Dynamic Wireframe Character skeleton inside formula compartment */}
                                            <svg viewBox="0 0 100 100" className="w-full h-full stroke-emerald-500/30">
                                                {/* Car frame background */}
                                                <path d="M 10,70 L 90,70" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                                <path d="M 20,40 L 40,30 L 70,30 L 85,55 L 45,65 Z" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
                                                
                                                {/* Person Joint Structure based on task */}
                                                {selectedTask === 'welding' ? (
                                                    <g>
                                                        {/* Torso */}
                                                        <line x1="50" y1="35" x2="52" y2="60" stroke="#00F0FF" strokeWidth="2" />
                                                        {/* Shoulder lines */}
                                                        <line x1="42" y1="38" x2="58" y2="38" stroke="#00F0FF" strokeWidth="1.5" />
                                                        {/* Left Arm bending to target weld point */}
                                                        <line x1="42" y1="38" x2="38" y2="48" stroke="#00F0FF" strokeWidth="1.5" />
                                                        <line x1="38" y1="48" x2="45" y2="52" stroke="#004dff" strokeWidth="2" />
                                                        {/* Right Arm bending to weld rod */}
                                                        <line x1="58" y1="38" x2="62" y2="48" stroke="#00F0FF" strokeWidth="1.5" />
                                                        <line x1="62" y1="48" x2="48" y2="52" stroke="#004dff" strokeWidth="2" />
                                                        {/* Head */}
                                                        <circle cx="50" cy="27" r="5" fill="#111" stroke="#00F0FF" strokeWidth="2" />
                                                        <circle cx="50" cy="27" r="1.5" fill="#FF004c" />
                                                        {/* Target weld spark overlay */}
                                                        <circle cx="46" cy="52" r="3" fill="rgba(251, 191, 36, 0.4)" stroke="#eab308" className="animate-ping" />
                                                    </g>
                                                ) : selectedTask === 'torque' ? (
                                                    <g>
                                                        {/* Torso */}
                                                        <line x1="45" y1="35" x2="42" y2="60" stroke="#a855f7" strokeWidth="2" />
                                                        {/* Shoulders */}
                                                        <line x1="38" y1="38" x2="52" y2="38" stroke="#a855f7" strokeWidth="1.5" />
                                                        {/* Arm reaching for rod tool */}
                                                        <line x1="52" y1="38" x2="65" y2="42" stroke="#a855f7" strokeWidth="1.5" />
                                                        <line x1="65" y1="42" x2="72" y2="55" stroke="#00F0FF" strokeWidth="2" />
                                                        {/* Head */}
                                                        <circle cx="45" cy="27" r="5" fill="#111" stroke="#a855f7" strokeWidth="2" />
                                                    </g>
                                                ) : (
                                                    <g>
                                                        {/* Standing idle */}
                                                        <line x1="50" y1="28" x2="50" y2="58" stroke="#94a3b8" strokeWidth="2" />
                                                        <line x1="42" y1="33" x2="58" y2="33" stroke="#94a3b8" strokeWidth="1.5" />
                                                        <line x1="42" y1="33" x2="40" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
                                                        <line x1="58" y1="33" x2="60" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
                                                        <circle cx="50" cy="20" r="5" fill="#111" stroke="#94a3b8" strokeWidth="2" />
                                                    </g>
                                                )}
                                            </svg>

                                            {/* AI bounding labels */}
                                            {selectedTask === 'torque' && (
                                                <div className="absolute top-4 right-4 bg-purple-950/80 border border-purple-500/30 px-2 py-1 rounded text-[8px] font-mono text-purple-300">
                                                    REACH_TORQUE_CALIBRATOR: 98.4%
                                                </div>
                                            )}
                                            {selectedTask === 'welding' && (
                                                <div className="absolute top-4 right-4 bg-orange-950/80 border border-orange-500/30 px-2 py-1 rounded text-[8px] font-mono text-orange-300 animate-pulse">
                                                    WELD_ARC_PRECISION: 99.1%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action description text */}
                                    <div className="mt-4 bg-[#0d0d14] border border-white/[0.04] p-3 rounded-xl font-mono text-[10px]">
                                        <div className="text-[9px] text-brand-cyan uppercase tracking-wider mb-1 font-black">Pre-Loaded Active Blueprint specs:</div>
                                        {selectedTask === 'torque' ? (
                                            <p className="text-emerald-400">
                                                [ANTICIPATORY CAUSALITY TRIGGER] Mechanic detected reaching for rod cap bolts. Automatically pre-loading torque limits into tool registry: **120 Nm primary force + 95° rotation angle**.
                                            </p>
                                        ) : selectedTask === 'welding' ? (
                                            <p className="text-purple-400 animate-pulse">
                                                [HAZARD FOCUS REGISTERED] Eye protection layer and high IR thermal shield confirmed active. Dimming interface light levels by 85% to protect optic focus zones.
                                            </p>
                                        ) : (
                                            <p className="text-stone-400">
                                                Technician standby inside work bay. Normal ambient lighting and diagnostics dashboard fully active. Awaiting mechanics skeletal engagement.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Cognitive Workload Balancer & Dimmers */}
                                <div className="md:col-span-7 flex flex-col gap-4">
                                    
                                    {/* Stress bio markers panel */}
                                    <div className="bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl">
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-4 block">
                                            Biometric Stress markers (Simulated Telemetry)
                                        </span>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                            <div className="bg-[#0b0b10] border border-white/[0.04] p-3 rounded-xl text-center">
                                                <span className="text-[7.5px] text-gray-500 uppercase font-mono block mb-1">Heart rate</span>
                                                <span className="text-xl font-black font-mono text-white tracking-tight">{heartRate}</span>
                                                <span className="text-[8px] text-gray-500 font-mono block">BPM</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.04] p-3 rounded-xl text-center">
                                                <span className="text-[7.5px] text-gray-500 uppercase font-mono block mb-1">Cognitive load</span>
                                                <span className="text-xl font-black font-mono text-brand-purple tracking-tight">{simulatedCognitiveLoad}%</span>
                                                <span className="text-[8px] text-gray-500 font-mono block">PARSED CL</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.04] p-3 rounded-xl text-center">
                                                <span className="text-[7.5px] text-gray-500 uppercase font-mono block mb-1">Pupil dilation</span>
                                                <span className="text-xl font-black font-mono text-white tracking-tight">{pupilDilation}</span>
                                                <span className="text-[8px] text-gray-500 font-mono block">MM INDEX</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.04] p-3 rounded-xl text-center">
                                                <span className="text-[7.5px] text-gray-500 uppercase font-mono block mb-1">Skin Response (GSR)</span>
                                                <span className="text-xl font-black font-mono text-brand-cyan tracking-tight">{gsrValue}</span>
                                                <span className="text-[8px] text-gray-500 font-mono block">MICROS_SEC</span>
                                            </div>
                                        </div>

                                        {/* Progress bar visual for load */}
                                        <div className="space-y-2 font-mono text-[9px]">
                                            <div className="flex justify-between items-center">
                                                <span className="uppercase text-gray-400">Composite Cognitive Overload Index</span>
                                                <span className="font-extrabold text-stone-300">{simulatedCognitiveLoad}%</span>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple transition-all duration-1000" 
                                                    style={{ width: `${simulatedCognitiveLoad}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Spatial UI Balancer Dimmer Controller */}
                                    <div className="bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-[10px] font-mono font-black text-gray-300 uppercase tracking-widest block">
                                                    Regulate Ambient UI feedback Loop
                                                </span>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <span className="text-[8px] font-mono text-gray-500">AUTOPILOT</span>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={uiRegulationActive} 
                                                        onChange={(e) => setCognitiveState({ uiRegulationActive: e.target.checked })}
                                                        className="accent-brand-cyan" 
                                                    />
                                                </label>
                                            </div>

                                            <p className="text-xs text-gray-400 leading-relaxed font-sans font-medium mb-4">
                                                The Spatial Workload Balancer mitigates the technician's cognitive fatigue. When stress levels escalate or fine-motor precision operations (welding) are engaged, it dampens peripheral elements.
                                            </p>
                                        </div>

                                        <div className="border border-white/[0.06] p-4 rounded-xl bg-[#030305] space-y-3 font-mono text-[10px]">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">DAMP CONTROLLER CHANNEL:</span>
                                                <span className={uiRegulationActive ? 'text-brand-purple font-black' : 'text-gray-600'}>
                                                    {uiRegulationActive ? 'SYS_AMB_ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-400 uppercase">Peripheral Light Muting:</span>
                                                    <span className={`font-mono ${selectedTask === 'welding' && uiRegulationActive ? 'text-amber-400' : 'text-stone-400'}`}>
                                                        {selectedTask === 'welding' && uiRegulationActive ? 'DIMMED -85%' : 'STANDARD'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-400 uppercase">Alert Inhibition Buffer:</span>
                                                    <span className={`font-mono ${selectedTask === 'welding' && uiRegulationActive ? 'text-red-400 animate-pulse' : 'text-stone-400'}`}>
                                                        {selectedTask === 'welding' && uiRegulationActive ? 'MAXIMUM DAMPED' : 'NOMINAL'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </div>
                    )}


                    {/* TAB 3: HYPER-SCOUT & GENA.I RE (THE RECONNAISSANCE ARM) */}
                    {activeTab === 'hyperscout' && (
                        <div className="bg-gradient-to-b from-[#0a0a0f] to-[#040407]/98 p-6 rounded-2xl border border-white/10 shadow-2xl relative min-h-[640px] flex flex-col">
                            
                            <div className="border-b border-white/[0.08] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <Radar className="w-4 h-4 text-brand-purple" />
                                        Hyper-Scout: Calibration Map Entropic Reconnaissance
                                    </h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">SHANNON ENTROPY COEFFICIENT DISCOVERY TO SURPASS PROPRIETARY BLACK-BOX FILE BARRIERS</p>
                                </div>
                                <div className="flex gap-2">
                                    {(['0x6E21', '0x4B3A', '0x9B10'] as const).map(addr => (
                                        <button
                                            key={addr}
                                            onClick={() => setSelectedMapAddress(addr)}
                                            className={`px-3 py-1 rounded-lg font-mono text-[9px] font-black uppercase transition-all ${selectedMapAddress === addr ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/30' : 'bg-white/5 text-gray-400 border border-transparent'}`}
                                        >
                                            Map {addr}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
                                
                                {/* Top/Left: Shannon Entropy Distribution Map Chart */}
                                <div className="md:col-span-7 bg-[#06060a] border border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-3 block">
                                            Shannon Entropy analysis (Calibration limits: 4.5 – 5.8 Bits)
                                        </span>
                                        <div className="h-56 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={entropyData}>
                                                    <defs>
                                                        <linearGradient id="entropyGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#BC13FE" stopOpacity={0.4}/>
                                                            <stop offset="95%" stopColor="#BC13FE" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="entropy" 
                                                        stroke="#BC13FE" 
                                                        strokeWidth={2}
                                                        fillOpacity={1} 
                                                        fill="url(#entropyGrad)" 
                                                    />
                                                    <XAxis dataKey="address" stroke="#333" tick={{ fontSize: 7, fill: '#666', fontFamily: 'monospace' }} />
                                                    <YAxis stroke="#444" tick={{ fontSize: 8, fill: '#777', fontFamily: 'monospace' }} domain={[0, 7]} />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#050508', border: '1px solid rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: 'monospace' }}
                                                        cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Found Suspect Maps list */}
                                    <div className="mt-4 border-t border-white/[0.08] pt-3 space-y-2">
                                        <span className="text-[8.5px] font-mono text-gray-500 uppercase tracking-wider block">IDENTIFIED MAP TABLES (VARIANCE &gt; 500)</span>
                                        <div className="grid grid-cols-3 gap-2 font-mono text-[9px] text-stone-300">
                                            <div className="bg-[#0c0c14] hover:bg-[#12121e] border border-brand-cyan/20 p-2.5 rounded-lg flex flex-col cursor-pointer transition-colors" onClick={() => setSelectedMapAddress('0x4B3A')}>
                                                <span className="text-gray-500">0x4B3A Intake VE</span>
                                                <span className="font-extrabold text-brand-cyan mt-1">Variance: 840 (Active)</span>
                                            </div>
                                            <div className="bg-[#0c0c14] hover:bg-[#12121e] border border-brand-purple/20 p-2.5 rounded-lg flex flex-col cursor-pointer transition-colors" onClick={() => setSelectedMapAddress('0x6E21')}>
                                                <span className="text-gray-500">0x6E21 Ign Advance</span>
                                                <span className="font-extrabold text-brand-purple mt-1">Variance: 1040 (Active)</span>
                                            </div>
                                            <div className="bg-[#0c0c14] hover:bg-[#12121e] border border-white/[0.05] p-2.5 rounded-lg flex flex-col cursor-pointer transition-colors" onClick={() => setSelectedMapAddress('0x9B10')}>
                                                <span className="text-gray-500">0x9B10 Wastegate duty</span>
                                                <span className="font-extrabold text-white mt-1">Variance: 720 (Active)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Heuristic Fuzzer Console & Visual 3D style candidate grid */}
                                <div className="md:col-span-5 flex flex-col gap-4">
                                    
                                    {/* Interactive Visual table view */}
                                    <div className="bg-[#06060a] border border-white/[0.04] p-4 rounded-xl flex-1 flex flex-col">
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-3 block flex justify-between">
                                            <span>Decoded Calibration Matrix : Map {selectedMapAddress}</span>
                                            <span className="text-brand-purple">8x8 Cluster</span>
                                        </span>
                                        
                                        <div className="grid grid-cols-8 gap-1.5 p-2 bg-[#030305] rounded-xl border border-white/[0.02] flex-1 items-center justify-center">
                                            {activeMapMatrix.flat().map((val, key) => (
                                                <div 
                                                    key={key}
                                                    className="aspect-square text-[8px] font-mono font-bold flex items-center justify-center rounded-[3px] text-black transition-all"
                                                    style={{ 
                                                        backgroundColor: `rgb(${Math.min(255, val * 3)}, ${Math.max(10, 180 - val * 2)}, ${Math.max(20, 255 - val * 4)})`,
                                                    }}
                                                    title={`Lookup grid val: ${val}`}
                                                >
                                                    {val}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Direct DMA fuzzer panel */}
                                    <div className="bg-[#06060a] border border-white/[0.04] p-4 rounded-xl flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest font-black">
                                                    Diagnostic Protocol handshaker
                                                </span>
                                                <span className={`text-[9px] font-mono px-2 rounded ${dmaUnlocked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {dmaUnlocked ? 'DMA UNLOCKED // EXTENDED_03' : 'DEFAULT_01 LOCKED'}
                                                </span>
                                            </div>

                                            {/* Term shell */}
                                            <div className="bg-black/90 rounded-lg p-2.5 border border-white/[0.06] font-mono text-[8.5px] leading-relaxed text-emerald-500 h-24 overflow-y-auto custom-scrollbar">
                                                {fuzzerTerminal.map((line, idx) => (
                                                    <div key={idx} className={line.includes('[DMA-DMA]') ? 'text-brand-cyan' : ''}>
                                                        {line}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button 
                                            onClick={runFuzzerSecurityAccess}
                                            disabled={isFuzzing}
                                            className="w-full mt-3 py-2.5 bg-gradient-to-r from-brand-cyan to-brand-purple rounded-xl text-white font-mono text-[9px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-40 hover:opacity-90"
                                        >
                                            {isFuzzing ? 'Escalating Protocol...' : 'Escalate to Extended Session (0x10 03)'}
                                        </button>
                                    </div>

                                </div>

                            </div>
                        </div>
                    )}


                    {/* TAB 4: GENESIS EKF & PHYSICS CORE (THE DETERMINISTIC CORE) */}
                    {activeTab === 'ekf' && (
                        <div className="bg-gradient-to-b from-[#0a0a0f] to-[#040407]/98 p-6 rounded-2xl border border-white/10 shadow-2xl relative min-h-[640px] flex flex-col">
                            
                            <div className="border-b border-white/[0.08] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-brand-cyan" />
                                        Deterministic Ground Truth: KC-EKF-15 & Physics Twin
                                    </h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">SUB-METER LATENCY CORRECTION & GRACEFUL DEGRADATION SCHEMES FOR HIGH-SPEED MOTION</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-1.5 bg-[#07070c] border border-white/10 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setDataSourceMode('auto')}
                                            className={`px-2 py-1 rounded-md font-mono text-[8.5px] font-black uppercase transition-all ${dataSourceMode === 'auto' ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'text-gray-400 hover:text-white'}`}
                                            title="Automatically switch between OBD, Fused EKF, and Demo stream based on active sensors"
                                        >
                                            Auto
                                        </button>
                                        <button
                                            onClick={() => setDataSourceMode('demo')}
                                            className={`px-2 py-1 rounded-md font-mono text-[8.5px] font-black uppercase transition-all ${dataSourceMode === 'demo' ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'text-gray-400 hover:text-white'}`}
                                            title="Force Tier 4 digital autogenous track simulation stream"
                                        >
                                            Demo
                                        </button>
                                        <button
                                            onClick={() => setDataSourceMode('sensors')}
                                            className={`px-2 py-1 rounded-md font-mono text-[8.5px] font-black uppercase transition-all ${dataSourceMode === 'sensors' ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'text-gray-400 hover:text-white'}`}
                                            title="Force Tier 3 Kinematic IMU/GPS sensor fusion dead-reckoning"
                                        >
                                            Sensors
                                        </button>
                                        <button
                                            onClick={() => setDataSourceMode('obd')}
                                            className={`px-2 py-1 rounded-md font-mono text-[8.5px] font-black uppercase transition-all ${dataSourceMode === 'obd' ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'text-gray-400 hover:text-white'}`}
                                            title="Force Tier 1/2 live OBD-II CAN bus connection"
                                        >
                                            OBD
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-gray-400">GNSS Tunnel Outage Sim:</span>
                                        <button 
                                            onClick={() => {
                                                setGnssOutage(!gnssOutage);
                                            }}
                                            className={`px-3 py-1 rounded-lg font-mono text-[9px] font-black uppercase transition-all ${gnssOutage ? 'bg-red-500/15 text-red-500 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'}`}
                                        >
                                            {gnssOutage ? 'Tunnel Active (GPS Lost)' : 'GPS Stream Nominal'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
                                
                                {/* Left Column: 12-state Kalman variables list */}
                                <div className="md:col-span-5 bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-4 block">
                                            Active EKF-15 State Vector matrix
                                        </span>
                                        
                                        <div className="space-y-2.5 font-mono text-[10px]">
                                            <div className="bg-[#0b0b10] border border-white/[0.03] p-2 rounded-lg flex justify-between items-center">
                                                <span className="text-gray-500 font-black">r_xyz (3D Global Position)</span>
                                                <span className="text-white font-extrabold">{gnssOutage ? '[VO-FLOW Tracked]' : `[${ekfStateOutput[0]?.toFixed(2)}, ${ekfStateOutput[1]?.toFixed(2)}, ${ekfStateOutput[2]?.toFixed(2)}]`} m</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.03] p-2 rounded-lg flex justify-between items-center">
                                                <span className="text-gray-500 font-black">v_xyz (3D Kinematic Velocity)</span>
                                                <span className="text-white font-extrabold">[{ekfStateOutput[3]?.toFixed(2)}, {ekfStateOutput[4]?.toFixed(2)}, {ekfStateOutput[5]?.toFixed(2)}] m/s</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.03] p-2 rounded-lg flex justify-between items-center">
                                                <span className="text-gray-500 font-black">bias_gyro (Drift comp rad/s)</span>
                                                <span className="text-brand-cyan font-extrabold">[{ekfStateOutput[9]?.toFixed(3)}, {ekfStateOutput[10]?.toFixed(3)}, {ekfStateOutput[11]?.toFixed(3)}]</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.03] p-2 rounded-lg flex justify-between items-center">
                                                <span className="text-gray-500 font-black">bias_accel (Accel null mg)</span>
                                                <span className="text-brand-purple font-extrabold">[{ekfStateOutput[12]?.toFixed(3)}, {ekfStateOutput[13]?.toFixed(3)}, {ekfStateOutput[14]?.toFixed(3)}]</span>
                                            </div>
                                            <div className="bg-[#0b0b10] border border-white/[0.03] p-2 rounded-lg flex justify-between items-center">
                                                <span className="text-gray-500 font-black">EKF P-Trace Covariance</span>
                                                <span className="text-emerald-400 font-extrabold">Σ: {(ekfVarianceX + ekfVarianceY).toFixed(4)}</span>
                                            </div>
                                        </div>

                                        {/* Graceful Degradation HUD banner */}
                                        <div className="mt-4 border border-white/[0.06] p-3.5 rounded-xl bg-[#030305]">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div className={`w-2 h-2 rounded-full ${gnssOutage ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></div>
                                                <span className="text-[9px] font-mono font-black text-gray-200 uppercase tracking-wider">
                                                    Sensor Fusion Health Matrix
                                                </span>
                                            </div>
                                            {gnssOutage ? (
                                                <p className="text-[9px] font-mono text-amber-500 leading-normal uppercase">
                                                    [GNSS SIGNAL DEGRADED] Covariance thresholds elevated! Dynamic EKF shifter has relocated priority to 30Hz CV (Optic Flow) and high-density 100Hz dead reckoning. Positional deviation limited to &lt; 0.42m!
                                                </p>
                                            ) : (
                                                <p className="text-[9px] font-mono text-stone-400 leading-normal">
                                                    Tri-modality fusion active: GPS (10Hz) + CV (30Hz) + IMU (100Hz) producing full EKF matrix ground-truth stabilization.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Small signal meters */}
                                    <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-mono mt-4 pt-3 border-t border-white/[0.04]">
                                        <div className="bg-emerald-950/10 border border-emerald-500/20 p-2 rounded-lg">
                                            <span className="text-emerald-400 font-extrabold block mb-0.5">100Hz IMU</span>
                                            <span className="text-stone-300">ACTIVE</span>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${gnssOutage ? 'bg-red-950/20 border-red-500/30' : 'bg-emerald-950/10 border-emerald-500/20'}`}>
                                            <span className={`${gnssOutage ? 'text-red-400 animate-pulse' : 'text-emerald-400'} font-extrabold block mb-0.5`}>10Hz GNSS</span>
                                            <span className={gnssOutage ? 'text-red-300' : 'text-stone-300'}>{gnssOutage ? 'LOST' : 'ACTIVE'}</span>
                                        </div>
                                        <div className="bg-emerald-950/10 border border-emerald-500/20 p-2 rounded-lg">
                                            <span className="text-emerald-400 font-extrabold block mb-0.5">30Hz CV</span>
                                            <span className="text-stone-300">ACTIVE</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Digital Twin Latency Compensator */}
                                <div className="md:col-span-7 bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-mono font-black text-gray-300 uppercase tracking-widest block">
                                                Digital Twin zero-delay model (150ms Telemetry advance)
                                            </span>
                                            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-bold font-mono">
                                                CY_PREDICTIVE ON
                                            </span>
                                        </div>
                                        <p className="text-xs text-stone-400 leading-relaxed font-sans mb-4">
                                            Traditional OBD-II streams present a physical 150ms latency gap. The Genesis Physics Kernel runs a parallel vector simulation to estimate charge manifold density ahead of actual transceiver packet arrivals.
                                        </p>

                                        {/* Dual curve Recharts chart */}
                                        <div className="h-56 w-full mb-3">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={digitalTwinHistory}>
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="twinValue" 
                                                        stroke="#00F0FF" 
                                                        strokeWidth={2}
                                                        dot={false}
                                                        isAnimationActive={false}
                                                        name="Digital Twin Predictor (Zero Delay)" 
                                                    />
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="obdValue" 
                                                        stroke="#FFaa00" 
                                                        strokeWidth={1.5}
                                                        strokeDasharray="4 4"
                                                        dot={false}
                                                        isAnimationActive={false}
                                                        name="Raw OBD Telemetry Feed (150ms Lag)" 
                                                    />
                                                    <YAxis hide domain={['auto', 'auto']} />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#050508', border: '1px solid rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: 'monospace' }}
                                                        itemStyle={{ fontSize: 9 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Action button trigger stomp simulation */}
                                    <div className="border-t border-white/[0.06] pt-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="font-mono text-[9px] text-gray-500">
                                            <span>Throttle Slider input:</span>
                                            <input 
                                                type="range" 
                                                min="5" 
                                                max="100" 
                                                value={throttlePedal} 
                                                onChange={(e) => setThrottlePedal(parseInt(e.target.value))}
                                                className="w-28 sm:w-36 accent-brand-cyan h-1 bg-stone-800 rounded-lg ml-2"
                                            />
                                            <span className="ml-2 text-stone-300 font-extrabold">{throttlePedal}%</span>
                                        </div>
                                        
                                        <button 
                                            onClick={executeThrottleStomp}
                                            className="px-4 py-2 bg-gradient-to-r from-brand-cyan text-black font-mono text-[10px] font-black uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            Stomp Throttle (Simulate transient spike)
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}


                    {/* TAB 5: FORECASTING AGENT & HARMONIC DEGRADATION */}
                    {activeTab === 'forecasting' && (
                        <div className="bg-gradient-to-b from-[#0a0a0f] to-[#040407]/98 p-6 rounded-2xl border border-white/10 shadow-2xl relative min-h-[640px] flex flex-col">
                            
                            <div className="border-b border-white/[0.08] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-brand-cyan" />
                                        Predictive Harmonic Degradation Spectral Monitor
                                    </h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">HIGH-FREQUENCY SPECTRAL ANALYTICS & AUTONOMOUS MITIGATION LOGS</p>
                                </div>
                                <div className="flex gap-1">
                                    {(['fuel_pressure', 'alternator', 'injector_latency'] as const).map(source => (
                                        <button
                                            key={source}
                                            onClick={() => setSpectralSource(source)}
                                            className={`px-2.5 py-1 rounded-lg font-mono text-[9px] font-black uppercase transition-all ${spectralSource === source ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}
                                        >
                                            {source.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                                
                                {/* Left Column: PSD Frequency Analyzer chart */}
                                <div className="lg:col-span-7 bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-3 block">
                                            Power Spectral Density (PSD) Estimator (10Hz - 500Hz)
                                        </span>
                                        <p className="text-[11px] text-stone-400 font-sans mb-4 leading-relaxed">
                                            Analyzing sensor micro-fluctuations via Fast Fourier Transform (FFT). Micro-vibrations indicate mechanical wear, solenoid friction, or alternator diode leakage prior to actual failure.
                                        </p>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={spectralHistory}>
                                                    <defs>
                                                        <linearGradient id="psdGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4}/>
                                                            <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis dataKey="frequency" stroke="#666" fontSize={8} tickLine={false} />
                                                    <YAxis stroke="#666" fontSize={8} tickLine={false} label={{ value: 'PSD (dB/Hz)', angle: -90, position: 'insideLeft', style: { fill: '#666', fontSize: '9px', fontFamily: 'monospace' } }} />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#050508', border: '1px solid rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: 'monospace' }}
                                                    />
                                                    <Area type="monotone" dataKey="psd" stroke="#00F0FF" strokeWidth={2} fillOpacity={1} fill="url(#psdGrad)" name="Spectral Density" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="border-t border-white/[0.04] pt-4 mt-4 grid grid-cols-3 gap-3 text-center text-[10px] font-mono">
                                        <div className="bg-[#0b0b10] border border-white/[0.03] p-2.5 rounded-xl">
                                            <span className="text-gray-500 block mb-0.5 uppercase">Resonant Peaks</span>
                                            <span className="text-white font-extrabold">{spectralSource === 'fuel_pressure' ? '120Hz, 360Hz' : spectralSource === 'alternator' ? '60Hz, 180Hz' : '80Hz, 240Hz'}</span>
                                        </div>
                                        <div className="bg-[#0b0b10] border border-white/[0.03] p-2.5 rounded-xl">
                                            <span className="text-gray-500 block mb-0.5 uppercase">FFT Bin Width</span>
                                            <span className="text-brand-cyan font-extrabold">10 Hz</span>
                                        </div>
                                        <div className="bg-[#0b0b10] border border-white/[0.03] p-2.5 rounded-xl">
                                            <span className="text-gray-500 block mb-0.5 uppercase">FFT Window</span>
                                            <span className="text-brand-purple font-extrabold">Hanning (512pt)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: 3-Sigma limits and Autonomous corrections */}
                                <div className="lg:col-span-5 flex flex-col gap-6">
                                    
                                    {/* 3-Sigma Anomaly Probability distribution panel */}
                                    <div className="bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">
                                                3-Sigma Statistical Outlier Bounds
                                            </span>
                                            <span className={`text-[9px] px-2 py-0.5 rounded font-black font-mono uppercase ${anomaliesSigma > 3.0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {anomaliesSigma > 3.0 ? 'Anomaly Triggered' : 'Normal Bounds'}
                                            </span>
                                        </div>

                                        <div className="flex items-end justify-between gap-1 h-20 mb-3 px-2">
                                            {/* Beautiful animated simulation of statistical Gaussian Bell Curve */}
                                            {Array.from({ length: 25 }).map((_, i) => {
                                                const x = (i - 12) / 4; // -3 to +3 sigma
                                                const bellY = Math.exp(-Math.pow(x, 2) / 2) * 50; // standard distribution
                                                const isCurrentX = Math.abs(x - (anomaliesSigma - 2)) < 0.15;
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                        <div 
                                                            style={{ height: `${bellY}px` }} 
                                                            className={`w-full rounded-t-sm transition-all ${isCurrentX ? 'bg-brand-cyan shadow-[0_0_8px_rgba(0,240,255,0.8)]' : (Math.abs(x) > 1.5 ? 'bg-red-500/25' : 'bg-white/[0.06]')}`}
                                                        ></div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="bg-[#08080c] border border-white/[0.03] p-3.5 rounded-xl font-mono text-[10px] space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500 font-bold">Standard Deviation (σ):</span>
                                                <span className="text-white font-extrabold">{anomaliesSigma} σ</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500 font-bold">Mathematical Outlier Chance:</span>
                                                <span className="text-brand-cyan font-extrabold">{(Math.exp(-Math.pow(anomaliesSigma, 2) / 2) * 100).toFixed(4)}%</span>
                                            </div>
                                            <p className="text-[9px] text-stone-400 leading-normal mt-1 pt-1.5 border-t border-white/[0.04]">
                                                Outliers beyond 3σ indicate mechanical wear or fuel rail anomalies. Current variance is calculated dynamically from high-frequency telemetry.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Autonomous Intervention/Mitigations panel */}
                                    <div className="bg-[#06060a] border border-white/[0.04] p-5 rounded-2xl flex-1 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-3 block">
                                                Forecasting Agent Mitigation Registry
                                            </span>
                                            <p className="text-[11px] text-stone-400 font-sans mb-4 leading-normal">
                                                Active proactive overrides automatically injected into the ECU tuning map by the ASI Forecasting Agent to mitigate mechanical wear:
                                            </p>

                                            <div className="space-y-2">
                                                {mitigations.map((item, idx) => (
                                                    <div key={idx} className="bg-[#0b0b10] border border-white/[0.03] p-2.5 rounded-xl font-mono text-[10px] flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <span className="text-brand-purple font-black">{item.system}</span>
                                                                <span className="text-[8px] text-stone-500">{item.time}</span>
                                                            </div>
                                                            <p className="text-[9px] text-gray-300">{item.action}</p>
                                                        </div>
                                                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black">
                                                            {item.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t border-white/[0.04] pt-4 mt-4 flex items-center justify-between">
                                            <span className="text-[9px] text-stone-500 font-mono">System Integrity Loop: Nominal</span>
                                            <button 
                                                onClick={() => {
                                                    const now = new Date();
                                                    const timeStr = now.toTimeString().split(' ')[0];
                                                    const list = [
                                                        { system: 'KNOCK_LIMIT', action: 'Lowered individual cylinder knock threshold by -0.8 BAR' },
                                                        { system: 'BOOST_WASTEGATE', action: 'Soothes transient overboost spikes via proportional dampener' },
                                                        { system: 'INJECTOR_DUTY', action: 'Pulse-width compensation scaling enabled on cylinder 4' }
                                                    ];
                                                    const pick = list[Math.floor(Math.random() * list.length)];
                                                    setMitigations(prev => [{ time: timeStr, system: pick.system, action: pick.action, status: 'ACTIVE' }, ...prev.slice(0, 2)]);
                                                }}
                                                className="px-3 py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/25 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider transition-all"
                                            >
                                                Deploy Micro-Trim Override
                                            </button>
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Bottom Timeline of anomalous prognostic data */}
            <div className="bg-gradient-to-b from-[#0a0a0f] to-[#050508]/98 p-6 rounded-2xl border border-white/10 shadow-2xl mt-6 relative z-10 transition-all">
                <header className="border-b border-white/[0.06] pb-3 mb-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-xs font-mono font-black text-stone-200 uppercase tracking-widest flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-brand-cyan" />
                            Active Predictive Prognostic Engine Timeline
                        </h3>
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">Sigma anomalies: 3σ bounds verified</span>
                </header>

                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 border border-brand-cyan/20 rounded-full animate-spin"></div>
                            <div className="absolute inset-2 border border-brand-purple/20 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                            <Brain className="w-6 h-6 text-brand-cyan animate-pulse" />
                        </div>
                        <p className="text-xs font-mono text-brand-cyan uppercase tracking-widest animate-pulse">Running Gemini analytical heuristics...</p>
                    </div>
                ) : error ? (
                    <div className="border border-red-500/20 bg-red-500/5 p-6 rounded-xl text-center">
                        <p className="text-xs font-mono text-red-400">{error}</p>
                    </div>
                ) : timelineEvents.length === 0 ? (
                    <div className="text-center py-12 border border-white/[0.04] rounded-xl bg-black/40">
                        <LinkLauncherButton onClick={handleConnect} isConnected={isConnected} handleAnalyze={handleAnalyze} />
                    </div>
                ) : (
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        <RiskTimeline events={timelineEvents} />
                    </div>
                )}
            </div>

        </div>
    );
};

// Internal mini-helper to tidy button layout
const LinkLauncherButton: React.FC<{ isConnected: boolean, onClick: () => void, handleAnalyze: () => void }> = ({ isConnected, onClick, handleAnalyze }) => {
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center gap-3">
                <Brain className="w-8 h-8 text-stone-600 animate-pulse" />
                <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Awaiting dynamic connection synchronization</p>
                <button 
                    onClick={onClick}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-mono text-[9px] font-bold uppercase text-stone-300 transition-all"
                >
                    Connect OBD Pipeline
                </button>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <HardDrive className="w-8 h-8 text-brand-cyan animate-pulse" />
            <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Telemetry loop active. Ready to proceed with diagnostic heuristics.</p>
            <button 
                onClick={handleAnalyze}
                className="px-5 py-2.5 bg-gradient-to-r from-brand-cyan to-brand-purple rounded-xl font-mono text-[10px] font-black uppercase text-white shadow-xl hover:opacity-90 transition-opacity"
            >
                Execute Forecasting Analyst
            </button>
        </div>
    );
};

export default AIEngine;
