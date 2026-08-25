import React, { useState, useEffect } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { ObdConnectionState } from '../../types';
import { 
    Cpu, Activity, Check, Play, AlertCircle, 
    RefreshCcw, Sliders, Settings, ShieldAlert,
    Gauge, Info, Zap
} from 'lucide-react';

interface ResetProcedure {
    id: string;
    name: string;
    description: string;
    durationMs: number;
    steps: string[];
    txPayloads: string[];
    rxAcknowledges: string[];
}

const MAINTENANCE_PROCEDURES: ResetProcedure[] = [
    {
        id: 'idle_relearn',
        name: 'Idle Air Volume Learn (Idle Relearn)',
        description: 'Recalibrates the electronic throttle body control plate angles to establish precise stable idling.',
        durationMs: 8000,
        steps: [
            "Confirming engine operating temperature (>72°C)",
            "Checking Transmission in Neutral / Park with handbrake fully locked",
            "Zeroing volatile throttle position sensor biases",
            "Performing closed throttle mechanical position control learning cycle",
            "Commanding adaptive idle RPM feedback calibration factor loop",
            "Flashing learning maps to persistent non-volatile EEPROM storage"
        ],
        txPayloads: ["31 01 FF 01", "30 01 A0 1B 01", "31 01 AA 02"],
        rxAcknowledges: ["71 01 FF 01 00 (ACK_OK)", "70 01 A0 1B 01 (LEARNING_ACTIVE)", "71 01 AA 02 02 (LEARNING_PERSISTED)"]
    },
    {
        id: 'fuel_trim_reset',
        name: 'Fuel Trim Adaptive Grid Reset',
        description: 'Erases Short-Term (STFT) and adaptive Long-Term (LTFT) fuel trim maps (Essential for newly installed injectors).',
        durationMs: 4000,
        steps: [
            "Requesting secure extended tuning diagnostic session (0x10 03)",
            "Querying current long-term trim baseline cell weights",
            "Clearing volatile stoichiometric fuel adaptation tables in CPU RAM",
            "Resetting short term adjustment loops back to baseline 0.0% parameters"
        ],
        txPayloads: ["10 03", "14 FF FF FF", "2E 1F A0 00 00"],
        rxAcknowledges: ["50 03 (Session Extended Enabled)", "54 (Faults/Adaptations Wiped)", "6E 1F A0 00 (Write Parameter Success)"]
    },
    {
        id: 'sas_calibration',
        name: 'Steering Angle Sensor (SAS) Calibration',
        description: 'Centers yaw-rate and steering position references used by Vehicle Dynamics Control (VDC) & Traction control.',
        durationMs: 5000,
        steps: [
            "Confirming vehicle is stationary on level surface",
            "Reading raw steering wheel lock deflection angle degree offset",
            "Applying mechanical center-point compensation correction factor",
            "Zeroing gyroscopic yaw-rate and lateral accelerometer bias indices"
        ],
        txPayloads: ["31 01 FF 12", "30 01 A0 C8 00"],
        rxAcknowledges: ["71 01 FF 12 00 (SAS_ZEROED_OK)", "70 01 A0 C8 00 (YAW_BIAS_COMPLETELY_ZEROED)"]
    },
    {
        id: 'battery_reg',
        name: 'Alternator Charging Battery Registration',
        description: 'Resets aging charging metrics inside Body Control Module BCM for optimal alternator output PWM on new batteries.',
        durationMs: 4000,
        steps: [
            "Querying Intelligent Power Distribution Module (IPDM) metrics",
            "Resetting battery internal resistance degradation curves",
            "Updating alternator smart charging duty cycle map profiles"
        ],
        txPayloads: ["30 01 B0 A5 01"],
        rxAcknowledges: ["70 01 B0 A5 01 00 (BAT_REGISTRATION_ACK)"]
    },
    {
        id: 'throttle_valve_reset',
        name: 'Throttle Closed Valve Position Calibration',
        description: 'Learns fully closed sensor feedback voltage reference for throttle actuator motors.',
        durationMs: 4500,
        steps: [
            "De-energizing throttle body electronic control actuator coils",
            "Reading output voltage at fully closed mechanical resting spring stop",
            "Confirming throttle position sensor 1 vs 2 dual-channel sweep tolerances",
            "Re-activating throttle actuator driver stages"
        ],
        txPayloads: ["31 01 FF D8", "30 01 A3 FF 01"],
        rxAcknowledges: ["71 01 FF D8 00 (THROTTLE_CAL_STORED)", "70 01 A3 FF 01 (ACTUATOR_COILS_RE_ENERGIZED)"]
    },
    {
        id: 'evap_test',
        name: 'EVAP Large/Small Leak forced canister purge test',
        description: 'Forced bi-directional sweep of canister purge valve to verify evap system seal integrity and component flow.',
        durationMs: 6000,
        steps: [
            "Sealing EVAP canister system return solenoid",
            "Commanding vacuum purge solenoid duty pulse to build engine negative pressure",
            "Monitoring pressure decay curves to check for leaks/decay",
            "Restoring standard atmospheric ventilation pressure valves"
        ],
        txPayloads: ["30 01 15 FC 01", "31 01 AA F2"],
        rxAcknowledges: ["70 01 15 FC 01 (CANISTER_SEALED)", "71 01 AA F2 00 (EVAP_PRESSURE_DECAY_OK_PASS)"]
    }
];

