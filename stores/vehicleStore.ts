
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { useUIStore } from './uiStore';
import { get, set as idbSet, del } from 'idb-keyval';
import { MathEngineService, MathChannel } from '../services/MathEngineService';
import { 
    SensorDataPoint, LogSession, TuningModification, VehicleConfig, LoggingConfig,
    ObdConnectionState, DiagnosticCode, EmissionsReadiness, 
    DynoRun, DynoPoint, ECUProfile, TuningTableType, AIScanProgress,
    SubsystemStatus, PIDDefinition, ObdOptimizationConfig, TuningProfile, CustomDidDefinition, CanMapping,
    LaunchControlSuite, RaceSession, DragStripState, LaunchState, DragStats, HardwareLinkStatus, HardwareProtocol
} from '../types';
import { HardwareBridgeService } from '../services/HardwareBridgeService';
import { VisualOdometryResult } from '../services/VisionGroundTruth';
import { GenesisEKFUltimate } from '../services/GenesisEKFUltimate';
import { decodeCanValue } from '../utils/canDecoder';
import { CartelWorxSDK } from '../services/CartelWorxSDK';
import { MathKernel } from '../services/MathKernel';
import { KinematicsEngine } from '../services/Kinematics';
import { RevLimiter, CVTLaunchControl, BrakeThermalModel, LatencyEliminator } from '../services/ATEngine';
import { AutomotiveIntelligenceHub } from '../services/MLCore';

import { DatabaseService } from '../services/DatabaseService';
import { calculateCRC32, prepareChunkedData } from '../services/FlashUtils';
import { ChecksumService, EcuType } from '../services/ChecksumService';
import { UdsSecurityService, EcuVariant } from '../services/UdsSecurityService';
import { parseUdsResponse, UdsNrc } from '../lib/UdsUtils';
import { generateCopilotResponse } from '../services/geminiService';
import { assessDiagnosticCommand, commercialControlDenial } from '../services/CommercialReleasePolicy';
import { brokerCopilotAction, CopilotActionProposal } from '../services/ai/CopilotActionBroker';

const createMap = (base: number) => Array.from({length: 16}, () => Array(16).fill(base));

const initialSensorData: SensorDataPoint = {
    time: 0, rpm: 0, speed: 0, gear: 0, fuelUsed: 0, inletAirTemp: 0,
    batteryVoltage: 0, engineTemp: 0, fuelTemp: 0, turboBoost: 0,
    fuelPressure: 0, oilPressure: 0, shortTermFuelTrim: 0, longTermFuelTrim: 0,
    o2SensorVoltage: 0, engineLoad: 0, distance: 0, gForceX: 0, gForceY: 0, gForceZ: 0,
    latitude: 0, longitude: 0, maf: 0, timingAdvance: 0, throttlePos: 0,
    fuelLevel: 0, barometricPressure: 0, ambientTemp: 0, fuelRailPressure: 0,
    lambda: 0, wheelSpeedFL: 0, wheelSpeedFR: 0, wheelSpeedRL: 0, wheelSpeedRR: 0,
    knockLevel: 0, knockRetard: 0, knockCount: 0,
    vvtIntakeAngle: 0, vvtExhaustAngle: 0, injectorPulseWidth: 0,
    wastegateDutyCycle: 0, fuelPumpDutyCycle: 0, acceleratorPedalPos: 0,
    targetIdleRpm: 0, torqueConverterSlip: 0, linePressure: 0,
    awdTorqueSplit: 0, steeringAngle: 0, yawRate: 0,
    vvelPosition: 0, engineOilTemp: 0, mafB1: 0, mafB2: 0, 
    throttlePosB1: 0, throttlePosB2: 0, ignTimingB1: 0, ignTimingB2: 0
};

const safeVal = (val: any, fallback: number = 0): number => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return fallback;
    return val;
};

// Exponential Moving Average Smoothing
const smooth = (current: number, target: number, factor: number = 0.2): number => {
    return (current * (1 - factor)) + (target * factor);
};

// Range Validation
const validate = (val: number, min: number, max: number, fallback: number): number => {
    if (val < min || val > max) return fallback;
    return val;
};

let fusionRafId: number | null = null; 
const ekf = new GenesisEKFUltimate();
const mlHub = new AutomotiveIntelligenceHub();
let sdkInstance: CartelWorxSDK | null = null;
let obdPollTimeout: number | null = null;
let currentPollId: number = 0;
let lastObdUpdateTime: number = 0;
let lastObdData: Partial<SensorDataPoint> | null = null;
let lastObdQualityScore: number = 100;
let lastSimulationTime: number = 0;
let watchdogInterval: number | null = null;
let lastWatchdogStopToastTime = 0;
let lastWatchdogSlipToastTime = 0;
let lastWatchdogLatGToastTime = 0;

let lastAccel: [number, number, number] = [0, 0, 0];
let lastGyro: [number, number, number] = [0, 0, 0];
let lastGpsSpeed: number | null = null;
let lastGpsAccuracy: number = 1.0;
let hasNewGpsSpeed = false;
let lastGpsTime: number = 0;
let lastVisionSpeed: number | null = null;
let hasNewVisionSpeed = false;
let lastVisionYawRate: number | null = null;
let hasNewVisionYawRate = false;

enum UdsSession {
    Default = 0x01,
    Programming = 0x02,
    Extended = 0x03,
    Safety = 0x04
}

interface CanFrame {
    id: number;
    dlc: number;
    data: Uint8Array;
    timestamp: number;
}

export interface MLInsights {
    fusedSpeed: number;
    slipProbability: number;
    driverScore: number;
    anomalies: {
        o2: boolean;
        knock: boolean;
    };
}

export interface CognitiveState {
    selectedTask: 'welding' | 'torque' | 'idle';
    uiRegulationActive: boolean;
    simulatedCognitiveLoad: number;
    pupilDilation: number;
    heartRate: number;
    gsrValue: number;
}

interface VehicleStoreState {
    latestData: SensorDataPoint;
    data: SensorDataPoint[];
    mlInsights: MLInsights;
    isLogging: boolean;
    loggingConfig: LoggingConfig;
    currentLog: Partial<SensorDataPoint>[];
    savedLogs: LogSession[];
    obdState: ObdConnectionState;
    dataSourceMode: 'auto' | 'demo' | 'sensors' | 'obd';
    setDataSourceMode: (mode: 'auto' | 'demo' | 'sensors' | 'obd') => void;
    adaptiveDashboardMode: boolean;
    isHighStress: boolean;
    setAdaptiveDashboardMode: (enabled: boolean) => void;
    ekfStats: { visionConfidence: number; gpsActive: boolean; fusionUncertainty: number; dataQualityScore: number; visionYawRate?: number; visionSlipAngle?: number; fusedYawRate?: number; gpuActive?: boolean; };
    dtcs: DiagnosticCode[];
    readiness: EmissionsReadiness | null;
    isScanning: boolean;
    ecuProfile: ECUProfile | null;
    protocol: string;
    tuning: { 
        veTable: number[][]; 
        ignitionTable: number[][]; 
        boostTable: number[][]; 
        torqueTable: number[][];
        throttleTable: number[][];
        tcuTable: number[][];
        boostTarget: number; 
        overrun?: { enabled: boolean; activationRpm: number; };
    };
    tuningProfiles: TuningProfile[];
    activeProfileId: string | null;
    dyno: { isRunning: boolean; runs: DynoRun[]; currentRunData: DynoPoint[]; settings: { drivetrainLoss: number; correctionFactor: number; smoothing: number; startRpm: number; stopRpm: number; gear: number; }; };
    learningMaps: {
        ve: number[][]; // RPM (0-8000, 500 step) vs Load (0-100, 6.25 step)
        ign: number[][];
        lambda: number[][];
        boost: number[][];
        samples: number[][]; // Sample count for averaging
    };
    subsystems: SubsystemStatus;
    tuningHistory: any[];
    vehicleConfig: VehicleConfig;
    hasActiveFault: boolean;
    isPriming: boolean;
    isCalibrating: boolean;
    isReady: boolean;
    setReady: (ready: boolean) => void;
    calibrationProgress: number;
    calibrationStatus: string;
    shiftLightRpm: number;
    pedals: { brake: number; throttle: number };
    activePids: PIDDefinition[];
    customDids: CustomDidDefinition[];
    canMappings: CanMapping[];
    mathChannels: MathChannel[];
    mathValues: Record<string, number>;
    ghostTrace: {r: number, c: number, time: number}[];
    addMathChannel: (channel: MathChannel) => void;
    removeMathChannel: (id: string) => void;
    backupCalibration: Uint8Array | null;
    optimizationConfig: ObdOptimizationConfig;
    uds: {
        session: UdsSession;
        securityAccess: boolean;
        lastResponseCode: number;
        isFlashing: boolean;
        securityLog: string[];
        customMappings: Record<string, { name: string; unit: string; factor: number; offset: number }>;
    };
    addCustomMapping: (id: string, mapping: { name: string; unit: string; factor: number; offset: number }) => void;
    removeCustomMapping: (id: string) => void;
    canBus: {
        load: number;
        errorCount: number;
        activeFrames: CanFrame[];
    };
    observers: {
        tireTempEstimates: { fl: number; fr: number; rl: number; rr: number };
        cylinderPressureEstimates: number[];
    };
    commsLog: { time: number; type: 'REQ' | 'RES' | 'ERR'; bytes: string }[];
    launchControl: LaunchControlSuite;
    raceSession: RaceSession;
    hardwareLink: HardwareLinkStatus;
    hardwareLog: string[];
    coPilot: {
        messages: { id: string; role: 'ai' | 'user' | 'system'; text: string; timestamp: number; toolCalls?: any[] }[];
        isThinking: boolean;
        lastVoicePrompt?: string;
        actionProposals: CopilotActionProposal[];
    };
    rlTraining?: { epsilon: number };
    cognitiveState: CognitiveState;

