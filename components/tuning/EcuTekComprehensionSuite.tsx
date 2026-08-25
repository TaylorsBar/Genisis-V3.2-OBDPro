import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Cpu, 
    Sliders, 
    Database, 
    Activity, 
    Play, 
    CheckCircle, 
    AlertTriangle, 
    Settings, 
    Layers, 
    Zap, 
    Sparkles, 
    RefreshCw, 
    SlidersHorizontal, 
    Terminal, 
    Binary,
    Search,
    Code,
    Wand2,
    TrendingUp,
    Radio,
    Eye,
    Check,
    BookOpen,
    Download as DownloadIcon,
    Upload
} from 'lucide-react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useUIStore } from '../../stores/uiStore';
import { EcuVariant } from '../../services/UdsSecurityService';
import { DatabaseService } from '../../services/DatabaseService';

interface DetectedMap {
    id: string;
    name: string;
    address: string;
    dimensions: string;
    type: string;
    desc: string;
    data: number[][];
    xAxisLabel: string;
    yAxisLabel: string;
    unit: string;
}

const EcuTekComprehensionSuite: React.FC = () => {
    // Platform Selection: VR30DDTT, VQ37VHR, VR38DETT, SKYLINE_SH7055
    const [selectedEcu, setSelectedEcu] = useState<'VR30DDTT' | 'VQ37VHR' | 'VR38DETT' | 'SKYLINE_SH7055'>('VR30DDTT');
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanMessage, setScanMessage] = useState('');
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [hasScanned, setHasScanned] = useState(false);

    // Skyline SH7055 Nisprog and DTC Configuration States
    const [activeSkylineTab, setActiveSkylineTab] = useState<'nisprog' | 'dtcMasks'>('nisprog');
    const [nisprogLog, setNisprogLog] = useState<string[]>(['[Nisprog v1.0.4] Offline. Ready to interface via K-Line.']);
    const [isNisprogConnecting, setIsNisprogConnecting] = useState(false);
    const [isNisprogFlashing, setIsNisprogFlashing] = useState(false);
    const [isNisprogConnected, setIsNisprogConnected] = useState(false);
    const [isNisprogDumping, setIsNisprogDumping] = useState(false);
    const [skylineDtcs, setSkylineDtcs] = useState<{ id: string; name: string; address: string; active: boolean }[]>([
        { id: 'dtc_1', name: 'DTC 1: Crankshaft Position Sensor (P0335)', address: '0xA288', active: true },
        { id: 'dtc_2', name: 'DTC 2: Camshaft Position Sensor (P0340)', address: '0xA28C', active: true },
        { id: 'dtc_3', name: 'DTC 3: Mass Airflow Circuit High/Low (P0102)', address: '0xA290', active: true },
        { id: 'dtc_4', name: 'DTC 4: Engine Coolant Temp (P0117)', address: '0xA294', active: true },
        { id: 'dtc_5', name: 'DTC 5: Intake Air Temp (P0112)', address: '0xA298', active: true },
        { id: 'dtc_6', name: 'DTC 6: Knock Sensor Circuit Malfunction (P0325)', address: '0xA29C', active: true },
        { id: 'dtc_7', name: 'DTC 7: Throttle Position Circuit (P0122)', address: '0xA2A0', active: true },
        { id: 'dtc_8', name: 'DTC 8: O2 Sensor Bank 1 (P0130)', address: '0xA2A4', active: true },
        { id: 'dtc_9', name: 'DTC 9: Injector Circuit Open (P0200)', address: '0xA2A8', active: true },
        { id: 'dtc_10', name: 'DTC 10: Evaporative Emission System (P0440)', address: '0xA2AC', active: true },
        { id: 'dtc_11', name: 'DTC 11: Ignition Coil Secondary Fault (P0350)', address: '0xA2B0', active: true },
        { id: 'dtc_12', name: 'DTC 12: Vehicle Speed Sensor (P0500)', address: '0xA2B4', active: true },
        { id: 'dtc_13', name: 'DTC 13: Idle Air Control (P0505)', address: '0xA2B8', active: true },
        { id: 'dtc_14', name: 'DTC 14: EGR Valve Volume Control (P0400)', address: '0xA2BC', active: true },
        { id: 'dtc_15', name: 'DTC 15: Catalyst System Efficiency (P0420)', address: '0xA2C0', active: true },
        { id: 'dtc_16', name: 'DTC 16: Torque Signal Fault (P1600)', address: '0xA2C4', active: true },
        { id: 'dtc_17', name: 'DTC 17: Alternative ROM Checksum Fault (P1700)', address: '0xA2C8', active: true }
    ]);
    const [skylineSupmasks, setSkylineSupmasks] = useState<{ id: string; name: string; address: string; active: boolean }[]>([
        { id: 'cid1100', name: 'CID1100 Supmask (Diagnostic Class)', address: '0x8386', active: true },
        { id: 'cid1120', name: 'CID1120 Supmask (System Loop)', address: '0x8392', active: true },
        { id: 'cid1140', name: 'CID1140 Supmask (Emission Check)', address: '0x838A', active: true },
        { id: 'cid1160', name: 'CID1160 Supmask (Evap Evacuation)', address: '0x838E', active: true },
        { id: 'cid1200', name: 'CID1200 Supmask (Fuel Trims Guard)', address: '0x839E', active: true },
        { id: 'cid1220', name: 'CID1220 Supmask (Knock Strategy)', address: '0x83A2', active: true },
        { id: 'cid1240', name: 'CID1240 Supmask (VTC Angle Bounds)', address: '0x83A6', active: true },
        { id: 'cid1300', name: 'CID1300 Supmask (Secondary Monitors)', address: '0x83AA', active: true },
        { id: 'cid1400', name: 'CID1400 Supmask (Misfire Detection)', address: '0x8396', active: true },
        { id: 'cid1420', name: 'CID1420 Supmask (Exhaust Gas Recirculation)', address: '0x839A', active: true },
        { id: 'cid1500', name: 'CID1500 Supmask (Auto Transmission Line)', address: '0x83AE', active: true }
    ]);
    
    // ROM Hex visualization
    const [hexMatrix, setHexMatrix] = useState<string[]>([]);
    const [highlightedIndices, setHighlightedIndices] = useState<number[]>([]);
    
    // Map Editing
    const [detectedMaps, setDetectedMaps] = useState<DetectedMap[]>([]);
    const [selectedMap, setSelectedMap] = useState<DetectedMap | null>(null);
    const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
    const [cellInputValue, setCellInputValue] = useState('');

    // RaceROM Features State
    const [activeMode, setActiveMode] = useState<number>(1);
    const [modeConfigs, setModeConfigs] = useState<Record<number, {
        boostLimit: number;
        timingDelta: number;
        launchRpm: number;
        exhaustBurble: number;
        label: string;
    }>>({
        1: { boostLimit: 1.1, timingDelta: 0.0, launchRpm: 3200, exhaustBurble: 10, label: "93 Pump Performance" },
        2: { boostLimit: 1.4, timingDelta: 2.5, launchRpm: 3500, exhaustBurble: 20, label: "E85 Flex-Fuel Max Power" },
        3: { boostLimit: 1.2, timingDelta: -4.0, launchRpm: 3000, exhaustBurble: 95, label: "Overrun Crackles/Flame Map" },
        4: { boostLimit: 0.5, timingDelta: -8.0, launchRpm: 2000, exhaustBurble: 0, label: "Valet/Eco Safe Mode" }
    });

    // Custom Map Formula
    const [customInput1, setCustomInput1] = useState('FLEX_ETHANOL_PERCENT');
    const [customInput2, setCustomInput2] = useState('IAT_SENSOR_TEMP');
    const [customOutput, setCustomOutput] = useState('BOOST_TARGET_OFFSET');
    const [customMultiplier, setCustomMultiplier] = useState('1.5');
    const [customLog, setCustomLog] = useState<string[]>([]);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isCompiled, setIsCompiled] = useState(false);

    // Fast Logging Bypass
    const [bypassLogging, setBypassLogging] = useState(false);
    const [logStream, setLogStream] = useState<{ time: string; rpm: number; boost: number; vvel: number; eg: number }[]>([]);
    const logIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // AI Map Advisor and Transformer States
    const [isAnalyzingMap, setIsAnalyzingMap] = useState(false);
    const [aiMapReport, setAiMapReport] = useState<{ summary: string; suggestion: string } | null>(null);

    // Advanced CAN Sniffer and Parameter Injector States
    const [activeRightTab, setActiveRightTab] = useState<'calibration' | 'canSniffer'>('calibration');
    const [isSniffing, setIsSniffing] = useState(false);
    const [snifferFrames, setSnifferFrames] = useState<{ id: string; dlc: number; data: string[]; count: number }[]>([]);
    const [userCanQuery, setUserCanQuery] = useState("Identify Ethanolic concentration percent and thermal offset variables");
    const [isAnalyzingCan, setIsAnalyzingCan] = useState(false);
    const [canSuggestions, setCanSuggestions] = useState<any[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null);
    const [customSensors, setCustomSensors] = useState<{ value: string; label: string }[]>([
        { value: 'FLEX_ETHANOL_PERCENT', label: 'Flex-Fuel Ethanol %' },
        { value: 'IAT_SENSOR_TEMP', label: 'Inlet Air Temp' },
        { value: 'ACCEL_PEDAL_RAW', label: 'Pedal Position' },
        { value: 'GEAR_INDEX', label: 'Active Gear Index' }
    ]);

    const showToast = useUIStore.getState().showToast;
    const requestSecurityAccess = useVehicleStore(state => state.requestSecurityAccess);

    // Skyline SH7055 Nisprog and DTC Configuration Core Actions
    const connectNisprog = async () => {
        setIsNisprogConnecting(true);
        setNisprogLog(prev => [...prev, '[COM3] Open serial port at 10400 bps...']);
        await new Promise(r => setTimeout(r, 600));
        setNisprogLog(prev => [...prev, 'Sending L22 Fast Initialization pulse...']);
        await new Promise(r => setTimeout(r, 800));
        setNisprogLog(prev => [...prev, 'ECU wakeup reply: 55 EF 7F (Successful)']);
        setNisprogLog(prev => [...prev, 'Processor: Renesas SH7055 (512kb Internal Flash) detected.']);
        await new Promise(r => setTimeout(r, 500));
        setNisprogLog(prev => [...prev, 'Uploading custom Nisprog bootstrap kernel to RAM address 0xFFFF0000...']);
        await new Promise(r => setTimeout(r, 900));
        setNisprogLog(prev => [...prev, 'Baudrate escalation to 38400 bps... Done.']);
        setNisprogLog(prev => [...prev, 'Nisprog calibration session initiated and UNLOCKED!']);
        setIsNisprogConnecting(false);
        setIsNisprogConnected(true);
        showToast("Nisprog connected to SH7055 ECU!", "success");
    };

    const dumpNisprogRom = async () => {
        if (!isNisprogConnected) return;
        setIsNisprogDumping(true);
        setNisprogLog(prev => [...prev, 'Dumping full 512KB ROM space...']);
        for (let s = 0; s <= 10; s++) {
            await new Promise(r => setTimeout(r, 150));
            setNisprogLog(prev => [...prev, `Reading sector ${s}/15 at 0x${(s * 0x8000).toString(16).toUpperCase()}... OK`]);
        }
        setNisprogLog(prev => [...prev, 'Validating Alternative Checksum boundaries: 0x1408 - 0x3186...']);
        setNisprogLog(prev => [...prev, 'Dump completed! ROM MD5: c62fbc826500bdf19623e1e903f6f1c4.']);
        setIsNisprogDumping(false);
        showToast("512KB ROM successfully dumped to workspace!", "success");
    };

    const flashNisprogRom = async () => {
        if (!isNisprogConnected) return;
        setIsNisprogFlashing(true);
        setNisprogLog(prev => [...prev, 'Preparing flash sector write...']);
        await new Promise(r => setTimeout(r, 500));
        setNisprogLog(prev => [...prev, 'Erasing sectors...']);
        await new Promise(r => setTimeout(r, 800));
        setNisprogLog(prev => [...prev, 'Sector 0-3 cleared.']);
        setNisprogLog(prev => [...prev, 'Writing custom calibration segments...']);
        await new Promise(r => setTimeout(r, 900));
        setNisprogLog(prev => [...prev, 'Calculating Alt Checksum...']);
        setNisprogLog(prev => [...prev, 'Checksum range 0x1408 to 0x3186 updated to value: 0x5CBA']);
        setNisprogLog(prev => [...prev, 'Success! Flash write complete. Bootloader session closed.']);
        setIsNisprogFlashing(false);
        showToast("Nissan Skyline ROM flash written successfully!", "success");
    };

    const disconnectNisprog = () => {
        setIsNisprogConnected(false);
        setNisprogLog(['[Nisprog v1.0.4] Offline. Ready to interface via K-Line.']);
        showToast("Nisprog session closed.", "info");
    };

    const toggleDtc = (id: string) => {
        setSkylineDtcs(prev => prev.map(dtc => {
            if (dtc.id === id) {
                const nextState = !dtc.active;
                showToast(`${dtc.name} ${nextState ? 'ENABLED' : 'MUTED'} in ROM map at address ${dtc.address}!`, "success");
                return { ...dtc, active: nextState };
            }
            return dtc;
        }));
    };

    const toggleSupmask = (id: string) => {
        setSkylineSupmasks(prev => prev.map(mask => {
            if (mask.id === id) {
                const nextState = !mask.active;
                showToast(`${mask.name} ${nextState ? 'ENABLED' : 'MUTED'} at address ${mask.address}!`, "success");
                return { ...mask, active: nextState };
            }
            return mask;
        }));
    };

    // SVG path generator for direct memory access (DMA) oscilloscope
    const generatePath = (
        data: { time: string; rpm: number; boost: number; vvel: number; eg: number }[],
        key: 'rpm' | 'boost' | 'vvel' | 'eg',
        min: number,
        max: number,
        height: number,
        width: number
    ) => {
        if (data.length < 2) return '';
        const points = data.map((d, index) => {
            const x = (index / (data.length - 1)) * width;
            const val = d[key];
            const normalized = Math.max(0, Math.min(1, (val - min) / (max - min)));
            const y = height - (normalized * height);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return `M ${points.join(' L ')}`;
    };

    // Initialize Mock Hex data
    useEffect(() => {
        const tempHex: string[] = [];
        for (let i = 0; i < 256; i++) {
            const val = Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
            tempHex.push(val);
        }
        setHexMatrix(tempHex);
    }, [selectedEcu]);

    // Handle ROM Comprehension Scan
    const triggerRomScan = async () => {
        setIsScanning(true);
        setScanProgress(0);
        setHasScanned(false);
        setDetectedMaps([]);
        setSelectedMap(null);
        setScanLog([`[EcuTek Comprehension v8.1] Initializing binary scan for ${selectedEcu} ROM...`]);

        const totalSteps = 20;
        const messages = [
            "Decompressing factory ROM image...",
            "Analyzing memory layout boundaries...",
            "Calculating Shannon Entropy index across memory offsets...",
            "Detecting 1D Axis definitions (RPM, Load, Volumetric index)...",
            "Resolving map boundaries using local heuristic gradients...",
            "Validating cell checksum configurations...",
            "Locating VVEL Lift and VTC angle offset structures...",
            "Injecting EcuTek RaceROM patch pointers...",
            "Assembling dynamic data definitions (UDS 0x2C)...",
            "ROM analysis complete! 4 high-fidelity maps recovered."
        ];

        for (let i = 1; i <= totalSteps; i++) {
            await new Promise(r => setTimeout(r, 120));
            const pct = (i / totalSteps) * 100;
            setScanProgress(pct);

            // Dynamically light up random indices in the hex table
            const activeIndices: number[] = [];
            const count = Math.floor(Math.random() * 20) + 10;
            for (let k = 0; k < count; k++) {
                activeIndices.push(Math.floor(Math.random() * 256));
            }
            setHighlightedIndices(activeIndices);

            if (i % 2 === 0) {
                const msgIdx = Math.floor(i / 2) - 1;
                if (messages[msgIdx]) {
                    setScanMessage(messages[msgIdx]);
                    setScanLog(prev => [...prev, `[${pct.toFixed(0)}%] ${messages[msgIdx]}`]);
                }
            }
        }

        // Establish detected maps based on selected platform
        const maps: DetectedMap[] = [];
        if (selectedEcu === 'VR30DDTT') {
            maps.push(
                {
                    id: 'vvel_lift',
                    name: 'VVEL Intake Valve Lift',
                    address: '0x1A2B0',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Defines direct intake valve lift target (mm) relative to engine speed and target load.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Engine Load (%)',
                    unit: 'mm',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((1.5 + (r * 0.4) + (c * 0.2)).toFixed(2)))
                    )
                },
                {
                    id: 'target_lambda',
                    name: 'Target Lambda (Bank 1 & 2)',
                    address: '0x2D4F0',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Target Air-Fuel equivalence ratio for optimal stoichiometric balance and cooling.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Engine Load (%)',
                    unit: 'λ',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((1.0 - (r * 0.01) - (c * 0.008)).toFixed(3)))
                    )
                },
                {
                    id: 'boost_target',
                    name: 'RaceROM Target Boost Limit',
                    address: '0x3E510',
                    dimensions: '16x16',
                    type: '3D Patch',
                    desc: 'EcuTek dynamic boost limit target (psi) matching wastegate threshold duty cycles.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Accelerator Position (%)',
                    unit: 'psi',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((5.0 + (r * 0.6) + (c * 0.5)).toFixed(1)))
                    )
                },
                {
                    id: 'knock_sensitivity',
                    name: 'Knock Sensor Gain Threshold',
                    address: '0x0F4B0',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Determines real knock filtration multiplier vs noise floors across high frequency bandwidths.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Cylinder Index',
                    unit: 'dB',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((12.0 + (r * 0.5) - (c * 0.2)).toFixed(1)))
                    )
                }
            );
        } else if (selectedEcu === 'VQ37VHR') {
            maps.push(
                {
                    id: 'vvel_lift',
                    name: 'VVEL Dynamic Valve Event Lift',
                    address: '0x124C0',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Intake valve event duration and lift coefficients tailored for high-revving naturally aspirated flow.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Accelerator (%)',
                    unit: 'mm',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((1.2 + (r * 0.5) + (c * 0.15)).toFixed(2)))
                    )
                },
                {
                    id: 'vtc_intake',
                    name: 'VTC Intake Cam Angle Offset',
                    address: '0x14B20',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Intake variable cam advancement target in crank degrees for optimal cylinder scavenging.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Engine Load (%)',
                    unit: 'deg',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((Math.min(40, (r * 2.5) + (c * 1.2))).toFixed(1)))
                    )
                },
                {
                    id: 'mbt_spark',
                    name: 'Base Spark Timing (MBT)',
                    address: '0x221A0',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Mean Best Torque spark timing target in crank degrees before top dead center.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Engine Load (%)',
                    unit: 'deg BTDC',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((15.0 + (r * 1.2) - (c * 0.8)).toFixed(1)))
                    )
                }
            );
        } else if (selectedEcu === 'SKYLINE_SH7055') {
            // Nissan Skyline SH7055 Nisprog platform maps matching XML definition
            maps.push(
                {
                    id: 'cold_ignition_timing',
                    name: 'Cold Ignition Timing Map',
                    address: '0x6749',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Target ignition advance degrees before top dead center (BTDC) under cold-start conditions. Reference X Axis: 0x8437.',
                    xAxisLabel: 'Engine RPM (0x8437)',
                    yAxisLabel: 'Cylinder Load',
                    unit: 'deg BTDC',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((10.0 + (r * 1.5) - (c * 0.4)).toFixed(1)))
                    )
                },
                {
                    id: 'target_afr',
                    name: 'Target AFR Map (8x8)',
                    address: '0x6E19',
                    dimensions: '8x8',
                    type: '3D Matrix',
                    desc: 'Target Air-Fuel Ratio (AFR) mapping for high load power enrichment and stoichiometric cruising. Reference X Axis: 0x81C0.',
                    xAxisLabel: 'Engine RPM (0x81C0)',
                    yAxisLabel: 'Calculated Load',
                    unit: 'AFR',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((14.7 - (r * 0.2) - (c * 0.15)).toFixed(2)))
                    )
                },
                {
                    id: 'decel_fuel_compensation',
                    name: 'Deceleration Fuel Compensation',
                    address: '0x6B09',
                    dimensions: '8x8',
                    type: '3D Matrix',
                    desc: 'Correction multiplier applied to fuel injector pulse width during closed throttle deceleration. Reference X Axis: 0x81B0, Y Axis: 0x81A8.',
                    xAxisLabel: 'RPM (0x81B0)',
                    yAxisLabel: 'Engine Load (0x81A8)',
                    unit: 'ms',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((0.85 + (r * 0.02) + (c * 0.01)).toFixed(3)))
                    )
                },
                {
                    id: 'accel_fuel_compensation',
                    name: 'Acceleration Fuel Compensation',
                    address: '0x6AC9',
                    dimensions: '8x8',
                    type: '3D Matrix',
                    desc: 'Transient fuel enrichment volume applied during rapid accelerator pedal state changes. Reference X Axis: 0x81B0, Y Axis: 0x81A8.',
                    xAxisLabel: 'RPM (0x81B0)',
                    yAxisLabel: 'Engine Load (0x81A8)',
                    unit: 'ms',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((1.12 + (r * 0.05) - (c * 0.02)).toFixed(3)))
                    )
                },
                {
                    id: 'cold_intake_cam_timing',
                    name: 'Cold Intake Cam Timing (8x8)',
                    address: '0x7099',
                    dimensions: '8x8',
                    type: '3D Matrix',
                    desc: 'Intake valve timing control (VTC) cam phase offset target for valve scavenging. Reference X Axis: 0x8DC1, Y Axis: 0x8DD1.',
                    xAxisLabel: 'Engine RPM (0x8DC1)',
                    yAxisLabel: 'Engine Load (0x8DD1)',
                    unit: 'deg',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((5.0 + (r * 1.8) + (c * 0.6)).toFixed(1)))
                    )
                },
                {
                    id: 'qh0_torque_conversion',
                    name: 'QH0 / Torque Conversion Map',
                    address: '0x7974',
                    dimensions: '8x8',
                    type: '3D Matrix',
                    desc: 'Mathematical load coefficient (QH0) to engine torque (Nm) estimation conversion index. Reference X Axis: 0x911E, Y Axis: 0x8329.',
                    xAxisLabel: 'QH0 Target (0x911E)',
                    yAxisLabel: 'RPM (0x8329)',
                    unit: 'Nm',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((40 + (r * 32) + (c * 15)).toFixed(0)))
                    )
                },
                {
                    id: 'maf_table',
                    name: 'MAF Translation Table',
                    address: '0x913E',
                    dimensions: '8x8',
                    type: 'Sensor Calibration',
                    desc: 'Mass Airflow Sensor (MAF) voltage to volumetric airflow translation curve. Essential for load scaling.',
                    xAxisLabel: 'Voltage (V)',
                    yAxisLabel: 'Flow Scaling',
                    unit: 'g/sec',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((4.5 + (r * 18.4) + (c * 9.2)).toFixed(2)))
                    )
                },
                {
                    id: 'load_base_fuel',
                    name: 'Load Base Fuel Schedule Table',
                    address: '0x92FE',
                    dimensions: '8x8',
                    type: 'Injection Matrix',
                    desc: 'Target Base Fuel Schedule (BFS) multiplier for fuel injector pulse width control.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Engine Load',
                    unit: 'BFS ms',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((1.05 + (r * 0.04) + (c * 0.015)).toFixed(3)))
                    )
                },
                {
                    id: 'target_idle_rpm',
                    name: 'Target Idle RPM Table',
                    address: '0x8993',
                    dimensions: '8x8',
                    type: 'Idle Matrix',
                    desc: 'Target Engine Idle speed (RPM) based on engine coolant temperature feedback loops.',
                    xAxisLabel: 'Coolant Temp (°C)',
                    yAxisLabel: 'AC Status',
                    unit: 'RPM',
                    data: Array.from({ length: 8 }, (_, r) => 
                        Array.from({ length: 8 }, (_, c) => Number((1200 - (r * 60) + (c * 100)).toFixed(0)))
                    )
                }
            );
        } else {
            // VR38DETT (GT-R)
            maps.push(
                {
                    id: 'boost_control',
                    name: 'Turbine WG Duty Cycle',
                    address: '0x44B00',
                    dimensions: '16x16',
                    type: '3D Matrix',
                    desc: 'Primary solenoid pulse-width modulation target for wastegate control.',
                    xAxisLabel: 'RPM',
                    yAxisLabel: 'Engine Load (%)',
                    unit: '%',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((90.0 - (r * 2.0) - (c * 3.0)).toFixed(1)))
                    )
                },
                {
                    id: 'gr6_clutch_pressure',
                    name: 'GR6 Dual-Clutch Fluid Target Pressure',
                    address: '0x55E20',
                    dimensions: '16x16',
                    type: 'Transmission Matrix',
                    desc: 'Clutch clamping targets matching heavy launch and high-torque shift transfers.',
                    xAxisLabel: 'Transmission Temperature (°C)',
                    yAxisLabel: 'Input Torque (Nm)',
                    unit: 'bar',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((2.0 + (r * 0.5) + (c * 0.8)).toFixed(1)))
                    )
                },
                {
                    id: 'launch_boost',
                    name: 'RaceROM Launch Control Boost Delta',
                    address: '0x6A110',
                    dimensions: '16x16',
                    type: 'RaceROM Patch',
                    desc: 'Offset pressure targeting during stationary launch control phases.',
                    xAxisLabel: 'Launch RPM Target',
                    yAxisLabel: 'Coolant Temp (°C)',
                    unit: 'psi',
                    data: Array.from({ length: 16 }, (_, r) => 
                        Array.from({ length: 16 }, (_, c) => Number((2.0 + (r * 0.4) + (c * 0.1)).toFixed(1)))
                    )
                }
            );
        }

        setDetectedMaps(maps);
        setHighlightedIndices([]);
        setIsScanning(false);
        setHasScanned(true);
        DatabaseService.writeSystemLog(
            'Info',
            'EcuTek',
            `Completed ROM comprehension scan for platform: ${selectedEcu}. Found ${maps.length} calibration tables.`
        );
        showToast("EcuTek ROM Comprehension Completed successfully!", "success");
    };

    // Handle map cell edit
    const startEditingCell = (r: number, c: number, value: number) => {
        setEditingCell({ r, c });
        setCellInputValue(value.toString());
    };

    const saveCellEdit = () => {
        if (!selectedMap || !editingCell) return;
        const val = parseFloat(cellInputValue);
        if (isNaN(val)) return;

        const updatedData = [...selectedMap.data];
        updatedData[editingCell.r][editingCell.c] = val;

        const updatedMap = { ...selectedMap, data: updatedData };
        setSelectedMap(updatedMap);
        setDetectedMaps(prev => prev.map(m => m.id === selectedMap.id ? updatedMap : m));
        setEditingCell(null);
    };

    // Handle Custom Map Compilation
    const compileCustomMapPatch = async () => {
        setIsCompiling(true);
        setIsCompiled(false);
        setCustomLog([`[RaceROM Compiler] Initializing Custom Code injection sequence...`]);

        const steps = [
            `Allocating custom payload registers inside free memory space at 0xFFA000...`,
            `Parsing logical parameters: IF (${customInput1}) AND (${customInput2}) THEN OFFSET (${customOutput})`,
            `Validating hardware safety margins with MemoryProtector...`,
            `Injecting direct hook in main vehicle loop interrupt vector (ISR)...`,
            `Re-calculating factory flash 32-bit checksum algorithms...`,
            `Double-buffering RaceROM memory buffers for failsafe execution...`,
            `RaceROM Custom Map compiled successfully!`
        ];

        for (let i = 0; i < steps.length; i++) {
            await new Promise(r => setTimeout(r, 400));
            setCustomLog(prev => [...prev, `> ${steps[i]}`]);
        }

        setIsCompiling(false);
        setIsCompiled(true);
        DatabaseService.writeSystemLog(
            'Info',
            'RaceROM',
            `RaceROM patch compiled. Logic: IF (${customInput1}) AND (${customInput2}) THEN OFFSET (${customOutput}) with Gain ${customMultiplier}`
        );
        showToast("RaceROM Custom Code compilation succeeded!", "success");
    };

    // FAST 120Hz Direct Logging simulation
    useEffect(() => {
        if (bypassLogging) {
            logIntervalRef.current = setInterval(() => {
                setLogStream(prev => {
                    const nextTime = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
                    const nextRpm = Math.floor(6200 + Math.sin(Date.now() / 200) * 150 + Math.random() * 40);
                    const nextBoost = Number((1.1 + Math.sin(Date.now() / 300) * 0.15 + Math.random() * 0.02).toFixed(2));
                    const nextVvel = Number((7.2 + Math.cos(Date.now() / 400) * 0.8).toFixed(2));
                    const nextEg = Math.floor(820 + Math.random() * 10);

                    const updated = [...prev, { time: nextTime, rpm: nextRpm, boost: nextBoost, vvel: nextVvel, eg: nextEg }];
                    if (updated.length > 50) updated.shift();
                    return updated;
                });
            }, 100);
        } else {
            if (logIntervalRef.current) {
                clearInterval(logIntervalRef.current);
                logIntervalRef.current = null;
            }
        }

        return () => {
            if (logIntervalRef.current) clearInterval(logIntervalRef.current);
        };
    }, [bypassLogging]);

    // Live CAN frame stream generator
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (isSniffing) {
            timer = setInterval(() => {
                setSnifferFrames(prev => {
                    const ids = ['0x110', '0x1F5', '0x2A1', '0x2AA', '0x35E', '0x42B', '0x5C4'];
                    const newFrames = [...prev];
                    
                    const targetId = ids[Math.floor(Math.random() * ids.length)];
                    const hexChars = '0123456789ABCDEF';
                    const data: string[] = Array.from({ length: 8 }, () => 
                        hexChars[Math.floor(Math.random() * 16)] + hexChars[Math.floor(Math.random() * 16)]
                    );
                    
                    const existingIdx = newFrames.findIndex(f => f.id === targetId);
                    if (existingIdx >= 0) {
                        newFrames[existingIdx] = { ...newFrames[existingIdx], data, count: newFrames[existingIdx].count + 1 };
                    } else {
                        newFrames.push({ id: targetId, dlc: 8, data, count: 1 });
                    }
                    
                    if (newFrames.length > 8) newFrames.shift();
                    return newFrames;
                });
            }, 250);
        } else {
            if (timer) clearInterval(timer);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isSniffing]);

    const runCanAnalysis = async () => {
        setIsAnalyzingCan(true);
        setCanSuggestions([]);
        setSelectedSuggestion(null);
        try {
            const { suggestCanMappings } = await import('../../services/geminiService');
            const frames = snifferFrames.map(f => ({ id: f.id, data: f.data }));
            const results = await suggestCanMappings(userCanQuery, frames);
            setCanSuggestions(results || []);
            if (results && results.length > 0) {
                setSelectedSuggestion(results[0]);
            }
            showToast("Gemini Automotive CAN analysis completed!", "success");
        } catch (e: any) {
            console.error(e);
            showToast("Failed to analyze CAN frames: " + e.message, "error");
        } finally {
            setIsAnalyzingCan(false);
        }
    };

    const injectCustomSensor = (suggestion: any) => {
        const valName = suggestion.name.toUpperCase().replace(/\s+/g, '_');
        if (customSensors.some(s => s.value === valName)) {
            showToast(`Sensor ${suggestion.name} is already registered!`, "info");
            return;
        }
        
        const newSensor = {
            value: valName,
            label: `CAN: ${suggestion.name} (${suggestion.canId})`
        };
        setCustomSensors(prev => [...prev, newSensor]);
        DatabaseService.writeSystemLog(
            'Info',
            'CAN Sniffer',
            `Injected custom CAN sensor mapping: ${suggestion.name} at CAN ID 0x${suggestion.canId}`
        );
        showToast(`Injected ${suggestion.name} into custom map sensors!`, "success");
    };

    const runMapOptimizationAdvisor = async () => {
        if (!selectedMap) return;
        setIsAnalyzingMap(true);
        setAiMapReport(null);
        try {
            const { analyzeFuelMap } = await import('../../services/geminiService');
            const fullTable = selectedMap.data;
            const mockConfig = {
                platformId: selectedEcu === 'VR30DDTT' ? 'INFINITI_VR30' : selectedEcu === 'VQ37VHR' ? 'VQ37' : selectedEcu === 'SKYLINE_SH7055' ? 'NISSAN_SKYLINE_SH7055' : 'BARRA',
                engineType: selectedEcu,
                boostTarget: 1.4,
                sparkSafetyMargin: 0.85,
                closedLoopTargetLambda: 0.82,
                injectorScaling: 1050
            };
            const result = await analyzeFuelMap(fullTable, mockConfig as any);
            setAiMapReport(result);
            showToast("Kinetic Copilot completed Map thermodynamic analysis!", "success");
        } catch (e: any) {
            console.error(e);
            showToast("Failed to analyze calibration map: " + e.message, "error");
        } finally {
            setIsAnalyzingMap(false);
        }
    };

    const applyAiOptimizationOverlay = (multiplier: number, mode: 'scale' | 'offset') => {
        if (!selectedMap) return;
        
        const updatedData = selectedMap.data.map(row => 
            row.map(val => {
                let newVal = val;
                if (mode === 'scale') {
                    newVal = Number((val * multiplier).toFixed(3));
                } else {
                    newVal = Number((val + multiplier).toFixed(3));
                }
                return newVal;
            })
        );

        const updatedMap = { ...selectedMap, data: updatedData };
        setSelectedMap(updatedMap);
        setDetectedMaps(prev => prev.map(m => m.id === selectedMap.id ? updatedMap : m));
        DatabaseService.writeSystemLog(
            'Warning',
            'AI Tuning',
            `Applied AI calibration optimization overlay to ${selectedMap.name} (${mode === 'scale' ? 'Scaled' : 'Offset'} by ${multiplier})`
        );
        showToast(`Successfully applied AI Calibration optimization overlay to ${selectedMap.name}!`, "success");
    };

    const renderBitGrid = (suggestion: any) => {
        const start = suggestion.startBit;
        const len = suggestion.bitLength;
        const order = suggestion.byteOrder;
        
        const activeBits = new Set<number>();
        for (let i = 0; i < len; i++) {
            activeBits.add((start + i) % 64);
        }

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500">
                    <span>64-Bit Frame Payload Map (8 Bytes x 8 Bits)</span>
                    <span className="text-brand-cyan uppercase">{order === 'big' ? 'Motorola' : 'Intel'}</span>
                </div>
                <div className="grid grid-cols-8 gap-1 p-2 bg-black/60 border border-white/5 rounded-lg">
                    {Array.from({ length: 64 }).map((_, bitIndex) => {
                        const byteIndex = Math.floor(bitIndex / 8);
                        const isActive = activeBits.has(bitIndex);
                        return (
                            <div 
                                key={bitIndex}
                                className={`aspect-square rounded flex flex-col items-center justify-center text-[7px] font-mono border transition-all ${
                                    isActive 
                                    ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan font-bold shadow-[0_0_5px_rgba(0,240,255,0.4)]' 
                                    : 'bg-zinc-950/40 border-white/5 text-zinc-600 hover:text-zinc-400'
                                }`}
                                title={`Byte ${byteIndex}, Bit ${bitIndex % 8}`}
                            >
                                {bitIndex}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <section className="bg-[#040404] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative w-full flex flex-col">
            {/* Header */}
            <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-cyan/10 p-2 border border-brand-cyan/20 rounded-xl">
                        <Cpu className="w-5 h-5 text-brand-cyan animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black tracking-[0.2em] text-white uppercase italic">
                            {selectedEcu === 'SKYLINE_SH7055' ? 'Nisprog Calibration Suite' : 'EcuTek Rom Comprehension'}
                        </h2>
                        <p className="text-[10px] text-zinc-500 font-medium">
                            {selectedEcu === 'SKYLINE_SH7055' 
                                ? 'Nissan Skyline SH7055 Big-Endian K-Line Bootloader & Diagnostic Suite' 
                                : 'Nissan & Infiniti Reverse-Engineering & RaceROM Calibration Suite'}
                        </p>
                    </div>
                </div>

                {/* Ecu Platform Selector */}
                <div className="flex bg-[#0a0a0a] border border-white/10 rounded-xl p-1 shrink-0 flex-wrap gap-1">
                    {['VR30DDTT', 'VQ37VHR', 'VR38DETT', 'SKYLINE_SH7055'].map(ecu => (
                        <button
                            key={ecu}
                            onClick={() => {
                                setSelectedEcu(ecu as any);
                                setHasScanned(false);
                                setSelectedMap(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                selectedEcu === ecu 
                                ? 'bg-brand-cyan text-black shadow-lg shadow-brand-cyan/20' 
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {ecu === 'SKYLINE_SH7055' ? 'SKYLINE SH7055' : ecu}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
                {/* Left controls panel - 5 cols */}
                <div className="lg:col-span-5 border-r border-white/5 p-6 flex flex-col justify-between gap-6">
                    <div className="space-y-6">
                        {/* Interactive Hex Scanning Dashboard */}
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-brand-cyan" />
                                    Active ROM Address Matrix
                                </span>
                                <span className="text-[9px] font-mono text-zinc-600">0x0000 - 0xFFFF</span>
                            </div>

                            {/* ROM Hex Table */}
                            <div className="grid grid-cols-16 gap-0.5 max-h-[140px] overflow-y-auto p-1 custom-scrollbar bg-black/60 rounded border border-white/5">
                                {hexMatrix.map((val, idx) => {
                                    const isHighlighted = highlightedIndices.includes(idx);
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`text-[8px] font-mono text-center py-0.5 rounded transition-all ${
                                                isHighlighted 
                                                ? 'bg-brand-cyan text-black font-black scale-110 shadow-[0_0_5px_#00F0FF]' 
                                                : 'text-zinc-600 hover:text-zinc-300'
                                            }`}
                                        >
                                            {val}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Primary scan trigger */}
                            <button
                                onClick={triggerRomScan}
                                disabled={isScanning}
                                className="w-full py-3 bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black border border-brand-cyan rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                            >
                                <Play className="w-3.5 h-3.5" />
                                {isScanning ? `Analyzing ROM...` : `Deconstruct & Comprehend ROM`}
                            </button>
                        </div>

                        {/* Recovery results list */}
                        {hasScanned && (
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Discovered 3D Calibration Maps:</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {detectedMaps.map(map => (
                                        <button
                                            key={map.id}
                                            onClick={() => setSelectedMap(map)}
                                            className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center group ${
                                                selectedMap?.id === map.id 
                                                ? 'bg-brand-cyan/10 border-brand-cyan/40 text-white' 
                                                : 'bg-black/30 border-white/5 hover:border-white/10 text-zinc-300'
                                            }`}
                                        >
                                            <div>
                                                <div className="text-[11px] font-bold uppercase">{map.name}</div>
                                                <div className="text-[8px] font-mono text-zinc-500 mt-1">Offset: {map.address} | Dimensions: {map.dimensions}</div>
                                            </div>
                                            <div className="text-[9px] font-black font-mono text-brand-cyan bg-brand-cyan/5 px-2 py-1 rounded border border-brand-cyan/20">
                                                {map.type}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Technical log lines */}
                    <div className="bg-[#050505] border border-white/5 p-4 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                            <Terminal className="w-3.5 h-3.5" />
                            Comprehension Core Diagnostics
                        </div>
                        <div className="h-[90px] overflow-y-auto font-mono text-[9px] text-emerald-500/80 space-y-1.5 custom-scrollbar">
                            {scanLog.map((log, i) => (
                                <div key={i} className="leading-normal">{log}</div>
                            ))}
                            {isScanning && (
                                <div className="flex items-center gap-2 text-brand-cyan animate-pulse">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Scanning segment... {(scanProgress).toFixed(0)}%</span>
                                </div>
                            )}
                            {!isScanning && scanLog.length === 0 && (
                                <div className="text-zinc-600 italic">No diagnostic events compiled. Trigger ROM Comprehension above.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Interactive workspace panel - 7 cols */}
                <div className="lg:col-span-7 bg-black/30 p-6 flex flex-col justify-between gap-6 min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {/* Map editor screen */}
                        {selectedMap ? (
                            <motion.div 
                                key={selectedMap.id}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-6"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase italic tracking-widest">{selectedMap.name}</h3>
                                        <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed max-w-lg">{selectedMap.desc}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setSelectedMap(null);
                                            setAiMapReport(null);
                                        }}
                                        className="text-[9px] font-black text-zinc-500 hover:text-white uppercase tracking-widest"
                                    >
                                        [Close Map]
                                    </button>
                                </div>

                                {/* Custom Grid View */}
                                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/60">
                                    <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center text-[8px] font-mono text-zinc-500">
                                        <span>X-Axis: {selectedMap.xAxisLabel}</span>
                                        <span>Y-Axis: {selectedMap.yAxisLabel}</span>
                                        <span>Unit: {selectedMap.unit}</span>
                                    </div>

                                    <div className="p-4 overflow-x-auto">
                                        <table className="w-full min-w-[320px] border-collapse">
                                            <tbody>
                                                {selectedMap.data.slice(0, 8).map((row, rIdx) => (
                                                    <tr key={rIdx}>
                                                        {row.slice(0, 8).map((val, cIdx) => {
                                                            const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;
                                                            return (
                                                                <td 
                                                                    key={cIdx}
                                                                    onClick={() => startEditingCell(rIdx, cIdx, val)}
                                                                    className={`border border-white/5 p-2 font-mono text-[10px] text-center cursor-pointer transition-all ${
                                                                        isEditing 
                                                                        ? 'bg-brand-cyan text-black font-black' 
                                                                        : 'hover:bg-brand-cyan/20 text-brand-cyan'
                                                                    }`}
                                                                >
                                                                    {isEditing ? (
                                                                        <input 
                                                                            type="text"
                                                                            value={cellInputValue}
                                                                            onChange={(e) => setCellInputValue(e.target.value)}
                                                                            onBlur={saveCellEdit}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') saveCellEdit();
                                                                                if (e.key === 'Escape') setEditingCell(null);
                                                                            }}
                                                                            autoFocus
                                                                            className="w-full bg-transparent border-none text-center font-mono outline-none text-black font-black p-0"
                                                                        />
                                                                    ) : (
                                                                        val
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="text-[8px] text-zinc-500 text-center mt-3">Showing prioritized 8x8 cell cluster segment for preview sizing. Click cells to calibrate values.</div>
                                    </div>
                                </div>

                                {/* AI Physics Calibration Advisor Console */}
                                <div className="bg-[#080808] border border-brand-cyan/20 rounded-xl p-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Wand2 className="w-4 h-4 text-brand-cyan" />
                                            <div>
                                                <h4 className="text-[10px] font-black text-white uppercase tracking-wider">KC Intelligent Calibration Optimizer</h4>
                                                <p className="text-[8px] text-zinc-500">Thermodynamic analysis, closed-loop knock limits, and charge-scavenge tuning advisors</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={runMapOptimizationAdvisor}
                                            disabled={isAnalyzingMap}
                                            className="px-3 py-1 bg-brand-cyan/10 hover:bg-brand-cyan text-brand-cyan hover:text-black border border-brand-cyan/30 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                                        >
                                            {isAnalyzingMap ? 'Analyzing...' : 'Execute AI Fluid Analysis'}
                                        </button>
                                    </div>

                                    {aiMapReport && (
                                        <div className="space-y-3 p-3 bg-black/60 rounded-lg border border-white/5 text-[9px] animate-in fade-in duration-300">
                                            <div className="space-y-1">
                                                <div className="text-zinc-400 font-bold uppercase tracking-wider text-[8px] flex items-center gap-1">
                                                    <BookOpen className="w-3 h-3 text-brand-cyan" />
                                                    Thermodynamic Evaluation
                                                </div>
                                                <p className="text-zinc-300 font-medium leading-relaxed">{aiMapReport.summary}</p>
                                            </div>

                                            <div className="space-y-1 pt-2 border-t border-white/5">
                                                <div className="text-brand-cyan font-bold uppercase tracking-wider text-[8px] flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3 text-brand-cyan" />
                                                    Optimal Calibration Advice
                                                </div>
                                                <p className="text-zinc-300 font-medium leading-relaxed">{aiMapReport.suggestion}</p>
                                            </div>

                                            <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => applyAiOptimizationOverlay(1.015, 'scale')}
                                                    className="px-3 py-1.5 bg-brand-cyan text-black font-black uppercase tracking-wider rounded text-[8px] hover:scale-105 transition-all"
                                                >
                                                    Apply +1.5% Peak Advance
                                                </button>
                                                <button
                                                    onClick={() => applyAiOptimizationOverlay(0.985, 'scale')}
                                                    className="px-3 py-1.5 bg-zinc-900 border border-white/10 text-white font-black uppercase tracking-wider rounded text-[8px] hover:bg-white/5 transition-all"
                                                >
                                                    Taper Load Trims (-1.5%)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="default-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6 flex-1 flex flex-col justify-between"
                            >
                                {/* Tab Switcher in Right Panel */}
                                <div className="flex border-b border-white/5 pb-2 justify-between items-center">
                                    <div className="flex gap-4">
                                        {selectedEcu === 'SKYLINE_SH7055' ? (
                                            <>
                                                <button
                                                    onClick={() => setActiveSkylineTab('nisprog')}
                                                    className={`text-[10px] font-black uppercase tracking-wider pb-1.5 transition-all flex items-center gap-1.5 ${
                                                        activeSkylineTab === 'nisprog'
                                                        ? 'text-brand-cyan border-b border-brand-cyan font-bold'
                                                        : 'text-zinc-500 hover:text-white'
                                                    }`}
                                                >
                                                    <Cpu className="w-3.5 h-3.5" />
                                                    Nisprog Bootloader
                                                </button>
                                                <button
                                                    onClick={() => setActiveSkylineTab('dtcMasks')}
                                                    className={`text-[10px] font-black uppercase tracking-wider pb-1.5 transition-all ${
                                                        activeSkylineTab === 'dtcMasks'
                                                        ? 'text-white border-b border-brand-cyan'
                                                        : 'text-zinc-500 hover:text-white'
                                                    }`}
                                                >
                                                    DTC & Supmask Config
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setActiveRightTab('calibration')}
                                                    className={`text-[10px] font-black uppercase tracking-wider pb-1.5 transition-all ${
                                                        activeRightTab === 'calibration'
                                                        ? 'text-white border-b border-brand-cyan'
                                                        : 'text-zinc-500 hover:text-white'
                                                    }`}
                                                >
                                                    RaceROM Calibration
                                                </button>
                                                <button
                                                    onClick={() => setActiveRightTab('canSniffer')}
                                                    className={`text-[10px] font-black uppercase tracking-wider pb-1.5 transition-all flex items-center gap-1.5 ${
                                                        activeRightTab === 'canSniffer'
                                                        ? 'text-brand-cyan border-b border-brand-cyan font-bold'
                                                        : 'text-zinc-500 hover:text-white'
                                                    }`}
                                                >
                                                    <Radio className="w-3.5 h-3.5 animate-pulse text-brand-cyan" />
                                                    Intelligent CAN Sniffer
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-[8px] font-mono text-zinc-600 uppercase">
                                        {selectedEcu === 'SKYLINE_SH7055' ? 'K-Line Diagnostic Kernel' : 'EcuTek Extension Kernel'}
                                    </span>
                                </div>

                                {selectedEcu === 'SKYLINE_SH7055' ? (
                                    activeSkylineTab === 'nisprog' ? (
                                        <div className="space-y-4 flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Nisprog Bootloader Console</h4>
                                                        <p className="text-[8px] text-zinc-500 mt-0.5">K-Line / CAN flash kernel loader for Nissan SH7055 Processors</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[8px] font-black uppercase text-zinc-500 bg-black px-2 py-1 border border-white/5 rounded">Baud: 38400</span>
                                                        <span className={`px-2 py-1 text-[8px] font-black uppercase rounded ${isNisprogConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'}`}>
                                                            {isNisprogConnected ? 'Connected' : 'Offline'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="bg-[#050505] border border-white/10 rounded-lg p-3 font-mono text-[9px] text-zinc-300 space-y-1 h-[220px] overflow-y-auto custom-scrollbar flex flex-col shadow-inner">
                                                    {nisprogLog.map((log, i) => (
                                                        <div key={i} className="flex gap-2 hover:bg-white/5 px-1 py-0.5 rounded transition-all">
                                                            <span className="text-zinc-600 shrink-0">[{new Date().toISOString().substring(11, 19)}]</span>
                                                            <span className={log.includes('Success') || log.includes('OK') ? 'text-emerald-400' : log.includes('Error') ? 'text-brand-red' : 'text-zinc-300'}>{log}</span>
                                                        </div>
                                                    ))}
                                                    {(isNisprogConnecting || isNisprogDumping || isNisprogFlashing) && (
                                                        <div className="flex gap-2 px-1 py-0.5 animate-pulse text-brand-cyan">
                                                            <span className="text-zinc-600 shrink-0">[{new Date().toISOString().substring(11, 19)}]</span>
                                                            <span>...Processing...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                {!isNisprogConnected ? (
                                                    <button
                                                        onClick={connectNisprog}
                                                        disabled={isNisprogConnecting}
                                                        className="flex-1 py-2.5 bg-brand-cyan/20 hover:bg-brand-cyan border border-brand-cyan text-brand-cyan hover:text-black font-black text-[9px] uppercase tracking-wider rounded transition-all"
                                                    >
                                                        {isNisprogConnecting ? 'Establishing Comm...' : 'Initialize ECU (L22 Wakeup)'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={disconnectNisprog}
                                                        disabled={isNisprogDumping || isNisprogFlashing}
                                                        className="flex-1 py-2.5 bg-brand-red/20 hover:bg-brand-red border border-brand-red text-brand-red hover:text-white font-black text-[9px] uppercase tracking-wider rounded transition-all"
                                                    >
                                                        Close Session
                                                    </button>
                                                )}
                                                <button
                                                    onClick={dumpNisprogRom}
                                                    disabled={!isNisprogConnected || isNisprogDumping || isNisprogFlashing}
                                                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-black text-[9px] uppercase tracking-wider rounded transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    <DownloadIcon className="w-3.5 h-3.5" />
                                                    {isNisprogDumping ? 'Dumping...' : 'Dump ROM (512KB)'}
                                                </button>
                                                <button
                                                    onClick={flashNisprogRom}
                                                    disabled={!isNisprogConnected || isNisprogFlashing || isNisprogDumping}
                                                    className="flex-1 py-2.5 bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500 text-emerald-500 hover:text-black font-black text-[9px] uppercase tracking-wider rounded transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                    {isNisprogFlashing ? 'Flashing...' : 'Write Flash ROM'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 flex-1 flex flex-col animate-in fade-in duration-200">
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Diagnostic Trouble Code (DTC) Switches</h4>
                                                <p className="text-[8px] text-zinc-500">Toggle binary flags for OBD2 DTC reporting. Muting a code bypasses CEL illumination for specific faults.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 flex flex-col h-[280px]">
                                                    <h5 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Active Codes</h5>
                                                    <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                                        {skylineDtcs.map(dtc => (
                                                            <div key={dtc.id} className="flex items-center justify-between bg-black border border-white/5 p-2 rounded hover:border-white/10 transition-colors">
                                                                <div>
                                                                    <div className="text-[9px] font-bold text-white">{dtc.name}</div>
                                                                    <div className="text-[8px] font-mono text-zinc-600">Addr: {dtc.address}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleDtc(dtc.id)}
                                                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all ${dtc.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'}`}
                                                                >
                                                                    {dtc.active ? 'Enabled' : 'Muted'}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 flex flex-col h-[280px]">
                                                    <h5 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Diagnostic Supmasks</h5>
                                                    <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                                        {skylineSupmasks.map(mask => (
                                                            <div key={mask.id} className="flex items-center justify-between bg-black border border-white/5 p-2 rounded hover:border-white/10 transition-colors">
                                                                <div>
                                                                    <div className="text-[9px] font-bold text-white">{mask.name}</div>
                                                                    <div className="text-[8px] font-mono text-zinc-600">Addr: {mask.address}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleSupmask(mask.id)}
                                                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all ${mask.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'}`}
                                                                >
                                                                    {mask.active ? 'Enabled' : 'Muted'}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ) : activeRightTab === 'canSniffer' ? (
                                    <div className="space-y-4 flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                                        <div className="space-y-4">
                                            {/* Subtitle / Description */}
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Automotive CAN Packet Reverse-Engineering</h4>
                                                    <p className="text-[8px] text-zinc-500 mt-0.5">Stream vehicle controller area network packets and execute real-time payload mapping via Gemini 3.5</p>
                                                </div>
                                                <button
                                                    onClick={() => setIsSniffing(!isSniffing)}
                                                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all ${
                                                        isSniffing 
                                                        ? 'bg-brand-red text-white' 
                                                        : 'bg-emerald-500 text-black'
                                                    }`}
                                                >
                                                    {isSniffing ? 'Halt Sniffer' : 'Initiate CAN Sniffer'}
                                                </button>
                                            </div>

                                            {/* Live scrolling traffic frames */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="bg-black/60 border border-white/5 rounded-xl p-3 space-y-2 h-[200px] flex flex-col justify-between">
                                                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Live Packet Bus (CAN-H/CAN-L)</span>
                                                        <span className="text-[8px] font-mono text-brand-cyan animate-pulse">{isSniffing ? 'ONLINE' : 'STBY'}</span>
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto font-mono text-[9px] text-emerald-400/80 space-y-1 scrollbar-none max-h-[140px]">
                                                        {snifferFrames.length > 0 ? snifferFrames.map((frame, i) => (
                                                            <div key={i} className="flex justify-between hover:bg-white/5 px-1 py-0.5 rounded">
                                                                <span className="text-amber-500">{frame.id}</span>
                                                                <span className="text-zinc-400 font-bold">[{frame.dlc}]</span>
                                                                <span className="text-emerald-400">{frame.data.join(' ')}</span>
                                                                <span className="text-zinc-600">x{frame.count}</span>
                                                            </div>
                                                        )) : (
                                                            <div className="text-zinc-600 italic h-full flex items-center justify-center text-center">
                                                                CAN Bus Idle.<br />Click 'Initiate CAN Sniffer' to capture data frames.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Gemini prompt & analyze block */}
                                                <div className="bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col justify-between gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-wider block">Gemini Custom Reverse Engineering Target</label>
                                                        <input 
                                                            type="text"
                                                            value={userCanQuery}
                                                            onChange={e => setUserCanQuery(e.target.value)}
                                                            placeholder="What are we trying to locate? (e.g. ethanol content)"
                                                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2 text-[9px] font-mono text-white outline-none focus:border-brand-cyan/40"
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={runCanAnalysis}
                                                        disabled={isAnalyzingCan || snifferFrames.length === 0}
                                                        className="w-full py-2 bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black border border-brand-cyan rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Wand2 className="w-3.5 h-3.5" />
                                                        {isAnalyzingCan ? 'Reverse Engineering...' : 'Identify custom PIDs with Gemini'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Results suggestions layout */}
                                            {canSuggestions.length > 0 && (
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 border-t border-white/5 pt-3">
                                                    {/* List of suggestions */}
                                                    <div className="md:col-span-5 space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                                        <div className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Identified Signals</div>
                                                        {canSuggestions.map((s, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setSelectedSuggestion(s)}
                                                                className={`w-full p-2.5 rounded-lg border text-left transition-all flex justify-between items-center ${
                                                                    selectedSuggestion?.name === s.name
                                                                    ? 'bg-brand-cyan/10 border-brand-cyan/40 text-white'
                                                                    : 'bg-black/30 border-white/5 hover:border-white/10 text-zinc-300'
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className="text-[10px] font-bold">{s.name}</div>
                                                                    <div className="text-[8px] font-mono text-zinc-500 mt-0.5">ID: {s.canId} | Unit: {s.unit}</div>
                                                                </div>
                                                                <span className="text-[8px] font-black bg-brand-cyan/5 px-1.5 py-0.5 rounded text-brand-cyan">{s.confidence}%</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Selected suggestion breakdown & bit visualizer */}
                                                    {selectedSuggestion && (
                                                        <div className="md:col-span-7 bg-black/40 border border-white/5 rounded-xl p-3 space-y-3 animate-in fade-in duration-200">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <span className="text-[8px] font-black text-zinc-500 uppercase">Byte-Level Mapping Diagram</span>
                                                                    <h5 className="text-[10px] font-black text-brand-cyan uppercase">{selectedSuggestion.name}</h5>
                                                                </div>
                                                                <button
                                                                    onClick={() => injectCustomSensor(selectedSuggestion)}
                                                                    className="px-2 py-1 bg-brand-cyan text-black font-black uppercase text-[8px] rounded hover:scale-105 transition-all"
                                                                >
                                                                    Inject Sensor
                                                                </button>
                                                            </div>

                                                            {renderBitGrid(selectedSuggestion)}

                                                            <div className="text-[8.5px] text-zinc-400 font-medium leading-normal bg-black/40 border border-white/5 p-2 rounded-lg">
                                                                <span className="font-bold text-white">Math formula: </span>
                                                                RawValue * {selectedSuggestion.scaling} + {selectedSuggestion.offset} {selectedSuggestion.unit}. <br />
                                                                <span className="text-zinc-500 mt-1 block">{selectedSuggestion.explanation}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Advanced RaceROM live setup */
                                    <div className="space-y-6 flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-xs font-black text-white uppercase italic tracking-widest flex items-center gap-1.5">
                                                        <Sparkles className="w-4 h-4 text-brand-cyan" />
                                                        RaceROM 4-Way Mode Matrix
                                                    </h3>
                                                    <p className="text-[10px] text-zinc-500">Live multi-map cruise-control profile switching parameters.</p>
                                                </div>
                                            </div>

                                            {/* Modes select buttons */}
                                            <div className="grid grid-cols-4 gap-2">
                                                {[1, 2, 3, 4].map(modeNum => (
                                                    <button
                                                        key={modeNum}
                                                        onClick={() => setActiveMode(modeNum)}
                                                        className={`p-3 rounded-xl border transition-all text-center ${
                                                            activeMode === modeNum 
                                                            ? 'bg-brand-cyan/10 border-brand-cyan text-white shadow-glow-cyan' 
                                                            : 'bg-black/30 border-white/5 hover:border-white/10 text-zinc-400'
                                                        }`}
                                                    >
                                                        <div className="text-[8px] font-mono font-black text-brand-cyan">MODE {modeNum}</div>
                                                        <div className="text-[9px] font-bold truncate mt-1 text-white">{modeConfigs[modeNum].label}</div>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Sliders for current active mode */}
                                            <div className="bg-[#0c0c0c] border border-white/5 p-4 rounded-xl space-y-4">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Configure Active Parameters: Mode {activeMode}</span>
                                                    <span className="text-[9px] font-mono text-brand-cyan bg-brand-cyan/5 px-2 py-0.5 rounded border border-brand-cyan/20 font-bold">{modeConfigs[activeMode].label}</span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Solenoid duty/boost target limit */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[9px] font-bold uppercase text-zinc-400">
                                                            <span>Target Boost Limit</span>
                                                            <span className="text-brand-cyan">{modeConfigs[activeMode].boostLimit} bar</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="0.4" max="2.0" step="0.1"
                                                            value={modeConfigs[activeMode].boostLimit}
                                                            onChange={(e) => setModeConfigs(prev => ({
                                                                ...prev,
                                                                [activeMode]: { ...prev[activeMode], boostLimit: parseFloat(e.target.value) }
                                                            }))}
                                                            className="w-full accent-brand-cyan"
                                                        />
                                                    </div>

                                                    {/* Launch control stationary limit */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[9px] font-bold uppercase text-zinc-400">
                                                            <span>Launch holding RPM</span>
                                                            <span className="text-brand-cyan">{modeConfigs[activeMode].launchRpm} RPM</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="1500" max="4500" step="100"
                                                            value={modeConfigs[activeMode].launchRpm}
                                                            onChange={(e) => setModeConfigs(prev => ({
                                                                ...prev,
                                                                [activeMode]: { ...prev[activeMode], launchRpm: parseInt(e.target.value) }
                                                            }))}
                                                            className="w-full accent-brand-cyan"
                                                        />
                                                    </div>

                                                    {/* Global ignition base offset */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[9px] font-bold uppercase text-zinc-400">
                                                            <span>Spark Ignition Trim</span>
                                                            <span className="text-brand-cyan">{modeConfigs[activeMode].timingDelta >= 0 ? '+' : ''}{modeConfigs[activeMode].timingDelta}°</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="-12" max="6" step="0.5"
                                                            value={modeConfigs[activeMode].timingDelta}
                                                            onChange={(e) => setModeConfigs(prev => ({
                                                                ...prev,
                                                                [activeMode]: { ...prev[activeMode], timingDelta: parseFloat(e.target.value) }
                                                            }))}
                                                            className="w-full accent-brand-cyan"
                                                        />
                                                    </div>

                                                    {/* Overrun combustion duration (crackles) */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[9px] font-bold uppercase text-zinc-400">
                                                            <span>Overrun Burble Intensity</span>
                                                            <span className="text-brand-cyan">{modeConfigs[activeMode].exhaustBurble}%</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="0" max="100" step="5"
                                                            value={modeConfigs[activeMode].exhaustBurble}
                                                            onChange={(e) => setModeConfigs(prev => ({
                                                                ...prev,
                                                                [activeMode]: { ...prev[activeMode], exhaustBurble: parseInt(e.target.value) }
                                                            }))}
                                                            className="w-full accent-brand-cyan"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Custom Map Builder Logic Creator */}
                                        <div className="border border-white/5 rounded-xl bg-[#0c0c0c] p-4 space-y-4">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-white uppercase tracking-widest">
                                                <Sliders className="w-4 h-4 text-brand-cyan" />
                                                RaceROM Custom Map Math Constructor
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-zinc-500 uppercase">Input Sensor A</label>
                                                    <select 
                                                        value={customInput1} 
                                                        onChange={e => setCustomInput1(e.target.value)}
                                                        className="w-full bg-black border border-white/10 rounded p-1.5 text-[9px] font-mono text-zinc-300 outline-none"
                                                    >
                                                        {customSensors.map(sensor => (
                                                            <option key={sensor.value} value={sensor.value}>{sensor.label}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-zinc-500 uppercase">Input Sensor B</label>
                                                    <select 
                                                        value={customInput2} 
                                                        onChange={e => setCustomInput2(e.target.value)}
                                                        className="w-full bg-black border border-white/10 rounded p-1.5 text-[9px] font-mono text-zinc-300 outline-none"
                                                    >
                                                        {customSensors.map(sensor => (
                                                            <option key={sensor.value} value={sensor.value}>{sensor.label}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-zinc-500 uppercase">Output Vector Target</label>
                                                    <select 
                                                        value={customOutput} 
                                                        onChange={e => setCustomOutput(e.target.value)}
                                                        className="w-full bg-black border border-white/10 rounded p-1.5 text-[9px] font-mono text-zinc-300 outline-none"
                                                    >
                                                        <option value="BOOST_TARGET_OFFSET">Boost Target Offset</option>
                                                        <option value="SPARK_IGN_RETARD_TRIM">Ignition Retard</option>
                                                        <option value="VVEL_MAX_EVENT_LIMIT">VVEL Maximum Lift</option>
                                                        <option value="PORT_DIRECT_SPLIT_RATIO">Injector Split Ratio</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-zinc-500 uppercase">Gain Multiplier</label>
                                                    <input 
                                                        type="text" 
                                                        value={customMultiplier}
                                                        onChange={e => setCustomMultiplier(e.target.value)}
                                                        className="w-full bg-black border border-white/10 rounded p-1.5 text-[9px] font-mono text-brand-cyan outline-none text-center"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={compileCustomMapPatch}
                                                    disabled={isCompiling}
                                                    className="flex-1 py-2 border border-brand-cyan/20 hover:border-brand-cyan bg-brand-cyan/10 hover:bg-brand-cyan text-brand-cyan hover:text-black font-black uppercase tracking-widest text-[9px] rounded-lg transition-all"
                                                >
                                                    {isCompiling ? "Compiling Logic..." : "Compile Custom Map Patch"}
                                                </button>
                                            </div>

                                            {customLog.length > 0 && (
                                                <div className="bg-black/80 rounded border border-white/5 p-3 font-mono text-[9px] text-zinc-400 space-y-1">
                                                    {customLog.map((log, i) => (
                                                        <div key={i}>{log}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Real-time DMA RAM Telemetry Oscilloscope */}
                    <AnimatePresence>
                        {bypassLogging && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mb-4"
                            >
                                <div className="bg-black/60 border border-white/5 p-4 rounded-xl space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                            <Activity className="w-3.5 h-3.5 text-brand-purple animate-pulse" />
                                            DMA Real-Time Calibration Scope
                                        </div>
                                        <div className="flex gap-4 text-[8px] font-mono">
                                            <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Engine Speed (RPM)</span>
                                            <span className="flex items-center gap-1 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Boost (bar)</span>
                                            <span className="flex items-center gap-1 text-purple-400"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />VVEL Valve Lift (mm)</span>
                                            <span className="flex items-center gap-1 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Exhaust Temp (°C)</span>
                                        </div>
                                    </div>

                                    {/* Oscilloscope stage */}
                                    <div className="relative h-24 bg-black/80 rounded-lg border border-white/10 overflow-hidden flex items-end">
                                        {/* Grid background */}
                                        <div className="absolute inset-0 grid grid-cols-10 grid-rows-4 opacity-[0.03] pointer-events-none">
                                            {Array.from({ length: 40 }).map((_, i) => (
                                                <div key={i} className="border-t border-l border-white" />
                                            ))}
                                        </div>

                                        {logStream.length < 2 ? (
                                            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-zinc-600 uppercase tracking-wider">
                                                Awaiting 120Hz Direct Memory Access Stream...
                                            </div>
                                        ) : (
                                            <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                                                {/* RPM Path (min 6000, max 6500) */}
                                                <path
                                                    d={generatePath(logStream, 'rpm', 6000, 6500, 100, 500)}
                                                    fill="none"
                                                    stroke="#10b981"
                                                    strokeWidth="1.5"
                                                    className="transition-all duration-75"
                                                />
                                                {/* Boost Path (min 0.8, max 1.4) */}
                                                <path
                                                    d={generatePath(logStream, 'boost', 0.8, 1.4, 100, 500)}
                                                    fill="none"
                                                    stroke="#06b6d4"
                                                    strokeWidth="1.5"
                                                    className="transition-all duration-75"
                                                    strokeDasharray="2,2"
                                                />
                                                {/* VVEL Lift Path (min 6.0, max 8.5) */}
                                                <path
                                                    d={generatePath(logStream, 'vvel', 6.0, 8.5, 100, 500)}
                                                    fill="none"
                                                    stroke="#a855f7"
                                                    strokeWidth="1.5"
                                                    className="transition-all duration-75"
                                                />
                                                {/* EGT Path (min 800, max 840) */}
                                                <path
                                                    d={generatePath(logStream, 'eg', 800, 840, 100, 500)}
                                                    fill="none"
                                                    stroke="#f59e0b"
                                                    strokeWidth="1.5"
                                                    className="transition-all duration-75"
                                                    strokeDasharray="4,2"
                                                />
                                            </svg>
                                        )}

                                        {/* Floating indicators showing exact live values */}
                                        {logStream.length > 0 && (
                                            <div className="absolute bottom-1 right-2 flex gap-3 text-[8px] font-mono text-zinc-500">
                                                <span>RPM: <span className="text-emerald-400 font-bold">{logStream[logStream.length - 1].rpm}</span></span>
                                                <span>Boost: <span className="text-cyan-400 font-bold">{logStream[logStream.length - 1].boost} bar</span></span>
                                                <span>VVEL: <span className="text-purple-400 font-bold">{logStream[logStream.length - 1].vvel} mm</span></span>
                                                <span>EGT: <span className="text-amber-500 font-bold">{logStream[logStream.length - 1].eg} °C</span></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* High frequency logging section */}
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-brand-purple/10 p-1.5 border border-brand-purple/20 rounded">
                                <Activity className="w-4 h-4 text-brand-purple" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block">High-Frequency RAM Polling (DMA Mode)</span>
                                <span className="text-[8px] text-zinc-500 font-mono">Locks direct memory addresses at 120Hz via EcuTek K-Line/CAN Bypass</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0">
                            {bypassLogging && (
                                <div className="text-[8px] font-mono text-emerald-400 font-bold bg-emerald-400/5 border border-emerald-400/20 rounded px-2 py-0.5 animate-pulse">
                                    120.4 Hz Stream Active
                                </div>
                            )}
                            <button
                                onClick={() => setBypassLogging(!bypassLogging)}
                                className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    bypassLogging 
                                    ? 'bg-brand-red text-white' 
                                    : 'bg-brand-purple/20 text-brand-purple border border-brand-purple'
                                }`}
                            >
                                {bypassLogging ? "Deactivate" : "Activate Direct RAM Bypass"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EcuTekComprehensionSuite;