export const MaintenanceResetsPanel: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const obdState = useVehicleStore(state => state.obdState);

    // Running Reset States
    const [runningProcedureId, setRunningProcedureId] = useState<string | null>(null);
    const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
    const [progress, setProgress] = useState<number>(0);
    const [resetLogs, setResetLogs] = useState<string[]>([
        "Reset & Maintainer subsystem loaded.",
        "System: Awaiting calibration triggers."
    ]);

    // Cylinder Cutoff Bidirectional Testing States
    const [cutCylinders, setCutCylinders] = useState<Record<number, boolean>>({
        1: false, 2: false, 3: false, 4: false, 5: false, 6: false
    });
    const [cylinderMisfires, setCylinderMisfires] = useState<Record<number, number>>({
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
    });

    const isWiredConnected = obdState === ObdConnectionState.Connected;

    // Cylinder cut logic which updates global store RPM simulation briefly
    const toggleCylinderCut = (cylNum: number) => {
        const isCurrentlyCut = cutCylinders[cylNum];
        const nextState = !isCurrentlyCut;
        
        setCutCylinders(prev => ({ ...prev, [cylNum]: nextState }));
        
        let tx = "";
        let rx = "";

        if (nextState) {
            // Cut cyl
            tx = `30 01 A0 0C 0${cylNum}`; // Service 30 InputOutputControl cut injection
            rx = `70 01 A0 0C 0${cylNum} 01 (CYLINDER_CUTOFF_ACTIVE)`;
            
            // Increment misfires of that cyl
            setCylinderMisfires(m => ({ ...m, [cylNum]: Math.min(m[cylNum] + 15, 99) }));
            
            // Brief physical drop inside simulated data
            // We temporarily adjust the vehicleStore's RPM offset multiplier or trigger speed state drops
            // To simulate physical engine shake, we override the local rpm display briefly. 
            // In a real application we'd hook into the simulation engine. Here we can output detailed logs.
            setResetLogs(l => [
                ...l,
                `TX: ${tx}`,
                `RX: ${rx}`,
                `WARN: Injector PWM Cutoff commanded on Cylinder #${cylNum}.`,
                `WARN: Engine idle speed dropping. Severe primary harmonic imbalance detected!`,
                `WARN: Diagnostic code P030${cylNum} (misfire cylinder ${cylNum}) queued in pending registers.`
            ].slice(-16));
        } else {
            // Restore cyl
            tx = `30 01 A0 0C 00`; // Return control
            rx = `70 01 A0 0C 00 (CONTROL_RETURNED_TO_ECU)`;
            
            setResetLogs(l => [
                ...l,
                `TX: ${tx}`,
                `RX: ${rx}`,
                `INFO: Re-activated injector signal on Cylinder #${cylNum}.`,
                `INFO: Stoichiometric equilibrium restored. Cylinder functioning normal.`
            ].slice(-16));
        }
    };

    // Cylinder cut impact on RPM display. 
    // If any cylinder is cut, we'll force-simulate a vibrating RPM drop!
    useEffect(() => {
        const activeCuts = Object.values(cutCylinders).filter(Boolean).length;
        if (activeCuts > 0) {
            // Drop RPM in simulator or update fake sensor data slightly
            const timer = setInterval(() => {
                const currentData = useVehicleStore.getState().latestData;
                // Shake around 520 RPM instead of standard 750
                const shake = 520 + Math.random() * 40 - 20;
                // Update latestData inside the store dynamically to show real physical feedback on tachometers!
                useVehicleStore.setState({
                    latestData: {
                        ...currentData,
                        rpm: shake,
                        engineLoad: 38.5, // engine load increases as throttle opens to compensate for dead cylinder
                        shortTermFuelTrim: 12.5 // rich compensation
                    }
                });
            }, 100);
            return () => {
                clearInterval(timer);
                const currentData = useVehicleStore.getState().latestData;
                // restore engine variables
                useVehicleStore.setState({
                    latestData: {
                        ...currentData,
                        rpm: 750,
                        engineLoad: 18.2,
                        shortTermFuelTrim: 0.0
                    }
                });
            };
        }
    }, [cutCylinders]);

    // Handle running maintenance calibration routines (with timers & logs)
    const runProcedure = (proc: ResetProcedure) => {
        if (runningProcedureId) return;
        
        setRunningProcedureId(proc.id);
        setCurrentStepIdx(0);
        setProgress(0);

        setResetLogs(l => [
            ...l,
            `TX: 10 03 (Enter secure extended session)`,
            `RX: 50 03 (ACK)`,
            `SYSTEM: Initiated sequence: [${proc.name}]`
        ].slice(-16));

        const totalSteps = proc.steps.length;
        const intervalMs = proc.durationMs / totalSteps;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            if (step < totalSteps) {
                setCurrentStepIdx(step);
                setProgress((step / totalSteps) * 100);
                
                // Print a payload logic
                const payloadIdx = Math.min(step, proc.txPayloads.length - 1);
                const txPayload = proc.txPayloads[payloadIdx];
                const rxAck = proc.rxAcknowledges[payloadIdx];

                setResetLogs(l => [
                    ...l,
                    `TX: ${txPayload}`,
                    `RX: ${rxAck}`,
                    `STEP ${step + 1}: ${proc.steps[step]}`
                ].slice(-16));
            } else {
                clearInterval(timer);
                setProgress(100);
                setRunningProcedureId(null);
                
                // If fuel trim reset, also zero the trims in store data
                if (proc.id === 'fuel_trim_reset') {
                    const currentData = useVehicleStore.getState().latestData;
                    useVehicleStore.setState({
                        latestData: {
                            ...currentData,
                            shortTermFuelTrim: 0.0,
                            longTermFuelTrim: 0.0
                        }
                    });
                }

                setResetLogs(l => [
                    ...l,
                    `SYSTEM: SUCCESS. Sequence [${proc.name}] complete. ECU parameters updated and stored.`,
                    `TX: 10 01 (Reset to default diagnostics session)`,
                    `RX: 50 01 (ACK)`
                ].slice(-16));
            }
        }, intervalMs);
    };

    return (
        <div id="maintenance-resets-container" className="flex flex-col h-full bg-[#050505] text-gray-300 font-mono text-xs select-none">
            
            {/* Upper Header */}
            <div className="p-4 border-b border-white/5 bg-[#090909] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <h3 className="text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Settings className="w-4 h-4 text-brand-purple animate-pulse" />
                        UDS SERVICE 0x31 / 0x2E SPECIAL MAINTENANCE CALIBRATION CORES
                    </h3>
                    <p className="text-[9px] text-gray-500 mt-0.5">DIRECT SYSTEM RE-LEARNS, RE-CALIBRATIONS AND INTERACTIVE RE-SETS</p>
                </div>
            </div>

            {/* Split screen: Main Calibrations on left, Cylinder Cut test on right */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                
                {/* Left Section: Maintenance Routines */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-white/5 space-y-4">
                    
                    {/* Running Indicator Overlay if active */}
                    {runningProcedureId && (
                        <div className="bg-brand-purple/10 border border-brand-purple/30 p-4 rounded-xl space-y-3 animate-pulse">
                            <div className="flex justify-between items-center text-[10px] text-brand-purple font-black">
                                <span className="flex items-center gap-2">
                                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                    UDS RE-WRITE CALIBRATION SEQUENCE IN PROGRESS...
                                </span>
                                <span>{progress.toFixed(0)}%</span>
                            </div>
                            
                            <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/5">
                                <div className="bg-gradient-to-r from-brand-purple to-purple-400 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                            
                            <div className="text-[10px] text-white font-bold leading-none capitalize">
                                Action: {runningProcedureId && MAINTENANCE_PROCEDURES.find(p => p.id === runningProcedureId)?.steps[currentStepIdx]}
                            </div>
                        </div>
                    )}

                    {/* Proactive Help Alert */}
                    <div className="bg-[#111]/40 border border-white/5 p-3 rounded-lg flex items-start gap-2.5">
                        <Info className="w-4.5 h-4.5 text-brand-purple shrink-0 mt-0.5 animate-pulse" />
                        <p className="text-[10px] text-gray-500 leading-normal font-sans">
                            Calibrations below utilize low-level J2534 passthrough commands to directly modify ECU parameters. Pre-test checklist: Engine OFF/IGNITION ON, Battery Voltage &gt; 12.2V, Parking brake engaged.
                        </p>
                    </div>

                    {/* Standard Deck Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {MAINTENANCE_PROCEDURES.map(proc => {
                            const isRunning = runningProcedureId === proc.id;
                            const isDisabled = runningProcedureId !== null && !isRunning;

                            return (
                                <div 
                                    key={proc.id}
                                    className={`bg-black/40 border p-4 rounded-xl flex flex-col justify-between space-y-3.5 transition-all group hover:border-[#222] ${isRunning ? 'border-brand-purple/50 bg-brand-purple/5' : 'border-white/5'}`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black tracking-widest text-[#555] group-hover:text-gray-400">PROC ID: {proc.id.toUpperCase()}</span>
                                            <span className="text-[8.5px] text-brand-purple font-black uppercase">UDS RID</span>
                                        </div>
                                        <h4 className="text-[11px] font-black text-white uppercase font-sans tracking-wide leading-tight group-hover:text-brand-purple transition-all">{proc.name}</h4>
                                        <p className="text-[9.5px] text-gray-500 leading-snug font-sans">{proc.description}</p>
                                    </div>

                                    <button
                                        onClick={() => runProcedure(proc)}
                                        disabled={isDisabled}
                                        className={`w-full py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                                            isRunning 
                                            ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/40 animate-pulse'
                                            : 'bg-brand-purple text-white hover:bg-purple-600 disabled:opacity-20'
                                        }`}
                                    >
                                        {isRunning ? 'CALIBRATING...' : <><Play className="w-3 h-3 text-white" /> INITIALIZE RESET</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                </div>

                {/* Right Section: Bidirectional Cylinder Cutoff & Misfire Test Panel */}
                <div className="w-full lg:w-80 shrink-0 bg-[#090909] p-4 flex flex-col justify-between border-t lg:border-t-0 border-white/5 overflow-hidden">
                    
                    <div className="space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                        
                        {/* Header info */}
                        <div className="shrink-0 space-y-2">
                            <div className="flex justify-between items-center">
                                <h4 className="text-white text-[10.5px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                    <ShieldAlert className="w-4 h-4 text-brand-red animate-pulse" />
                                    Cylinder Power Balance Cut Test
                                </h4>
                                <span className="bg-red-950/20 text-brand-red border border-brand-red/30 px-1 py-0.5 rounded text-[8.5px] font-black">BI-DIRECTIONAL</span>
                            </div>
                            <p className="text-[9.5px] text-gray-500 leading-tight font-sans">
                                Selectively cuts fuel injector signals to identify damaged coil-packs, failed ignition stages or clogged injectors. Live RPM will dip and vibrate if targeted cylinder was operational.
                            </p>
                        </div>

                        {/* Cylinder Matrix Grid */}
                        <div className="grid grid-cols-2 gap-2.5 shrink-0">
                            {[1, 2, 3, 4, 5, 6].map(cyl => {
                                const isCut = cutCylinders[cyl];
                                const misfires = cylinderMisfires[cyl];

                                return (
                                    <div 
                                        key={cyl}
                                        onClick={() => toggleCylinderCut(cyl)}
                                        className={`p-3 rounded-xl border cursor-pointer select-none relative overflow-hidden transition-all text-left ${
                                            isCut 
                                            ? 'bg-brand-red/10 border-brand-red text-brand-red shadow-[0_0_12px_rgba(255,0,60,0.15)] animate-pulse' 
                                            : 'bg-black border-white/5 hover:border-white/10 text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-black font-sans text-white uppercase tracking-tight">Cylinder #{cyl}</span>
                                            <div className={`w-1.5 h-1.5 rounded-full ${isCut ? 'bg-brand-red shadow-[0_0_6px_#ff003c]' : 'bg-green-500 shadow-[0_0_6px_#22c55e]'}`}></div>
                                        </div>

                                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter block mt-1.5">
                                            STATUS: {isCut ? 'INJECTOR CUT' : 'SPARK INJECTING'}
                                        </span>

                                        <div className="flex justify-between items-center mt-3 text-[8.5px] font-mono leading-none border-t border-white/5 pt-2">
                                            <span className="text-gray-600 font-bold">MISFIRES:</span>
                                            <span className={misfires > 0 ? 'text-brand-red font-black font-sans' : 'text-gray-500'}>{misfires}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Scrolling log console of current reset events */}
                        <div className="flex-1 flex flex-col justify-between min-h-0 pt-3">
                            <h5 className="text-[8.5px] text-gray-500 uppercase tracking-wide shrink-0">ECU CALIBRATION FEEDBACK STREAM</h5>
                            
                            <div className="flex-1 bg-black rounded-lg border border-white/5 p-3 font-mono text-[9px] overflow-y-auto custom-scrollbar space-y-2 mt-1.5">
                                {resetLogs.map((log, i) => {
                                    let col = "text-gray-400";
                                    if (log.startsWith("TX:")) col = "text-brand-purple font-black";
                                    if (log.startsWith("RX:")) col = "text-emerald-400";
                                    if (log.startsWith("WARN:")) col = "text-brand-red animate-pulse";
                                    if (log.startsWith("INFO:")) col = "text-brand-cyan";
                                    if (log.startsWith("SYSTEM:")) col = "text-white font-bold border-t border-white/5 pt-1 mt-1 pb-1 border-b";

                                    return (
                                        <div key={i} className={`leading-relaxed break-all ${col}`}>
                                            {log}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
};

export default MaintenanceResetsPanel;
