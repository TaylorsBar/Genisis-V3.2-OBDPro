
import { ObdConnectionState, DiagnosticCode, ActiveTest, PIDDefinition, ObdOptimizationConfig, ThrottleTuning, TransmissionTuning, EmissionsReadiness } from "../types";
import { useDiagnosticStore } from "../stores/diagnosticStore";
import { SecurityManager } from "./SecurityManager";

export const OBD_PIDS: PIDDefinition[] = [
    { id: 'rpm', name: 'Engine RPM', description: 'Engine speed in revolutions per minute', mode: '01', pid: '0C', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) / 4, unit: 'RPM', category: 'Engine' },
    { id: 'speed', name: 'Vehicle Speed', description: 'Vehicle speed in km/h', mode: '01', pid: '0D', bytes: 1, formula: (b) => b[0], unit: 'km/h', category: 'Performance' },
    { id: 'engine_load', name: 'Engine Load', description: 'Calculated engine load', mode: '01', pid: '04', bytes: 1, formula: (b) => (b[0] * 100) / 255, unit: '%', category: 'Engine' },
    { id: 'coolant_temp', name: 'Coolant Temp', description: 'Engine coolant temperature', mode: '01', pid: '05', bytes: 1, formula: (b) => b[0] - 40, unit: '°C', category: 'Engine' },
    { id: 'throttle_pos', name: 'Throttle Position', description: 'Absolute throttle position', mode: '01', pid: '11', bytes: 1, formula: (b) => (b[0] * 100) / 255, unit: '%', category: 'Engine' },
    { id: 'maf', name: 'MAF Air Flow Rate', description: 'Mass Air Flow sensor rate', mode: '01', pid: '10', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) / 100, unit: 'g/s', category: 'Air' },
    { id: 'iat', name: 'Intake Air Temp', description: 'Intake air temperature', mode: '01', pid: '0F', bytes: 1, formula: (b) => b[0] - 40, unit: '°C', category: 'Air' },
    { id: 'fuel_pressure', name: 'Fuel Pressure', description: 'Fuel rail pressure', mode: '01', pid: '0A', bytes: 1, formula: (b) => b[0] * 3, unit: 'kPa', category: 'Fuel' },
    { id: 'stft1', name: 'Short Term Fuel Trim B1', description: 'Short term fuel trim bank 1', mode: '01', pid: '06', bytes: 1, formula: (b) => (b[0] - 128) * 100 / 128, unit: '%', category: 'Fuel' },
    { id: 'ltft1', name: 'Long Term Fuel Trim B1', description: 'Long term fuel trim bank 1', mode: '01', pid: '07', bytes: 1, formula: (b) => (b[0] - 128) * 100 / 128, unit: '%', category: 'Fuel' },
    { id: 'timing_advance', name: 'Timing Advance', description: 'Ignition timing advance', mode: '01', pid: '0E', bytes: 1, formula: (b) => (b[0] - 128) / 2, unit: '°', category: 'Engine' },
    { id: 'baro', name: 'Barometric Pressure', description: 'Absolute barometric pressure', mode: '01', pid: '33', bytes: 1, formula: (b) => b[0], unit: 'kPa', category: 'Air' },
    { id: 'ambient_temp', name: 'Ambient Air Temp', description: 'Ambient air temperature', mode: '01', pid: '46', bytes: 1, formula: (b) => b[0] - 40, unit: '°C', category: 'Air' },
    { id: 'fuel_level', name: 'Fuel Level Input', description: 'Fuel level input percentage', mode: '01', pid: '2F', bytes: 1, formula: (b) => (b[0] * 100) / 255, unit: '%', category: 'Fuel' },
    { id: 'abs_load', name: 'Absolute Load Value', description: 'Absolute load value', mode: '01', pid: '43', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 100 / 255, unit: '%', category: 'Engine' },
    { id: 'control_module_volts', name: 'Control Module Voltage', description: 'ECU supply voltage', mode: '01', pid: '42', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) / 1000, unit: 'V', category: 'Performance' },
    { id: 'evap_purge', name: 'Commanded Evap Purge', description: 'Evaporative purge percentage', mode: '01', pid: '2E', bytes: 1, formula: (b) => (b[0] * 100) / 255, unit: '%', category: 'Fuel' },
    { id: 'cat_temp_b1s1', name: 'Catalyst Temp B1S1', description: 'Bank 1 Sensor 1 Cat temp', mode: '01', pid: '3C', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) / 10 - 40, unit: '°C', category: 'Air' },
    
    // Nissan/Infiniti Proprietary PIDs (Consult III / UDS)
    { id: 'vvtIntakeAngle', name: 'INT/V TIM(B1)', description: 'Intake Valve Timing Angle', mode: '22', pid: '1101', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.5 - 64, unit: '°', category: 'Engine' },
    { id: 'vvtExhaustAngle', name: 'EXH/V TIM(B1)', description: 'Exhaust Valve Timing Angle', mode: '22', pid: '1102', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.5 - 64, unit: '°', category: 'Engine' },
    { id: 'injectorPulseWidth', name: 'INJ PULSE-B1', description: 'Injector Pulse Width', mode: '22', pid: '1103', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.01, unit: 'ms', category: 'Fuel' },
    { id: 'wastegateDutyCycle', name: 'W/G DUTY', description: 'Wastegate Duty Cycle', mode: '22', pid: '1104', bytes: 1, formula: (b) => b[0] * 0.392, unit: '%', category: 'Air' },
    { id: 'fuelPumpDutyCycle', name: 'F/PUMP DUTY', description: 'Fuel Pump Duty Cycle', mode: '22', pid: '1105', bytes: 1, formula: (b) => b[0] * 0.392, unit: '%', category: 'Fuel' },
    { id: 'acceleratorPedalPos', name: 'ACCEL SEN 1', description: 'Accelerator Pedal Position', mode: '22', pid: '1106', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Engine' },
    { id: 'targetIdleRpm', name: 'TARGET IDLE', description: 'Target Idle RPM', mode: '22', pid: '1107', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.125, unit: 'RPM', category: 'Engine' },
    { id: 'torqueConverterSlip', name: 'SLIP REV', description: 'Torque Converter Slip', mode: '22', pid: '1108', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.125, unit: 'RPM', category: 'Performance' },
    { id: 'linePressure', name: 'LINE PRES', description: 'Transmission Line Pressure', mode: '22', pid: '1109', bytes: 1, formula: (b) => b[0] * 0.1, unit: 'MPa', category: 'Performance' },
    { id: 'awdTorqueSplit', name: 'ETS SOL', description: 'AWD Torque Split', mode: '22', pid: '110A', bytes: 1, formula: (b) => b[0] * 0.392, unit: '%', category: 'Performance' },
    { id: 'steeringAngle', name: 'STR ANGLE', description: 'Steering Angle', mode: '22', pid: '110B', bytes: 2, formula: (b) => ((b[0] * 256 + b[1]) - 32768) * 0.1, unit: '°', category: 'Performance' },
    { id: 'yawRate', name: 'YAW RATE', description: 'Yaw Rate', mode: '22', pid: '110C', bytes: 2, formula: (b) => ((b[0] * 256 + b[1]) - 32768) * 0.01, unit: '°/s', category: 'Performance' },
    
    // Infiniti G37 / VQ37VHR Specific PIDs
    { id: 'vvelPosition', name: 'VVEL POS', description: 'VVEL Control Shaft Position', mode: '22', pid: '1201', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.01, unit: '°', category: 'Engine' },
    { id: 'vvelTarget', name: 'VVEL TGT', description: 'VVEL Target Position', mode: '22', pid: '1202', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.01, unit: '°', category: 'Engine' },
    { id: 'mafB1', name: 'MAF B1', description: 'Mass Air Flow Bank 1', mode: '22', pid: '1203', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Air' },
    { id: 'mafB2', name: 'MAF B2', description: 'Mass Air Flow Bank 2', mode: '22', pid: '1204', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Air' },
    { id: 'throttlePosB1', name: 'THR POS B1', description: 'Throttle Position Bank 1', mode: '22', pid: '1205', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Engine' },
    { id: 'throttlePosB2', name: 'THR POS B2', description: 'Throttle Position Bank 2', mode: '22', pid: '1206', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Engine' },
    { id: 'ignTimingB1', name: 'IGN TIM B1', description: 'Ignition Timing Bank 1', mode: '22', pid: '1207', bytes: 1, formula: (b) => b[0] - 64, unit: '°', category: 'Engine' },
    { id: 'ignTimingB2', name: 'IGN TIM B2', description: 'Ignition Timing Bank 2', mode: '22', pid: '1208', bytes: 1, formula: (b) => b[0] - 64, unit: '°', category: 'Engine' },
    { id: 'knockSensor1', name: 'KNOCK S1', description: 'Knock Sensor 1 Voltage', mode: '22', pid: '1209', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Engine' },
    { id: 'knockSensor2', name: 'KNOCK S2', description: 'Knock Sensor 2 Voltage', mode: '22', pid: '120A', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.005, unit: 'V', category: 'Engine' },
    { id: 'engineOilTemp', name: 'EOT', description: 'Engine Oil Temperature', mode: '22', pid: '120B', bytes: 1, formula: (b) => b[0] - 40, unit: '°C', category: 'Engine' },
    { id: 'transFluidTemp', name: 'TFT', description: 'Transmission Fluid Temperature', mode: '22', pid: '120C', bytes: 1, formula: (b) => b[0] - 40, unit: '°C', category: 'Performance' },
    { id: 'afSensor1B1', name: 'A/F S1 B1', description: 'A/F Sensor 1 Bank 1', mode: '22', pid: '120D', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.001, unit: 'V', category: 'Fuel' },
    { id: 'afSensor1B2', name: 'A/F S1 B2', description: 'A/F Sensor 1 Bank 2', mode: '22', pid: '120E', bytes: 2, formula: (b) => (b[0] * 256 + b[1]) * 0.001, unit: 'V', category: 'Fuel' },
];

const CANDIDATE_SERVICES = [
    "0000fff0-0000-1000-8000-00805f9b34fb",
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "0000bee0-0000-1000-8000-00805f9b34fb",
    "000018f0-0000-1000-8000-00805f9b34fb",
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // vLinker
    "0000ffe1-0000-1000-8000-00805f9b34fb", // HM-10
    "00001101-0000-1000-8000-00805f9b34fb"  // Standard SPP (if supported by OS stack)
];

interface QueueItem {
    cmd: string;
    resolve: (val: string) => void;
    reject: (err: any) => void;
    retriesLeft: number;
    timeoutMs: number;
    sentTime?: number;
}

const DEFAULT_TIMEOUT = 1000;

export class ObdService {
    private device: any | null = null;
    private server: any | null = null;
    private writeChar: any | null = null;
    private notifyChar: any | null = null;
    private isVirtual: boolean = false;
    private virtualNotifyListener: any = null;
    private virtualDtcsCleared: boolean = false;

    private commandQueue: QueueItem[] = [];
    private isProcessingQueue: boolean = false;
    private rxBuffer: string = "";
    private currentCmdTimeout: any = null;

    // Sniffing & Discovery State
    private isSniffing: boolean = false;
    private sniffCallback: ((frame: string) => void) | null = null;
    private isDiscovering: boolean = false;
    private discoveredPids: Set<string> = new Set();
    private discoveredDids: Set<string> = new Set();
    private supportedPidsMap: Record<string, boolean> = {};

    // Advanced ELM327 Strategy State
    private adaptiveTimeoutMs: number = DEFAULT_TIMEOUT;
    private latencyHistory: number[] = [];
    private consecutiveErrors: number = 0;
    private isHighSpeedBaud: boolean = false;
    private protocolLocked: boolean = false;
    private isCanProtocol: boolean = false;
    private keepAliveTimer: any = null;

    // Active PIDs for polling
    private activePids: PIDDefinition[] = [];
    private highPriorityPids: PIDDefinition[] = [];
    private lowPriorityPids: PIDDefinition[] = [];

    // Optimization State
    public connectedProtocol: string = "Unknown";
    public detectedVin: string = "Unknown";
    private useNissanConsultMode: boolean | null = null; 
    public useSubaruSsm2Mode: boolean = false;
    public useSubaruSsm1Mode: boolean = false; 
    private config: ObdOptimizationConfig = {
        multiPid: true,
        adaptiveTiming: 2,
        fastBaud: true,
        canFiltering: true,
        highFreqMode: false,
        refreshRateTarget: 20,
        dmaEngine: true
    };

    private lastPollTime: number = 0;
    private lastLatency: number = 0;

    constructor(private onStatusChange: (status: ObdConnectionState) => void) {}

    public async execute(cmd: string, retries: number = 0, timeout: number = DEFAULT_TIMEOUT): Promise<string> {
        return this.runCommand(cmd, retries, timeout);
    }

    /**
     * T1 Function: Sets custom drive-by-wire parameters using a UDS Write Data Identifier command (Service ID 0x2E).
     * This simulates writing to a proprietary non-volatile memory location (NVM).
     * @param tuning The high-level configuration object for throttle response.
     */
    public async setThrottleTuning(tuning: ThrottleTuning): Promise<boolean> {
        this.log('SYS', `Applying Throttle Tuning... Sending UDS command $2E to ECU (Mode: ${tuning.mode})`);
        
        const modeMap: Record<ThrottleTuning['mode'], string> = { 
            'ECO': '01', 'STANDARD': '00', 'SPORT': '02', 'SPORT_PLUS': '03', 
            'RACE': '04', 'CUSTOM': '05', 'VALET': '06', 'LOCK': '07' 
        };
        const modeHex = modeMap[tuning.mode] || '00';
        const scaleHex = Math.round(tuning.responseScale * 100).toString(16).padStart(2, '0');
        const biteHex = Math.round(tuning.initialBite).toString(16).padStart(2, '0');
        const smoothingHex = Math.round(tuning.smoothing).toString(16).padStart(2, '0');
        
        const udsCommand = `2E F0 10 ${modeHex} ${scaleHex} ${biteHex} ${smoothingHex}`;

        try {
            const res = await this.execute(udsCommand);
            if (res.startsWith("6E")) {
                this.log('SYS', "Throttle tuning applied successfully.");
                return true;
            } else {
                this.log('ERR', `Throttle tuning failed: ECU response: ${res}`);
                return false;
            }
        } catch (e) {
            this.log('ERR', `UDS communication error during throttle write: ${e}`);
            return false;
        }
    }

    /**
     * T1 Function: Sets transmission tuning parameters (shift points, firmness) via UDS command.
     * @param tuning The high-level configuration object for transmission logic.
     */
    public async setTransmissionTuning(tuning: TransmissionTuning): Promise<boolean> {
        this.log('SYS', "Applying Transmission Tuning... Sending UDS command $2E to TCM");

        const firmnessHex = Math.round(tuning.shiftFirmness * 2.55).toString(16).padStart(2, '0');
        const offsetRpm = tuning.shiftPointOffset + 2000;
        const offsetHex = Math.round(offsetRpm / 2).toString(16).padStart(4, '0');
        const revMatchHex = tuning.revMatching ? '01' : '00';
        const sportHex = tuning.isSportModeActive ? '01' : '00';

        const udsCommand = `2E F0 20 ${firmnessHex} ${offsetHex.substring(0, 2)} ${offsetHex.substring(2, 4)} ${revMatchHex} ${sportHex}`;

        try {
            const res = await this.execute(udsCommand);
            if (res.startsWith("6E")) { 
                this.log('SYS', "Transmission tuning applied successfully.");
                return true;
            } else {
                this.log('ERR', `Transmission tuning failed: ECU response: ${res}`);
                return false;
            }
        } catch (e) {
            this.log('ERR', `UDS communication error during transmission write: ${e}`);
            return false;
        }
    }

    /**
     * T1 Function: Performs UDS Security Access (Service 0x27) sequence.
     * 1. Send Request Seed (01)
     * 2. Calculate Key via SecurityManager
     * 3. Send Calculated Key (02)
     * @param level Security level (usually 0x01 for request, 0x02 for send)
     * @param algoId The algorithm ID to use for key calculation.
     * @returns boolean indicating if security access was granted.
     */
    public async performSecurityAccess(level: number, algoId: number): Promise<boolean> {
        this.log('SYS', `Starting UDS Security Access (Service $27) Level: ${level}, Algo: 0x${algoId.toString(16)}`);

        try {
            // 1. Request Seed
            const requestSeedCmd = `27 ${level.toString(16).padStart(2, '0')}`;
            const seedRes = await this.runCommand(requestSeedCmd, 1, 2000);
            
            // Expected response format: 67 <level> XX XX ...
            const cleanSeedRes = seedRes.replace(/[\s\r\n>]/g, "");
            const posResp = (0x40 + 0x27).toString(16); // 67
            const levelHex = level.toString(16).padStart(2, '0');
            
            if (!cleanSeedRes.startsWith(posResp + levelHex)) {
                this.log('ERR', `Security Access failed: ECU denied seed request. Response: ${seedRes}`);
                return false;
            }

            const seedHex = cleanSeedRes.substring(4);
            if (seedHex.replace(/0/g, '') === '') {
                this.log('SYS', "Security access already granted or not required (Seed is zero).");
                return true;
            }

            // Convert hex seed to Uint8Array
            const seedBytes = new Uint8Array(seedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            // 2. Calculate Key
            const key = SecurityManager.calculateKey(algoId, seedBytes);
            const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

            this.log('SYS', `Calculated Key: ${keyHex} for Seed: ${seedHex}`);

            // 3. Send Key (Sub-function is level + 1)
            const sendLevel = level + 1;
            const sendKeyCmd = `27 ${sendLevel.toString(16).padStart(2, '0')} ${keyHex}`;
            const keyRes = await this.runCommand(sendKeyCmd, 1, 2000);
            const cleanKeyRes = keyRes.replace(/[\s\r\n>]/g, "");
            const posSendResp = (0x40 + 0x27).toString(16);
            const sendLevelHex = sendLevel.toString(16).padStart(2, '0');

            if (cleanKeyRes.startsWith(posSendResp + sendLevelHex)) {
                this.log('SYS', "Security Access GRANTED.");
                return true;
            } else {
                this.log('ERR', `Security Access DENIED. Key rejected by ECU. Response: ${keyRes}`);
                return false;
            }

        } catch (e) {
            this.log('ERR', `UDS Security Access process error: ${e}`);
            return false;
        }
    }

    public setOptimizationConfig(config: ObdOptimizationConfig) {
        this.config = config;
        // Apply immediate changes if connected
        if (this.device?.gatt?.connected) {
            this.applyOptimizations();
        }
    }

    private async applyOptimizations() {
        if (!this.isCanProtocol) return;
        
        try {
            if (this.config.canFiltering) {
                await this.runCommand("AT SH 7E0", 1, 500); // Set Header to Engine ECU
                await this.runCommand("AT CRA 7E8", 1, 500); // CAN Receive Address (Engine ECU only)
            } else {
                await this.runCommand("AT D", 1, 500); // Reset headers
                await this.runCommand("AT AR", 1, 500); // Auto Receive
            }
            
            await this.runCommand("AT V1", 1, 500); // Variable DLC (don't pad to 8 bytes)
            await this.runCommand(`AT AT ${this.config.adaptiveTiming}`, 1, 500);
            
            // Update ST based on target refresh rate
            // 1000 / Hz = ms per poll. ST should be slightly less.
            let targetMs = 1000 / this.config.refreshRateTarget;
            if (this.config.dmaEngine) {
                targetMs = Math.min(targetMs, 40); // Max 40ms timeout in DMA mode
            }
            const stVal = Math.min(255, Math.floor(targetMs / 4)).toString(16).toUpperCase().padStart(2, '0');
            await this.runCommand(`AT ST ${stVal}`, 1, 500);
        } catch (e) {
            this.log('ERR', 'Failed to apply real-time optimizations');
        }
    }

    private log(direction: 'TX' | 'RX' | 'SYS' | 'ERR', data: string) {
        useDiagnosticStore.getState().addLog(direction, data);
    }

    private updateAdaptiveTimeout(latency: number) {
        this.latencyHistory.push(latency);
        if (this.latencyHistory.length > 10) this.latencyHistory.shift();
        
        const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
        // Set ST to avg + 25% buffer, min 200ms, max 2000ms
        this.adaptiveTimeoutMs = Math.min(2000, Math.max(200, Math.round(avgLatency * 1.25)));
        
        // ELM327 AT ST is in 4ms increments. Value = ms / 4.
        // We only update if it changes significantly to avoid command overhead
        const stValue = Math.min(255, Math.floor(this.adaptiveTimeoutMs / 4));
        if (this.commandQueue.length === 0 && !this.isProcessingQueue) {
            // We'll inject an AT ST command occasionally or just use it for our internal timeout
        }
    }

    private async handleBufferFull() {
        this.log('SYS', 'ELM327 Buffer Full detected. Executing emergency flush...');
        this.rxBuffer = "";
        await this.runCommand("AT Z", 0, 1000); // Soft reset
        await this.runCommand("AT E0", 0, 500);
    }

    public async connect(): Promise<void> {
        const bt = (navigator as any).bluetooth;
        if (!bt) {
            this.log('SYS', 'Web Bluetooth API not available in this environment.');
            this.log('SYS', 'Initiating Virtual ELM327 OBD Emulator Fallback...');
            await this.connectVirtual();
            return;
        }

        try {
            this.log('SYS', 'Initiating connection sequence...');
            this.onStatusChange(ObdConnectionState.Connecting);
            this.commandQueue = [];
            this.rxBuffer = "";
            this.consecutiveErrors = 0;
            
            // Load locked protocol if available
            const lockedProto = localStorage.getItem('obd_locked_protocol');
            if (lockedProto) {
                this.log('SYS', `Found locked protocol: ${lockedProto}. Prioritizing...`);
                this.connectedProtocol = lockedProto;
            }

            try {
                this.device = await bt.requestDevice({
                    filters: [
                        { namePrefix: "OBD" }, 
                        { namePrefix: "V-LINK" }, 
                        { namePrefix: "ELM" }, 
                        { namePrefix: "IOS-Vlink" }, 
                        { namePrefix: "Konnwei" },
                        { namePrefix: "Viecar" },
                        { namePrefix: "vLinker" },
                        { namePrefix: "Carista" },
                        { namePrefix: "UniCarScan" },
                        { namePrefix: "GWBT" },
                        { namePrefix: "GEARWRENCH" }
                    ],
                    optionalServices: CANDIDATE_SERVICES
                });
            } catch (deviceError) {
                this.log('SYS', 'Web Bluetooth device selection rejected, failed, or not allowed.');
                this.log('SYS', 'Initiating Virtual ELM327 OBD Emulator Fallback...');
                await this.connectVirtual();
                return;
            }

            this.log('SYS', `Device selected: ${this.device.name || 'Unknown Device'}`);
            this.device!.addEventListener('gattserverdisconnected', this.handleDisconnect);
            this.server = await this.device!.gatt!.connect();

            let service = null;
            for (const uuid of CANDIDATE_SERVICES) {
                try { 
                    service = await this.server!.getPrimaryService(uuid); 
                    this.log('SYS', `Found primary service: ${uuid}`);
                    break; 
                } catch (e) { }
            }
            if (!service) throw new Error("No OBD service found.");

            const characteristics = await service.getCharacteristics();
            this.notifyChar = characteristics.find((c: any) => c.properties.notify || c.properties.indicate);
            this.writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

            if (!this.notifyChar || !this.writeChar) {
                throw new Error("Missing required characteristics (RX/TX)");
            }

            await this.notifyChar.startNotifications();
            this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotification);

            // [PRO-FIX] Bionic Flush: Clean lead-in garbage from ELM327 buffer
            this.log('SYS', 'Executing Bionic Flush sequence (Standard Protocol Reset)...');
            if (this.writeChar) {
                await this.writeChar.writeValue(new TextEncoder().encode("\r"));
            }
            await new Promise(r => setTimeout(r, 400));

            this.log('SYS', 'GATT characteristics configured. Starting protocol handshake (KOEO Resilient)...');
            await this.initializeConnection();
            
            if (this.connectedProtocol === "Unknown") {
                throw new Error("Initialization failed: Protocol not recognized after all strategies.");
            }

            this.log('SYS', `Connection established. Protocol: ${this.connectedProtocol}`);
            this.onStatusChange(ObdConnectionState.Connected);
            
            // Stabilization period before background noise
            await new Promise(r => setTimeout(r, 1000));

            // Start heartbeat to keep ECU session alive (Tester Present 0x3E)
            this.startKeepAlive();

            // Start autonomous discovery in background
            this.runDiscovery().catch(e => this.log('ERR', `Discovery error: ${e}`));

        } catch (error: any) {
            this.log('ERR', `Connection failed: ${error.message || String(error)}`);
            this.onStatusChange(ObdConnectionState.Error);
            this.disconnect();
        }
    }

    private async connectVirtual(): Promise<void> {
        this.isVirtual = true;
        this.virtualDtcsCleared = false;
        this.onStatusChange(ObdConnectionState.Connecting);
        this.commandQueue = [];
        this.rxBuffer = "";
        this.consecutiveErrors = 0;
        
        // Mock notifyChar and writeChar
        this.notifyChar = {
            startNotifications: async () => {},
            addEventListener: (type: string, listener: any) => {
                this.virtualNotifyListener = listener;
            }
        };
        
        this.writeChar = {
            properties: { write: true, writeWithoutResponse: true },
            writeValue: async (payload: Uint8Array) => {
                this.processVirtualPayload(payload);
            },
            writeValueWithoutResponse: async (payload: Uint8Array) => {
                this.processVirtualPayload(payload);
            }
        };
        
        await this.notifyChar.startNotifications();
        this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotification);
        
        await new Promise(r => setTimeout(r, 400));
        
        this.log('SYS', 'Virtual GATT characteristics configured. Starting handshake...');
        await this.initializeConnection();
        
        if (this.connectedProtocol === "Unknown") {
            this.connectedProtocol = "ISO 15765-4 (CAN 11/500)";
        }
        
        this.log('SYS', `Virtual Connection established. Protocol: ${this.connectedProtocol}`);
        this.onStatusChange(ObdConnectionState.Connected);
        
        await new Promise(r => setTimeout(r, 600));
        this.startKeepAlive();
        this.runDiscovery().catch(e => this.log('ERR', `Discovery error: ${e}`));
    }

    private processVirtualPayload(payload: Uint8Array) {
        const cmdWithCr = new TextDecoder().decode(payload);
        const cmd = cmdWithCr.trim().replace(/\r/g, '').toUpperCase();
        
        let response = "";
        
        if (cmd === "") {
            response = "\r>";
        } else if (cmd === "AT I") {
            response = "ELM327 v2.1\r>";
        } else if (cmd === "AT Z") {
            response = "\r\rELM327 v2.1\r>";
        } else if (cmd === "AT E0" || cmd === "AT L0" || cmd === "AT S0" || cmd.startsWith("AT AT") || cmd.startsWith("AT ST") || cmd.startsWith("AT SP") || cmd === "AT AFC" || cmd === "AT H0") {
            response = "OK\r>";
        } else if (cmd === "AT DP") {
            response = "ISO 15765-4 (CAN 11/500)\r>";
        } else if (cmd === "AT RV") {
            const volts = (13.8 + Math.random() * 0.4).toFixed(1);
            response = `${volts}V\r>`;
        } else if (cmd === "0902") {
            response = "49 02 01 4A 4E 31 45 56 36 41 33 55 30 30 30 30 30 31\r>";
        } else if (cmd === "0904") {
            response = "49 04 01 31 56 51 30 41\r>";
        } else if (cmd === "0100" || cmd === "0120" || cmd === "0140" || cmd === "0160") {
            response = "41 00 BE 3E A8 13\r>";
        } else if (cmd === "0101") {
            response = "41 01 00 07 E0 00\r>";
        } else if (cmd === "03") {
            response = this.virtualDtcsCleared ? "43 00 00\r>" : "43 02 01 01 03 00\r>";
        } else if (cmd === "07") {
            response = this.virtualDtcsCleared ? "47 00 00\r>" : "47 01 01 71\r>";
        } else if (cmd === "0A") {
            response = this.virtualDtcsCleared ? "4A 00 00\r>" : "4A 01 52 01\r>";
        } else if (cmd === "04") {
            this.virtualDtcsCleared = true;
            response = "44\r>";
        } else if (cmd === "3E" || cmd === "3E00") {
            response = "7E\r>";
        } else if (cmd.startsWith("01")) {
            // Check for multi-pid mode
            if (cmd.length > 4) {
                // e.g. 010C0D04 -> parse and return combined response
                let multiResp = "41";
                for (let i = 2; i < cmd.length; i += 2) {
                    const pid = cmd.substring(i, i + 2);
                    const val = this.getSimulatedPidValue(pid);
                    multiResp += `${pid}${val}`;
                }
                response = `${multiResp}\r>`;
            } else {
                const pid = cmd.substring(2, 4);
                const val = this.getSimulatedPidValue(pid);
                response = `41 ${pid} ${val}\r>`;
            }
        } else if (cmd.startsWith("22")) {
            const dids = cmd.substring(2);
            let hexRes = "62";
            for (let i = 0; i < dids.length; i += 4) {
                const did = dids.substring(i, i + 4);
                const val = this.getSimulatedDidValue(did);
                hexRes += `${did}${val}`;
            }
            response = `${hexRes}\r>`;
        } else if (cmd.startsWith("2F") || cmd.startsWith("31") || cmd.startsWith("30")) {
            const service = cmd.substring(0, 2);
            const respService = (parseInt(service, 16) + 0x40).toString(16).toUpperCase();
            response = `${respService} ${cmd.substring(2)}\r>`;
        } else {
            response = "OK\r>";
        }
        
        setTimeout(() => {
            if (this.virtualNotifyListener) {
                const encoder = new TextEncoder();
                const data = encoder.encode(response);
                
                const event = {
                    target: {
                        value: data
                    }
                };
                this.virtualNotifyListener(event);
            }
        }, 15);
    }

    private getSimulatedPidValue(pid: string): string {
        const time = Date.now();
        if (pid === "05") { // Coolant temp
            const temp = Math.round(90 + Math.sin(time / 15000) * 2) + 40;
            return Math.max(0, Math.min(255, temp)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (pid === "0C") { // RPM
            const rpmVal = 1200 + 800 * Math.sin(time / 4000) + Math.random() * 15;
            const rpm = Math.round(rpmVal * 4);
            const high = Math.floor(rpm / 256);
            const low = rpm % 256;
            return `${high.toString(16).padStart(2, "0")}${low.toString(16).padStart(2, "0")}`.toUpperCase();
        }
        if (pid === "0D") { // Speed
            const speedVal = 45 + 15 * Math.sin(time / 6000);
            const speed = Math.round(speedVal);
            return Math.max(0, Math.min(255, speed)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (pid === "0F") { // IAT
            const temp = Math.round(28 + Math.sin(time / 20000)) + 40;
            return Math.max(0, Math.min(255, temp)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (pid === "10") { // MAF
            const rpmVal = 1200 + 800 * Math.sin(time / 4000);
            const maf = Math.round((rpmVal * 0.003) * 100);
            const high = Math.floor(maf / 256);
            const low = maf % 256;
            return `${high.toString(16).padStart(2, "0")}${low.toString(16).padStart(2, "0")}`.toUpperCase();
        }
        if (pid === "11") { // Throttle Position
            const tpVal = 18 + 12 * Math.sin(time / 4000);
            const tp = Math.round((tpVal * 255) / 100);
            return Math.max(0, Math.min(255, tp)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (pid === "04") { // Engine Load
            const loadVal = 22 + 15 * Math.sin(time / 4000);
            const load = Math.round((loadVal * 255) / 100);
            return Math.max(0, Math.min(255, load)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (pid === "0A") { // Fuel Pressure
            const fp = Math.round(350 / 3);
            return Math.max(0, Math.min(255, fp)).toString(16).padStart(2, "0").toUpperCase();
        }
        return "00";
    }

    private getSimulatedDidValue(did: string): string {
        const time = Date.now();
        if (did === "1101") { // VVT Intake Angle
            const val = Math.round((12 * Math.sin(time / 5000) + 64) * 2);
            const high = Math.floor(val / 256);
            const low = val % 256;
            return `${high.toString(16).padStart(2, "0")}${low.toString(16).padStart(2, "0")}`.toUpperCase();
        }
        if (did === "1102") { // VVT Exhaust Angle
            const val = Math.round((8 * Math.sin(time / 5000) + 64) * 2);
            const high = Math.floor(val / 256);
            const low = val % 256;
            return `${high.toString(16).padStart(2, "0")}${low.toString(16).padStart(2, "0")}`.toUpperCase();
        }
        if (did === "1103") { // Injector Pulse Width
            const val = Math.round((2.2 + 0.8 * Math.sin(time / 4000)) * 100);
            const high = Math.floor(val / 256);
            const low = val % 256;
            return `${high.toString(16).padStart(2, "0")}${low.toString(16).padStart(2, "0")}`.toUpperCase();
        }
        if (did === "1104") { // Wastegate Duty
            const val = Math.round((15 + 10 * Math.sin(time / 4000)) / 0.392);
            return Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (did === "1105") { // Fuel pump duty
            const val = Math.round(48 / 0.392);
            return Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (did === "120B") { // Oil temp
            const val = Math.round(94 + Math.sin(time / 18000) * 2) + 40;
            return Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0").toUpperCase();
        }
        if (did === "120C") { // Transmission temp
            const val = Math.round(82 + Math.sin(time / 25000)) + 40;
            return Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0").toUpperCase();
        }
        return "00";
    }

    public disconnect = () => {
        this.stopKeepAlive();
        if (this.isVirtual) {
            this.log('SYS', 'Disconnecting Virtual ELM327 OBD Emulator...');
            this.isVirtual = false;
        } else if (this.device?.gatt?.connected) {
            this.log('SYS', 'Disconnecting from device...');
            this.device.gatt.disconnect();
        }
        this.device = null;
        this.onStatusChange(ObdConnectionState.Disconnected);
    };

    private startKeepAlive() {
        this.stopKeepAlive();
        // Send Tester Present (0x3E) every 2 seconds to keep diagnostic session open
        this.keepAliveTimer = setInterval(() => {
            if (this.commandQueue.length === 0 && !this.isProcessingQueue && this.writeChar) {
                // Determine best keep alive based on protocol
                const cmd = this.isCanProtocol ? "3E00" : "3E";
                this.runCommand(cmd, 0, 500).catch(() => {});
            }
        }, 2000);
    }

    private stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    private handleDisconnect = () => {
        this.log('SYS', 'Device disconnected unexpectedly.');
        this.onStatusChange(ObdConnectionState.Disconnected);
    };

    private async runDiscovery() {
        if (this.isDiscovering) return;
        this.isDiscovering = true;
        this.log('SYS', 'Initiating Intelligent ECU Parameter Discovery...');

        try {
            // 1. Detect VIN
            const vinRes = await this.runCommand("0902", 2, 2000);
            if (vinRes && vinRes.includes("49 02")) {
                const hex = vinRes.replace(/[\s\r\n>]/g, '').split("4902")[1];
                if (hex) {
                    const vinHex = hex.substring(2);
                    let vin = "";
                    for (let i = 0; i < vinHex.length; i += 2) {
                        const charCode = parseInt(vinHex.substring(i, i + 2), 16);
                        if (charCode > 31 && charCode < 127) vin += String.fromCharCode(charCode);
                    }
                    this.detectedVin = vin.trim();
                    this.log('SYS', `Detected VIN: ${this.detectedVin}`);
                }
            }

            // 1b. Detect Calibration ID (G25/VQ Strategy)
            let calId = "";
            try {
                // Try UDS F191 (Nissan Standard)
                const calRes = await this.runCommand("22F191", 1, 1500);
                if (calRes && calRes.includes("62 F1 91")) {
                    const hex = calRes.split("62F191")[1]?.replace(/[\s\r\n>]/g, '');
                    if (hex) {
                        for (let i = 0; i < hex.length; i += 2) {
                            const charCode = parseInt(hex.substring(i, i + 2), 16);
                            if (charCode > 31 && charCode < 127) calId += String.fromCharCode(charCode);
                        }
                    }
                }
                
                // Fallback to Standard OBD 0904
                if (!calId) {
                    const obdCalRes = await this.runCommand("0904", 1, 1500);
                    if (obdCalRes && obdCalRes.includes("49 04")) {
                        const hex = obdCalRes.split("4904")[1]?.replace(/[\s\r\n>]/g, '');
                        if (hex) {
                            for (let i = 2; i < hex.length; i += 2) {
                                const charCode = parseInt(hex.substring(i, i + 2), 16);
                                if (charCode > 31 && charCode < 127) calId += String.fromCharCode(charCode);
                            }
                        }
                    }
                }
                
                if (calId) {
                    this.log('SYS', `Detected Calibration ID: ${calId.trim()}`);
                }
            } catch (e) {
                this.log('SYS', `Calibration ID detection skipped: ${e}`);
            }

            // 2. Discover Supported PIDs using bitmasks (0100, 0120, 0140, 0160, 0180, 01A0, 01C0)
            const pidGroups = ["00", "20", "40", "60", "80", "A0", "C0"];
            this.supportedPidsMap = {};

            for (const group of pidGroups) {
                const res = await this.runCommand(`01${group}`, 1, 1500);
                const hex = this.parseValue(res, `41${group}`);
                if (hex && hex.length >= 8) {
                    this.parsePidBitmask(group, hex);
                    // If the last bit (bit 32) is 0, no more groups are supported
                    const lastByte = parseInt(hex.substring(6, 8), 16);
                    if (!(lastByte & 0x01)) break;
                } else {
                    break;
                }
            }

            this.log('SYS', `PID Discovery complete. Supported SAE PIDs: ${Object.keys(this.supportedPidsMap).length}`);

            // 3. Intelligent PID Selection
            const highPriorityIds = ['rpm', 'speed', 'throttle_pos'];
            this.highPriorityPids = OBD_PIDS.filter(p => highPriorityIds.includes(p.id));
            this.lowPriorityPids = OBD_PIDS.filter(p => !highPriorityIds.includes(p.id) && 
                (p.id === 'coolant_temp' || p.id === 'engine_load' || p.id === 'maf' || 
                 p.id === 'fuel_pressure' || p.id === 'timing_advance'));

            this.activePids = [...this.highPriorityPids, ...this.lowPriorityPids];
            this.log('SYS', `Optimal PID set auto-selected. High: ${this.highPriorityPids.length}, Low: ${this.lowPriorityPids.length}.`);

            // 4. Performance Lock: Headers Off for maximum polling speed
            await this.runCommand("AT H0", 1, 500);

        } catch (e) {
            this.log('ERR', `Discovery error: ${e}`);
        }

        this.isDiscovering = false;
    }

    private parsePidBitmask(group: string, hex: string) {
        const startPid = parseInt(group, 16);
        for (let i = 0; i < 4; i++) {
            const byte = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
            for (let bit = 0; bit < 8; bit++) {
                if (byte & (0x80 >> bit)) {
                    const pidNum = startPid + (i * 8) + bit + 1;
                    const pidHex = pidNum.toString(16).toUpperCase().padStart(2, '0');
                    this.supportedPidsMap[pidHex] = true;
                }
            }
        }
    }

    public startSniffing(callback: (frame: string) => void) {
        if (!this.writeChar) return;
        this.isSniffing = true;
        this.sniffCallback = callback;
        this.runCommand("AT MA", 0, 1000).catch(() => {}); // Send Monitor All
    }

    public stopSniffing() {
        if (!this.writeChar) return;
        this.isSniffing = false;
        this.sniffCallback = null;
        // Send a character to stop AT MA
        this.writeChar.writeValue(new TextEncoder().encode("\r")).catch(() => {});
    }

    private handleNotification = (event: Event) => {
        const value = (event.target as any).value;
        const decoder = new TextDecoder('utf-8');
        const chunk = decoder.decode(value);
        this.rxBuffer += chunk;

        if (this.isSniffing && this.sniffCallback) {
            // Process complete lines for sniffing
            const lines = this.rxBuffer.split('\r');
            if (lines.length > 1) {
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (line && !line.includes('>')) {
                        this.sniffCallback(line);
                    }
                }
                this.rxBuffer = lines[lines.length - 1]; // Keep the incomplete line
            }
            // If we see a prompt, sniffing stopped unexpectedly
            if (this.rxBuffer.includes('>')) {
                this.isSniffing = false;
            }
            return;
        }

        if (this.rxBuffer.includes('>')) {
            const now = Date.now();
            const currentItem = this.commandQueue[0];
            
            if (currentItem && currentItem.sentTime) {
                this.lastLatency = now - currentItem.sentTime;
                this.latencyHistory.push(this.lastLatency);
                if (this.latencyHistory.length > 10) this.latencyHistory.shift();
                
                // Adaptive timeout adjustment
                const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
                this.adaptiveTimeoutMs = Math.max(500, Math.min(2500, avgLatency * 2.5));
            }

            if (this.currentCmdTimeout) {
                clearTimeout(this.currentCmdTimeout);
                this.currentCmdTimeout = null;
            }

            const promptIndex = this.rxBuffer.indexOf('>');
            const rawData = this.rxBuffer.substring(0, promptIndex).trim();
            this.rxBuffer = this.rxBuffer.substring(promptIndex + 1);

            this.log('RX', rawData || '<EMPTY>');

            // Detect ELM327 errors
            if (rawData.includes("BUFFER FULL")) {
                this.handleBufferFull();
            } else if (rawData.includes("BUS BUSY") || rawData.includes("CAN ERROR")) {
                this.consecutiveErrors++;
                this.log('SYS', `Bus Error detected (${this.consecutiveErrors}). Cooling down...`);
                // If many errors, try to reset protocol
                if (this.consecutiveErrors > 5) {
                    this.consecutiveErrors = 0;
                    this.initializeConnection();
                }
            } else {
                this.consecutiveErrors = 0;
            }

            if (this.commandQueue.length > 0) {
                const item = this.commandQueue[0];
                
                // Update adaptive timing
                if (item.sentTime) {
                    this.updateAdaptiveTimeout(now - item.sentTime);
                }

                const { resolve } = item;
                this.commandQueue.shift();
                this.isProcessingQueue = false;
                resolve(rawData);
                
                // Dynamic delay based on adapter quality/latency
                const nextCmdDelay = this.config.dmaEngine ? 0 : Math.max(10, Math.min(50, Math.round(this.adaptiveTimeoutMs / 10)));
                if (nextCmdDelay === 0) {
                    Promise.resolve().then(() => this.processQueue());
                } else {
                    setTimeout(() => {
                        this.processQueue();
                    }, nextCmdDelay);
                }
            }
        }
    };

    public runCommand(cmd: string, retries: number = 0, timeout: number = DEFAULT_TIMEOUT): Promise<string> {
        return new Promise((resolve, reject) => {
            this.commandQueue.push({ cmd, resolve, reject, retriesLeft: retries, timeoutMs: timeout });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue || this.commandQueue.length === 0 || !this.writeChar) return;
        
        // Pipeline Optimization: If queue is too deep, drop old non-critical commands
        if (this.commandQueue.length > 15) {
            this.log('SYS', `Pipeline congestion detected (${this.commandQueue.length}). Flushing non-critical commands...`);
            const keptQueue: QueueItem[] = [];
            for (const item of this.commandQueue) {
                if (item.cmd.startsWith("AT") || item.cmd.startsWith("10") || item.cmd.startsWith("27")) {
                    keptQueue.push(item);
                } else {
                    item.reject(new Error("Dropped due to congestion"));
                }
            }
            this.commandQueue = keptQueue;
            if (this.commandQueue.length === 0) {
                this.isProcessingQueue = false;
                return;
            }
        }

        this.isProcessingQueue = true;
        const item = this.commandQueue[0];
        try {
            this.log('TX', item.cmd);
            item.sentTime = Date.now();
            const encoder = new TextEncoder();
            const payload = encoder.encode(item.cmd + "\r");
            
            if (this.config.dmaEngine && this.writeChar.properties.writeWithoutResponse) {
                await this.writeChar.writeValueWithoutResponse(payload);
            } else {
                await this.writeChar.writeValue(payload);
            }
            
            // Use adaptive timeout if it's longer than requested, otherwise use requested
            const effectiveTimeout = Math.max(item.timeoutMs, this.adaptiveTimeoutMs);
            
            this.currentCmdTimeout = setTimeout(async () => {
                this.log('SYS', `Timeout on ${item.cmd}. Sending interrupt...`);
                try {
                    // Send carriage return to interrupt ELM327
                    await this.writeChar.writeValue(new TextEncoder().encode("\r"));
                } catch (e) {}

                if (item.retriesLeft > 0) {
                    this.log('SYS', `Retrying... (${item.retriesLeft} left)`);
                    item.retriesLeft--;
                    this.rxBuffer = ""; 
                    this.isProcessingQueue = false;
                    this.processQueue();
                } else {
                    this.log('ERR', `Command timeout: ${item.cmd}`);
                    
                    // CRITICAL: We don't shift yet. We wait for the interrupt to take effect
                    // if we can, or we shift and risk desync. 
                    // Better: Reject and leave isProcessingQueue=true until a '>' is seen
                    // OR we force a hardware reset.
                    
                    this.commandQueue.shift();
                    this.rxBuffer = ""; 
                    this.isProcessingQueue = false;
                    item.reject(new Error(`TIMEOUT: ${item.cmd}`));
                    this.processQueue();
                }
            }, item.timeoutMs);
        } catch (e: any) {
            this.log('ERR', `Write error on ${item.cmd}: ${e.message || String(e)}`);
            this.commandQueue.shift(); 
            this.rxBuffer = ""; // Clear buffer on error
            this.isProcessingQueue = false;
            item.reject(e);
            this.processQueue();
        }
    }

    public async reconnect(): Promise<void> {
        this.log('SYS', 'Attempting automatic reconnection...');
        this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.connect();
    }

    private async initializeConnection() {
        this.onStatusChange(ObdConnectionState.Initializing);
        try {
            // [PRO-FIX] First contact: Use high timeout for initial identification
            const version = await this.runCommand("AT I", 1, 2000);
            this.log('SYS', `Adapter Firmware Identified: ${version}`);
            
            // Critical: Cold Reset and wait for hardware stabilization
            await this.runCommand("AT Z", 2, 3000); 
            await new Promise(r => setTimeout(r, 1000)); 

            // Standard Config - Enforce rigid ELM327 state
            await this.runCommand("AT E0", 1, 1000); // Echo Off
            await this.runCommand("AT L0", 1, 1000); // Linefeeds Off
            await this.runCommand("AT S0", 1, 1000); // Spaces Off
            await this.runCommand("AT AT 2", 1, 1000); // Adaptive Timing 2 (Aggressive)
            await this.runCommand("AT ST FF", 1, 1000); // Max timeout for handshake
            
            await this.runCommand("AT SP 0", 1, 500); // Try Auto mode
            
            // Try to enable high speed baud if it's a vLinker or STN adapter
            if (this.config.fastBaud && (version.includes("vLinker") || version.includes("STN") || version.includes("V3.0"))) {
                this.log('SYS', 'Performance Hardware Detected. Optimizing throughput...');
                try {
                    await this.runCommand("AT BRT 0F", 1, 500); 
                    await this.runCommand("AT V1", 1, 500); // Variable DLC for vLinker
                } catch (e) {}
            }

            const protDesc = await this.runCommand("AT DP", 1, 1000); // Describe protocol
            this.log('SYS', `Initial Protocol State: ${protDesc}`);
            
            // Enable Flow Control for better multi-frame handling
            await this.runCommand("AT AFC", 1, 1000);

        } catch (e) {
            this.log('ERR', 'ELM327 stage-0 handshake failed. Attempting emergency soft-recovery...');
            await this.runCommand("AT Z", 1, 3000);
        }

        let connected = false;
        let response = "";

        // Strategy 0: Locked Protocol Recovery
        const lockedProto = localStorage.getItem('obd_locked_protocol');
        if (lockedProto) {
            try {
                this.log('SYS', `Resuming Locked Protocol: ${lockedProto}`);
                if (lockedProto === 'SubaruSSM2') {
                    await this.runCommand("AT D", 1, 1000);
                    await this.runCommand("AT SP 3", 1, 1000);
                    await this.runCommand("AT AL", 1, 1000);
                    await this.runCommand("AT IB 48", 1, 1000);
                    await this.runCommand("AT SH 80 12 F0", 1, 1000);
                    await this.runCommand("AT WM 80 12 F0 3E", 1, 1000);
                    await this.runCommand("AT SW 32", 1, 1000);
                    await this.runCommand("AT SI", 1, 4000);
                    response = await this.runCommand("A801000008", 1, 4000);
                    if (response && response.replace(/[\s\r\n>]/g, '').toUpperCase().includes("E801")) {
                        connected = true;
                        this.useSubaruSsm2Mode = true;
                    }
                } else if (lockedProto === 'SubaruSSM1') {
                    await this.runCommand("AT D", 1, 1000);
                    await this.runCommand("AT SP 3", 1, 1000);
                    await this.runCommand("AT AL", 1, 1000);
                    await this.runCommand("AT IB 19", 1, 1000);
                    await this.runCommand("AT SH 80 12 F0", 1, 1000);
                    response = await this.runCommand("78000001", 1, 4000);
                    if (response) {
                        const clean = response.replace(/[\s\r\n>]/g, '').toUpperCase();
                        if (/F8[0-9A-F]{2}/.test(clean)) {
                            connected = true;
                            this.useSubaruSsm1Mode = true;
                        }
                    }
                } else {
                    await this.runCommand(`AT SP ${lockedProto}`, 1, 1500);
                    response = await this.runCommand("0100", 1, 4500);
                    if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
                }
            } catch (e) {
                this.log('SYS', 'Locked restoration failed. Entering multi-strategy loop.');
                localStorage.removeItem('obd_locked_protocol');
            }
        }

        // Strategy 1: Nissan G25/G37 Priority CAN (SP 6 - ISO 15765-4 CAN 11/500 + Physical Address 7E0)
        // This is often needed when the engine is OFF but Ignition is ON for Nissan.
        if (!connected) {
            try {
                this.log('SYS', 'Attempting Nissan G25 Physical CAN Handshake (7E0)...');
                
                // Battery Check
                const battery = await this.runCommand("AT RV", 1, 1000);
                this.log('SYS', `Battery Voltage: ${battery}`);
                const volts = parseFloat(battery);
                if (volts < 11.0) {
                    this.log('ERR', 'Low Voltage detected. Connection may be unstable.');
                }

                await this.runCommand("AT SP 6", 1, 1000);
                await this.runCommand("AT SH 7E0", 1, 1000);
                await this.runCommand("AT CRA 7E8", 1, 1000); 

                // Tester Present to keep it awake
                await this.runCommand("3E00", 1, 1000);
                
                const testRes = await this.runCommand("0100", 1, 3000);
                
                let response = "";
                if (testRes.includes("4100") || testRes.includes("UNABLE TO CONNECT")) {
                    if (testRes.includes("UNABLE")) {
                        this.log('SYS', 'ECU Warming up. Double probing with physical address...');
                        await new Promise(r => setTimeout(r, 800));
                        await this.runCommand("2101", 1, 2000); // Nissan specific high-speed init
                        response = await this.runCommand("0100", 1, 4000);
                    } else {
                        response = testRes;
                    }
                }
                
                if (response && response.includes("4100")) {
                    connected = true;
                    this.isCanProtocol = true;
                    this.log('SYS', 'Nissan Physical CAN Handshake Successful.');
                }
            } catch (e) {
                this.log('SYS', 'Nissan Physical probe failed, attempting K-Line fallback...');
                try {
                    await this.runCommand("AT SP 5", 1, 1000); // ISO 14230-4 KWP (fast init)
                    response = await this.runCommand("0100", 1, 3000);
                    if (response.includes("4100")) {
                        connected = true;
                        this.isCanProtocol = false;
                    }
                } catch (e2) {}
                
                if (!connected) {
                    // Reset headers before next strategy
                    await this.runCommand("AT D", 1, 1000);
                }
            }
        }

        // Strategy 2: Auto Protocol (SP 0) - Give it plenty of time to search
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000); // Reset headers
                await this.runCommand("AT SP 0", 1, 1000);
                response = await this.runCommand("0100", 1, 6000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 2 failed:", e);
            }
        }

        // Strategy 3: Standard CAN 11/500 (SP 6)
        if (!connected) {
            try {
                await this.runCommand("AT SP 6", 1, 1000);
                response = await this.runCommand("0100", 1, 3000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 3 failed:", e);
            }
        }

        // Strategy 4: Toyota Hilux Alt CAN (SP 7 - ISO 15765-4 CAN 29/500)
        if (!connected) {
            try {
                await this.runCommand("AT SP 7", 1, 1000);
                response = await this.runCommand("0100", 1, 3000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 4 failed:", e);
            }
        }

        // Strategy 5: Nissan Dualis J10 Specific (KWP2000 Fast Init)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000); // Reset headers
                await this.runCommand("AT SP 5", 1, 1000); // ISO 14230-4 KWP (fast init)
                await this.runCommand("AT AL", 1, 1000); // Allow long messages
                await this.runCommand("AT IB 10", 1, 1000); // Set ISO baud to 10400
                await this.runCommand("AT IIA 10", 1, 1000); // Init address
                await this.runCommand("AT SH 81 10 FC", 1, 1000); // Set Header (Tester to Engine)
                await this.runCommand("AT WM 81 10 FC 3E", 1, 1000); // Set Keep-Alive Message (Tester Present)
                await this.runCommand("AT SW 32", 1, 1000); // Wakeup interval set to ~1 second (50 * 20ms) instead of 00 (off)
                await this.runCommand("AT FI", 1, 3000); // Fast Init
                response = await this.runCommand("2101", 1, 4000);
                if (response && response.replace(/[\s\r\n>]/g, '').includes("6101")) {
                    connected = true;
                    this.useNissanConsultMode = true;
                } else {
                    // Try standard OBD2 PID on this protocol
                    response = await this.runCommand("0100", 1, 4000);
                    if (response && response.replace(/[\s\r\n>]/g, '').includes("4100")) {
                        connected = true;
                        this.useNissanConsultMode = false;
                    }
                }
            } catch (e) {
                console.warn("Strategy 4 failed:", e);
            }
        }

        // Strategy 4b: Nissan Dualis J10 Alternative (KWP2000 5 Baud Init)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 4", 1, 1000); // ISO 14230-4 KWP (5 baud init)
                await this.runCommand("AT AL", 1, 1000); // Allow long messages
                await this.runCommand("AT IB 10", 1, 1000); // Set ISO baud to 10400
                await this.runCommand("AT IIA 10", 1, 1000); // Init address
                await this.runCommand("AT SH 81 10 FC", 1, 1000); // Set Header
                await this.runCommand("AT WM 81 10 FC 3E", 1, 1000); // Set Keep-Alive Message
                await this.runCommand("AT SW 32", 1, 1000); // Wakeup interval set to ~1 second
                await this.runCommand("AT SI", 1, 3000); // Slow Init
                response = await this.runCommand("2101", 1, 4000);
                if (response && response.replace(/[\s\r\n>]/g, '').includes("6101")) {
                    connected = true;
                    this.useNissanConsultMode = true;
                } else {
                    response = await this.runCommand("0100", 1, 4000);
                    if (response && response.replace(/[\s\r\n>]/g, '').includes("4100")) {
                        connected = true;
                        this.useNissanConsultMode = false;
                    }
                }
            } catch (e) {
                console.warn("Strategy 4b failed:", e);
            }
        }

        // Strategy 4c: Nissan Dualis J10 K-Line Alt ECU Address (AT SH 81 12 F1 / 81 12 FC)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 5", 1, 1000); // ISO 14230-4 KWP (fast init)
                await this.runCommand("AT AL", 1, 1000); 
                await this.runCommand("AT IB 10", 1, 1000); 
                await this.runCommand("AT IIA 12", 1, 1000); // Init address 12
                await this.runCommand("AT SH 81 12 F1", 1, 1000); // Set Header to 12 F1
                await this.runCommand("AT WM 81 12 F1 3E", 1, 1000); 
                await this.runCommand("AT SW 32", 1, 1000); 
                await this.runCommand("AT FI", 1, 3000); 
                response = await this.runCommand("2101", 1, 4000);
                if (response && response.replace(/[\s\r\n>]/g, '').includes("6101")) {
                    connected = true;
                    this.useNissanConsultMode = true;
                } else {
                    // Try the FC variant
                    await this.runCommand("AT SH 81 12 FC", 1, 1000);
                    await this.runCommand("AT WM 81 12 FC 3E", 1, 1000);
                    response = await this.runCommand("2101", 1, 4000);
                    if (response && response.replace(/[\s\r\n>]/g, '').includes("6101")) {
                        connected = true;
                        this.useNissanConsultMode = true;
                    } else {
                        response = await this.runCommand("0100", 1, 4000);
                        if (response && response.replace(/[\s\r\n>]/g, '').includes("4100")) {
                            connected = true;
                            this.useNissanConsultMode = false;
                        }
                    }
                }
            } catch (e) {
                console.warn("Strategy 4c failed:", e);
            }
        }

        // Strategy 5: Generic KWP2000 Fast Init (SP 5)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000); // Reset headers
                await this.runCommand("AT SP 5", 1, 1000);
                await this.runCommand("AT FI", 1, 3000);
                response = await this.runCommand("0100", 1, 3000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 5 failed:", e);
            }
        }

        // Strategy 6: Generic ISO 9141-2 (SP 3)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000); // Reset headers
                await this.runCommand("AT SP 3", 1, 1000);
                response = await this.runCommand("0100", 1, 4000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 6 failed:", e);
            }
        }

        // Strategy 7: Ford J1850 PWM (SP 1) - Common in older Australian Fords (Territory/Falcon)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 1", 1, 1000);
                response = await this.runCommand("0100", 1, 4000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 7 failed:", e);
            }
        }

        // Strategy 8: Ford/GM J1850 VPW (SP 2)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 2", 1, 1000);
                response = await this.runCommand("0100", 1, 4000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 8 failed:", e);
            }
        }

        // Strategy 9: Honda/Toyota KWP2000 Specific (SP 5 with specific headers)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 5", 1, 1000);
                await this.runCommand("AT IIA 13", 1, 1000); // Honda specific init address
                await this.runCommand("AT FI", 1, 3000);
                response = await this.runCommand("0100", 1, 4000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 9 failed:", e);
            }
        }

        // Strategy 10: VAG ALDL / Older ISO (SP 3 with 5 baud init)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 3", 1, 1000);
                await this.runCommand("AT SI", 1, 3000); // Slow Init
                response = await this.runCommand("0100", 1, 4000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 10 failed:", e);
            }
        }

        // Strategy 11: BMW TP2.0 / K-Line (SP 5 with specific wakeup)
        if (!connected) {
            try {
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 5", 1, 1000);
                await this.runCommand("AT SH 81 12 F1", 1, 1000); // BMW specific header
                await this.runCommand("AT FI", 1, 3000);
                response = await this.runCommand("0100", 1, 4000);
                if (response.replace(/[\s\r\n>]/g, '').includes("4100")) connected = true;
            } catch (e) {
                console.warn("Strategy 11 failed:", e);
            }
        }

        // Strategy 12: Subaru Select Monitor 2 (SSM2) over K-Line (4800 baud)
        if (!connected) {
            try {
                this.log('SYS', 'Attempting Subaru Select Monitor (SSM2) handshake (4800 baud)...');
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 3", 1, 1000); // ISO 9141-2
                await this.runCommand("AT AL", 1, 1000); // Allow long messages 
                await this.runCommand("AT IB 48", 1, 1000); // Set ISO Baud to 4800 (SSM2 speed)
                await this.runCommand("AT SH 80 12 F0", 1, 1000); // Set Header Tester (F0) -> ECU (12)
                await this.runCommand("AT WM 80 12 F0 3E", 1, 1000); // Keep alive
                await this.runCommand("AT SW 32", 1, 1000); // Wakeup interval set to ~1s
                await this.runCommand("AT SI", 1, 4000); // Slow Init to establish 5-baud hardware handshake
                
                // Read ROM ID or RPM on SSM2 (CMD: A8 01 00 00 08)
                response = await this.runCommand("A801000008", 1, 4000);
                if (response && response.replace(/[\s\r\n>]/g, '').toUpperCase().includes("E801")) {
                    connected = true;
                    this.useSubaruSsm2Mode = true;
                    this.log('SYS', 'Subaru Select Monitor (SSM2) connection successful.');
                }
            } catch (e) {
                console.warn("Strategy 12 (Subaru SSM2) failed:", e);
                this.useSubaruSsm2Mode = false;
            }
        }

        // Strategy 12b: Subaru Select Monitor 1 (SSM1) over K-Line (1953 baud)
        if (!connected) {
            try {
                this.log('SYS', 'Attempting Subaru Select Monitor (SSM1) handshake (1953 baud)...');
                await this.runCommand("AT D", 1, 1000);
                await this.runCommand("AT SP 3", 1, 1000); // ISO 9141-2
                await this.runCommand("AT AL", 1, 1000);
                await this.runCommand("AT IB 19", 1, 1000); // Custom ISO Baud 1953 baud (SSM1 classic speed)
                await this.runCommand("AT SH 80 12 F0", 1, 1000);
                
                response = await this.runCommand("78000001", 1, 4000); // Read RAM 1 byte
                if (response) {
                    const clean = response.replace(/[\s\r\n>]/g, '').toUpperCase();
                    if (/F8[0-9A-F]{2}/.test(clean)) {
                        connected = true;
                        this.useSubaruSsm1Mode = true;
                        this.log('SYS', 'Subaru Select Monitor (SSM1) connection successful.');
                    }
                }
            } catch (e) {
                console.warn("Strategy 12b (Subaru SSM1) failed:", e);
                this.useSubaruSsm1Mode = false;
            }
        }

        if (!connected) {
            this.connectedProtocol = "Unknown";
            throw new Error("OBD Protocol Handshake failed. Please ensure ignition is ON and adapter is correct.");
        }

        if (this.useSubaruSsm2Mode) {
            this.connectedProtocol = "Subaru SSM2";
            this.isCanProtocol = false;
            localStorage.setItem('obd_locked_protocol', 'SubaruSSM2');
        } else if (this.useSubaruSsm1Mode) {
            this.connectedProtocol = "Subaru SSM1";
            this.isCanProtocol = false;
            localStorage.setItem('obd_locked_protocol', 'SubaruSSM1');
        } else {
            try {
                this.connectedProtocol = "Established"; // Fallback if DPN fails
                
                // Lock onto Engine ECU if CAN is used (J11+ or Hilux)
                if (response.includes("7E8")) {
                    await this.runCommand("AT SH 7E0", 1, 1000); 
                }

                const protoNum = await this.runCommand("AT DPN", 1, 1500);
                if (protoNum && protoNum.length > 0) {
                    this.connectedProtocol = protoNum;
                    
                    // Detect if it's a CAN protocol (6, 7, 8, 9)
                    const pNum = protoNum.replace(/A/g, '');
                    this.isCanProtocol = ['6', '7', '8', '9'].includes(pNum);

                    // Lock protocol for future connections
                    if (!protoNum.includes("?")) {
                        localStorage.setItem('obd_locked_protocol', pNum); 
                    }
                }
            } catch (e) {
                console.warn("Final init steps failed:", e);
            }
        }
        
        // Test if Nissan Consult mode is working (if not already confirmed)
        if (this.useNissanConsultMode !== true) {
            try {
                const test21 = await this.runCommand("2101", 1, 2000);
                if (test21 && test21.replace(/[\s\r\n>]/g, '').includes("6101")) {
                    this.useNissanConsultMode = true;
                } else {
                    this.useNissanConsultMode = false;
                }
            } catch (e) {
                this.useNissanConsultMode = false;
            }
        }

        // Apply ELM327 Elite Optimizations (Multi-PID, Adaptive Timing, etc.)
        await this.applyOptimizations();
    }

    private ssm1CoolantTemp(b: number): number {
        const table: [number, number][] = [
            [0, 150],
            [13, 100],
            [18, 90],
            [28, 80],
            [45, 70],
            [68, 60],
            [96, 50],
            [131, 40],
            [166, 30],
            [196, 20],
            [221, 10],
            [236, 0],
            [246, -10],
            [251, -20],
            [253, -30],
            [254, -40],
            [255, -50]
        ];
        for (let i = 0; i < table.length - 1; i++) {
            const [x0, y0] = table[i];
            const [x1, y1] = table[i + 1];
            if (b >= x0 && b <= x1) {
                const ratio = (b - x0) / (x1 - x0);
                return y0 + ratio * (y1 - y0);
            }
        }
        return 20; // Fallback
    }

    private parseValue(response: string, modePid: string): string | null {
        if (!response || response.includes("NODATA") || response.includes("ERROR") || response.includes("?")) return null;
        
        // Multi-line cleaner: removes prompt echoes, headers, spaces
        let clean = response.replace(/[\s\r\n>]/g, ''); 
        
        // Strip out CAN multi-frame numbering (e.g., 0: 41 0C ..., 1: ..., 2: ...)
        clean = clean.replace(/[0-9]:/g, '');
        
        const target = modePid.replace(/\s+/g, '');
        const idx = clean.indexOf(target);
        if (idx !== -1) return clean.substring(idx + target.length);
        return null;
    }

    public setActivePids(pids: PIDDefinition[]) {
        this.activePids = pids;
    }

    public async pollHighFreqData(): Promise<Partial<any>> {
        if (!this.writeChar || this.isProcessingQueue) return {};

        const now = Date.now();
        const dt = (now - this.lastPollTime) / 1000;
        
        // Adaptive Throttling: If latency is high, slow down polling to prevent pipeline congestion
        const targetRate = this.config.refreshRateTarget || 20;
        const dynamicDelay = Math.max(1000 / targetRate, this.lastLatency * 1.5);
        
        if (this.lastPollTime > 0 && (now - this.lastPollTime) < dynamicDelay) {
            return {}; 
        }

        this.lastPollTime = now;
        const data: any = { source: 'live_obd', customPids: {}, latency: this.lastLatency };
        const pollTimeout = Math.max(1000, this.adaptiveTimeoutMs * 2);

        // SUBARU SELECT MONITOR (SSM2) - DIRECT MEMORY READ STRATEGY
        if (this.useSubaruSsm2Mode) {
            try {
                if ((this as any)._ssm2Cycle === undefined) {
                    (this as any)._ssm2Cycle = 0;
                }
                (this as any)._ssm2Cycle++;
                
                // Bandwidth Optimization: Read only 4 core addresses (RPM, Speed, Throttle) on most cycles
                const isHighPriorityCycle = (this as any)._ssm2Cycle % 5 !== 0;
                const cmd = isHighPriorityCycle 
                    ? "A80400000E00000F000010000015" // RPM (2 bytes), Speed (1 byte), Throttle (1 byte)
                    : "A80900000E00000F000010000008000015000013000014000012000011"; // Full 9 addresses
                
                const res = await this.runCommand(cmd, 0, pollTimeout);
                if (res) {
                    const hex = res.replace(/[\s\r\n>]/g, '').toUpperCase();
                    const targetIdx = hex.indexOf("E8");
                    if (targetIdx !== -1) {
                        let payload = hex.substring(targetIdx + 2);
                        const expectedLen = isHighPriorityCycle ? 4 : 9;
                        const expectedLenHex = expectedLen.toString(16).toUpperCase().padStart(2, '0');
                        if (payload.startsWith(expectedLenHex)) {
                            payload = payload.substring(2);
                        }
                        if (payload.length >= expectedLen * 2) {
                            const b: number[] = [];
                            for (let i = 0; i < expectedLen; i++) {
                                b.push(parseInt(payload.substring(i * 2, i * 2 + 2), 16));
                            }
                            
                            if (isHighPriorityCycle) {
                                // 4 addresses: RPM H/L (b[0]/b[1]), Speed (b[2]), Throttle (b[3])
                                if (!isNaN(b[0]) && !isNaN(b[1])) {
                                    data.rpm = (b[0] * 256 + b[1]) / 4;
                                }
                                if (!isNaN(b[2])) {
                                    data.speed = b[2];
                                }
                                if (!isNaN(b[3])) {
                                    data.throttlePos = (b[3] * 100) / 255;
                                }
                                // Retain last values for non-polled fields
                                data.engineTemp = (this as any)._lastEngineTemp || 85;
                                data.maf = (this as any)._lastMaf || 0;
                                data.inletAirTemp = (this as any)._lastIat || 24;
                                data.timingAdvance = (this as any)._lastTimingAdvance || 0;
                                data.engineLoad = data.rpm > 0 ? Math.min(100, (data.maf * 500) / data.rpm) : 0;
                            } else {
                                // Full 9 addresses
                                if (!isNaN(b[0]) && !isNaN(b[1])) {
                                    data.rpm = (b[0] * 256 + b[1]) / 4;
                                }
                                if (!isNaN(b[2])) {
                                    data.speed = b[2];
                                }
                                if (!isNaN(b[3])) {
                                    data.engineTemp = b[3] - 40;
                                    (this as any)._lastEngineTemp = data.engineTemp;
                                }
                                if (!isNaN(b[4])) {
                                    data.throttlePos = (b[4] * 100) / 255;
                                }
                                if (!isNaN(b[5]) && !isNaN(b[6])) {
                                    data.maf = (b[5] * 256 + b[6]) / 100;
                                    (this as any)._lastMaf = data.maf;
                                }
                                if (!isNaN(b[7])) {
                                    data.inletAirTemp = b[7] - 40;
                                    (this as any)._lastIat = data.inletAirTemp;
                                }
                                if (!isNaN(b[8])) {
                                    data.timingAdvance = (b[8] * 0.5) - 64;
                                    (this as any)._lastTimingAdvance = data.timingAdvance;
                                }
                                data.engineLoad = data.rpm > 0 ? Math.min(100, (data.maf * 500) / data.rpm) : 0;
                            }
                            
                            if (Math.random() < 0.05) {
                                const vRes = await this.runCommand("AT RV", 0, 500);
                                if (vRes) {
                                    const vMatch = vRes.match(/[\d.]+/);
                                    if (vMatch) {
                                        const val = parseFloat(vMatch[0]);
                                        if (!isNaN(val)) data.batteryVoltage = val;
                                    }
                                }
                            }
                            return data;
                        }
                    }
                }
            } catch (e) {
                console.warn("SSM2 Polling error:", e);
            }
        }

        // SUBARU SELECT MONITOR (SSM1) - LEGACY READ RAM STRATEGY
        if (this.useSubaruSsm1Mode) {
            try {
                if ((this as any)._ssm1Cycle === undefined) {
                    (this as any)._ssm1Cycle = 0;
                }
                (this as any)._ssm1Cycle++;

                const isHighPriorityCycle = (this as any)._ssm1Cycle % 5 !== 0;
                // High-efficiency block-read: 
                // On high priority cycles: Request 7 bytes starting at Address 0x0009 (TPS, Speed, MAF L/H, IAT, RPM H/L)
                // On full cycles: Request 11 bytes starting from Address 0x0007 (Battery Voltage, Coolant, TPS, Speed, MAF, IAT, RPM H/L, Ignition)
                const cmd = isHighPriorityCycle ? "78000907" : "7800070B";
                const blockRes = await this.runCommand(cmd, 0, pollTimeout);
                if (blockRes) {
                    const hex = blockRes.replace(/[\s\r\n>]/g, '').toUpperCase();
                    const idx = hex.indexOf("F8");
                    if (idx !== -1) {
                        const expectedBytes = isHighPriorityCycle ? 7 : 11;
                        if (hex.length >= idx + 2 + (expectedBytes * 2)) {
                            const b: number[] = [];
                            for (let i = 0; i < expectedBytes; i++) {
                                const start = idx + 2 + (i * 2);
                                b.push(parseInt(hex.substring(start, start + 2), 16));
                            }
                            
                            if (isHighPriorityCycle) {
                                // 7 bytes starting from Address 0x0009:
                                // b[0] = TPS (0x0009)
                                // b[1] = empty/unknown/unused (0x000A)
                                // b[2] = Speed (0x000B)
                                // b[3] = MAF (0x000C)
                                // b[4] = IAT (0x000D)
                                // b[5]/b[6] = RPM H/L (0x000E/0x000F)
                                if (!isNaN(b[0])) {
                                    data.throttlePos = (b[0] * 100) / 255;
                                }
                                if (!isNaN(b[2])) {
                                    data.speed = b[2];
                                }
                                if (!isNaN(b[5]) && !isNaN(b[6])) {
                                    data.rpm = (b[5] * 256 + b[6]) * 12.5;
                                }
                                
                                // Retain previous
                                data.batteryVoltage = (this as any)._lastSsm1Volt || 13.8;
                                data.engineTemp = (this as any)._lastSsm1Temp || 85;
                                data.inletAirTemp = (this as any)._lastSsm1Iat || 24;
                                data.timingAdvance = (this as any)._lastSsm1Timing || 0;
                                data.maf = (this as any)._lastSsm1Maf || 0;
                                data.engineLoad = data.rpm > 0 ? Math.min(100, (data.maf * 500) / data.rpm) : 0;
                            } else {
                                // Parse Battery Voltage (Address 0x0007)
                                if (!isNaN(b[0])) {
                                    data.batteryVoltage = b[0] * 0.08;
                                    (this as any)._lastSsm1Volt = data.batteryVoltage;
                                }
                                // Parse Coolant Temp (Address 0x0008)
                                if (!isNaN(b[1])) {
                                    data.engineTemp = this.ssm1CoolantTemp(b[1]);
                                    (this as any)._lastSsm1Temp = data.engineTemp;
                                }
                                // Parse Throttle Position (Address 0x0009)
                                if (!isNaN(b[2])) {
                                    data.throttlePos = (b[2] * 100) / 255;
                                }
                                // Parse Vehicle Speed (Address 0x000B)
                                if (!isNaN(b[4])) {
                                    data.speed = b[4];
                                }
                                // Parse Mass Air Flow (Address 0x000C)
                                if (!isNaN(b[5])) {
                                    const mafVoltage = b[5] * 0.02;
                                    data.maf = (mafVoltage * mafVoltage * mafVoltage) * 2.5 + (mafVoltage * 4);
                                    (this as any)._lastSsm1Maf = data.maf;
                                }
                                // Parse Inlet Air Temp (Address 0x000D)
                                if (!isNaN(b[6])) {
                                    data.inletAirTemp = this.ssm1CoolantTemp(b[6]);
                                    (this as any)._lastSsm1Iat = data.inletAirTemp;
                                }
                                // Parse Engine RPM (Address 0x000E/0x000F)
                                if (!isNaN(b[7]) && !isNaN(b[8])) {
                                    data.rpm = (b[7] * 256 + b[8]) * 12.5;
                                }
                                // Parse Ignition Timing (Address 0x0011)
                                if (!isNaN(b[10])) {
                                    data.timingAdvance = (b[10] * 0.5) - 64;
                                    (this as any)._lastSsm1Timing = data.timingAdvance;
                                }
                                
                                data.engineLoad = data.rpm > 0 ? Math.min(100, (data.maf * 500) / data.rpm) : 0;
                            }
                            return data;
                        }
                    }
                }
            } catch (e) {
                console.warn("SSM1 Polling error:", e);
            }
        }
        
        // NISSAN DUALIS (J10) - SERVICE 21 STRATEGY
        if (this.useNissanConsultMode !== false) {
            try {
                // Request '2101' - The massive status block for Consult-II
                const res = await this.runCommand("2101", 0, pollTimeout); 
                if (res) {
                    const hex = res.replace(/[\s\r\n>]/g, '');
                    
                    // Nissan J10 block usually starts with 6101 (Response to 2101)
                    const targetIdx = hex.indexOf("6101");
                    if (targetIdx !== -1) {
                        this.useNissanConsultMode = true;
                        const payload = hex.substring(targetIdx + 4);
                        
                        // Nissan / Infiniti VQ/MR CONSULT-II Byte Mapping (Appx):
                        // 0-1: RPM, 2: Speed, 3: Coolant, 4: TPS, 5: Load, 6: IAT, 7-8: MAF, 9: Timing
                        if (payload.length >= 8) {
                            const rpmRaw = parseInt(payload.substring(0, 4), 16);
                            const spdRaw = parseInt(payload.substring(4, 6), 16);
                            const tempRaw = parseInt(payload.substring(6, 8), 16);
                            
                            if (!isNaN(rpmRaw)) data.rpm = rpmRaw * 12.5; // (or 0.125 * 100 formula)
                            if (!isNaN(spdRaw)) data.speed = spdRaw * 2;
                            if (!isNaN(tempRaw)) data.engineTemp = tempRaw - 40;
                            
                            // Extended Param Extraction for Elite telemetry coverage
                            if (payload.length >= 20) {
                                const tpsRaw = parseInt(payload.substring(8, 10), 16);
                                const loadRaw = parseInt(payload.substring(10, 12), 16);
                                const iatRaw = parseInt(payload.substring(12, 14), 16);
                                const mafRaw = parseInt(payload.substring(14, 18), 16);
                                const advRaw = parseInt(payload.substring(18, 20), 16);
                                
                                if (!isNaN(tpsRaw)) data.throttlePos = (tpsRaw * 100) / 255;
                                if (!isNaN(loadRaw)) data.engineLoad = (loadRaw * 100) / 255;
                                if (!isNaN(iatRaw)) data.inletAirTemp = iatRaw - 40;
                                if (!isNaN(mafRaw)) data.maf = mafRaw / 100;
                                if (!isNaN(advRaw)) data.timingAdvance = (advRaw / 2) - 64;
                            }
                            
                            // Optional: Extract CVT Temp if available
                            if (payload.length >= 24) {
                                const cvtRaw = parseInt(payload.substring(20, 22), 16);
                                if (!isNaN(cvtRaw)) data.transmissionTemp = cvtRaw - 40;
                            }
                            
                            // Sub-poll battery voltage sparingly to maintain ultra-low latency for main loop
                            if (Math.random() < 0.05) {
                                const vRes = await this.runCommand("AT RV", 0, 500);
                                if (vRes) {
                                    const vMatch = vRes.match(/[\d.]+/);
                                    if (vMatch) {
                                        const val = parseFloat(vMatch[0]);
                                        if (!isNaN(val)) data.batteryVoltage = val;
                                    }
                                }
                            }
                            
                            return data;
                        }
                    } else if (res.includes("NODATA") || res.includes("ERROR") || res.includes("?")) {
                        // Only disable Consult mode if we get a hard error, not just a malformed packet
                        this.useNissanConsultMode = false;
                    }
                }
            } catch (e: any) {
                // Do not permanently disable on timeout, as it might be a transient pipeline obstruction
                if (e && e.message && !e.message.includes("TIMEOUT")) {
                    this.useNissanConsultMode = false;
                }
            }
        }

        // ELM327 CAN MULTI-PID OPTIMIZATION
        // High Speed Tiered Polling
        if (this.isCanProtocol && this.config.multiPid) {
            // Priority: Always poll High (RPM, Speed, Throttle for real-time gear/driver demand), Cycle through Low
            const defaultHighIds = ['rpm', 'speed', 'throttle_pos'];
            const highPids = this.highPriorityPids.length > 0 ? this.highPriorityPids : OBD_PIDS.filter(p => defaultHighIds.includes(p.id));
            const lowPids = this.lowPriorityPids.length > 0 ? this.lowPriorityPids : OBD_PIDS.filter(p => !defaultHighIds.includes(p.id));
            
            if ((this as any)._pollCycle === undefined) {
                (this as any)._pollCycle = 0;
            }
            (this as any)._pollCycle++;

            const pidsToPoll = [...highPids];
            
            // Bandwidth Optimization: Only query 1 low-priority PID on 1 out of every 5 cycles
            const shouldPollLow = (this as any)._pollCycle % 5 === 0;
            if (shouldPollLow && lowPids.length > 0) {
                if (!(this as any)._lowPidIdx) (this as any)._lowPidIdx = 0;
                const nextLowPid = lowPids[(this as any)._lowPidIdx % lowPids.length];
                (this as any)._lowPidIdx++;
                pidsToPoll.push(nextLowPid);
            }

            
            // Group PIDs by mode (usually all '01')
            const mode01Pids = pidsToPoll.filter(p => p.mode === '01');
            if (mode01Pids.length > 0) {
                // ELM327 safely supports up to 3-4 PIDs without causing multi-frame response timeouts on standard adapters
                const chunks = [];
                for (let i = 0; i < mode01Pids.length; i += 3) {
                    chunks.push(mode01Pids.slice(i, i + 3));
                }

                // If highFreqMode is strongly enforced, only run the first chunk.
                // (Already constrained by the pidsToPoll slice above, but safety check)
                const chunksToProcess = this.config.highFreqMode ? chunks.slice(0, 1) : chunks;

                for (const chunk of chunksToProcess) {
                    try {
                        const cmd = `01${chunk.map(p => p.pid).join('')}`;
                        const res = await this.runCommand(cmd, 0, pollTimeout);
                        const hex = res.replace(/[\s\r\n>]/g, '');
                        
                        if (hex && hex.includes("41")) {
                            let currentHex = hex.substring(hex.indexOf("41") + 2);
                            for (const pidDef of chunk) {
                                const pidHex = pidDef.pid.toUpperCase();
                                const pidIdx = currentHex.indexOf(pidHex);
                                if (pidIdx !== -1) {
                                    const valHex = currentHex.substring(pidIdx + 2, pidIdx + 2 + (pidDef.bytes * 2));
                                    const bytes: number[] = [];
                                    for (let i = 0; i < pidDef.bytes * 2; i += 2) {
                                        bytes.push(parseInt(valHex.substring(i, i + 2), 16));
                                    }
                                    const value = pidDef.formula(bytes);
                                    if (!isNaN(value)) {
                                        this.mapPidToData(pidDef.id, value, data);
                                    }
                                    // Advance currentHex to avoid duplicate PID matching
                                    currentHex = currentHex.substring(pidIdx + 2 + (pidDef.bytes * 2));
                                }
                            }
                        } else if (res.includes("NODATA") || res.includes("ERROR") || res.includes("?")) {
                            console.warn("Multi-PID chunk rejected. Auto-disabling multi-PID optimization.");
                            this.config.multiPid = false;
                            break; 
                        }
                    } catch (e: any) {
                        console.warn("Multi-PID Poll Error:", e);
                        if (e && e.message && e.message.includes("TIMEOUT")) {
                             console.warn("Multi-PID chunk timed out. Auto-disabling multi-PID.");
                             this.config.multiPid = false;
                             break;
                        }
                    }
                }
                
                // Poll voltage separately (reduce frequency if DMA engine is enabled to save latency)
                if (!this.config.dmaEngine || this.pollVoltageCounter === 0) {
                    await this.pollVoltage(data, pollTimeout);
                }
            }

            // Group PIDs by mode '22' (UDS)
            const mode22Pids = pidsToPoll.filter(p => p.mode === '22');
            if (mode22Pids.length > 0) {
                // UDS supports multiple DIDs in one request, usually up to 3 or 4 depending on ECU
                const chunks = [];
                for (let i = 0; i < mode22Pids.length; i += 3) {
                    chunks.push(mode22Pids.slice(i, i + 3));
                }

                for (const chunk of chunks) {
                    try {
                        const cmd = `22${chunk.map(p => p.pid).join('')}`;
                        const res = await this.runCommand(cmd, 0, pollTimeout);
                        const hex = res.replace(/[\s\r\n>]/g, '');
                        
                        if (hex && hex.includes("62")) {
                            let currentHex = hex.substring(hex.indexOf("62") + 2);
                            for (const pidDef of chunk) {
                                const pidHex = pidDef.pid.toUpperCase();
                                const pidIdx = currentHex.indexOf(pidHex);
                                if (pidIdx !== -1) {
                                    const valHex = currentHex.substring(pidIdx + 4, pidIdx + 4 + (pidDef.bytes * 2));
                                    const bytes: number[] = [];
                                    for (let i = 0; i < pidDef.bytes * 2; i += 2) {
                                        bytes.push(parseInt(valHex.substring(i, i + 2), 16));
                                    }
                                    const value = pidDef.formula(bytes);
                                    if (!isNaN(value)) {
                                        this.mapPidToData(pidDef.id, value, data);
                                    }
                                    currentHex = currentHex.substring(pidIdx + 4 + (pidDef.bytes * 2));
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Multi-PID UDS Poll Error:", e);
                    }
                }
            }
            
            if (mode01Pids.length > 0 || mode22Pids.length > 0) {
                return data;
            }
        }

        // STANDARD PID POLLING (Fallback for non-CAN or mixed modes)
        const defaultHighIds = ['rpm', 'speed', 'throttle_pos'];
        const highPids = this.highPriorityPids.length > 0 ? this.highPriorityPids : OBD_PIDS.filter(p => defaultHighIds.includes(p.id));
        const lowPids = this.lowPriorityPids.length > 0 ? this.lowPriorityPids : OBD_PIDS.filter(p => !defaultHighIds.includes(p.id) && [
            'engine_load', 'coolant_temp', 'maf', 'iat'
        ].includes(p.id));

        const pidsToPoll = [...highPids];
        
        // Decimate low priority: only query 1 low-priority PID per cycle to reduce latency and bandwidth
        if (lowPids.length > 0) {
            if (!(this as any)._lowPidIdxStd) (this as any)._lowPidIdxStd = 0;
            const nextLowPid = lowPids[(this as any)._lowPidIdxStd % lowPids.length];
            (this as any)._lowPidIdxStd++;
            pidsToPoll.push(nextLowPid);
        }

        for (const pidDef of pidsToPoll) {
            try {
                // Append '1' to tell ELM327 to return immediately after 1 response (eliminates timeout delay)
                const cmd = this.config.dmaEngine ? `${pidDef.mode}${pidDef.pid}1` : `${pidDef.mode}${pidDef.pid}`;
                const res = await this.runCommand(cmd, 0, pollTimeout);
                const hex = this.parseValue(res, `4${pidDef.mode.substring(1)}${pidDef.pid}`);
                
                if (hex) {
                    const bytes: number[] = [];
                    for (let i = 0; i < pidDef.bytes * 2; i += 2) {
                        bytes.push(parseInt(hex.substring(i, i + 2), 16));
                    }
                    const value = pidDef.formula(bytes);
                    
                    if (!isNaN(value)) {
                        this.mapPidToData(pidDef.id, value, data);
                    }
                }
            } catch (e) {
                console.warn(`PID Poll Error (${pidDef.name}):`, e);
            }
        }

        if (!this.config.dmaEngine || this.pollVoltageCounter === 0) {
            await this.pollVoltage(data, pollTimeout);
        }
        return data;
    }

    private mapPidToData(id: string, value: number, data: any) {
        if (id === 'rpm') data.rpm = value;
        else if (id === 'speed') data.speed = value;
        else if (id === 'engine_load') data.engineLoad = value;
        else if (id === 'coolant_temp') data.engineTemp = value;
        else if (id === 'throttle_pos') data.throttlePos = value;
        else if (id === 'maf') data.maf = value;
        else if (id === 'iat') data.inletAirTemp = value;
        else if (id === 'fuel_pressure') data.fuelPressure = value;
        else if (id === 'stft1') data.shortTermFuelTrim = value;
        else if (id === 'ltft1') data.longTermFuelTrim = value;
        else if (id === 'timing_advance') data.timingAdvance = value;
        else if (id === 'baro') data.barometricPressure = value;
        else if (id === 'ambient_temp') data.ambientTemp = value;
        else if (id === 'fuel_level') data.fuelLevel = value;
        else if (id === 'vvtIntakeAngle') data.vvtIntakeAngle = value;
        else if (id === 'vvtExhaustAngle') data.vvtExhaustAngle = value;
        else if (id === 'injectorPulseWidth') data.injectorPulseWidth = value;
        else if (id === 'wastegateDutyCycle') data.wastegateDutyCycle = value;
        else if (id === 'fuelPumpDutyCycle') data.fuelPumpDutyCycle = value;
        else if (id === 'acceleratorPedalPos') data.acceleratorPedalPos = value;
        else if (id === 'targetIdleRpm') data.targetIdleRpm = value;
        else if (id === 'torqueConverterSlip') data.torqueConverterSlip = value;
        else if (id === 'linePressure') data.linePressure = value;
        else if (id === 'awdTorqueSplit') data.awdTorqueSplit = value;
        else if (id === 'steeringAngle') data.steeringAngle = value;
        else if (id === 'yawRate') data.yawRate = value;
        else if (id === 'vvelPosition') data.vvelPosition = value;
        else if (id === 'vvelTarget') data.vvelTarget = value;
        else if (id === 'mafB1') data.mafB1 = value;
        else if (id === 'mafB2') data.mafB2 = value;
        else if (id === 'throttlePosB1') data.throttlePosB1 = value;
        else if (id === 'throttlePosB2') data.throttlePosB2 = value;
        else if (id === 'ignTimingB1') data.ignTimingB1 = value;
        else if (id === 'ignTimingB2') data.ignTimingB2 = value;
        else if (id === 'knockSensor1') data.knockSensor1 = value;
        else if (id === 'knockSensor2') data.knockSensor2 = value;
        else if (id === 'engineOilTemp') data.engineOilTemp = value;
        else if (id === 'transFluidTemp') data.transFluidTemp = value;
        else if (id === 'afSensor1B1') data.afSensor1B1 = value;
        else if (id === 'afSensor1B2') data.afSensor1B2 = value;
        else {
            data.customPids[id] = value;
        }
    }

    private pollVoltageCounter = 0;
    private async pollVoltage(data: any, timeout: number) {
        // Poll voltage every 20 cycles (roughly once per second at 20Hz) to save line bandwidth
        this.pollVoltageCounter++;
        if (this.config.dmaEngine && this.pollVoltageCounter < 20) return;
        this.pollVoltageCounter = 0;

        try {
            const vRes = await this.runCommand("AT RV", 0, timeout);
            const vMatch = vRes.match(/[\d.]+/);
            if (vMatch) {
                const val = parseFloat(vMatch[0]);
                if (!isNaN(val)) data.batteryVoltage = val;
            }
        } catch (e) { }
    }

    public async getDiagnosticTroubleCodes(): Promise<DiagnosticCode[]> {
        const DTC_DESCRIPTIONS: Record<string, string> = {
            "P0101": "Mass Air Flow (MAF) Circuit Range/Performance Malfunction",
            "P0102": "Mass Air Flow (MAF) Circuit Low Input",
            "P0103": "Mass Air Flow (MAF) Circuit High Input",
            "P0113": "Intake Air Temperature (IAT) Sensor Circuit High Input",
            "P0117": "Engine Coolant Temperature (ECT) Sensor Circuit Low Input",
            "P0118": "Engine Coolant Temperature (ECT) Sensor Circuit High Input",
            "P0171": "System Too Lean (Bank 1) - Leak, O2 sensor or fuel supply issue",
            "P0172": "System Too Rich (Bank 1) - Rich fueling or injector leak",
            "P0300": "Random/Multiple Cylinder Misfire Detected - Spark/Coils/Fuel",
            "P0301": "Cylinder 1 Misfire Detected",
            "P0302": "Cylinder 2 Misfire Detected",
            "P0303": "Cylinder 3 Misfire Detected",
            "P0304": "Cylinder 4 Misfire Detected",
            "P0420": "Catalytic Converter System Efficiency Below Threshold (Bank 1)",
            "P0500": "Vehicle Speed Sensor Malfunction",
            "P1101": "Nissan VVT Intake Angle System Performance",
            "P1201": "Infiniti VVEL Control Shaft Position Out of Range",
            "C1201": "Engine Control System Malfunction (ABS Side Trigger)",
            "U0100": "Lost Communication with ECM/PCM - CAN Bus Timeout",
            "U0101": "Lost Communication with TCM (Transmission Control Module)",
            "P1721": "Vehicle Speed Sensor (MTR)",
            "P1805": "Brake Switch Circuit",
            "U1000": "CAN Communication Line - Signal Malfunction",
            "U1001": "CAN Communication Line - Signal Malfunction (ECM)"
        };

        const results: DiagnosticCode[] = [];
        
        // Strategy: 1. Try UDS Service 19 (Read DTCs by Status Mask) if CAN
        // This provides much deeper insights on Nissan/Infiniti (G25/G37)
        if (this.isCanProtocol) {
            try {
                this.log('SYS', "Attempting UDS Service $19 High-Depth Scan...");
                // Force Nissan/Infiniti Physical address for deepest scan
                await this.runCommand("AT SH 7E0", 1, 500);
                await this.runCommand("AT CRA 7E8", 1, 500);
                
                // 19 02 FF: Read all DTCs with any status
                const res = await this.runCommand("1902FF", 1, 2500);
                if (res && res.includes("59 02")) {
                    this.parseUdsDtcs(res, results, DTC_DESCRIPTIONS);
                }
            } catch (e) {
                this.log('ERR', "UDS Scan failed, falling back to standard OBD2");
            }
        }

        // 2. Standard OBD2 Fallback (Modes 03, 07, 0A)
        // Switch to Functional Addressing (7DF) for broad vehicle scan (All ECUs)
        if (this.isCanProtocol) {
            await this.runCommand("AT SH 7DF", 1, 500);
        }

        const modes = [
            { mode: "03", status: 'Confirmed' as const },
            { mode: "07", status: 'Pending' as const },
            { mode: "0A", status: 'Permanent' as const }
        ];

        for (const { mode, status } of modes) {
            try {
                const res = await this.runCommand(mode);
                if (res.includes("NO DATA") || res.includes("ERROR") || res.includes("?")) continue;
                
                // Split by lines and parse each line
                const lines = res.split(/[\r\n]+/);
                const targetSid = (0x40 + parseInt(mode, 16)).toString(16).toUpperCase(); // "43", "47", "4A"
                
                for (const line of lines) {
                    const cleanLine = line.trim().replace(/>/g, '');
                    if (!cleanLine) continue;
                    
                    // Split line into bytes
                    const bytes = cleanLine.split(/\s+/).filter(b => /^[0-9A-Fa-f]{2}$/.test(b));
                    if (bytes.length === 0) continue;
                    
                    // Find index of targetSid
                    const sidIdx = bytes.indexOf(targetSid);
                    if (sidIdx === -1) continue;
                    
                    let startIdx = sidIdx + 1;
                    const remainingCount = bytes.length - startIdx;
                    // If odd remaining count, usually the first byte is the DTC count (like 02 or 01)
                    if (remainingCount % 2 !== 0) {
                        startIdx += 1;
                    }
                    
                    for (let j = startIdx; j < bytes.length - 1; j += 2) {
                        const byte1Hex = bytes[j];
                        const byte2Hex = bytes[j+1];
                        if (byte1Hex === "00" && byte2Hex === "00") continue;
                        
                        const firstByte = parseInt(byte1Hex, 16);
                        
                        // Parse DTC parts standard OBD2
                        const type = (firstByte >> 6) & 0x03;
                        const digit2 = (firstByte >> 4) & 0x03;
                        const digit3 = (firstByte & 0x0F).toString(16).toUpperCase();
                        
                        let prefix = "P";
                        if (type === 1) prefix = "C";
                        else if (type === 2) prefix = "B";
                        else if (type === 3) prefix = "U";
                        
                        const pCode = `${prefix}${digit2}${digit3}${byte2Hex}`.toUpperCase();
                        
                        // Avoid duplicates if UDS already found it
                        if (results.some(r => r.code === pCode)) continue;

                        const desc = DTC_DESCRIPTIONS[pCode] || "Manufacturer Controlled DTC - See Service Manual";
                        
                        results.push({
                            code: pCode,
                            status,
                            description: desc,
                            timestamp: Date.now()
                        });
                    }
                }
            } catch (e) {
                console.warn(`Failed to read DTC mode ${mode}:`, e);
            }
        }

        // Restore Physical Addressing for standard polling
        if (this.isCanProtocol) {
            await this.runCommand("AT SH 7E0", 1, 500);
        }

        return results;
    }

    private parseUdsDtcs(res: string, results: DiagnosticCode[], descriptions: Record<string, string>) {
        const hex = res.replace(/[\s\r\n>]/g, '');
        const sidIdx = hex.indexOf("5902");
        if (sidIdx === -1) return;

        // Skip 59 02 and the next byte (DTC status mask)
        let ptr = sidIdx + 6;
        while (ptr + 8 <= hex.length) {
            const byte1 = hex.substring(ptr, ptr + 2);
            const byte2 = hex.substring(ptr + 2, ptr + 4);
            const byte3 = hex.substring(ptr + 4, ptr + 6);
            const statusByte = parseInt(hex.substring(ptr + 6, ptr + 8), 16);
            
            ptr += 8;
            if (byte1 === "00" && byte2 === "00" && byte3 === "00") continue;

            const firstByte = parseInt(byte1, 16);
            const type = (firstByte >> 6) & 0x03;
            let prefix = "P";
            if (type === 1) prefix = "C";
            else if (type === 2) prefix = "B";
            else if (type === 3) prefix = "U";

            const digit2 = (firstByte >> 4) & 0x03;
            const digit3 = (firstByte & 0x0F).toString(16).toUpperCase();
            
            const pCode = `${prefix}${digit2}${digit3}${byte2}${byte3}`.toUpperCase();
            
            // Map UDS status bits to our simplified status
            let status: 'Confirmed' | 'Pending' | 'Permanent' = 'Confirmed';
            if (statusByte & 0x01) status = 'Pending';
            if (statusByte & 0x08) status = 'Confirmed';
            
            results.push({
                code: pCode,
                status,
                description: descriptions[pCode] || descriptions[pCode.substring(0, 5)] || "Nissan/Infiniti Specific Diagnostic Code",
                timestamp: Date.now()
            });
        }
    }

    public async clearDiagnosticTroubleCodes(): Promise<boolean> {
        this.log('SYS', "Initiating Universal DTC Clearance Sequence...");
        let success = false;

        try {
            // 1. Try UDS Service 14 (Clear Diagnostic Information)
            // 14 FF FF FF clears ALL groups on Nissan/Infiniti
            if (this.isCanProtocol) {
                // Try Physical Address first (Main ECU)
                await this.runCommand("AT SH 7E0", 1, 500);
                const udsRes = await this.runCommand("14FFFFFF", 1, 3000);
                if (udsRes.includes("54") || udsRes.includes("OK")) {
                    this.log('SYS', "UDS Service $14 (Physical) Clear successful.");
                    success = true;
                }
            }

            // 2. Standard OBD2 Mode 04 Fallback
            // Use Functional Addressing for global clear
            if (this.isCanProtocol) {
                await this.runCommand("AT SH 7DF", 1, 500);
            }
            
            const obdRes = await this.runCommand("04", 1, 3000);
            if (obdRes.includes("44") || obdRes.includes("OK")) {
                this.log('SYS', "Standard OBD2 Mode $04 (Functional) Clear successful.");
                success = true;
            }

            // Restore Physical Addressing
            if (this.isCanProtocol) {
                await this.runCommand("AT SH 7E0", 1, 500);
            }

            // 3. Virtual Fallback
            if (this.isVirtual) {
                this.virtualDtcsCleared = true;
                success = true;
            }

            return success;
        } catch (e) {
            this.log('ERR', "Failed to clear DTCs across protocols.");
            return false;
        }
    }

    public async getEmissionsReadiness(): Promise<EmissionsReadiness | null> {
        try {
            const res = await this.runCommand("0101");
            if (res.includes("NO DATA") || res.includes("ERROR") || !res.includes("4101")) return null;
            
            const hex = res.replace(/\s+/g, '').split("4101")[1];
            if (!hex || hex.length < 8) return null;
            
            // Byte B: Status of monitors since DTCs cleared (Bits 0-6: Misfire, FuelSys, Components, Catalyst, HeatedCat, EVAP, SecondaryAir, A/C)
            // Byte C: Status of monitors this cycle (Bits 0-6: Misfire, FuelSys, Components, Catalyst, HeatedCat, EVAP, SecondaryAir, A/C)
            // Need to parse Byte B (index 2-3 in hex string)
            const byteB = parseInt(hex.substring(2, 4), 16);
            
            return {
                misfire: (byteB & 0x01) === 0,
                fuelSystem: (byteB & 0x02) === 0,
                components: (byteB & 0x04) === 0,
                catalyst: (byteB & 0x08) === 0,
                evap: (byteB & 0x10) === 0,
                o2Sensor: (byteB & 0x20) === 0,
                egr: (byteB & 0x40) === 0
            };
        } catch (e) {
            console.warn("Failed to read readiness monitors:", e);
            return null;
        }
    }

    public async sendUdsCommand(sid: string, paramHex: string = ""): Promise<string> { return await this.runCommand(`${sid}${paramHex}`, 0, 1000); }
    public async performActiveTest(test: ActiveTest, valHex: string): Promise<boolean> {
        try { const res = await this.runCommand(`${test.command}${valHex}`); return !res.includes("ERROR"); } catch (e) { return false; }
    }
}