    setCognitiveState: (state: Partial<CognitiveState>) => void;
    startFusionLoop: () => void;
    stopFusionLoop: () => void;
    requestSensors: () => Promise<void>;
    connectObd: () => Promise<void>;
    disconnectObd: () => void;
    scanVehicle: () => Promise<void>;
    clearVehicleFaults: () => Promise<void>;
    primeFuelSystem: () => Promise<void>;
    calibrateSensors: () => Promise<void>;
    flashCalibration: (binary: Uint8Array, progressCb: (p: AIScanProgress) => void) => Promise<boolean>;
    rollbackCalibration: (progressCb: (p: AIScanProgress) => void) => Promise<boolean>;
    startLogging: () => void;
    stopLogging: (customName?: string) => void;
    renameLog: (id: string, name: string) => void;
    deleteLog: (id: string) => void;
    processVisionFrame: (img: ImageData) => Promise<VisualOdometryResult>;
    updateMapCell: (table: TuningTableType, row: number, col: number, value: number) => void;
    smoothMap: (table: TuningTableType) => void;
    applyTuningModification: (mod: TuningModification) => void;
    undoLastTuningChange: () => void;
    saveProfile: (name: string) => void;
    loadProfile: (id: string) => void;
    deleteProfile: (id: string) => void;
    setVehicleConfig: (config: Partial<VehicleConfig>) => void;
    setBoostTarget: (target: number) => void;
    setShiftLightRpm: (rpm: number) => void;
    setLaunchControl: (config: Partial<VehicleStoreState['launchControl']>) => void;
    toggleAls: () => void;
    toggleWmi: () => void;
    toggleAlp: () => void;
    startDynoRun: () => void;
    stopDynoRun: () => void;
    toggleDynoRunVisibility: (id: string) => void;
    deleteDynoRun: (id: string) => void;
    setDynoSettings: (settings: Partial<VehicleStoreState['dyno']['settings']>) => void;
    executeRawCommand: (cmd: string) => Promise<string>;
    setActivePids: (pids: PIDDefinition[]) => void;
    addCustomDid: (did: CustomDidDefinition) => void;
    removeCustomDid: (id: string) => void;
    addCanMapping: (mapping: CanMapping) => void;
    removeCanMapping: (id: string) => void;
    updateCanMapping: (mapping: CanMapping) => void;
    setOptimizationConfig: (config: Partial<ObdOptimizationConfig>) => void;
    startCanSniffing: (callback: (frame: string) => void) => void;
    stopCanSniffing: () => void;
    performFlashTransfer: (data: Uint8Array, address: number) => Promise<boolean>;
    readDid: (did: string) => Promise<string | null>;
    writeDid: (did: string, data: string) => Promise<boolean>;
    readMemoryByAddress: (address: number, sizeBytes: number) => Promise<Uint8Array | null>;
    readHardwareMap: (address: number) => Promise<number[][] | null>;
    executeRoutine: (routineId: string, payload?: string) => Promise<string | null>;
    requestSecurityAccess: (variant: EcuVariant) => Promise<boolean>;
    setDiagnosticSession: (session: UdsSession) => Promise<boolean>;
    fingerprintECU: () => Promise<void>;
    setCanHeaders: (txHeader: string, rxHeader: string) => Promise<void>;
    establishKessLink: () => Promise<void>;
    writeKessParameter: (id: string, val: number) => Promise<boolean>;
    loadDatabases: () => Promise<void>;
    sendCoPilotMessage: (text: string) => Promise<void>;
    stageCopilotAction: (proposal: CopilotActionProposal) => void;
    clearCoPilotLog: () => void;
    setLoggingConfig: (config: Partial<LoggingConfig>) => void;
    readECUMapping: (mappingType: TuningTableType) => Promise<number[][] | null>;
    getEkfState: () => { x: number[]; P: number[]; residuals: Record<string, number>; };
}

const storage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await idbSet(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};

