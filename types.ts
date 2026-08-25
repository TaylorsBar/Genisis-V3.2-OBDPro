export interface SensorDataPoint {
  time: number;
  rpm: number;
  speed: number;
  gear: number;
  fuelUsed: number;
  inletAirTemp: number;
  batteryVoltage: number;
  engineTemp: number;
  fuelTemp: number;
  turboBoost: number;
  fuelPressure: number;
  oilPressure: number;
  transmissionTemp?: number;
  brakeTemp?: number;
  tireGrip?: number;
  shortTermFuelTrim: number;
  longTermFuelTrim: number;
  o2SensorVoltage: number;
  engineLoad: number;
  distance: number;
  gForceX: number;
  gForceY: number;
  gForceZ: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  slope?: number;
  source?: 'sim' | 'live_obd' | 'gps_fallback' | 'fused_ekf' | 'dma_engine';
  maf: number;
  timingAdvance: number;
  throttlePos: number;
  fuelLevel: number;
  barometricPressure: number;
  ambientTemp: number;
  fuelRailPressure: number;
  lambda: number;
  wheelSpeedFL: number;
  wheelSpeedFR: number;
  wheelSpeedRL: number;
  wheelSpeedRR: number;
  knockLevel: number;
  knockRetard: number;
  knockCount: number;
  power?: number;
  // Comprehensive Engine & ECU
  vvtIntakeAngle?: number;
  vvtExhaustAngle?: number;
  injectorPulseWidth?: number;
  wastegateDutyCycle?: number;
  fuelPumpDutyCycle?: number;
  acceleratorPedalPos?: number;
  targetIdleRpm?: number;
  // Drivetrain & Chassis
  torqueConverterSlip?: number;
  linePressure?: number;
  awdTorqueSplit?: number;
  steeringAngle?: number;
  yawRate?: number;
  // Dynamic PIDs
  customPids?: Record<string, number>;
  // VQ37VHR Specific
  vvelPosition?: number;
  vvelTarget?: number;
  mafB1?: number;
  mafB2?: number;
  throttlePosB1?: number;
  throttlePosB2?: number;
  ignTimingB1?: number;
  ignTimingB2?: number;
  knockSensor1?: number;
  knockSensor2?: number;
  engineOilTemp?: number;
  transFluidTemp?: number;
  afSensor1B1?: number;
  afSensor1B2?: number;
}

export interface TuningProfile {
    id: string;
    name: string;
    tuning: {
        veTable: number[][];
        ignitionTable: number[][];
        boostTable: number[][];
        torqueTable: number[][];
        throttleTable: number[][];
        tcuTable: number[][];
        boostTarget: number;
    };
    createdAt: number;
}

export enum ObdConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Initializing = 'Initializing',
  Connected = 'Connected',
  Error = 'Error',
  HardwareHandshake = 'HardwareHandshake',
  BypassingFirmware = 'BypassingFirmware'
}

export enum HardwareProtocol {
  StandardObd = 'StandardObd',
  KLine_Kess = 'KLine_Kess',
  CAN_Kess = 'CAN_Kess',
  J2534_PassThru = 'J2534_PassThru'
}

export interface HardwareLinkStatus {
  deviceId: string | null;
  firmwareVersion: string | null;
  protocol: HardwareProtocol;
  isClone: boolean;
  handshakeComplete: boolean;
}

export interface PIDDefinition {
  id: string;
  name: string;
  description: string;
  mode: string;
  pid: string;
  bytes: number;
  formula: (bytes: number[]) => number;
  unit: string;
  category: 'Engine' | 'Fuel' | 'Air' | 'Performance' | 'Other' | 'Custom';
}

export interface CustomDidDefinition {
    id: string;
    did: string; // 4 digit hex string
    name: string;
    description: string;
    bytes: number;
    unit: string;
    scaling: number;
    offset: number;
    signed: boolean;
}

