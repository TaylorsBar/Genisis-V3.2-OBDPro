import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { Terminal, ShieldAlert, CheckCircle, Flame, Cpu, Gauge, Radio } from 'lucide-react';

const RecalibrationPage: React.FC = () => {
    const { executeRoutine, readiness, scanVehicle } = useVehicleStore();
    const [progress, setProgress] = useState<number>(90);
    const [isSynchronizing, setIsSynchronizing] = useState<boolean>(false);
    const [activeStepText, setActiveStepText] = useState<string>('SYSTEM READY FOR PILOT SYNCHRONIZATION');
    const [selectedRoutine, setSelectedRoutine] = useState<{ id: string; name: string }>({
        id: '0101',
        name: 'Throttle Body Initialization'
    });
    
    // Dynamic terminal feed
    const [log, setLog] = useState<string[]>([
        'CALIBRATING 12-STATE KALMAN FILTER...',
        'SYNCHRONIZING DIGITAL TWIN PHYSICS KERNEL...',
        'ESTABLISHING SECURE ECU UPLINK...',
        'VERIFYING NEURAL FABRIC INTEGRITY...',
        'SYSTEM READY FOR PILOT SYNCHRONIZATION.'
    ]);

    // Timestamps for the log lines to match the retro dashboard look
    const [logTimes, setLogTimes] = useState<string[]>([]);

    useEffect(() => {
        // Initialize static timestamps for initial log entries
        const now = new Date();
        const initialTimes = Array.from({ length: 5 }, (_, i) => {
            const date = new Date(now.getTime() - (5 - i) * 1000);
            return date.toTimeString().split(' ')[0];
        });
        setLogTimes(initialTimes);
    }, []);

    const addLogLine = (message: string) => {
        const timeStr = new Date().toTimeString().split(' ')[0];
        setLog(prev => [...prev, message]);
        setLogTimes(prev => [...prev, timeStr]);
    };

    // Trigger full diagnostic scan & synchronization sequence
    const handleSynchronize = async () => {
        if (isSynchronizing) return;
        setIsSynchronizing(true);
        setProgress(0);
        setLog([]);
        setLogTimes([]);

        const steps = [
            { pct: 15, text: 'CALIBRATING 12-STATE KALMAN FILTER...', log: 'Initializing dual-core EKF matrices. Covariance converging.' },
            { pct: 35, text: 'SYNCHRONIZING DIGITAL TWIN PHYSICS KERNEL...', log: 'Syncing real-time tire slip & aerodynamic drag vectors.' },
            { pct: 55, text: 'ESTABLISHING SECURE ECU UPLINK...', log: `Accessing gateway security access level 3. Procedure 0x${selectedRoutine.id} triggered.` },
            { pct: 75, text: 'VERIFYING NEURAL FABRIC INTEGRITY...', log: 'Neural map validation signature verified by Genesis OS.' },
            { pct: 90, text: 'SYNTHESIZING NEURAL FABRIC...', log: 'Merging live telemetry variables with AI core model.' },
            { pct: 100, text: 'SYSTEM SYNCHRONIZED SUCCESSFULLY', log: 'Handshake complete. Speedshop calibration persistent.' }
        ];

        // Execute background routines if selected
        try {
            executeRoutine(selectedRoutine.id);
        } catch (e) {
            console.error('Routine execution error', e);
        }

        let stepIdx = 0;
        const interval = setInterval(async () => {
            setProgress(prev => {
                const nextPct = prev + 1;
                
                // Trigger messages and logs when reaching step thresholds
                if (stepIdx < steps.length && nextPct >= steps[stepIdx].pct) {
                    setActiveStepText(steps[stepIdx].text);
                    addLogLine(steps[stepIdx].log);
                    stepIdx++;
                }

                if (nextPct >= 100) {
                    clearInterval(interval);
                    setIsSynchronizing(false);
                    // Force refresh emissions/readiness upon successful calibration
                    try {
                        scanVehicle();
                    } catch (e) {
                        console.error(e);
                    }
                    return 100;
                }
                return nextPct;
            });
        }, 60);
    };

    // Auto-scroll the terminal block
    const terminalEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [log]);

    return (
        <div className="absolute inset-0 w-full h-full bg-[#0d0b11] text-[#f2f2f2] font-sans flex flex-col overflow-hidden select-none relative recalc-page">
            
            {/* Custom Theme Styles to match user markup */}
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;700;900&display=swap');
                
                .recalc-page {
                    --bg: #0d0b11;
                    --ink: #f2f2f2;
                    --accent: #bc13fe;
                    --ink-faint: rgba(255, 255, 255, 0.05);
                    --neon-shadow: 0 0 25px rgba(188, 19, 254, 0.4);
                    background-image: 
                        linear-gradient(rgba(188, 19, 254, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(188, 19, 254, 0.03) 1px, transparent 1px);
                    background-size: 40px 40px;
                }

                .sidebar-repeating {
                    background: repeating-linear-gradient(-45deg, transparent, transparent 10px, var(--ink-faint) 10px, var(--ink-faint) 11px);
                }

                .font-oswald {
                    font-family: 'Oswald', sans-serif;
                }

                .font-space-mono {
                    font-family: 'Space Mono', monospace;
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--accent);
                    border-radius: 2px;
                }
            `}} />

            {/* MAIN SHELL CONTAINER */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[80px_1fr_420px] p-4 gap-4 min-h-0">
                
                {/* SIDEBAR */}
                <aside className="border-2 border-[#f2f2f2] flex flex-col justify-between items-center py-6 sidebar-repeating hidden md:flex">
                    <div className="writing-mode-vertical text-center uppercase font-space-mono text-[10px] tracking-[0.4em] text-[#f2f2f2]/40 transform rotate-180 py-4">
                        KARTEL CO. MOTORSPORT
                    </div>
                    <div className="writing-mode-vertical text-center uppercase font-space-mono text-[10px] tracking-[0.4em] text-[#f2f2f2]/40 transform rotate-180 py-4">
                        SPEEDSHOP DIV
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <section className="border-2 border-[#f2f2f2] relative p-6 md:p-12 flex flex-col justify-between bg-black/20 overflow-hidden min-h-0">
                    
                    {/* Status badge row */}
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <div className="inline-block px-3 py-1 bg-[#bc13fe] text-white font-space-mono text-[10px] tracking-wider uppercase font-bold">
                                GENESIS OS V5.0
                            </div>
                            <span className="block font-space-mono text-[10px] tracking-widest text-[#bc13fe] uppercase mt-2">ACTIVE PROCESS</span>
                        </div>
                        <div className="text-right">
                            <span className="font-space-mono text-[9px] text-[#f2f2f2]/50 uppercase tracking-widest block">Subsystem status</span>
                            <span className="font-space-mono text-[10px] text-[#bc13fe] uppercase tracking-wider font-bold">CALIBRATION_PENDING</span>
                        </div>
                    </div>

                    {/* Progress Indicator */}
                    <div className="my-auto py-8 z-10">
                        <h2 className="font-oswald text-[7rem] md:text-[10rem] lg:text-[12rem] font-bold leading-none tracking-tighter text-[#f2f2f2]">
                            {progress}%
                        </h2>
                        <div className="font-space-mono text-xs md:text-sm tracking-wider text-[#f2f2f2] uppercase flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#bc13fe] animate-pulse"></span>
                            {activeStepText}
                        </div>
                    </div>

                    {/* Readiness Monitors (Dynamic integration of live state) */}
                    <div className="border-t border-[#f2f2f2]/10 pt-4 z-10">
                        <span className="font-space-mono text-[9px] text-[#bc13fe] uppercase tracking-widest block mb-3">Emissions & System Readiness checks</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { name: 'Catalyst', value: readiness?.catalyst ?? true },
                                { name: 'Evap', value: readiness?.evap ?? true },
                                { name: 'O2 Sensor', value: readiness?.o2Sensor ?? true },
                                { name: 'EGR Sys', value: readiness?.egr ?? true }
                            ].map((mon) => (
                                <div key={mon.name} className="bg-black/30 border border-[#f2f2f2]/10 p-2 flex items-center justify-between">
                                    <span className="font-space-mono text-[10px] text-[#f2f2f2]/60">{mon.name}</span>
                                    <span className={`font-space-mono text-[9px] px-1.5 py-0.5 uppercase font-bold ${mon.value ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/30 text-red-400 border border-red-500/20'}`}>
                                        {mon.value ? 'Pass' : 'Inc'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Huge ambient watermark */}
                    <div className="font-oswald text-[12rem] lg:text-[16rem] font-black leading-none tracking-tighter text-transparent select-none opacity-5 absolute -bottom-10 -right-6 pointer-events-none" style={{ WebkitTextStroke: '2px #f2f2f2' }}>
                        V5.0
                    </div>
                </section>

                {/* INFO & CONTROL PANEL */}
                <section className="border-2 border-[#f2f2f2] p-6 flex flex-col justify-between bg-black/10 min-h-0 overflow-y-auto custom-scrollbar gap-6">
                    
                    {/* Brand header */}
                    <div className="border-b-2 border-[#f2f2f2] pb-4 shrink-0">
                        <h1 className="font-oswald text-4xl lg:text-5xl font-black italic tracking-tight uppercase text-[#f2f2f2]">
                            KC SPEEDSHOP
                        </h1>
                        <div className="font-space-mono text-[9px] tracking-widest text-[#bc13fe] uppercase mt-1 opacity-70">
                            EST. 2026 • CALIBRATION DEPT
                        </div>
                    </div>

                    {/* Procedure selector */}
                    <div className="shrink-0">
                        <span className="font-space-mono text-[10px] text-[#bc13fe] tracking-widest uppercase block mb-3">SELECT ROUTINE PATTERN</span>
                        <div className="flex flex-col gap-2">
                            {[
                                { id: '0101', name: 'Throttle Body Initialization' },
                                { id: '0102', name: 'EGR Valve Learn' },
                                { id: '0103', name: 'Crank Position Relearn' }
                            ].map(routine => {
                                const isSelected = selectedRoutine.id === routine.id;
                                return (
                                    <button
                                        key={routine.id}
                                        onClick={() => {
                                            if (isSynchronizing) return;
                                            setSelectedRoutine(routine);
                                            addLogLine(`Procedure target switched to: ${routine.name} (0x${routine.id})`);
                                        }}
                                        className={`w-full text-left p-3 border font-space-mono text-xs transition-all flex justify-between items-center cursor-pointer ${
                                            isSelected 
                                                ? 'border-[#bc13fe] bg-[#bc13fe]/10 text-white shadow-[0_0_12px_rgba(188,19,254,0.25)]' 
                                                : 'border-[#f2f2f2]/10 bg-black/20 text-[#f2f2f2]/60 hover:border-[#f2f2f2]/30 hover:text-[#f2f2f2]'
                                        }`}
                                    >
                                        <span>{routine.name}</span>
                                        <span className="text-[10px] text-[#bc13fe]">0x{routine.id}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Console / Terminal output */}
                    <div className="flex-1 bg-black/40 border-l-4 border-[#bc13fe] p-4 font-space-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[180px]">
                        {log.map((line, idx) => (
                            <div key={idx} className="grid grid-cols-[80px_1fr] items-start opacity-85 hover:opacity-100 transition-opacity">
                                <strong className="text-[#bc13fe] font-bold">
                                    [{logTimes[idx] || '00:00:00'}]
                                </strong>
                                <span className="text-gray-300 break-words">{line}</span>
                            </div>
                        ))}
                        <div ref={terminalEndRef} />
                    </div>

                    {/* Trigger synchronisation */}
                    <button 
                        onClick={handleSynchronize}
                        disabled={isSynchronizing}
                        className="bg-[#f2f2f2] text-[#0d0b11] hover:bg-[#bc13fe] hover:text-white border-none py-4 px-6 w-full font-oswald text-lg font-black tracking-widest uppercase transition-all duration-300 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]"
                        style={{ boxShadow: isSynchronizing ? '0 0 25px rgba(188, 19, 254, 0.4)' : undefined }}
                    >
                        {isSynchronizing ? 'SYNCHRONIZING...' : 'SYNCHRONIZE'}
                    </button>
                </section>
            </div>

            {/* BOTTOM STATUS FOOTER */}
            <footer className="h-[60px] bg-[#f2f2f2] text-[#0d0b11] flex items-center px-6 md:px-10 justify-between shrink-0 select-none">
                <div className="font-space-mono text-[10px] tracking-widest font-bold uppercase text-[#0d0b11]">
                    GENESIS INTERFACE // PILOT CALIBRATION
                </div>
                <div className="font-space-mono text-[10px] tracking-widest font-bold uppercase text-[#0d0b11] hidden sm:block">
                    SERIAL NO. KC-992-GNS
                </div>
            </footer>
        </div>
    );
};

export default RecalibrationPage;