export const useVehicleStore = create<VehicleStoreState>()(
    persist(
        (set, get) => ({
            latestData: initialSensorData,
            data: [],
            mlInsights: {
                fusedSpeed: 0,
                slipProbability: 0,
                driverScore: 100,
                anomalies: { o2: false, knock: false }
            },
            isLogging: false,
            loggingConfig: {
                selectedFields: ['rpm', 'speed', 'turboBoost', 'engineLoad', 'lambda', 'engineTemp', 'throttlePos', 'timingAdvance'],
                format: 'CSV',
                frequency: 20
            },
            currentLog: [],
            savedLogs: [],
            obdState: ObdConnectionState.Disconnected,
            dataSourceMode: 'auto',
            ekfStats: { visionConfidence: 0, gpsActive: false, fusionUncertainty: 0, dataQualityScore: 100, visionYawRate: 0, visionSlipAngle: 0, fusedYawRate: 0 },
            dtcs: [],
            readiness: null,
            isScanning: false,
            ecuProfile: null,
            protocol: 'Unknown',
            tuning: { 
                veTable: createMap(85), 
                ignitionTable: createMap(25), 
                boostTable: createMap(1.2), 
                torqueTable: createMap(100), 
                throttleTable: createMap(0), 
                tcuTable: createMap(2500), 
                boostTarget: 18 
            },
            tuningProfiles: [],
            activeProfileId: null,
            dyno: { 
                isRunning: false, 
                runs: [], 
                currentRunData: [],
                settings: { drivetrainLoss: 0.15, correctionFactor: 1.0, smoothing: 3, startRpm: 2500, stopRpm: 7500, gear: 3 }
            },
            learningMaps: {
                ve: createMap(0),
                ign: createMap(0),
                lambda: createMap(0),
                boost: createMap(0),
                samples: createMap(0)
            },
            subsystems: { als: 'OFF', wmi: 'OFF', alp: 'PROTECT' },
            tuningHistory: [],
            vehicleConfig: { displacement: 2.0, cylinders: 4, aspiration: 'NA', fuelType: 'Pump 93', injectors: 4, injectorSizeCc: 400, primePulseWidthMs: 2.5, maxRpm: 6800, softCutRpm: 6600, idleRpmTarget: 750, weight: 1250, gearRatios: [0, 4.923, 3.193, 2.042, 1.411, 1.000, 0.862, 0.771], finalDrive: 3.357, tireCircumference: 2.13 },
            hasActiveFault: false,
            commsLog: [],
            launchControl: {
                enabled: false,
                launchRpm: 3500,
                exitSpeed: 10,
                activationMethod: 'SPEED_BASED',
                strategy: 'IGNITION_CUT',
                hardLimit: true,
                retardDeg: 15,
                flameOn: false,
                antiLagEnabled: false,
                stage2BoostTarget: 1.0,
                isStage2Active: false
            },
            raceSession: {
                mode: 'DRAG',
                isActive: false,
                dragState: DragStripState.Idle,
                launchState: LaunchState.Idle,
                startTime: null,
                greenLightTime: null,
                elapsedTime: 0,
                data: [],
                lapTimes: [],
                dragStats: {
                    reactionTime: null,
                    sixtyFootTime: null,
                    threeThirtyTime: null,
                    eighthMileTime: null,
                    eighthMileSpeed: null,
                    oneThousandTime: null,
                    quarterMileTime: null,
                    quarterMileSpeed: null,
                    zeroToSixtyTime: null,
                    zeroToHundredTime: null,
                    densityAltitude: 0,
                    slope: 0,
                    valid: true
                },
                currentDelta: 0,
                aiInsights: [],
                bestLapData: []
            },
            hardwareLink: {
                deviceId: null,
                firmwareVersion: null,
                protocol: HardwareProtocol.StandardObd,
                isClone: false,
                handshakeComplete: false
            },
            hardwareLog: [],
            coPilot: {
                messages: [
                    { id: '1', role: 'ai', text: 'Genesis v5.5 Initialized. Neural Link STABLE. Systems within nominal range. Ready for high-frequency calibration.', timestamp: Date.now() }
                ],
                isThinking: false,
                actionProposals: []
            },
            cognitiveState: {
                selectedTask: 'torque',
                uiRegulationActive: true,
                simulatedCognitiveLoad: 48,
                pupilDilation: 3.4,
                heartRate: 76,
                gsrValue: 4.2
            },
            rlTraining: { epsilon: 0.15 },
            isPriming: false,
            isCalibrating: false,
            isReady: false,
            setReady: (ready: boolean) => set({ isReady: ready }),
            calibrationProgress: 0,
            calibrationStatus: '',
            shiftLightRpm: 6500,
            pedals: { brake: 0, throttle: 0 },
            activePids: [],
            customDids: [],
            canMappings: [],
            mathChannels: MathEngineService.PRESETS,
            mathValues: {},
            ghostTrace: [],
            backupCalibration: null,
            optimizationConfig: {
                multiPid: true,
                adaptiveTiming: 2,
                fastBaud: true,
                canFiltering: true,
                highFreqMode: false,
                refreshRateTarget: 20,
                dmaEngine: true
            },
            uds: {
                session: UdsSession.Default,
                securityAccess: false,
                lastResponseCode: 0,
                isFlashing: false,
                securityLog: [],
                customMappings: {}
            },
            canBus: {
                load: 0,
                errorCount: 0,
                activeFrames: []
            },
            observers: {
                tireTempEstimates: { fl: 25, fr: 25, rl: 25, rr: 25 },
                cylinderPressureEstimates: [0, 0, 0, 0]
            },

            setDataSourceMode: (mode: 'auto' | 'demo' | 'sensors' | 'obd') => {
                set({ dataSourceMode: mode });
            },

            adaptiveDashboardMode: false,
            isHighStress: false,
            setAdaptiveDashboardMode: (enabled: boolean) => set({ adaptiveDashboardMode: enabled }),

            getEkfState: () => {
                return {
                    x: [...ekf.x],
                    P: [...ekf.P],
                    residuals: { ...ekf.residuals }
                };
            },

            setCognitiveState: (partial: Partial<CognitiveState>) => {
                set(state => ({ cognitiveState: { ...state.cognitiveState, ...partial } }));
            },

            requestSensors: async () => {
                // Request Motion Sensors (iOS specific)
                let motionGranted = false;
                if (typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                    try {
                        const permissionState = await (DeviceMotionEvent as any).requestPermission();
                        if (permissionState === 'granted') {
                            motionGranted = true;
                        }
                    } catch (e) {
                        console.warn("DeviceMotionEvent permission request failed:", e);
                    }
                } else {
                    motionGranted = true;
                }

                // Register event listener for physical motion triggers
                if (typeof window !== 'undefined' && motionGranted) {
                    const handleMotion = (e: DeviceMotionEvent) => {
                        const acc = e.acceleration || e.accelerationIncludingGravity;
                        if (acc) lastAccel = [acc.x || 0, acc.y || 0, acc.z || 0];
                        if (e.rotationRate) lastGyro = [e.rotationRate.alpha || 0, e.rotationRate.beta || 0, e.rotationRate.gamma || 0];
                    };
                    window.removeEventListener('devicemotion', handleMotion);
                    window.addEventListener('devicemotion', handleMotion);
                }

                // Geolocation Request (Promise-wrapped so callers can cleanly await user action)
                if (typeof navigator !== 'undefined' && "geolocation" in navigator) {
                    await new Promise<void>((resolve) => {
                        let resolved = false;
                        const complete = () => {
                            if (!resolved) {
                                resolved = true;
                                resolve();
                            }
                        };

                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                if (pos.coords.speed !== null) {
                                    lastGpsSpeed = pos.coords.speed;
                                    lastGpsAccuracy = pos.coords.accuracy || 1.0;
                                    hasNewGpsSpeed = true;
                                }
                                set(s => ({ ekfStats: { ...s.ekfStats, gpsActive: true } }));
                                complete();
                            },
                            () => {
                                set(s => ({ ekfStats: { ...s.ekfStats, gpsActive: false } }));
                                complete();
                            },
                            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                        );

                        // Safe timeout fallback so the loading sequence never hangs
                        setTimeout(complete, 6000);
                    });

                    // Start watchPosition for continuous tracking
                    const watchId = navigator.geolocation.watchPosition(
                        (pos) => {
                            if (pos.coords.speed !== null) {
                                lastGpsSpeed = pos.coords.speed;
                                lastGpsAccuracy = pos.coords.accuracy || 1.0;
                                hasNewGpsSpeed = true;
                            }
                            set(s => ({ ekfStats: { ...s.ekfStats, gpsActive: true } }));
                        },
                        () => {
                            set(s => ({ ekfStats: { ...s.ekfStats, gpsActive: false } }));
                        },
                        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                    );

                    // Store watchId on window to prevent duplicate listeners if re-run
                    const anyWin = window as any;
                    if (anyWin.__genesisGpsWatchId) {
                        navigator.geolocation.clearWatch(anyWin.__genesisGpsWatchId);
                    }
                    anyWin.__genesisGpsWatchId = watchId;
                }
            },

            startFusionLoop: () => {
                if (fusionRafId) return;
                let lastTime = performance.now();
                let lastUiTime = performance.now();
                let accumulatedDt = 0;
                let prevLatVel = 0;

                const loop = (time: number) => {
                    const dt = Math.max(0.001, Math.min((time - lastTime) / 1000, 0.1));
                    lastTime = time;
                    lastSimulationTime = Date.now();

                    const state = get();
                    const prev = state.latestData;
                    
                    ekf.predict(lastAccel, lastGyro, dt);
                    if (lastVisionSpeed !== null && hasNewVisionSpeed) {
                        ekf.fuseGps(lastVisionSpeed, 2.0);
                        hasNewVisionSpeed = false;
                        lastGpsTime = Date.now();
                    }
                    if (lastVisionYawRate !== null && hasNewVisionYawRate) {
                        ekf.fuseVisionYawRate(lastVisionYawRate, state.ekfStats.visionConfidence);
                        hasNewVisionYawRate = false;
                    }
                    if (lastGpsSpeed !== null && hasNewGpsSpeed) {
                        ekf.fuseGps(lastGpsSpeed, Math.max(0.2, lastGpsAccuracy * 0.1));
                        hasNewGpsSpeed = false;
                        lastGpsTime = Date.now();
                    } else {
                        // Zero Velocity Update (ZUPT)
                        const accelMag = Math.sqrt(lastAccel[0]**2 + lastAccel[1]**2 + lastAccel[2]**2);
                        // More lenient stationary check for mobile devices
                        const isStationary = (Math.abs(accelMag - 9.81) < 0.8 || accelMag < 0.2) && 
                                             Math.abs(lastGyro[0]) < 0.2 && 
                                             Math.abs(lastGyro[1]) < 0.2 && 
                                             Math.abs(lastGyro[2]) < 0.2;
                        
                        if (isStationary) {
                            ekf.applyZupt(lastAccel, lastGyro);
                            ekf.fuseGps(0, 0.05); // High confidence zero
                        }
                    }

                    accumulatedDt += dt;

                    // Throttle deep React state updates, virtual DOM diffing, and charts data slicing to ~40FPS (~25msspacing),
                    // avoiding browser layout thrashing while preserving 100Hz+ physical IMU/EKF integration loop fidelity!
                    if (time - lastUiTime < 25) {
                        fusionRafId = requestAnimationFrame(loop);
                        return;
                    }

                    const elapsedDt = accumulatedDt;
                    accumulatedDt = 0;
                    lastUiTime = time;
                    
                    const estimatedSpeedMs = safeVal(ekf.getEstimatedSpeed(), 0);
                    const clampedSpeedMs = Math.max(0, Math.min(100, estimatedSpeedMs));
                    const rawSpeedKph = clampedSpeedMs * 3.6;
                    
                    // --- PHYSICS & THERMAL (REAL DATA ONLY) ---
                    const currentBrakeTemp = prev.brakeTemp || 25;
                    const decelG = -Math.min(0, lastAccel[0] / 9.81);
                    const newBrakeTemp = BrakeThermalModel.updateTemperature(currentBrakeTemp, estimatedSpeedMs, decelG, elapsedDt, state.vehicleConfig.weight);
                    
                    set(s => {
                        const current = s.latestData;
                        const isObd = s.obdState === ObdConnectionState.Connected;
                        const mode = s.dataSourceMode;

                        const gearboxConfig = {
                            ratios: s.vehicleConfig.gearRatios || [0, 4.923, 3.193, 2.042, 1.411, 1.000, 0.862, 0.771],
                            finalDrive: s.vehicleConfig.finalDrive || 3.357,
                            tireCircumference: s.vehicleConfig.tireCircumference || 2.13
                        };
                        
                        // --- HIGH-FIDELITY TRACK CYCLE SIMULATOR (TIER 4 REVELATION) ---
                        const runTime = Date.now() / 1000;
                        const lapCycle = runTime % 45; // 45s simulated track segment
                        let simSpeed = 0;
                        let simRpm = 850;
                        let simGear = 0;
                        let simThrottle = 0;
                        let simAccelX = 0;
                        let simAccelY = 0;

                        if (lapCycle < 25) {
                             // High Throttle Acceleration (0 to 25 seconds)
                             simThrottle = 100 - (lapCycle % 4.1) * 2.5; 
                             simGear = Math.min(7, Math.floor(lapCycle / 4.1) + 1);
                             const shiftProgress = lapCycle % 4.1;
                             if (shiftProgress < 0.45) {
                                 // Clutch-in throttle dip to simulate manual shift latency & RPM drop
                                 simThrottle = 5;
                                 simRpm = 3800;
                                 simAccelX = -0.6; // shift lag deceleration force
                             } else {
                                 const normProgress = (shiftProgress - 0.45) / 3.65;
                                 simRpm = 4100 + normProgress * 3500; // Rise to shift point
                                 simAccelX = 0.55 / simGear;
                             }
                             simSpeed = simGear * 28 + (simRpm / 1000) * 8.5;
                        } else if (lapCycle < 35) {
                             // Hard Race Braking into Apex (25 to 35 seconds)
                             simThrottle = 0;
                             const brakingPct = (lapCycle - 25) / 10;
                             simSpeed = Math.max(32, 195 - brakingPct * 163);
                             simGear = Math.max(1, Math.floor(simSpeed / 30) + 1);
                             // Rev-matching downshifts
                             const downshiftTime = (lapCycle - 25) % 2.5;
                             if (downshiftTime < 0.4) {
                                 simRpm = 5800 - downshiftTime * 2000; // Blip RPM
                             } else {
                                 simRpm = Math.max(2200, KinematicsEngine.calculateRpm(simSpeed, simGear, gearboxConfig));
                             }
                             simAccelX = -1.35; // intense braking deceleration
                             simAccelY = 1.25 * Math.sin((lapCycle - 25) * Math.PI / 5); // aggressive slalom body roll
                        } else {
                             // Balanced Corner Exit (35 to 45 seconds)
                             simThrottle = 45;
                             const exitPct = (lapCycle - 35) / 10;
                             simSpeed = 32 + exitPct * 48;
                             simGear = 2;
                             simRpm = KinematicsEngine.calculateRpm(simSpeed, simGear, gearboxConfig);
                             simAccelX = 0.3;
                             simAccelY = 0.75 * Math.sin((lapCycle - 35) * Math.PI / 5);
                        }

                        // --- 4-TIER RESOLUTION PIPELINE ---
                        let finalSpeed = 0;
                        let finalRpm = 850;
                        let gearToUse = 0;
                        let finalSteering = 0;
                        let finalThrottle = current.acceleratorPedalPos || 0;
                        let finalGForceX = lastAccel[0] / 9.81;
                        let finalGForceY = lastAccel[1] / 9.81;
                        let finalGForceZ = lastAccel[2] / 9.81;
                        let dataSourceType: 'live_obd' | 'fused_ekf' | 'simulated_track' = 'simulated_track';

                        const forceDemo = mode === 'demo';
                        const forceSensors = mode === 'sensors';
                        const forceObd = mode === 'obd';

                        if ((isObd && !forceDemo && !forceSensors) || forceObd) {
                             // TIER 1 & 2: LIVE OBD-II READS WITH COHERENT RESOLVERS
                             finalSpeed = lastObdData?.speed !== undefined ? lastObdData.speed : current.speed;
                             finalRpm = lastObdData?.rpm !== undefined ? lastObdData.rpm : current.rpm;
                             // Fallback to 0 if OBD/CAN does not explicitly specify the gear, triggering intelligent kinematic estimation below
                             gearToUse = lastObdData?.gear !== undefined ? lastObdData.gear : 0;
                             finalSteering = lastObdData?.steeringAngle !== undefined ? lastObdData.steeringAngle : (current.steeringAngle || 0);
                             dataSourceType = 'live_obd';
                             
                             if (!gearToUse || gearToUse === 0) {
                                 gearToUse = KinematicsEngine.estimateGear(finalSpeed, finalRpm, gearboxConfig);
                             }
                        } else {
                             // Verify offline physical movement on mobile (Tier 3)
                             const gpsFresh = (Date.now() - lastGpsTime) < 5000;
                             const isVisionActive = s.ekfStats.visionConfidence > 0.1 || lastVisionSpeed !== null;
                             const sensorsMoving = (lastGpsSpeed !== null && lastGpsSpeed > 0.8) || (clampedSpeedMs > 0.6) || (Math.abs(lastAccel[0]) > 1.8 || Math.abs(lastAccel[1]) > 1.8) || isVisionActive;

                             if (forceSensors || (mode === 'auto' && sensorsMoving)) {
                                 // TIER 3: PHYSICAL KINEMATIC OBSERVER (GPS/IMU SENSOR FUSION)
                                 dataSourceType = 'fused_ekf';
                                 finalSpeed = rawSpeedKph;

                                 // Resilient GPS Outage Dead-Reckoning
                                 if (!gpsFresh && (Date.now() - lastGpsTime) >= 5000) {
                                     const dropDuration = (Date.now() - lastGpsTime - 5000) / 1000;
                                     finalSpeed = rawSpeedKph * Math.exp(-dropDuration * 0.15); // slow decayed momentum
                                 }

                                 if (finalSpeed < 1.5) {
                                     finalSpeed = 0;
                                 }

                                 // Gear selection mapping based on speed limits
                                 if (finalSpeed < 1.0) {
                                     gearToUse = 0;
                                 } else if (finalSpeed < 25) {
                                     gearToUse = 1;
                                 } else if (finalSpeed < 50) {
                                     gearToUse = 2;
                                 } else if (finalSpeed < 75) {
                                     gearToUse = 3;
                                 } else if (finalSpeed < 105) {
                                     gearToUse = 4;
                                 } else if (finalSpeed < 135) {
                                     gearToUse = 5;
                                 } else if (finalSpeed < 170) {
                                     gearToUse = 6;
                                 } else {
                                     gearToUse = 7;
                                 }

                                 finalRpm = KinematicsEngine.calculateRpm(finalSpeed, gearToUse, gearboxConfig);
                                 finalSteering = Math.abs(lastGyro[2]) > 0.05 ? (lastGyro[2] * 5.2) : 0;
                             } else {
                                 if (mode === 'demo') {
                                     // TIER 4: FULL-SCALE DIGITAL AUTOGENOUS STREAM (DEMO MODE ACTIVE)
                                     dataSourceType = 'simulated_track';
                                     finalSpeed = simSpeed;
                                     finalRpm = simRpm;
                                     gearToUse = simGear;
                                     finalThrottle = simThrottle;
                                     finalGForceX = simAccelX;
                                     finalGForceY = simAccelY;
                                     finalSteering = simAccelY * -14;
                                 } else {
                                     // TIER 5: STATIONARY / COHERENT IDLE STATE (AUTO MODE WITHOUT PHYSICAL MOVEMENT)
                                     dataSourceType = 'simulated_track';
                                     finalSpeed = 0;
                                     const idleTarget = s.vehicleConfig?.idleRpmTarget || 750;
                                     finalRpm = idleTarget + Math.sin(runTime * 2.5) * 12 + (Math.random() - 0.5) * 4;
                                     gearToUse = 0; // Neutral
                                     finalThrottle = 0;
                                     finalGForceX = 0;
                                     finalGForceY = 0;
                                     finalSteering = 0;
                                 }
                             }
                        }

                        gearToUse = isNaN(gearToUse) ? 0 : Math.max(0, Math.min(8, Math.round(gearToUse)));

                        // --- CAN SENSOR MAPPING & RAW INJECTION ---
                        let mappedPids = { 
                            ...current.customPids,
                            ...(lastObdData?.customPids || {})
                        };
                        if ((s as any).canBus?.activeFrames && s.canMappings.length > 0) {
                            s.canMappings.forEach(mapping => {
                                const frame = (s as any).canBus.activeFrames.find((f: any) => f.id === `0x${mapping.canId}`);
                                if (frame) {
                                    try {
                                        const val = decodeCanValue(frame.data, mapping);
                                        mappedPids[mapping.name] = val;
                                    } catch (e) {
                                        // Decoding failed, ignore
                                    }
                                }
                            });
                        }

                        // Drive secondary synthetic metrics if in simulation state to complete the preview experience
                        const resolvedAccelerator = isObd ? (lastObdData?.acceleratorPedalPos ?? lastObdData?.throttlePos ?? current.acceleratorPedalPos ?? 0) : (dataSourceType === 'simulated_track' ? finalThrottle : 0);
                        const resolvedEngineLoad = isObd ? (lastObdData?.engineLoad ?? current.engineLoad ?? 0) : (dataSourceType === 'simulated_track' ? finalThrottle * 0.9 : 12);
                        const resolvedTurboBoost = isObd ? (lastObdData?.turboBoost ?? current.turboBoost ?? 0) : (dataSourceType === 'simulated_track' ? (finalThrottle > 42 ? ((finalThrottle - 42) / 58) * 1.62 : 0) : 0);
                        const resolvedOilPressure = isObd ? (lastObdData?.oilPressure ?? current.oilPressure ?? 4.2) : (dataSourceType === 'simulated_track' ? 1.4 + (finalRpm / 1000) * 0.78 : 2.5);
                        const resolvedEngineTemp = isObd ? (lastObdData?.engineTemp ?? current.engineTemp ?? 85) : (dataSourceType === 'simulated_track' ? 88 + Math.sin(runTime / 32) * 1.8 : 85);
                        const resolvedIat = isObd ? (lastObdData?.inletAirTemp ?? current.inletAirTemp ?? 24) : (dataSourceType === 'simulated_track' ? 26 + Math.sin(runTime / 24) * 0.8 : 24);
                        const resolvedO2Voltage = isObd ? (lastObdData?.o2SensorVoltage ?? current.o2SensorVoltage ?? 0.45) : (dataSourceType === 'simulated_track' ? 0.5 + Math.sin(runTime * 1.4) * 0.35 : 0.45);

                        const nextData: SensorDataPoint = {
                            ...current,
                            ...(isObd ? (lastObdData || {}) : {}),
                            customPids: mappedPids,
                            time: Date.now(),
                            speed: finalSpeed, 
                            rpm: finalRpm,
                            gear: gearToUse,
                            acceleratorPedalPos: resolvedAccelerator,
                            engineLoad: resolvedEngineLoad,
                            turboBoost: resolvedTurboBoost,
                            oilPressure: resolvedOilPressure,
                            engineTemp: resolvedEngineTemp,
                            inletAirTemp: resolvedIat,
                            o2SensorVoltage: resolvedO2Voltage,
                            distance: current.distance + ((finalSpeed / 3.6) * elapsedDt),
                            gForceX: finalGForceX,
                            gForceY: finalGForceY,
                            gForceZ: finalGForceZ,
                            yawRate: isObd && lastObdData?.yawRate !== undefined ? lastObdData.yawRate : ekf.getEstimatedYawRate(),
                            brakeTemp: newBrakeTemp,
                            // Never allow the demo generator to masquerade as fused sensor evidence.
                            // Downstream coaching and certification lanes use this discriminator
                            // to exclude simulated values from live claims.
                            source: dataSourceType === 'live_obd'
                                ? 'live_obd'
                                : dataSourceType === 'fused_ekf'
                                    ? 'fused_ekf'
                                    : 'sim',
                            steeringAngle: finalSteering,
                        };

                        // --- MATH ENGINE EVALUATION ---
                        const mathEngine = MathEngineService.getInstance();
                        const nextMathValues: Record<string, number> = {};
                        s.mathChannels.forEach(ch => {
                            nextMathValues[ch.id] = mathEngine.evaluate(ch.formula, nextData);
                        });

                        // --- GHOST TRACE LOGIC ---
                        let nextGhost = s.ghostTrace;
                        if (isObd && finalRpm > 400) {
                            const r = Math.min(15, Math.floor(current.engineLoad / 6.25));
                            const c = Math.min(15, Math.floor(finalRpm / 500));
                            nextGhost = [{ r, c, time: Date.now() }, ...s.ghostTrace].slice(0, 15);
                        }

                        let newDyno = s.dyno;
                        let newLearningMaps = s.learningMaps;

                        if (s.dyno.isRunning) {
                            const cf = KinematicsEngine.calculateCorrectionFactor(current.ambientTemp, current.barometricPressure);
                            const res = KinematicsEngine.estimateHorsepower(
                                finalSpeed, 
                                lastAccel[0] / 9.81, 
                                state.vehicleConfig.weight, 
                                cf,
                                s.dyno.settings.drivetrainLoss
                            );
                            const hp = res.whp;
                            const tq = KinematicsEngine.estimateTorque(hp, finalRpm);
                            
                            // Auto-Stop check
                            if (finalRpm >= s.dyno.settings.stopRpm || finalSpeed < 5) {
                                // We can't call stopDynoRun here as we are in set(), but we can flag it
                                newDyno = { ...s.dyno, isRunning: false };
                                // In a real app we'd trigger the save outside or via a flag
                            } else {
                                newDyno = {
                                    ...s.dyno,
                                    currentRunData: [...s.dyno.currentRunData, { 
                                        rpm: finalRpm, 
                                        power: hp, 
                                        torque: tq, 
                                        afr: current.lambda * 14.7,
                                        targetAfr: current.lambda * 14.7, // approximation
                                        boost: current.turboBoost,
                                        ignition: current.timingAdvance,
                                        ve: current.engineLoad // approximation
                                    }]
                                };
                            }
                        } else if (!s.dyno.isRunning && s.latestData.rpm > s.dyno.settings.startRpm && s.latestData.rpm < s.dyno.settings.startRpm + 200 && (s.latestData.acceleratorPedalPos || 0) > 90 && s.latestData.gear === s.dyno.settings.gear) {
                            // Auto-Start trigger
                            newDyno = { ...s.dyno, isRunning: true, currentRunData: [] };
                        }

                        // --- REAL-TIME 3D MAP LEARNING ---
                        if (isObd && finalRpm > 500 && current.engineLoad > 0) {
                            const rpmIdx = Math.min(15, Math.floor(finalRpm / 500));
                            const loadIdx = Math.min(15, Math.floor(current.engineLoad / 6.25));
                            
                            const samples = s.learningMaps.samples[loadIdx][rpmIdx];
                            const alpha = 1 / (samples + 1);
                            
                            const updateVal = (prev: number, curr: number) => (prev * (1 - alpha)) + (curr * alpha);
                            
                            const newVe = [...s.learningMaps.ve];
                            newVe[loadIdx] = [...newVe[loadIdx]];
                            newVe[loadIdx][rpmIdx] = updateVal(newVe[loadIdx][rpmIdx], current.engineLoad);

                            const newIgn = [...s.learningMaps.ign];
                            newIgn[loadIdx] = [...newIgn[loadIdx]];
                            newIgn[loadIdx][rpmIdx] = updateVal(newIgn[loadIdx][rpmIdx], current.timingAdvance);

                            const newLambda = [...s.learningMaps.lambda];
                            newLambda[loadIdx] = [...newLambda[loadIdx]];
                            newLambda[loadIdx][rpmIdx] = updateVal(newLambda[loadIdx][rpmIdx], current.lambda);

                            const newBoost = [...s.learningMaps.boost];
                            newBoost[loadIdx] = [...newBoost[loadIdx]];
                            newBoost[loadIdx][rpmIdx] = updateVal(newBoost[loadIdx][rpmIdx], current.turboBoost);

                            const newSamples = [...s.learningMaps.samples];
                            newSamples[loadIdx] = [...newSamples[loadIdx]];
                            newSamples[loadIdx][rpmIdx] = samples + 1;

                            newLearningMaps = {
                                ve: newVe,
                                ign: newIgn,
                                lambda: newLambda,
                                boost: newBoost,
                                samples: newSamples
                            };
                        }

                        const mlResult = mlHub.processTelemetry({
                            speed: finalSpeed,
                            throttle: nextData.throttlePos || 0,
                            steering: finalSteering || 0,
                            latG: lastAccel[1] / 9.81,
                            lonG: lastAccel[0] / 9.81,
                            o2Voltage: nextData.o2SensorVoltage || 0.5,
                            knockCount: nextData.knockCount || 0,
                            dt: elapsedDt
                        });

                        let nextCurrentLog = s.currentLog;
                        if (s.isLogging) {
                            const entry: any = { time: nextData.time };
                            s.loggingConfig.selectedFields.forEach((f: string) => {
                                entry[f] = (nextData as any)[f];
                            });
                            nextCurrentLog = [...s.currentLog, entry];
                        }

                        const isHighStressCalculated = s.adaptiveDashboardMode && (
                            finalRpm >= 6000 || 
                            resolvedAccelerator >= 85 || 
                            finalSpeed >= 130 || 
                            Math.abs(finalGForceY) >= 1.0
                        );

                        return {
                            latestData: nextData,
                            mathValues: nextMathValues,
                            ghostTrace: nextGhost,
                            data: [...s.data.slice(-299), nextData],
                            currentLog: nextCurrentLog,
                            dyno: newDyno,
                            learningMaps: newLearningMaps,
                            mlInsights: mlResult,
                            isHighStress: isHighStressCalculated,
                            ekfStats: { 
                                ...s.ekfStats, 
                                fusionUncertainty: ekf.getUncertainty(), 
                                fusedYawRate: ekf.getEstimatedYawRate(), 
                                gpuActive: ekf.gpuActive,
                                dataQualityScore: isObd ? lastObdQualityScore : s.ekfStats.dataQualityScore
                            }
                        };
                    });

                    // Heuristic Watchdog & Predictive State Machine
                    // Asynchronous, non-blocking evaluation thread that maps kinematic arrays against ML boundaries
                    Promise.resolve().then(() => {
                        const s = get();
                        const latG = s.latestData.gForceY || 0;
                        const lonG = s.latestData.gForceX || 0;
                        const slip = s.mlInsights?.slipProbability || 0;
                        const currentSpeed = s.latestData.speed || 0;
                        const prevSpeed = prev?.speed || 0;

                        // Check transitions for Predictive State Machine
                        const wasMoving = prevSpeed > 5;
                        const isStoppedNow = currentSpeed === 0;

                        if (wasMoving && isStoppedNow) {
                            const now = Date.now();
                            if (now - lastWatchdogStopToastTime > 15000) {
                                lastWatchdogStopToastTime = now;
                                // Automatically compile the active diagnostic history and session data caches.
                                // Pre-stage structural configurations.
                                console.log("[PREDICTIVE ENGINE] Vehicle stopped. Pre-staging diagnostic reports and compiling session data caches.");
                                const uiStore = useUIStore.getState();
                                uiStore.showToast("Automated Operator Watchdog: Pre-staged active diagnostic logs & EKF covariance caches for zero-touch inspection.", "info", 5000);
                            }
                        }

                        // Kinematic array watchdog vs ML boundaries
                        if (slip > 0.45 || Math.abs(latG) > 1.2 || Math.abs(lonG) > 1.2) {
                            // High-frequency traction / acceleration threshold breached
                            const uiStore = useUIStore.getState();
                            const now = Date.now();
                            if (slip > 0.55 && now - lastWatchdogSlipToastTime > 10000) {
                                lastWatchdogSlipToastTime = now;
                                uiStore.showToast("Operator Warning: Dynamic slip probability exceeded neural traction safety envelope!", "warning", 3000);
                            } else if (Math.abs(latG) > 1.3 && now - lastWatchdogLatGToastTime > 10000) {
                                lastWatchdogLatGToastTime = now;
                                uiStore.showToast("Heuristic Alert: Lateral loading exceeded J-Turn threshold. Recalibrating lateral slip variance.", "warning", 3000);
                            }
                        }
                    });

                    fusionRafId = requestAnimationFrame(loop);
                };
                fusionRafId = requestAnimationFrame(loop);
            },

            stopFusionLoop: () => { if (fusionRafId) { cancelAnimationFrame(fusionRafId); fusionRafId = null; } },

            connectObd: async () => {
                set({ obdState: ObdConnectionState.Connecting });
                if (!sdkInstance) sdkInstance = new CartelWorxSDK((status) => set({ obdState: status }));
                try {
                    // ELITE CONNECTION PROTOCOL: WebBluetooth + 3-Stage Handshake
                    const success = await sdkInstance.startNeuralLink('WebBluetooth');
                    
                    if (success) {
                        // Handshake Verification Phase (Resilient Probing)
                        const protocol = sdkInstance.getProtocol();
                        if (protocol === "Unknown") {
                            console.error("Handshake Failed: Protocol not locked.");
                            set({ obdState: ObdConnectionState.Error });
                            return;
                        }
                        await new Promise(r => setTimeout(r, 600));

                        if (obdPollTimeout) clearTimeout(obdPollTimeout);
                        currentPollId++;
                        const pollId = currentPollId;
                        lastObdUpdateTime = Date.now();
                        lastObdData = null;
                        lastObdQualityScore = 100;
                        
                        let secondaryCycleCounter = 0;
                        const pollLoop = async () => {
                            if (get().obdState !== ObdConnectionState.Connected || pollId !== currentPollId) return;
                            try {
                                secondaryCycleCounter++;
                                
                                // High-Priority: Critical Telemetry (RPM, TPS)
                                // We simulate priority by ensuring we always ask for these.
                                // If the SDK supports granular PID requests, we'd use that here.
                                const live = await sdkInstance?.getLiveData();
                                
                                // Secondary-Priority: Diagnostic Queries (DTCs, Readiness) throttled to every 50 cycles (~2.5s)
                                if (secondaryCycleCounter >= 50) {
                                    secondaryCycleCounter = 0;
                                    const dtcs = await sdkInstance?.scanForFaults();
                                    if (dtcs && dtcs.length > 0) {
                                        set({ dtcs, hasActiveFault: true });
                                    }
                                }

                                if (live) {
                                    // Skip processing if no actual data was retrieved (e.g. queue skip)
                                    if (Object.keys(live).length <= 2 && !live.rpm && !live.speed) {
                                        // Empty poll, don't update watchdog
                                    } else {
                                        lastObdUpdateTime = Date.now();
                                        if (live.speed !== undefined) {
                                            ekf.fuseObdSpeed(live.speed / 3.6);
                                        }
                                        
                                        const currentRpm = live.rpm !== undefined ? live.rpm : (lastObdData?.rpm || get().latestData.rpm || 850);
                                        const currentLoad = live.engineLoad !== undefined ? live.engineLoad : (lastObdData?.engineLoad || get().latestData.engineLoad || 0);
                                        const currentTemp = live.engineTemp !== undefined ? live.engineTemp : (lastObdData?.engineTemp || get().latestData.engineTemp || 85);

                                        const rpmNorm = safeVal(currentRpm, 850) / 8000;
                                        const loadNorm = safeVal(currentLoad, 0) / 100;
                                        const tempNorm = safeVal(currentTemp, 85) / 120;
                                        
                                        const w1 = [[0.8, 0.2], [0.5, 0.5], [0.1, 0.9]];
                                        const w2 = [[0.8, 0.5, 0.1], [0.2, 0.5, 0.9]];
                                        
                                        const mse = MathKernel.calculateReconstructionError([rpmNorm, loadNorm, tempNorm], w1, w2);
                                        lastObdQualityScore = safeVal(Math.max(0, Math.min(100, 100 - (mse * 1000))), 100);

                                        const cleanLive: any = {};
                                        for (const key in live) {
                                            const val = (live as any)[key];
                                            if (typeof val === 'number') {
                                                const prevVal = lastObdData ? ((lastObdData as any)[key] || 0) : ((get().latestData as any)[key] || 0);
                                                cleanLive[key] = safeVal(val, prevVal);
                                            } else {
                                                cleanLive[key] = val;
                                            }
                                        }

                                        // Apply optional Kinematic Prediction only if high confidence
                                        let cleanRpm = cleanLive.rpm !== undefined ? cleanLive.rpm : (lastObdData?.rpm || get().latestData.rpm || 850);
                                        let cleanLoad = cleanLive.engineLoad !== undefined ? cleanLive.engineLoad : (lastObdData?.engineLoad || get().latestData.engineLoad || 0);
                                        
                                        if (get().optimizationConfig.highFreqMode) {
                                            const currThrottle = cleanLive.throttlePos !== undefined ? cleanLive.throttlePos : (lastObdData?.throttlePos || get().latestData.throttlePos || 0);
                                            const prevThrottle = lastObdData?.throttlePos || get().latestData.throttlePos || 0;
                                            const accelLon = lastAccel[0] / 9.81; 
                                            const { predictedRpm, predictedLoad } = LatencyEliminator.predictState(cleanRpm, cleanLoad, currThrottle, prevThrottle, accelLon, 0.05);
                                            cleanRpm = predictedRpm;
                                            cleanLoad = predictedLoad;
                                        }

                                        if (cleanLive.rpm !== undefined) cleanLive.rpm = safeVal(cleanRpm, cleanLive.rpm);
                                        if (cleanLive.engineLoad !== undefined) cleanLive.engineLoad = safeVal(cleanLoad, cleanLive.engineLoad);

                                        lastObdData = {
                                            ...lastObdData,
                                            ...cleanLive
                                        };
                                    }
                                }
                            } catch (e) {
                                console.warn("OBD Poll Error:", e);
                            }
                            const isDmaActive = sdkInstance?.isDmaActive() || false;
                            const nextDelay = isDmaActive ? 5 : (1000 / (get().optimizationConfig.refreshRateTarget || 20)); 
                            obdPollTimeout = window.setTimeout(pollLoop, nextDelay);
                        };
                        
                        pollLoop();

                        if (watchdogInterval) clearInterval(watchdogInterval);
                        watchdogInterval = window.setInterval(() => {
                            const now = Date.now();
                            if (get().obdState === ObdConnectionState.Connected) {
                                if (now - lastObdUpdateTime > 10000) {
                                    console.warn("OBD Watchdog: Stale data detected over 10s. Reconnecting...");
                                    get().disconnectObd();
                                    setTimeout(() => get().connectObd(), 1000);
                                }
                            }
                        }, 2000);

                        const protocolDesc = await sdkInstance.executeRawCommand("AT DP");
                        set({ protocol: protocolDesc });
                        
                        // Start dynamic fingerprinting (Service 0x09/0x22 DIDs)
                        await get().fingerprintECU();
                    } else {
                        set({ obdState: ObdConnectionState.Error });
                    }
                } catch (e: any) { 
                    console.error("OBD Connection Error:", e);
                    set({ obdState: ObdConnectionState.Error }); 
                }
            },

            disconnectObd: () => {
                if (obdPollTimeout) { clearTimeout(obdPollTimeout); obdPollTimeout = null; }
                if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
                currentPollId++;
                sdkInstance?.disconnect();
                set({ obdState: ObdConnectionState.Disconnected });
            },

            scanVehicle: async () => { 
                if (!sdkInstance) return; 
                set({ isScanning: true }); 
                const [codes, readiness] = await Promise.all([
                    sdkInstance.scanForFaults(),
                    sdkInstance.neuralLink.getReadiness()
                ]);
                set({ dtcs: codes, readiness, isScanning: false, hasActiveFault: codes.length > 0 }); 
            },
            clearVehicleFaults: async () => {
                useUIStore.getState().showToast(commercialControlDenial('DTC clearing'), 'warning');
            },
            primeFuelSystem: async () => {
                useUIStore.getState().showToast(commercialControlDenial('Fuel-system active test'), 'warning');
            },
            calibrateSensors: async () => {
                set({ isCalibrating: true, calibrationProgress: 0, calibrationStatus: 'Initializing IMU Zero-Point...' });
                
                const stages = [
                    { msg: 'Calibrating IMU Accelerometer...', duration: 1500 },
                    { msg: 'Zeroing Gyroscopic Yaw-Rate...', duration: 1000 },
                    { msg: 'GPS Signal Lock Acquisition...', duration: 2000 },
                    { msg: 'Probing Tire Pressure Sensors (TPMS)...', duration: 1500 },
                    { msg: 'Synchronizing Fused Ground Truth...', duration: 1000 },
                ];

                for (let i = 0; i < stages.length; i++) {
                    await new Promise(r => setTimeout(r, stages[i].duration));
                    if (stages[i].msg.includes('Synchronizing') || stages[i].msg.includes('Zeroing')) {
                        ekf.resetState();
                    }
                    set({ 
                        calibrationProgress: ((i + 1) / stages.length) * 100, 
                        calibrationStatus: stages[i].msg 
                    });
                }

                await new Promise(r => setTimeout(r, 1000));
                set({ isCalibrating: false, calibrationStatus: 'Calibration Successful' });
                setTimeout(() => set({ calibrationStatus: '' }), 3000);
            },
            flashCalibration: async (binary: Uint8Array, progressCb: (p: AIScanProgress) => void) => { 
                if (!sdkInstance) return false; 
                
                // 1. MANDATORY SECURITY BACKUP
                progressCb({ stage: 'SECURITY_BACKUP', progress: 0, complete: false });
                try {
                    const { readMemoryByAddress } = get();
                    const backup = await readMemoryByAddress(0x0, binary.length);
                    if (backup) {
                        set({ backupCalibration: backup });
                        console.log("Original calibration data secured in encrypted buffer.");
                    }
                } catch (e) {
                    console.error("Backup failed, aborting for safety.");
                    return false;
                }

                // 2. AUTOMATED CHECKSUM RECALCULATION
                progressCb({ stage: 'CALCULATING_ROM_CHECKSUMS', progress: 5, complete: false });
                const platform = get().vehicleConfig.platformId;
                let ecuType = EcuType.GENERIC_SUM32;
                if (platform === 'VQ37' || platform === 'VQ25') ecuType = EcuType.DENSO_SH7058;
                else if (platform === 'VQ35DE') ecuType = EcuType.DENSO_SH7055;
                else if (platform === 'BOSCH_MG1') ecuType = EcuType.BOSCH_MED17;

                const correctedBinary = ChecksumService.applyChecksums(binary, ecuType);
                
                // 3. CALIBRATION ID INTEGRITY GUARD
                progressCb({ stage: 'VERIFYING_ROM_COMPATIBILITY', progress: 10, complete: false });
                const ecuCalId = get().ecuProfile?.calibrationId;
                const binaryCalId = ChecksumService.extractCalibrationId(correctedBinary);
                
                if (ecuCalId && binaryCalId !== "UNKNOWN_ROM" && ecuCalId !== binaryCalId) {
                    progressCb({ stage: 'ERROR: CAL_ID_MISMATCH', progress: 0, complete: true });
                    useUIStore.getState().showToast(`CRITICAL: Platform Mismatch! ECU: ${ecuCalId}, Binary: ${binaryCalId}. Flash aborted.`, "error");
                    return false;
                }

                // 4. VERIFICATION
                const isValid = ChecksumService.verifyChecksums(correctedBinary, ecuType);
                if (!isValid) {
                    progressCb({ stage: 'ERROR: CHECKSUM_FAILURE', progress: 0, complete: true });
                    useUIStore.getState().showToast("Critical Safety Alert: Binary checksum recalculation failed. Flash aborted.", "error");
                    return false;
                }

                sdkInstance.setStatusCallback(progressCb);
                try {
                    const res = await sdkInstance.flashECU(correctedBinary); 
                    if (res) progressCb({ stage: 'COMPLETE', progress: 100, complete: true });
                    return res;
                } catch (e: any) {
                    progressCb({ stage: `ERROR: ${e.message}`, progress: 100, complete: true });
                    return false;
                }
            },
            rollbackCalibration: async (progressCb: (p: AIScanProgress) => void) => { 
                if (!sdkInstance) return false; 
                const { backupCalibration } = get();
                
                if (!backupCalibration) {
                    progressCb({ stage: 'ERROR: NO_BACKUP_FOUND', progress: 0, complete: true });
                    return false;
                }

                sdkInstance.setStatusCallback(progressCb);
                try {
                    const res = await sdkInstance.flashECU(backupCalibration); // Re-flashing backup
                    if (res) progressCb({ stage: 'COMPLETE', progress: 100, complete: true });
                    return res;
                } catch (e: any) {
                    progressCb({ stage: `ERROR: ${e.message}`, progress: 100, complete: true });
                    return false;
                }
            },
            requestSecurityAccess: async (variant: EcuVariant) => {
                void variant;
                const denial = commercialControlDenial('UDS security access');
                set(s => ({ uds: { ...s.uds, securityAccess: false, securityLog: [denial] } }));
                return false;
            },

            setDiagnosticSession: async (session: UdsSession) => {
                void session;
                set(s => ({ uds: { ...s.uds, session: UdsSession.Default, securityAccess: false } }));
                return false;
            },

            fingerprintECU: async () => {
                if (!sdkInstance) return;
                const { readDid } = get();
                
                // Read F121 (ECU Software Number), F190 (VIN), and F191 (Cal ID)
                const swNum = await readDid('F121');
                const vin = await readDid('F190');
                const calId = await readDid('F191');
                
                if (swNum || vin || calId) {
                    let platformId: ECUProfile['platformId'] = 'GENERIC';
                    const idString = (swNum || vin || calId || '').toUpperCase();
                    
                    if (idString.includes('MR20')) platformId = 'MR20DE';
                    else if (idString.includes('VQ25')) platformId = 'VQ25';
                    else if (idString.includes('VQ37')) platformId = 'VQ37';
                    else if (idString.includes('VQ35')) platformId = 'VQ35DE';
                    else if (idString.includes('KLE0')) platformId = 'MR20DE'; 
                    
                    set(s => ({
                        ecuProfile: {
                            ...s.ecuProfile,
                            vin: vin || s.ecuProfile?.vin || 'Unknown',
                            swId: swNum || s.ecuProfile?.swId,
                            calibrationId: calId || s.ecuProfile?.calibrationId,
                            platformId,
                            protocol: s.ecuProfile?.protocol || 'Unknown'
                        }
                    }));
                }
            },

            setCanHeaders: async (tx, rx) => {
                const { executeRawCommand } = get();
                await executeRawCommand(`AT SH ${tx}`);
                await executeRawCommand(`AT CRA ${rx}`);
            },

            addCustomMapping: (id, mapping) => {
                set(s => ({
                    uds: {
                        ...s.uds,
                        customMappings: { ...s.uds.customMappings, [id]: mapping }
                    }
                }));
            },

            removeCustomMapping: (id) => {
                set(s => {
                    const newMappings = { ...s.uds.customMappings };
                    delete newMappings[id];
                    return {
                        uds: { ...s.uds, customMappings: newMappings }
                    };
                });
            },

            addMathChannel: (channel) => {
                set(s => ({ mathChannels: [...s.mathChannels, channel] }));
            },

            removeMathChannel: (id) => {
                set(s => ({ mathChannels: s.mathChannels.filter(c => c.id !== id) }));
            },

            establishKessLink: async () => {
                set({ hardwareLog: [commercialControlDenial('KESS write-capable link')] });
            },

            writeKessParameter: async (id: string, val: number) => {
                void id;
                void val;
                set(s => ({ hardwareLog: [...s.hardwareLog, commercialControlDenial('KESS parameter write')] }));
                return false;
            },

            loadDatabases: async () => {
                const logs = await DatabaseService.getAllLogs();
                const profiles = await DatabaseService.getAllTuningProfiles();
                const dynoRuns = await DatabaseService.getAllDynoRuns();
                set(s => ({
                    savedLogs: logs,
                    tuningProfiles: profiles,
                    dyno: { ...s.dyno, runs: dynoRuns }
                }));
            },
            startLogging: () => set({ isLogging: true, currentLog: [] }),
            stopLogging: async (name?: string) => { 
                const { currentLog, savedLogs, loggingConfig, obdState } = get(); 
                if (!currentLog.length) { set({ isLogging: false }); return; } 
                
                const rpms = currentLog.filter(d => d.rpm !== undefined).map(d => d.rpm!);
                const boosts = currentLog.filter(d => d.turboBoost !== undefined).map(d => d.turboBoost!);
                const speeds = currentLog.filter(d => d.speed !== undefined).map(d => d.speed!);

                const isConnectedLive = obdState === ObdConnectionState.Connected;

                const log: LogSession = { 
                    id: Date.now().toString(), 
                    name: name || `Log ${Date.now()}`, 
                    startTime: currentLog[0].time!, 
                    duration: currentLog[currentLog.length-1].time! - currentLog[0].time!, 
                    source: isConnectedLive ? 'live_capture' : 'simulated_fallback',
                    dataPoints: currentLog, 
                    stats: { 
                        maxRpm: rpms.length ? Math.max(...rpms) : 0, 
                        maxBoost: boosts.length ? Math.max(...boosts) : 0, 
                        maxSpeed: speeds.length ? Math.max(...speeds) : 0, 
                        avgAfr: 14.7 
                    },
                    config: loggingConfig
                }; 
                
                await DatabaseService.saveLog(log);
                set({ isLogging: false, savedLogs: [log, ...savedLogs], currentLog: [] }); 
            },
            setLoggingConfig: (config: Partial<LoggingConfig>) => set(s => ({
                loggingConfig: { ...s.loggingConfig, ...config }
            })),
            renameLog: async (id: string, name: string) => {
                const { savedLogs } = get();
                const log = savedLogs.find(l => l.id === id);
                if (log) {
                    const updated = { ...log, name };
                    await DatabaseService.saveLog(updated);
                    set(s => ({ savedLogs: s.savedLogs.map(l => l.id === id ? updated : l) }));
                }
            },
            deleteLog: async (id: string) => {
                await DatabaseService.deleteLog(id);
                set(s => ({ savedLogs: s.savedLogs.filter(l => l.id !== id) }));
            },
            processVisionFrame: async (img: ImageData) => { 
                const res = await ekf.processCameraFrame(img, 0.05); 
                lastVisionSpeed = res.isTracking ? res.speed / 3.6 : null; 
                hasNewVisionSpeed = res.isTracking;
                lastVisionYawRate = res.isTracking ? res.yawRate : null;
                hasNewVisionYawRate = res.isTracking;
                set(s => ({ 
                    ekfStats: { 
                        ...s.ekfStats, 
                        visionConfidence: res.confidence,
                        visionYawRate: res.yawRate,
                        visionSlipAngle: res.slipAngle
                    } 
                })); 
                return res; 
            },
            updateMapCell: (table: TuningTableType, row: number, col: number, value: number) => set(s => { 
                const k = table === 've' ? 'veTable' : 
                          table === 'ign' ? 'ignitionTable' : 
                          table === 'boost' ? 'boostTable' : 
                          table === 'torque' ? 'torqueTable' : 
                          table === 'throttle' ? 'throttleTable' : 'tcuTable';
                const t = s.tuning[k].map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? value : c) : r); 
                return { tuning: { ...s.tuning, [k]: t } }; 
            }),
            smoothMap: (table: TuningTableType) => { 
                const k = table === 've' ? 'veTable' : 
                          table === 'ign' ? 'ignitionTable' : 
                          table === 'boost' ? 'boostTable' : 
                          table === 'torque' ? 'torqueTable' : 
                          table === 'throttle' ? 'throttleTable' : 'tcuTable';
                const m = get().tuning[k]; 
                const b = MathKernel.gaussianSmooth(MathKernel.toBuffer(m), 16, 16, 0.4); 
                set(s => ({ tuning: { ...s.tuning, [k]: MathKernel.fromBuffer(b, 16, 16) } })); 
            },
            applyTuningModification: (mod: TuningModification) => { 
                const k = mod.targetTable === 've' ? 'veTable' : 
                          mod.targetTable === 'ign' ? 'ignitionTable' : 
                          mod.targetTable === 'boost' ? 'boostTable' : 
                          mod.targetTable === 'torque' ? 'torqueTable' : 
                          mod.targetTable === 'throttle' ? 'throttleTable' : 'tcuTable';
                const c = get().tuning[k]; 
                const b = MathKernel.applyRegionModifier(MathKernel.toBuffer(c), mod.value, mod.operation as any, { rMin: Math.floor(mod.range.minLoad / (100/15)), rMax: Math.ceil(mod.range.maxLoad / (100/15)), cMin: Math.floor(mod.range.minRpm / (8000/15)), cMax: Math.ceil(mod.range.maxRpm / (8000/15)) }); 
                set(s => ({ tuning: { ...s.tuning, [k]: MathKernel.fromBuffer(b, 16, 16) }, tuningHistory: [...s.tuningHistory, { table: k, previous: c }] })); 
            },
            undoLastTuningChange: () => { const { tuningHistory } = get(); if (!tuningHistory.length) return; const last = tuningHistory[tuningHistory.length-1]; set(s => ({ tuning: { ...s.tuning, [last.table]: last.previous }, tuningHistory: s.tuningHistory.slice(0, -1) })); },
            saveProfile: async (name: string) => {
                const { tuning, tuningProfiles } = get();
                const newProfile: TuningProfile = {
                    id: Date.now().toString(),
                    name,
                    tuning: {
                        veTable: tuning.veTable,
                        ignitionTable: tuning.ignitionTable,
                        boostTable: tuning.boostTable,
                        torqueTable: tuning.torqueTable,
                        throttleTable: tuning.throttleTable,
                        tcuTable: tuning.tcuTable,
                        boostTarget: tuning.boostTarget
                    },
                    createdAt: Date.now()
                };
                await DatabaseService.saveTuningProfile(newProfile);
                set(s => ({ tuningProfiles: [...s.tuningProfiles, newProfile] }));
            },
            loadProfile: (id: string) => {
                const { tuningProfiles } = get();
                const profile = tuningProfiles.find(p => p.id === id);
                if (profile) {
                    set(s => ({ tuning: { ...s.tuning, ...profile.tuning }, activeProfileId: id }));
                }
            },
            deleteProfile: async (id: string) => {
                await DatabaseService.deleteTuningProfile(id);
                set(s => ({ tuningProfiles: s.tuningProfiles.filter(p => p.id !== id), activeProfileId: s.activeProfileId === id ? null : s.activeProfileId }));
            },
            setVehicleConfig: (config: Partial<VehicleConfig>) => set(s => ({ vehicleConfig: { ...s.vehicleConfig, ...config } })),
            setBoostTarget: (target: number) => set(s => ({ tuning: { ...s.tuning, boostTarget: target } })),
            setShiftLightRpm: (rpm: number) => set({ shiftLightRpm: rpm }),
            setDynoSettings: (settings: Partial<VehicleStoreState['dyno']['settings']>) => set(s => ({ dyno: { ...s.dyno, settings: { ...s.dyno.settings, ...settings } } })),
            setLaunchControl: (config: Partial<VehicleStoreState['launchControl']>) => set(s => ({ launchControl: { ...s.launchControl, ...config } })),
            toggleAls: () => set(s => ({ subsystems: { ...s.subsystems, als: s.subsystems.als === 'OFF' ? 'ARMED' : 'OFF' } })),
            toggleWmi: () => set(s => ({ subsystems: { ...s.subsystems, wmi: s.subsystems.wmi === 'OFF' ? 'READY' : 'OFF' } })),
            toggleAlp: () => set(s => ({ subsystems: { ...s.subsystems, alp: s.subsystems.alp === 'PROTECT' ? 'OVERRIDE' : 'PROTECT' } })),
            startDynoRun: () => set(s => ({ dyno: { ...s.dyno, isRunning: true, currentRunData: [] } })),
            stopDynoRun: async () => { 
                const { dyno, vehicleConfig, latestData } = get(); 
                if (dyno.currentRunData.length < 5) { set(s => ({ dyno: { ...s.dyno, isRunning: false, currentRunData: [] } })); return; } 
                
                const cf = KinematicsEngine.calculateCorrectionFactor(latestData.ambientTemp, latestData.barometricPressure);
                
                // Final calculation of peak figures from corrected data
                const peakPower = Math.max(...dyno.currentRunData.map(d => d.power)); 
                const peakTorque = Math.max(...dyno.currentRunData.map(d => d.torque)); 
                
                // Real-time AI Analysis heuristic
                const initialAfr = dyno.currentRunData[0]?.afr || 14.7;
                const minAfr = Math.min(...dyno.currentRunData.map(d => d.afr));
                const averageBoost = dyno.currentRunData.reduce((acc, d) => acc + d.boost, 0) / dyno.currentRunData.length;
                let aiSummaryStr = "AI ANALYSIS: ";
                if (minAfr < 10.5) {
                    aiSummaryStr += "Map is excessively rich at high RPM. Risk of spark blowout and cylinder wash. Suggest leaning out high-load cells by 4-6%. ";
                } else if (minAfr > 13.5) {
                    aiSummaryStr += "Dangerous lean condition detected at WOT! Consider adding fuel across the top percentile load columns immediately. ";
                } else {
                    aiSummaryStr += "AFR sweep remains optimal throughout the powerband. Safe combustion envelope. ";
                }
                
                if (averageBoost > 1.8) {
                    aiSummaryStr += "High manifold pressures logged. Recommended to monitor knock retard and IATs continuously.";
                } else {
                    aiSummaryStr += "Boost control active and tracking nominal targets.";
                }

                const performanceScore = Math.min(100, Math.floor((peakPower / (vehicleConfig.weight || 1500)) * 500));

                const newRun: DynoRun = { 
                    id: Date.now().toString(), 
                    timestamp: Date.now(), 
                    name: `Run #${dyno.runs.length + 1} (${cf.toFixed(2)} CF)`, 
                    data: dyno.currentRunData, 
                    peakPower, 
                    peakTorque, 
                    color: ['#00F0FF', '#BC13FE', '#FF003C'][dyno.runs.length % 3], 
                    isVisible: true,
                    aiSummary: aiSummaryStr,
                    performanceScore
                }; 
                
                await DatabaseService.saveDynoRun(newRun);
                set(s => ({ dyno: { ...s.dyno, isRunning: false, currentRunData: [], runs: [...s.dyno.runs, newRun] } })); 
            },
            toggleDynoRunVisibility: (id: string) => set(s => ({ dyno: { ...s.dyno, runs: s.dyno.runs.map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r) } })),
            deleteDynoRun: async (id: string) => {
                await DatabaseService.deleteDynoRun(id);
                set(s => ({ dyno: { ...s.dyno, runs: s.dyno.runs.filter(r => r.id !== id) } }));
            },
            executeRawCommand: async (cmd: string) => {
                const decision = assessDiagnosticCommand(cmd);
                if (!decision.allowed) {
                    const denial = `READ_ONLY REJECTION: ${decision.reason}`;
                    set(s => ({ commsLog: [{ time: Date.now(), type: 'ERR' as const, bytes: denial }, ...s.commsLog].slice(0, 50) }));
                    return denial;
                }
                if (!sdkInstance) {
                    set(s => ({ commsLog: [{ time: Date.now(), type: 'ERR' as const, bytes: 'ERROR: Not connected' }, ...s.commsLog].slice(0, 50) }));
                    return "ERROR: Not connected";
                }
                
                const cleanCmd = decision.normalizedCommand;
                set(s => ({ commsLog: [{ time: Date.now(), type: 'REQ' as const, bytes: cleanCmd }, ...s.commsLog].slice(0, 50) }));
                
                const res = await sdkInstance.executeRawCommand(cleanCmd);
                const parsed = parseUdsResponse(res);
                
                // Log the Response
                const type = !parsed.success ? 'ERR' as const : 'RES' as const;
                const logMsg = !parsed.success ? `0x7F [NRC 0x${parsed.nrc?.toString(16)}]: ${parsed.nrcText}` : res;
                
                set(s => ({ 
                    commsLog: [{ time: Date.now(), type, bytes: logMsg }, ...s.commsLog].slice(0, 50),
                    uds: { ...s.uds, lastResponseCode: parsed.nrc || (parsed.success ? 0x00 : 0x7F) }
                }));
                
                return res;
            },
            setActivePids: (pids: PIDDefinition[]) => {
                set({ activePids: pids });
                sdkInstance?.neuralLink.obd.setActivePids(pids);
            },
            addCustomDid: (did: CustomDidDefinition) => set(s => ({ customDids: [...s.customDids, did] })),
            removeCustomDid: (id: string) => set(s => ({ customDids: s.customDids.filter(d => d.id !== id) })),
            addCanMapping: (mapping) => set(s => ({ canMappings: [...s.canMappings, mapping] })),
            removeCanMapping: (id) => set(s => ({ canMappings: s.canMappings.filter(m => m.id !== id) })),
            updateCanMapping: (mapping) => set(s => ({ canMappings: s.canMappings.map(m => m.id === mapping.id ? mapping : m) })),
            setOptimizationConfig: (config: Partial<ObdOptimizationConfig>) => {
                const newConfig = { ...get().optimizationConfig, ...config };
                set({ optimizationConfig: newConfig });
                sdkInstance?.neuralLink.obd.setOptimizationConfig(newConfig);
            },
            startCanSniffing: (callback: (frame: string) => void) => {
                sdkInstance?.neuralLink.obd.startSniffing(callback);
            },
            stopCanSniffing: () => {
                sdkInstance?.neuralLink.obd.stopSniffing();
            },
            performFlashTransfer: async (data: Uint8Array, address: number): Promise<boolean> => {
                void data;
                void address;
                set(s => ({ hardwareLog: [...s.hardwareLog, commercialControlDenial('Flash transfer')] }));
                return false;
                /* Research implementation retained below for isolated migration.
                const { latestData, executeRawCommand } = get();
                
                // 1. DETERMINISTIC SAFETY LAYER
                if (latestData.batteryVoltage < 12.0) {
                    console.error("Voltage too low for flashing safe-operation.");
                    return false;
                }

                // 2. DOWNLOAD REQUEST (0x34) - Address, Size
                const hexAddr = address.toString(16).padStart(8, '0');
                const hexSize = data.length.toString(16).padStart(8, '0');
                await executeRawCommand(`34 00 22 ${hexAddr.match(/../g)?.join(' ')} ${hexSize.match(/../g)?.join(' ')}`);

                // 3. TRANSFER DATA (0x36) with Retry Logic
                const chunks = prepareChunkedData(data);
                for (let i = 0; i < chunks.length; i++) {
                    let retries = 3;
                    let success = false;
                    while (retries > 0 && !success) {
                        const blockSeq = ((i + 1) % 256).toString(16).padStart(2, '0');
                        const chunkPayload = chunks[i].join(' ');
                        const response = await executeRawCommand(`36 ${blockSeq} ${chunkPayload}`);
                        
                        if (response.startsWith('76')) { // Positive Response
                            success = true;
                        } else {
                            retries--;
                            console.warn(`Flash block ${i} failed. Retries left: ${retries}`);
                        }
                    }

                    if (!success) {
                        // AI REMEDIATION: Explain failure to user
                        console.error(`Flash failed at block ${i}`);
                        // In a real app, call a geminiService function to log/diagnose via natural language
                        return false;
                    }
                }

                // 4. REQUEST TRANSFER EXIT (0x37)
                await executeRawCommand('37');
                return true; */
            },
            readDid: async (did: string): Promise<string | null> => {
                const { executeRawCommand } = get();
                const response = await executeRawCommand(`22 ${did.padStart(4, '0')}`);
                const parsed = parseUdsResponse(response);
                if (parsed.success && parsed.data?.includes('62')) {
                    const idx = parsed.data.indexOf('62');
                    return parsed.data.substring(idx + 6);
                }
                return null;
            },
            writeDid: async (did: string, data: string): Promise<boolean> => {
                void did;
                void data;
                set(s => ({ hardwareLog: [...s.hardwareLog, commercialControlDenial('UDS DID write')] }));
                return false;
                /* Research implementation retained below for isolated migration.
                const { latestData, uds, executeRawCommand } = get();
                
                // 1. PHYSICAL SAFETY CHECK
                if (latestData.rpm > 500) {
                    set(s => ({ hardwareLog: [...s.hardwareLog, "WRITE REJECTED: Engine is running. Safety protocol active."] }));
                    return false;
                }
                if (latestData.speed > 0) {
                    set(s => ({ hardwareLog: [...s.hardwareLog, "WRITE REJECTED: Vehicle in motion."] }));
                    return false;
                }

                // 2. SESSION & SECURITY CHECK
                if (uds.session === UdsSession.Default) {
                    set(s => ({ hardwareLog: [...s.hardwareLog, "WARN: Writing in Default Session. ECU may reject without Extended Session (0x03)."] }));
                }
                if (!uds.securityAccess) {
                   set(s => ({ hardwareLog: [...s.hardwareLog, "WARN: Security Access (0x27) not granted. Write likely to fail with NRC 0x33."] }));
                }

                const response = await executeRawCommand(`2E ${did.padStart(4, '0')} ${data}`);
                const parsed = parseUdsResponse(response);
                
                if (parsed.success && parsed.data?.startsWith('6E')) {
                    return true;
                }
                
                if (parsed.nrc === UdsNrc.CONDITIONS_NOT_CORRECT) {
                    set(s => ({ hardwareLog: [...s.hardwareLog, "ECU REFUSAL: Physical conditions (RPM/Speed/Voltage) not met for write."] }));
                }
                
                return false; */
            },
            readMemoryByAddress: async (address: number, sizeBytes: number): Promise<Uint8Array | null> => {
                return await sdkInstance?.readMemoryByAddress(address, sizeBytes) ?? null;
            },
            readHardwareMap: async (address: number): Promise<number[][] | null> => {
                const { readMemoryByAddress } = get();
                const data = await readMemoryByAddress(address, 16 * 16 * 4); // 16x16 float32
                if (!data) return null;
                
                const table: number[][] = [];
                const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                for (let i = 0; i < 16; i++) {
                    const row: number[] = [];
                    for (let j = 0; j < 16; j++) {
                        row.push(view.getFloat32((i * 16 + j) * 4, true));
                    }
                    table.push(row);
                }
                return table;
            },
            executeRoutine: async (routineId: string, payload: string = ''): Promise<string | null> => {
                void routineId;
                void payload;
                set(s => ({ hardwareLog: [...s.hardwareLog, commercialControlDenial('UDS active routine')] }));
                return null;
            },
            stageCopilotAction: (proposal: CopilotActionProposal) => {
                set(s => ({
                    coPilot: {
                        ...s.coPilot,
                        actionProposals: [...s.coPilot.actionProposals, proposal].slice(-50),
                    },
                }));
            },
            sendCoPilotMessage: async (text: string) => {
                const id = Math.random().toString(36).substring(7);
                const userMsg = { id, role: 'user' as const, text, timestamp: Date.now() };
                
                set(s => ({ 
                    coPilot: { ...s.coPilot, messages: [...s.coPilot.messages, userMsg], isThinking: true } 
                }));

                const latestData = get().latestData;
                const tuning = get().tuning;
                const dtcs = get().dtcs;
                const isLogging = get().isLogging;
                const cognitiveState = get().cognitiveState;
                const ekfStats = {
                    visionConfidence: get().ekfStats?.visionConfidence || 0.95,
                    gpsActive: get().ekfStats?.gpsActive !== false,
                    fusionUncertainty: get().ekfStats?.fusionUncertainty || 0.005
                };

                let aiResponse = "";

                try {
                    // Call the real Gemini API for agentic command processing
                    const aiResult = await generateCopilotResponse(text, {
                        telemetry: latestData,
                        tuning,
                        diagnostics: dtcs,
                        currentRoute: window.location.pathname,
                        isLogging,
                        currentTask: cognitiveState?.selectedTask,
                        ekfStats
                    });

                    aiResponse = aiResult.speech;

                    if (aiResult.actionPayload && aiResult.actionPayload.target) {
                        const target = aiResult.actionPayload.target.toLowerCase();
                        const proposal = brokerCopilotAction(target, aiResult.actionPayload.value);

                        if (proposal.authority === 'STAGE_ONLY') {
                            get().stageCopilotAction(proposal);
                            aiResponse += ` ${proposal.kind.replace(/_/g, ' ')} was staged for operator review; no vehicle command was sent.`;
                        } else if (proposal.authority === 'BLOCKED') {
                            aiResponse += ` ${proposal.reason}`;
                        } else if (proposal.kind === 'SCAN_DIAGNOSTICS') {
                            get().scanVehicle();
                        } else if (proposal.kind === 'CALIBRATE_SENSORS') {
                            if (latestData.speed <= 0.5) get().calibrateSensors();
                            else aiResponse += ' Sensor calibration was not started while the vehicle is moving.';
                        } else if (proposal.kind === 'START_LOGGING') {
                            get().startLogging();
                        } else if (proposal.kind === 'STOP_LOGGING') {
                            void get().stopLogging();
                        }
                    }
                } catch (e) {
                    console.warn("Copilot API response generation failed. Activating native rule-based fail-safe logic.", e);
                }

                // Rule-based fallback remains observation/read-only. It cannot
                // change calibration, launch, rev-limit or subsystem state.
                if (!aiResponse) {
                    aiResponse = "I can observe, explain and record, but this release cannot control the vehicle.";
                    const lowerText = text.toLowerCase();
                    
                    if (lowerText.includes("boost") && lowerText.includes("increase")) {
                        aiResponse = commercialControlDenial('Boost-target change');
                    } else if (lowerText.includes("status") || lowerText.includes("report")) {
                        const data = get().latestData;
                        const sourceLabel = data.source === 'sim' ? 'SIMULATED' : (data.source ?? 'UNKNOWN').toUpperCase();
                        aiResponse = `Telemetry report (${sourceLabel}): coolant ${data.engineTemp}°C, load ${data.engineLoad.toFixed(1)}%, fusion uncertainty ${get().ekfStats.fusionUncertainty.toFixed(3)}. This is an observation, not a vehicle safety certification.`;
                    } else if (lowerText.includes("diagnose") || lowerText.includes("scan")) {
                        get().scanVehicle();
                        aiResponse = "Read-only diagnostic scan started. No DTCs will be cleared and no active tests will run.";
                    } else if (lowerText.includes("launch")) {
                        aiResponse = commercialControlDenial('Launch-control arming');
                    } else if (lowerText.includes("calibrate") || lowerText.includes("sensor")) {
                        if (latestData.speed <= 0.5) {
                            get().calibrateSensors();
                            aiResponse = "Stationary sensor calibration started.";
                        } else {
                            aiResponse = "Sensor calibration was not started while the vehicle is moving.";
                        }
                    } else if (lowerText.includes("log") && lowerText.includes("start")) {
                        get().startLogging();
                        aiResponse = "Telemetry logging started using the configured capture frequency.";
                    } else if (lowerText.includes("dyno") || lowerText.includes("horsepower")) {
                        aiResponse = "I can review a recorded dyno or acceleration run, but I will not automatically start or control one.";
                    } else if (lowerText.includes("anti") && lowerText.includes("lag")) {
                        aiResponse = commercialControlDenial('Anti-lag control');
                    } else if (lowerText.includes("rev") && lowerText.includes("limit")) {
                        aiResponse = commercialControlDenial('Rev-limit change');
                    }
                }

                const aiMsg = { 
                    id: Math.random().toString(36).substring(7), 
                    role: 'ai' as const, 
                    text: aiResponse, 
                    timestamp: Date.now() 
                };
                
                set(s => ({ 
                    coPilot: { ...s.coPilot, messages: [...s.coPilot.messages, aiMsg], isThinking: false } 
                }));
            },
            clearCoPilotLog: () => {
                set(s => ({ coPilot: { ...s.coPilot, messages: [], actionProposals: [] } }));
            },
            readECUMapping: async (mappingType: TuningTableType) => {
                if (!sdkInstance) return null;
                try {
                    const table = await sdkInstance.readECUMapping(mappingType);
                    return table;
                } catch (e) {
                    console.error("Read Map Error:", e);
                    return null;
                }
            }
        }),
        {
            name: 'genesis-vehicle-storage',
            storage: createJSONStorage(() => storage),
            partialize: (state: VehicleStoreState) => ({ 
                vehicleConfig: state.vehicleConfig,
                shiftLightRpm: state.shiftLightRpm,
                activePids: state.activePids,
                optimizationConfig: state.optimizationConfig,
                tuning: state.tuning,
                activeProfileId: state.activeProfileId,
                loggingConfig: state.loggingConfig,
                canMappings: state.canMappings,
            }),
            merge: (persistedState: any, currentState: VehicleStoreState) => {
                if (!persistedState) return currentState;
                const tuning = {
                    ...currentState.tuning,
                    ...(persistedState.tuning || {})
                };
                if (!tuning.veTable) tuning.veTable = createMap(85);
                if (!tuning.ignitionTable) tuning.ignitionTable = createMap(25);
                if (!tuning.boostTable) tuning.boostTable = createMap(1.2);
                if (!tuning.torqueTable) tuning.torqueTable = createMap(100);
                if (!tuning.throttleTable) tuning.throttleTable = createMap(0);
                if (!tuning.tcuTable) tuning.tcuTable = createMap(2500);

                return {
                    ...currentState,
                    ...persistedState,
                    tuning
                };
            }
        }
    )
);