export interface CanMapping {
    id: string;
    canId: string; // Hex string e.g. "1A0"
    name: string;
    unit: string;
    startBit: number;
    bitLength: number;
    byteOrder: 'big' | 'little';
    isSigned: boolean;
    scaling: number;
    offset: number;
}

// --- TIER 1 DMA TYPES ---
export enum AddrMode {
    PHYSICAL_PID = 0,
    DIRECT_MEMORY_16 = 16,
    DIRECT_MEMORY_24 = 24,
    DIRECT_MEMORY_32 = 32
}

export interface MemoryParam {
    id: string;
    address: number;
    sizeBytes: number;
    isSigned: boolean;
    scaling: number;
    offset: number;
    name: string;
    units: string;
}

export type ValidationStatus = 
    | 'bench_validated'
    | 'derived_from_public_service_data'
    | 'community_submitted_unverified';

export interface EcuVariant {
    osId: string;
    ecuType: string;
    securityAlgoId: number;
    validationStatus: ValidationStatus;
    memoryMap: Record<string, MemoryParam>;
}

export enum AlertLevel {
  Info = 'Info',
  Warning = 'Warning',
  Critical = 'Critical'
}

export interface DiagnosticCode {
    code: string;
    description?: string;
    status: 'Confirmed' | 'Pending' | 'Permanent';
    timestamp: number;
    freezeFrame?: Partial<SensorDataPoint>;
}

export interface TuningGoal {
    userIntent: string;
    platformId?: 'GENERIC' | 'MR20DE' | 'HR16DE' | 'K9K' | 'R9M' | 'M9R' | 'HRA2DDT' | 'MR16DDT' | 'KR15DDT' | 'HR13DDT' | 'VQ37' | 'VQ25' | 'BARRA' | 'BOSCH_MG1';
    powerIncreaseTarget: number;
    safetyMarginLevel: number;
    prioritizeEconomy: boolean;
    fuelType: '93_OCT' | 'E85' | 'DIESEL'; 
    targetTable?: TuningTableType;
    isFactoryBasemapRequest?: boolean;
}

export interface GeneratedMapResult {
    modifiedMapValues: number[][];
    predictedPowerGain: number;
    predictedSafetyScore: number;
    modificationsLog: string[];
}

export type TuningTableType = 've' | 'ign' | 'boost' | 'torque' | 'throttle' | 'tcu' | 'launch';
export type TuningOperation = 'add' | 'multiply' | 'set' | 'smooth' | 'linear_interp';

export interface TuningModification {
    targetTable: TuningTableType;
    operation: TuningOperation;
    range: {
        minRpm: number;
        maxRpm: number;
        minLoad: number;
        maxLoad: number;
    };
    value: number;
    reasoning: string;
    thoughtProcess?: string;
    riskAssessment?: string;
    outcomePrediction?: string;
}

export interface TimelineEvent {
    id: string;
    level: AlertLevel;
    title: string;
    timeframe: string;
    details: any;
}

export interface CopilotResponse {
    speech: string;
    intent: 'NAVIGATE' | 'UI_CONTROL' | 'TUNING_ACTION' | 'SYSTEM_ACTION' | 'ANALYSIS' | 'GENERAL';
    actionPayload?: {
        target: string;
        value?: number | string;
        parameters?: any;
    };
}

export interface AIScanProgress {
    stage: string;
    progress: number;
    complete: boolean;
}

export interface ActiveTest {
    id: string;
    name: string;
    description: string;
    command: string;
    resetCommand?: string;
    safetyInterlocks: {
        maxRpm?: number;
        minTemp?: number;
        engineOff?: boolean;
        vehicleStopped?: boolean;
    }
}

// --- SUBSYSTEM TYPES ---
export type AlsState = 'OFF' | 'ARMED' | 'ACTIVE';
export type WmiState = 'OFF' | 'READY' | 'LOW' | 'SPRAYING';
export type AlpState = 'PROTECT' | 'OVERRIDE';

export interface SubsystemStatus {
    als: AlsState;
    wmi: WmiState;
    alp: AlpState;
}

/**
 * Diagnostic alert for the Alerts component.
 */
