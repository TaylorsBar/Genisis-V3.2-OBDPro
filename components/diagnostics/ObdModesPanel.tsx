import React, { useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { ObdConnectionState, DiagnosticCode } from '../../types';
import { getDtcSeverity } from '../../pages/Diagnostics';
import { 
    Activity, Database, CheckCircle, AlertTriangle, 
    Info, Search, Sliders, ChevronDown, RefreshCw, Layers 
} from 'lucide-react';

// Pre-defined SAE J1979 standard PID entries for Mode 01
interface ObdPidDisplay {
    pid: string;
    name: string;
    desc: string;
    unit: string;
    getVal: (telemetry: any) => number | string;
}

const SAE_OBD_PIDS: ObdPidDisplay[] = [
    { pid: "0105", name: "Engine Coolant Temp", desc: "Engine Coolant Temperature from Cylinder Head Sensor", unit: "°C", getVal: (t) => t.engineTemp ?? 88 },
    { pid: "010C", name: "Engine RPM", desc: "Crankshaft Rotational Frequency", unit: "RPM", getVal: (t) => t.rpm ?? 750 },
    { pid: "010D", name: "Vehicle Speed", desc: "Vehicle Wheel-Speed Output Velocity", unit: "km/h", getVal: (t) => t.speed ?? 0 },
    { pid: "010F", name: "Intake Air Temp (IAT)", desc: "Inlet Air Temperature Sensor after Intercooler", unit: "°C", getVal: (t) => t.inletAirTemp ?? 24 },
    { pid: "0110", name: "Mass Air Flow (MAF)", desc: "Inlet Air Volume Rate Sensor", unit: "g/s", getVal: (t) => t.maf ?? 4.2 },
    { pid: "0111", name: "Throttle Position (TP)", desc: "Calculated Throttle Valve Duty Angle", unit: "%", getVal: (t) => t.throttlePos ?? 14.5 },
    { pid: "0114", name: "O2 Sensor 1 Voltage", desc: "Oxygen Sensor Bank 1 Sensor 1 Output Signal", unit: "V", getVal: (t) => t.o2SensorVoltage ?? 0.450 },
    { pid: "0104", name: "Engine Load (Calculated)", desc: "Direct calculated air-charge volumetric coefficient", unit: "%", getVal: (t) => t.engineLoad ?? 18.2 },
    { pid: "010A", name: "Fuel Pressure", desc: "Primary low-pressure intake side supply", unit: "kPa", getVal: (t) => t.fuelPressure ?? 350 },
    { pid: "0123", name: "Fuel Rail Pressure (HP)", desc: "High-pressure direct-injection rail reservoir", unit: "MPa", getVal: (t) => t.fuelRailPressure ?? 12.4 },
    { pid: "010E", name: "Ignition Timing Advance", desc: "Cylinder #1 advance spark parameter before TDC", unit: "°BTDC", getVal: (t) => t.timingAdvance ?? 14 },
    { pid: "0106", name: "Short Term Fuel Trim B1", desc: "STFT fuel correction factor (closed-loop)", unit: "%", getVal: (t) => t.shortTermFuelTrim ?? 0.0 },
    { pid: "0107", name: "Long Term Fuel Trim B1", desc: "LTFT long-horizon adaptive grid fuel adjustment", unit: "%", getVal: (t) => t.longTermFuelTrim ?? -1.2 },
    { pid: "0133", name: "Barometric Pressure", desc: "Ambient manifold atmospheric pressure", unit: "kPa", getVal: (t) => t.barometricPressure ?? 101.3 },
    { pid: "0142", name: "Control Module Voltage", desc: "System battery bus input to Main ECU pins", unit: "V", getVal: (t) => t.batteryVoltage ?? 14.1 },
    { pid: "015E", name: "Engine Fuel Rate", desc: "Instantaneous fuel flow rate", unit: "L/h", getVal: (t) => t.fuelUsed ?? 1.2 }
];

// O2 / On-Board Monitoring TID and CID limits for Mode 05/06
interface MonitorLimitTest {
    tid: string;
    cid: string;
    name: string;
    limit: string;
    value: string;
    result: 'PASS' | 'FAIL' | 'INC';
    system: string;
}

const ON_BOARD_MONITOR_LIMITS: MonitorLimitTest[] = [
    { tid: "$01", cid: "$01", name: "Rich-to-Lean Sensor Threshold (Bank 1 Sensor 1)", limit: "> 0.450 V", value: "0.525 V", result: "PASS", system: "O2 Sensor Monitor" },
    { tid: "$02", cid: "$02", name: "Lean-to-Rich Sensor Threshold (Bank 1 Sensor 1)", limit: "> 0.450 V", value: "0.485 V", result: "PASS", system: "O2 Sensor Monitor" },
    { tid: "$0B", cid: "$20", name: "Catalytic Converter Peak Conversion Efficiency", limit: "< 0.70 Ratio", value: "0.14 Ratio", result: "PASS", system: "Catalytic Converter" },
    { tid: "$31", cid: "$0A", name: "EVAP Purge Valve Flow Rate Diagnostic", limit: "> 0.015 L/s", value: "0.042 L/s", result: "PASS", system: "Evaporative Emissions (EVAP)" },
    { tid: "$3A", cid: "$15", name: "EVAP Small Leak Orifice Test Delta Pressure", limit: "< 0.020 inH2O", value: "0.003 inH2O", result: "PASS", system: "Evaporative Emissions (EVAP)" },
    { tid: "$47", cid: "$01", name: "EGR Gas Temperature Sensor Gain Limit", limit: "0.12 - 0.85 V", value: "0.412 V", result: "PASS", system: "Exhaust Gas Recirculation (EGR)" },
    { tid: "$A1", cid: "$01", name: "Continuous Cylinder 1 Misfire Rate (Last 10 Drives)", limit: "< 25 Counts", value: "0 Counts", result: "PASS", system: "Misfire Monitor" },
    { tid: "$A1", cid: "$02", name: "Continuous Cylinder 2 Misfire Rate (Last 10 Drives)", limit: "< 25 Counts", value: "1 Counts", result: "PASS", system: "Misfire Monitor" },
    { tid: "$A1", cid: "$03", name: "Continuous Cylinder 3 Misfire Rate (Last 10 Drives)", limit: "< 25 Counts", value: "0 Counts", result: "PASS", system: "Misfire Monitor" },
    { tid: "$A1", cid: "$04", name: "Continuous Cylinder 4 Misfire Rate (Last 10 Drives)", limit: "< 25 Counts", value: "2 Counts", result: "PASS", system: "Misfire Monitor" },
    { tid: "$A1", cid: "$05", name: "Continuous Cylinder 5 Misfire Rate (Last 10 Drives)", limit: "< 25 Counts", value: "0 Counts", result: "PASS", system: "Misfire Monitor" },
    { tid: "$A1", cid: "$06", name: "Continuous Cylinder 6 Misfire Rate (Last 10 Drives)", limit: "< 25 Counts", value: "12 Counts", result: "PASS", system: "Misfire Monitor" }
];

export const ObdModesPanel: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const dtcs = useVehicleStore(state => state.dtcs);
    const obdState = useVehicleStore(state => state.obdState);
    const clearVehicleFaults = useVehicleStore(state => state.clearVehicleFaults);
    
    const [subTab, setSubTab] = useState<'mode01' | 'mode02' | 'mode03' | 'mode05' | 'mode08' | 'mode09'>('mode01');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPidGraph, setSelectedPidGraph] = useState<string | null>(null);
    const [graphHistory, setGraphHistory] = useState<Record<string, number[]>>({});
    
    // Bi-directional component states (Mode 08)
    const [egrDuty, setEgrDuty] = useState<number>(0);
    const [injectorCutoff, setInjectorCutoff] = useState<number | null>(null);
    const [isThrottleSweeping, setIsThrottleSweeping] = useState<boolean>(false);

    // Keep track of real-time query logs to show as OBD output terminal.
    const [queryLogs, setQueryLogs] = useState<string[]>([
        "ISO15765-4 CAN High-Speed Baud initialized.",
        "TX: AT SH 7E0 // Set header targeting ECM",
        "RX: OK",
        "TX: 0100 // Query Supported PIDs Bitmask 1",
        "RX: 41 00 BE 3E A8 13",
        "TX: 0902 // Request VIN Information",
        "RX: 49 02 01 4A 4E 31 45 56 36 41  (JN1EV6A...)"
    ]);

    // Keep a buffer of historical sensor values for inline graphics
    useEffect(() => {
        const interval = setInterval(() => {
            setGraphHistory(prev => {
                const updated = { ...prev };
                SAE_OBD_PIDS.forEach(pid => {
                    const val = pid.getVal(latestData);
                    const numVal = typeof val === 'number' ? val : parseFloat(val);
                    if (!updated[pid.pid]) updated[pid.pid] = [];
                    const nextArr = [...updated[pid.pid], isNaN(numVal) ? 0 : numVal].slice(-30);
                    updated[pid.pid] = nextArr;
                });
                return updated;
            });
        }, 300);

        return () => clearInterval(interval);
    }, [latestData]);

    const logQuery = (tx: string, rx: string, sim?: string) => {
        setQueryLogs(prev => [
            ...prev,
            `TX: ${tx}`,
            `RX: ${rx}`,
            ...(sim ? [`SIM: ${sim}`] : [])
        ].slice(-24));
    };

    // Log simulated UDS activity when swapping tabs
    const handleTabChange = (tabName: 'mode01' | 'mode02' | 'mode03' | 'mode05' | 'mode08' | 'mode09') => {
        setSubTab(tabName);
        let command = '';
        let reply = '';
        if (tabName === 'mode01') {
            command = "0100";
            reply = "41 00 BE 3E A8 13 (Readiness Monitors/Sensors Bitmask)";
        } else if (tabName === 'mode02') {
            command = "020200";
            reply = "42 02 00 00 1A 2B 4C (Freeze Frame for Diagnostic Code)";
        } else if (tabName === 'mode03') {
            command = "03";
            reply = dtcs.length > 0 
                ? `43 ${dtcs.length} ${dtcs.map(dtc => dtc.code).join(' ')} (Active stored DTC list)`
                : "43 00 (Positive response: 0 Trouble Codes Stored)";
        } else if (tabName === 'mode05') {
            command = "0600";
            reply = "46 00 FA E3 AA 01 (On-board Mid-range TID/CID indices)";
        } else if (tabName === 'mode08') {
            command = "08";
            reply = "48 01 02 03 04 05 (Supported Bi-directional override commands active)";
        } else if (tabName === 'mode09') {
            command = "0900";
            reply = "49 00 55 A0 1E C0 (Vehicle Information Calibration Masks)";
        }

        logQuery(command, reply);
    };

    // Mode 04 Clear codes handler
    const handleClearDtcs = async () => {
        await clearVehicleFaults();
        logQuery(
            "04", 
            "44 // Diagnostic codes and adaptatives cleared",
            "OBD-II Broadcast Mode 04 Successful. Fault database erased. MIL turned OFF."
        );
    };

    // Action to inject mock fault
    const handleForceDtc = () => {
        useVehicleStore.setState({
            dtcs: [
                { 
                    code: 'P0171', 
                    description: 'System Too Lean (Bank 1) - Adaptive fuel limits exceeded', 
                    status: 'Confirmed', 
                    timestamp: Date.now(), 
                    freezeFrame: {
                        rpm: 2840,
                        speed: 78,
                        engineTemp: 94,
                        shortTermFuelTrim: 14.8,
                        longTermFuelTrim: 18.2,
                        throttlePos: 32.5,
                        engineLoad: 58,
                        maf: 22.4,
                        batteryVoltage: 13.8
                    } 
                }
            ],
            hasActiveFault: true
        });
        logQuery(
            "30 01 06 P0171",
            "70 01 06",
            "SIM: Force-injected diagnostic code P0171 to trigger warnings."
        );
    };

    // Adaptation resets
    const handleResetAdaptation = (type: 'fuel_map' | 'gearbox' | 'throttle') => {
        if (type === 'fuel_map') {
            logQuery(
                "31 01 FF 01",
                "71 01 FF 01 // Fuel Map adaptives cleared",
                "STFT/LTFT Adaptation Cell Grids reset to standard stoichiometric. Learning state re-initialized."
            );
        } else if (type === 'gearbox') {
            logQuery(
                "31 01 FF 02",
                "71 01 FF 02 // Clutch pressure maps cleared",
                "Gearbox Line Pressure adaptation cells reset for clutch sync."
            );
        } else if (type === 'throttle') {
            logQuery(
                "31 01 FF 03",
                "71 01 FF 03 // TPS sweep bounds aligned",
                "Main Throttle TPS voltage sensor alignments completed successfully."
            );
        }
    };

    // Bi-directional actuators
    const handleMode08Command = (actuator: string) => {
        if (actuator === 'fuel_pump_on') {
            logQuery("30 01 02 01", "70 01 02", "Relays energized. Commencing low-pressure primary pump prime sequence (5.2 BAR).");
        } else if (actuator === 'fuel_pump_off') {
            logQuery("30 01 02 00", "70 01 02", "Pump circuit opened. Primary fuel rail pressure decay initiated.");
        } else if (actuator === 'fan_low') {
            logQuery("30 01 02 03 01", "70 01 02", "Radiator Low Cooling Fan relay powered. 12V output driving.");
        } else if (actuator === 'fan_high') {
            logQuery("30 01 02 03 02", "70 01 02", "Radiator High Speed Fan relay powered. Secondary high-current coil closed.");
        } else if (actuator === 'fan_off') {
            logQuery("30 01 02 03 00", "70 01 02", "Cooling fan relays decoupled. Static state resumed.");
        }
    };

    const handleEgrChange = (val: number) => {
        setEgrDuty(val);
        const hexVal = val.toString(16).padStart(2, '0').toUpperCase();
        logQuery(`30 01 02 14 ${hexVal}`, "70 01 02", `Actuating Exhaust Recirculating solenoid. Mandate duty: ${val}%`);
    };

    const handleInjectorCut = (cyl: number) => {
        if (injectorCutoff === cyl) {
            setInjectorCutoff(null);
            logQuery(`30 01 02 22 0${cyl} 00`, "70 01 02", `Injector Cylinder ${cyl} re-engaged. Cylinder combustion loop stable.`);
        } else {
            setInjectorCutoff(cyl);
            logQuery(`30 01 02 22 0${cyl} 01`, "70 01 02", `Injector Cylinder ${cyl} CLOSED. Misfire simulation actively initiated.`);
        }
    };

    const handleThrottleSweep = () => {
        setIsThrottleSweeping(true);
        logQuery("30 01 02 25 01", "70 01 02", "Initiating electronic TPS self-align. Performing 0% -> 50% -> 100% full sweep.");
        
        let seconds = 0;
        const interval = setInterval(() => {
            seconds++;
            if (seconds === 1) {
                logQuery("2F 01 11 01 7F", "6F 01 11", "Feedback TPS Sensor 1 voltage: 2.5V (50% physical sweep)");
            } else if (seconds === 2) {
                logQuery("2F 01 11 01 FF", "6F 01 11", "Feedback TPS Sensor 1 voltage: 4.8V (100% full sweep)");
            } else if (seconds === 3) {
                logQuery("2F 01 11 01 00", "6F 01 11", "Feedback TPS Sensor 1 voltage: 0.45V (0% return bounds verified)");
                setIsThrottleSweeping(false);
                clearInterval(interval);
            }
        }, 1000);
    };

    // Filter available PIDs
    const filteredPids = SAE_OBD_PIDS.filter(pid => 
        pid.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        pid.pid.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div id="obd-modes-container" className="flex flex-col h-full bg-[#050505] text-gray-300 font-mono text-xs select-none">
            {/* Header Description */}
            <div className="p-4 border-b border-white/5 bg-[#090909] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <h3 className="text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4 text-brand-cyan animate-pulse" />
                        SAE J1979 / ISO 15031 DIAGNOSTIC MODES
                    </h3>
                    <p className="text-[9px] text-gray-500 mt-0.5">FULL OBDII SERVICE PROFILES WITH ON-BOARD MONITORING TEST LIMITS</p>
                </div>
                <div className="flex items-center gap-2 bg-black px-2 py-1 rounded border border-white/5 font-sans text-[9px] text-brand-cyan">
                    <span>STATUS:</span>
                    <span className="font-bold underline uppercase">{obdState}</span>
                </div>
            </div>

            {/* Sub Mode Tab Bar - Multi-column responsive grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 border-b border-white/5 bg-[#070707] shrink-0 text-center">
                <button 
                  onClick={() => handleTabChange('mode01')}
                  className={`py-3 text-[9px] font-bold border-r border-white/5 uppercase ${subTab === 'mode01' ? 'bg-[#111] text-brand-cyan border-b border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Mode 01 (Live)
                </button>
                <button 
                  onClick={() => handleTabChange('mode02')}
                  className={`py-3 text-[9px] font-bold border-r border-white/5 uppercase ${subTab === 'mode02' ? 'bg-[#111] text-brand-cyan border-b border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Mode 02 (Freeze)
                </button>
                <button 
                  onClick={() => handleTabChange('mode03')}
                  className={`py-3 text-[9px] font-bold border-r border-white/5 uppercase ${subTab === 'mode03' ? 'bg-[#111] text-brand-cyan border-b border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Mode 03/04 (DTC)
                </button>
                <button 
                  onClick={() => handleTabChange('mode05')}
                  className={`py-3 text-[9px] font-bold border-r border-white/5 uppercase ${subTab === 'mode05' ? 'bg-[#111] text-brand-cyan border-b border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Mode 5/6 (Monors)
                </button>
                <button 
                  onClick={() => handleTabChange('mode08')}
                  className={`py-3 text-[9px] font-bold border-r border-white/5 uppercase ${subTab === 'mode08' ? 'bg-[#111] text-brand-cyan border-b border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Mode 08 (Bi-Dir)
                </button>
                <button 
                  onClick={() => handleTabChange('mode09')}
                  className={`py-3 text-[9px] font-bold uppercase ${subTab === 'mode09' ? 'bg-[#111] text-brand-cyan border-b border-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Mode 09 (Info)
                </button>
            </div>

            {/* Split Panel: Left Content, Right Live Bus Logger */}
            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
                
                {/* Left Area Content */}
                <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar border-b xl:border-b-0 xl:border-r border-white/5 min-w-0">
                    
                    {subTab === 'mode01' && (
                        <div id="obd-mode1-view" className="space-y-4 flex flex-col h-full min-h-0">
                            {/* Search Filter */}
                            <div className="relative shrink-0">
                                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-600" />
                                <input 
                                    type="text" 
                                    placeholder="Filter standard SAE OBD Parameter Identifiers (PIDs)..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-black border border-white/5 rounded text-[11px] font-mono focus:border-brand-cyan focus:outline-none text-white uppercase placeholder:capitalize placeholder:text-gray-600"
                                />
                            </div>

                            {/* PID list */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 bg-[#111]/10 rounded-lg border border-white/5 p-2 pr-1">
                                {filteredPids.map(pid => {
                                    const rawVal = pid.getVal(latestData);
                                    const valueStr = typeof rawVal === 'number' ? rawVal.toFixed(1) : rawVal;
                                    const isSelected = selectedPidGraph === pid.pid;

                                    return (
                                        <div 
                                            key={pid.pid}
                                            onClick={() => setSelectedPidGraph(isSelected ? null : pid.pid)}
                                            className={`p-2.5 rounded border transition-all cursor-pointer ${isSelected ? 'bg-brand-cyan/5 border-brand-cyan/50 text-white' : 'bg-black/45 border-white/5 hover:border-white/10 text-gray-400 hover:text-gray-200'}`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold bg-[#1C1C1E] text-brand-cyan border border-brand-cyan/20 px-1.5 py-0.5 rounded uppercase">{pid.pid}</span>
                                                    <div className="truncate max-w-[150px] sm:max-w-xs md:max-w-md font-sans text-[11px] font-black text-gray-300 group-hover:text-white uppercase tracking-tight">{pid.name}</div>
                                                </div>
                                                <div className="flex items-baseline gap-1 bg-black/40 px-2.5 py-1 rounded border border-white/5">
                                                    <span className="text-xs font-black text-brand-cyan font-mono drop-shadow-[0_0_5px_rgba(0,240,255,0.2)]">{valueStr}</span>
                                                    <span className="text-[8px] text-gray-500 font-bold uppercase">{pid.unit}</span>
                                                </div>
                                            </div>
                                            <p className="text-[8.5px] text-gray-500 font-sans mt-1 leading-tight">{pid.desc}</p>
                                            
                                            {/* Micro-sparkline Graph if clicked */}
                                            {isSelected && graphHistory[pid.pid] && (
                                                <div className="mt-3 pt-3 border-t border-brand-cyan/20 flex flex-col justify-between h-20 bg-black/70 p-2 rounded-md animate-in slide-in-from-top-2">
                                                    <div className="flex justify-between text-[8px] text-gray-500 font-sans uppercase">
                                                        <span>Live Fast Scroll Sparkline Plot</span>
                                                        <span className="animate-pulse text-brand-cyan">● INTERACTIVE CAPTURE</span>
                                                    </div>
                                                    
                                                    {/* Pure SVG Sparkline graph */}
                                                    <svg className="w-full h-11 pointer-events-none mt-1">
                                                        {(() => {
                                                            const dataList = graphHistory[pid.pid] || [];
                                                            if (dataList.length < 2) return null;
                                                            const min = Math.min(...dataList);
                                                            const max = Math.max(...dataList);
                                                            const range = max - min === 0 ? 1 : max - min;
                                                            
                                                            const width = 450;
                                                            const height = 44;
                                                            
                                                            const points = dataList.map((val, idx) => {
                                                                const x = (idx / (dataList.length - 1)) * width;
                                                                const y = height - ((val - min) / range) * (height - 4) - 2;
                                                                return `${x},${y}`;
                                                            }).join(' ');

                                                            return (
                                                                <>
                                                                    <polyline
                                                                        fill="none"
                                                                        stroke="#00f0ff"
                                                                        strokeWidth="1.5"
                                                                        points={points}
                                                                        className="stroke-cyan-400"
                                                                        style={{ vectorEffect: 'non-scaling-stroke' }}
                                                                    />
                                                                    {/* Simple shadow fill */}
                                                                    <polyline
                                                                        fill="none"
                                                                        stroke="#00f0ff"
                                                                        strokeWidth="6"
                                                                        strokeOpacity="0.1"
                                                                        points={points}
                                                                        style={{ vectorEffect: 'non-scaling-stroke' }}
                                                                    />
                                                                </>
                                                            );
                                                        })()}
                                                    </svg>
                                                    
                                                    <div className="flex justify-between items-center text-[8px] text-gray-600 mt-1 font-mono">
                                                        <span>MIN: {Math.min(...graphHistory[pid.pid]).toFixed(1)} {pid.unit}</span>
                                                        <span>MAX: {Math.max(...graphHistory[pid.pid]).toFixed(1)} {pid.unit}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {subTab === 'mode02' && (
                        <div id="obd-mode2-view" className="space-y-4">
                            <div className="bg-[#111]/30 border border-white/5 p-4 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-brand-cyan" />
                                    <h4 className="text-white text-xs font-black uppercase">Captured Emissions Freeze Frame Snapshots</h4>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-tight font-sans">
                                    When the fuel or emissions ECU registers a fault code, it takes a strict physical snapshot of critical sensor parameters. Mode 02 allows for manual retrieval of these values to verify engine conditions (cold startup vs loaded heat).
                                </p>
                            </div>

                            {dtcs.length === 0 ? (
                                <div className="p-8 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-center opacity-60">
                                    <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                                    <span className="text-[11px] font-bold uppercase text-emerald-400">NO SECURE TROUBLE CODES DETECTED</span>
                                    <p className="text-[9px] text-gray-500 font-sans mt-1">There are no active faults. Freeze frame buffers are cleared.</p>
                                    
                                    <button 
                                        onClick={handleForceDtc}
                                        className="mt-4 px-3 py-1.5 bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black border border-brand-cyan/40 transition-colors uppercase font-bold text-[9px] rounded"
                                    >
                                        Trigger Mock Lean-Trim Fault (P0171)
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {dtcs.map((dtc, idx) => (
                                        <div key={idx} className="bg-black border border-white/5 rounded-xl overflow-hidden p-4 space-y-3 font-mono text-[10px]">
                                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-brand-red font-black text-xs">{dtc.code}</span>
                                                    <span className="text-[8px] bg-red-900/10 text-brand-red border border-brand-red/20 px-1 rounded">FREEZE FRAME AVAILABLE</span>
                                                </div>
                                                <span className="text-[8px] text-gray-600">FRAME AT: {new Date(dtc.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-gray-500 uppercase font-sans">Engine Speed</span>
                                                    <span className="text-brand-cyan font-bold">{dtc.freezeFrame?.rpm ?? 2450} RPM</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-gray-500 uppercase font-sans">Vehicle Speed</span>
                                                    <span className="text-brand-cyan font-bold">{dtc.freezeFrame?.speed ?? 64} km/h</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-gray-500 uppercase font-sans">Coolant Temp</span>
                                                    <span className="text-brand-cyan font-bold">{dtc.freezeFrame?.engineTemp ?? 92} °C</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-gray-500 uppercase font-sans">Engine Load</span>
                                                    <span className="text-brand-cyan font-bold">{dtc.freezeFrame?.engineLoad ?? 52} %</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-gray-500 uppercase font-sans">Short Fuel Trim</span>
                                                    <span className="text-brand-cyan font-bold">+{dtc.freezeFrame?.shortTermFuelTrim ?? 12.8} %</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-gray-500 uppercase font-sans">Long Fuel Trim</span>
                                                    <span className="text-brand-cyan font-bold">+{dtc.freezeFrame?.longTermFuelTrim ?? 16.5} %</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white/5 p-2 rounded col-span-2">
                                                    <span className="text-gray-500 uppercase font-sans">Mass Air Flow</span>
                                                    <span className="text-brand-cyan font-bold">{dtc.freezeFrame?.maf ?? 18.6} g/s</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {subTab === 'mode03' && (
                        <div id="obd-mode3-view" className="space-y-4">
                            <div className="bg-[#111]/30 border border-white/5 p-4 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-red animate-pulse" />
                                    <h4 className="text-white text-xs font-black uppercase">Mode 03/04 Diagnostic Trouble Codes (DTCs) & Adaptation Resets</h4>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-tight font-sans">
                                    Retrieve current confirmed, pending, and permanent diagnostic trouble codes stored in the ECU. Use Mode 04 to purge codes, reset Check Engine lamp (MIL), and clear adaptation maps.
                                </p>
                            </div>

                            {/* Actions bar */}
                            <div className="flex gap-2 shrink-0">
                                <button 
                                    onClick={handleClearDtcs}
                                    className="flex-1 py-2 bg-brand-red/10 border border-brand-red/30 hover:bg-brand-red hover:text-white text-brand-red font-bold text-[9px] uppercase tracking-wider rounded transition-colors"
                                >
                                    Mode 04: Clear Fault Codes & Adaptations
                                </button>
                                <button 
                                    onClick={handleForceDtc}
                                    className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 font-bold text-[9px] uppercase tracking-wider rounded transition-colors"
                                >
                                    Inject Mock Fault
                                </button>
                            </div>

                            {/* Adaptation / Core Resets Grid */}
                            <div className="space-y-2">
                                <h5 className="text-[10px] text-white font-bold uppercase tracking-wider">Advanced ECU Adaptation Resets</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="bg-[#111]/40 border border-white/5 p-2.5 rounded-lg flex flex-col justify-between gap-2">
                                        <div>
                                            <span className="text-[9px] text-gray-300 font-black">FUEL MAP RESET</span>
                                            <p className="text-[8px] text-gray-500 font-sans leading-none mt-1">Clears STFT/LTFT cell trim learning tables.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleResetAdaptation('fuel_map')}
                                            className="w-full py-1 bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan hover:text-black hover:border-brand-cyan/25 text-[8.5px] font-bold rounded uppercase border border-brand-cyan/20 transition-all"
                                        >
                                            Reset trims
                                        </button>
                                    </div>
                                    <div className="bg-[#111]/40 border border-white/5 p-2.5 rounded-lg flex flex-col justify-between gap-2">
                                        <div>
                                            <span className="text-[9px] text-gray-300 font-black">GEARBOX PRESSURE</span>
                                            <p className="text-[8px] text-gray-500 font-sans leading-none mt-1">Resets transmission shift rate adaptables.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleResetAdaptation('gearbox')}
                                            className="w-full py-1 bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan hover:text-black hover:border-brand-cyan/25 text-[8.5px] font-bold rounded uppercase border border-brand-cyan/20 transition-all"
                                        >
                                            Reset clutch
                                        </button>
                                    </div>
                                    <div className="bg-[#111]/40 border border-white/5 p-2.5 rounded-lg flex flex-col justify-between gap-2">
                                        <div>
                                            <span className="text-[9px] text-gray-300 font-black">THROTTLE CALIBRATE</span>
                                            <p className="text-[8px] text-gray-500 font-sans leading-none mt-1">Recalibrates pedal throttle valve duty sweep.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleResetAdaptation('throttle')}
                                            className="w-full py-1 bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan hover:text-black hover:border-brand-cyan/25 text-[8.5px] font-bold rounded uppercase border border-brand-cyan/20 transition-all"
                                        >
                                            Re-align TPS
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Fault codes layout */}
                            <div className="space-y-2">
                                <span className="text-[9px] text-gray-500 uppercase font-sans">Active & Historic DTC List</span>
                                {dtcs.length === 0 ? (
                                    <div className="p-8 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-center opacity-60">
                                        <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
                                        <span className="text-[10px] font-bold uppercase text-emerald-400">0 Diagnostic Trouble Codes Found</span>
                                        <p className="text-[8.5px] text-gray-500 font-sans mt-0.5">MIL light is currently inactive. System operates inside normal tolerances.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                        {dtcs.map((dtc, idx) => {
                                            const severity = getDtcSeverity(dtc.code);
                                            const sevConfig = {
                                                Critical: {
                                                    border: 'border-red-500/30 bg-red-950/10',
                                                    badge: 'bg-red-500/10 border-red-500/30 text-red-400',
                                                    label: 'CRITICAL',
                                                    icon: <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />
                                                },
                                                Warning: {
                                                    border: 'border-amber-500/30 bg-amber-950/10',
                                                    badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                                                    label: 'WARNING',
                                                    icon: <AlertTriangle className="w-3 h-3 text-amber-400" />
                                                },
                                                Informational: {
                                                    border: 'border-blue-500/30 bg-blue-950/10',
                                                    badge: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                                                    label: 'INFORMATIONAL',
                                                    icon: <Info className="w-3 h-3 text-blue-400" />
                                                }
                                            };
                                            const config = sevConfig[severity];

                                            return (
                                                <div key={idx} className={`border p-3 rounded-lg flex items-center justify-between gap-2.5 animate-in fade-in-25 ${config.border}`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xs font-black px-2 py-1 rounded border ${config.badge}`}>{dtc.code}</span>
                                                        <div className="space-y-0.5 text-left">
                                                            <div className="text-[11px] font-sans font-black text-gray-200 uppercase">{dtc.description}</div>
                                                            <div className="text-[8px] text-gray-500 font-mono flex items-center gap-1.5">
                                                                STATUS: {dtc.status} // CONFIRMED STORED CODE
                                                                <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                                                <span className="flex items-center gap-1 uppercase tracking-wider font-black">
                                                                    {config.icon}
                                                                    {config.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {subTab === 'mode05' && (
                        <div id="obd-mode5-view" className="space-y-4">
                            <div className="bg-[#111]/30 border border-white/5 p-4 rounded-xl space-y-2">
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest leading-none font-bold">In-Use Performance On-Board Test Parameters</span>
                                <h4 className="text-white text-xs font-black uppercase">Mode 05/06 Sensor Limits & Verification</h4>
                                <p className="text-[10px] text-gray-500 leading-tight font-sans">
                                    Displays specific non-continuous onboard monitoring diagnostic results which calculate catalytic efficiency, secondary O2 sensor switching response, misfire frequency, and EVAP canister vapor loss rates.
                                </p>
                            </div>

                            <div className="space-y-1.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                                {ON_BOARD_MONITOR_LIMITS.map((test, idx) => (
                                    <div key={idx} className="bg-black border border-white/5 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-mono text-[10px]">
                                        <div className="space-y-1 min-w-0 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20 px-1 rounded uppercase tracking-tighter">TID {test.tid} CID {test.cid}</span>
                                                <span className="text-[10px] text-gray-500 uppercase font-sans font-bold truncate max-w-xs">{test.system}</span>
                                            </div>
                                            <div className="text-[11px] font-sans text-gray-200 font-bold leading-none capitalize">{test.name}</div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                                            <div className="text-right text-[10px] font-mono">
                                                <div className="text-gray-500 text-[9px] uppercase font-sans">Target Constraint</div>
                                                <div className="font-bold text-gray-400">{test.limit}</div>
                                            </div>
                                            <div className="text-right text-[10px] font-mono border-l border-white/5 pl-3">
                                                <div className="text-gray-500 text-[9px] uppercase font-sans">Actual Value</div>
                                                <div className="font-bold text-brand-cyan">{test.value}</div>
                                            </div>
                                            <span className="text-[10px] font-black tracking-widest px-2 py-1 bg-emerald-950/20 text-emerald-400 border border-emerald-900/40 rounded shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                                                {test.result}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {subTab === 'mode08' && (
                        <div id="obd-mode8-view" className="space-y-4 text-left">
                            <div className="bg-[#111]/30 border border-white/5 p-4 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-brand-purple" />
                                    <h4 className="text-white text-xs font-black uppercase">Mode 08 Bi-Directional Actuator Control Suite</h4>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-tight font-sans">
                                    Send override commands directly to active electronic relays and solenoids. These diagnostic overrides remain safe for use with key on engine off testing.
                                </p>
                            </div>

                            {/* Bi-directional controls grids */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1 font-mono">
                                
                                {/* Actuator 1: Fuel Pump override */}
                                <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-between gap-2">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-white font-bold uppercase">1. Fuel Pump Override Relay</span>
                                            <span className="text-[8px] font-mono text-gray-500">7E0 // PID 3021</span>
                                        </div>
                                        <p className="text-[8.5px] text-gray-500 font-sans leading-snug">Override fuel pump speed circuit. Use to prime injectors during maintenance.</p>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button 
                                            onClick={() => handleMode08Command('fuel_pump_on')}
                                            className="flex-1 py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 text-[9px] font-bold rounded uppercase transition-colors"
                                        >
                                            Energize (ON)
                                        </button>
                                        <button 
                                            onClick={() => handleMode08Command('fuel_pump_off')}
                                            className="flex-1 py-1.5 bg-brand-red/15 hover:bg-brand-red text-brand-red hover:text-black border border-brand-red/20 text-[9px] font-bold rounded uppercase transition-colors"
                                        >
                                            De-Energize (OFF)
                                        </button>
                                    </div>
                                </div>

                                {/* Actuator 2: Coolant Fan control */}
                                <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-between gap-2">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-white font-bold uppercase">2. Coolant Radiator Fan Duty</span>
                                            <span className="text-[8px] font-mono text-gray-500">7E0 // PID 3022</span>
                                        </div>
                                        <p className="text-[8.5px] text-gray-500 font-sans leading-snug">Powers cooling fan coils on low/high duty steps to verify mechanical state.</p>
                                    </div>
                                    <div className="flex gap-1.5 mt-2">
                                        <button 
                                            onClick={() => handleMode08Command('fan_low')}
                                            className="flex-1 py-1 bg-white/5 border border-white/10 hover:bg-white/15 text-[8.5px] font-bold rounded uppercase transition-colors"
                                        >
                                            Low Speed
                                        </button>
                                        <button 
                                            onClick={() => handleMode08Command('fan_high')}
                                            className="flex-1 py-1 bg-brand-cyan/20 border border-brand-cyan/30 hover:bg-brand-cyan hover:text-black text-[8.5px] font-bold rounded uppercase transition-colors"
                                        >
                                            High Speed
                                        </button>
                                        <button 
                                            onClick={() => handleMode08Command('fan_off')}
                                            className="flex-1 py-1 bg-brand-red/20 border border-brand-red/30 hover:bg-brand-red text-[8.5px] font-bold rounded uppercase transition-colors"
                                        >
                                            Off
                                        </button>
                                    </div>
                                </div>

                                {/* Actuator 3: EGR Duty Actuator */}
                                <div className="bg-black/30 border border-white/5 p-3 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-white font-bold uppercase">3. EGR Valve Solenoid Override</span>
                                        <span className="text-[8px] font-mono text-gray-500">7E0 // PID 3034</span>
                                    </div>
                                    <p className="text-[8.5px] text-gray-500 font-sans leading-snug">Cycle Exhaust Gas Recirculation solenoid dynamically between 0% and 100%.</p>
                                    
                                    <div className="flex items-center gap-3 pt-1">
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            value={egrDuty}
                                            onChange={(e) => handleEgrChange(parseInt(e.target.value))}
                                            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                                        />
                                        <span className="text-xs font-black text-brand-cyan w-10 text-right">{egrDuty}%</span>
                                    </div>
                                </div>

                                {/* Actuator 4: Injector Shutoff (Misfire Isolator) */}
                                <div className="bg-black/30 border border-white/5 p-3 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-white font-bold uppercase">4. Individual Injector Cutout Test</span>
                                        <span className="text-[8px] font-mono text-gray-500">7E0 // PID 3042</span>
                                    </div>
                                    <p className="text-[8.5px] text-gray-500 font-sans leading-snug">Disable a specific cylinder injector to isolate mechanical engine misfires.</p>
                                    
                                    <div className="grid grid-cols-6 gap-1 pt-1">
                                        {[1, 2, 3, 4, 5, 6].map(cyl => {
                                            const cut = injectorCutoff === cyl;
                                            return (
                                                <button 
                                                    key={cyl}
                                                    onClick={() => handleInjectorCut(cyl)}
                                                    className={`py-1 text-[8.5px] font-bold rounded uppercase border transition-all ${cut ? 'bg-brand-red/30 border-brand-red text-brand-red animate-pulse font-black' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                                >
                                                    C{cyl}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Actuator 5: Electronic Throttle Sweep */}
                                <div className="bg-black/30 border border-white/5 p-3 rounded-xl col-span-1 md:col-span-2 flex flex-col sm:flex-row justify-between items-center gap-3">
                                    <div className="min-w-0 flex-1 text-left">
                                        <span className="text-[10px] text-white font-bold uppercase">5. Throttle Valve Self-Test Sweep Loop</span>
                                        <p className="text-[8.5px] text-gray-500 font-sans leading-snug mt-0.5">Executes full range mechanical self-test sweeps (0% → 100% → 0%) with key on/engine off to verify target duty follow-up.</p>
                                    </div>
                                    <button 
                                        disabled={isThrottleSweeping}
                                        onClick={handleThrottleSweep}
                                        className={`px-4 py-2 text-[9px] font-bold rounded uppercase border tracking-wider transition-colors shrink-0 w-full sm:w-auto ${isThrottleSweeping ? 'bg-zinc-800 border-zinc-700 text-zinc-500 animate-pulse' : 'bg-brand-purple/20 border-brand-purple/30 text-brand-purple hover:bg-brand-purple hover:text-black'}`}
                                    >
                                        {isThrottleSweeping ? 'Sweeping TPS...' : 'Run Sweep Test'}
                                    </button>
                                </div>

                            </div>
                        </div>
                    )}

                    {subTab === 'mode09' && (
                        <div id="obd-mode9-view" className="space-y-4 text-left">
                            <div className="bg-[#111]/30 border border-white/5 p-4 rounded-xl flex items-center gap-3">
                                <Info className="w-5 h-5 text-brand-cyan flex-shrink-0 animate-pulse" />
                                <div>
                                    <h4 className="text-white text-xs font-black uppercase">Mode 09 Request Vehicle / Calibration Information</h4>
                                    <p className="text-[10.5px] text-gray-500 leading-none font-sans mt-1">Queries locked ROM addresses holding manufacturing, validation, and calibration metadata.</p>
                                </div>
                            </div>

                            <div className="bg-black border border-white/5 p-4 rounded-xl space-y-4 font-mono select-text">
                                <div className="space-y-3.5">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <div>
                                            <span className="text-[9px] text-gray-500 uppercase font-sans">VIN (Vehicle Identification)</span>
                                            <div className="text-xs font-black text-white uppercase tracking-wider mt-1 font-mono">JN1EV6AP8BM140881</div>
                                        </div>
                                        <span className="text-[9px] bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">0902 DATA</span>
                                    </div>

                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <div>
                                            <span className="text-[9px] text-gray-500 uppercase font-sans">ECU Software ID / ROM OS ID</span>
                                            <div className="text-xs font-black text-white uppercase tracking-wider mt-1 font-mono">1JK0B-20110609_G25S</div>
                                        </div>
                                        <span className="text-[9px] bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">0904 CALID</span>
                                    </div>

                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <div>
                                            <span className="text-[9px] text-gray-500 uppercase font-sans">Calibration Verification Number (CVN)</span>
                                            <div className="text-xs font-black text-brand-cyan uppercase tracking-wider mt-1 font-mono">F7D2B60C89EE1B02</div>
                                        </div>
                                        <span className="text-[9px] bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">0906 CVN</span>
                                    </div>

                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <div>
                                            <span className="text-[9px] text-gray-500 uppercase font-sans">ECU Hardware Processor Core</span>
                                            <div className="text-xs font-black text-white uppercase tracking-wider mt-1 font-mono">RENSAS SH72533 (32-Bit TriCore, Flash 2048KB)</div>
                                        </div>
                                        <span className="text-[9px] bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">090A NAME</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-[9px] text-gray-500 uppercase font-sans">Programming Counter / Write Iterations</span>
                                            <div className="text-xs font-black text-brand-purple uppercase tracking-wider mt-1 font-mono">5 successful flash write events registered</div>
                                        </div>
                                        <span className="text-[9px] bg-brand-purple/20 text-brand-purple border border-brand-purple/20 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">090B WRT</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Right Area: Simulated CAN Bus Activity Monitor */}
                <div className="w-full xl:w-72 shrink-0 bg-[#090909] p-4 flex flex-col justify-between overflow-hidden">
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex justify-between items-center mb-3 shrink-0">
                            <h4 className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                                Real-Time CAN Bus Query Monitor
                            </h4>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                        </div>
                        
                        <p className="text-[9px] text-gray-500 mb-3 leading-tight shrink-0 text-left">Shows simulated ISO-CAN low-level parameter write and request payloads executed live on the system.</p>
                        
                        {/* Terminal list with green highlights */}
                        <div className="flex-1 bg-black rounded-lg border border-white/5 p-3 font-mono text-[9px] overflow-y-auto custom-scrollbar select-text space-y-2 max-h-[180px] xl:max-h-full text-left">
                            {queryLogs.map((log, i) => {
                                let color = "text-gray-400";
                                if (log.startsWith("TX:")) color = "text-orange-400 font-bold";
                                if (log.startsWith("RX:")) color = "text-emerald-400";
                                if (log.startsWith("SIM:")) color = "text-brand-cyan font-bold italic";
                                if (log.startsWith("ISO") || log.startsWith("K-Suite")) color = "text-gray-500 border-b border-white/5 pb-1.5";

                                return (
                                    <div key={i} className={`leading-relaxed break-all ${color}`}>
                                        {log}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button 
                        onClick={() => setQueryLogs([
                            "ISO15765-4 CAN High-Speed Baud initialized.",
                            "TX: AT SH 7E0 // Set header targeting ECM",
                            "RX: OK"
                        ])}
                        className="mt-3 w-full py-1.5 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 rounded transition-colors text-[9px] font-bold uppercase tracking-widest self-end shrink-0"
                    >
                        Purge Monitor Logs
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ObdModesPanel;