export interface DiagnosticAlert {
    id: string;
    level: AlertLevel;
    component: string;
    message: string;
    timestamp: string;
    isFaultRelated?: boolean;
}

/**
 * Message structure for diagnostic chat.
 */
export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

/**
 * Maintenance record for the service logbook.
 */
export interface MaintenanceRecord {
    id: string;
    date: string;
    service: string;
    notes: string;
    verified: boolean;
    isAiRecommendation: boolean;
}

export interface PlatformConfig {
    displacement: number;
    cylinders: number;
    aspiration: 'NA' | 'Turbo';
    fuelType: 'PETROL' | 'DIESEL';
    maxEgt: number;
    baseOctane: number;
    vvtMax: number;
    mbtBase: number;
    maxRpm: number;
}

/**
 * Engine configuration for AI tuning context.
 */
export interface VehicleConfig {
    displacement: number;
    cylinders: number;
    aspiration: 'NA' | 'Turbo' | 'Supercharged';
    fuelType: string;
    injectors: number;
    injectorSizeCc: number;
    primePulseWidthMs: number;
    maxRpm: number;
    softCutRpm: number;
    idleRpmTarget?: number;
    weight: number;
    vin?: string;
    platformId?: string;
    gearRatios?: number[];
    finalDrive?: number;
    tireCircumference?: number;
}

export interface LaunchControlSuite {
    enabled: boolean;
    launchRpm: number;
    exitSpeed: number;
    activationMethod: 'NEUTRAL' | 'CLUTCH_SWITCH' | 'SPEED_BASED' | 'BRAKE_HOLD';
    strategy: 'IGNITION_CUT' | 'FUEL_CUT' | 'HYBRID';
    hardLimit: boolean;
    retardDeg: number;
    flameOn: boolean;
    antiLagEnabled: boolean;
    stage2BoostTarget: number;
    isStage2Active: boolean;
}

/**
 * Event types for the security audit log.
 */
export enum AuditEvent {
    AiAnalysis = 'AI_ANALYSIS',
    Login = 'LOGIN',
    TuningChange = 'TUNING_CHANGE',
    DiagnosticQuery = 'DIAGNOSTIC_QUERY',
    DataSync = 'DATA_SYNC'
}

/**
 * Security audit log entry.
 */
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    event: AuditEvent;
    description: string;
    ipAddress: string;
    status: 'Success' | 'Failure';
}

/**
 * Event types for Hedera DLT logging.
 */
export enum HederaEventType {
    Maintenance = 'MAINTENANCE',
    Tuning = 'TUNING',
    Diagnostic = 'DIAGNOSTIC',
    Scrutineering = 'SCRUTINEERING'
}

/**
 * Hedera DLT transaction record.
 */
export interface HederaRecord {
    id: string;
    timestamp: string;
    eventType: HederaEventType;
    vin: string;
    summary: string;
    hederaTxId: string;
    dataHash: string;
}

/**
 * Lap time data for circuit racing.
 */
export interface LapTime {
    lap: number;
    time: number;
    split1?: number;
    split2?: number;
}

/**
 * Launch state for drag racing sequence.
 */
export enum LaunchState {
    Idle = 'Idle',
    Staging = 'Staging',
    Go = 'Go',
    FalseStart = 'FalseStart'
}

/**
 * Drag strip sequence states.
 */
export enum DragStripState {
    Idle = 'Idle',
    PreStage = 'PreStage',
    Stage = 'Stage',
    Amber1 = 'Amber1',
    Amber2 = 'Amber2',
    Amber3 = 'Amber3',
    Green = 'Green',
    RedLight = 'RedLight',
    Running = 'Running',
    Finished = 'Finished'
}

/**
 * Drag racing performance statistics.
 */
export interface DragStats {
    reactionTime: number | null;
    sixtyFootTime: number | null;
    threeThirtyTime: number | null;
    eighthMileTime: number | null;
    eighthMileSpeed: number | null;
    oneThousandTime: number | null;
    quarterMileTime: number | null;
    quarterMileSpeed: number | null;
    zeroToSixtyTime: number | null;
    zeroToHundredTime: number | null;
    densityAltitude: number;
    slope: number;
    valid: boolean;
}

/**
 * Race session container for circuit or drag data.
 */
export interface RaceSession {
    mode: 'DRAG' | 'CIRCUIT' | 'BENCHMARK';
    isActive: boolean;
    dragState: DragStripState;
    launchState: LaunchState;
    startTime: number | null;
    greenLightTime: number | null;
    elapsedTime: number;
    data: SensorDataPoint[];
    lapTimes: LapTime[];
    dragStats: DragStats;
    currentDelta: number;
    aiInsights: string[];
    bestLapData: SensorDataPoint[];
    currentSplit1?: number;
    currentSplit2?: number;
}

/**
 * Emissions monitors readiness status.
 */
export interface EmissionsReadiness {
    misfire: boolean;
    fuelSystem: boolean;
    components: boolean;
    catalyst: boolean;
    evap: boolean;
    o2Sensor: boolean;
    egr: boolean;
}

/**
 * Single data point from a dyno run.
 */
export interface DynoPoint {
    rpm: number;
    torque: number;
    power: number;
    afr: number;
    targetAfr: number;
    boost: number;
    ignition: number;
    ve: number;
}

/**
 * Historical dyno run record.
 */
export interface DynoRun {
    id: string;
    timestamp: number;
    name: string;
    data: DynoPoint[];
    peakPower: number;
    peakTorque: number;
    color: string;
    isVisible: boolean;
    aiSummary?: string;
    performanceScore?: number;
}

export interface ObdOptimizationConfig {
  multiPid: boolean;
  adaptiveTiming: 0 | 1 | 2;
  fastBaud: boolean;
  canFiltering: boolean;
  highFreqMode: boolean;
  refreshRateTarget: number; // Hz
  dmaEngine: boolean;
}

/**
 * ECU identification profile.
 */
export interface ECUProfile {
    vin: string;
    protocol: string;
    hwId?: string;
    swId?: string;
    calibrationId?: string;
    rawCalId?: string;
    platformId?: 'MR20DE' | 'HR16DE' | 'K9K' | 'R9M' | 'M9R' | 'HRA2DDT' | 'MR16DDT' | 'KR15DDT' | 'HR13DDT' | 'VQ37' | 'VQ25' | 'VQ35DE' | 'BARRA' | 'EDC17' | 'GENERIC' | 'BOSCH_MG1';
    optimization?: ObdOptimizationConfig;
}

export interface LoggingConfig {
    selectedFields: string[];
    format: 'CSV' | 'JSON';
    frequency: number; // Hz
}

/**
 * A data logging session.
 */
export interface LogSession {
    id: string;
    name: string;
    startTime: number;
    duration: number;
    source: 'live_capture' | 'simulated_fallback';
    dataPoints: Partial<SensorDataPoint>[];
    stats: {
        maxRpm: number;
        maxBoost: number;
        maxSpeed: number;
        avgAfr: number;
    };
    config?: LoggingConfig;
}

/**
 * Auto-tune modification decision.
 */
export interface AutoTuneDecision {
    cell: { r: number, c: number };
    oldValue: number;
    newValue: number;
    reason: string;
    confidence: number;
}

export interface ThrottleTuning {
    mode: 'ECO' | 'STANDARD' | 'SPORT' | 'SPORT_PLUS' | 'RACE' | 'CUSTOM' | 'VALET' | 'LOCK';
    responseScale: number;
    initialBite: number;
    smoothing: number;
}

export interface TransmissionTuning {
    shiftFirmness: number;
    shiftPointOffset: number;
    revMatching: boolean;
    isSportModeActive: boolean;
}

/**
 * Strategy parameters for map optimization.
 */
export interface OptimizationStrategy {
    baseAdvanceLimit: number;
    knockThreshold: number;
    maxEgt: number;
    smoothingFactor: number;
    seekMbt: boolean;
    targetAfr: number;
}