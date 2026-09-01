export type TelemetrySource =
    | 'OBD'
    | 'CAN_LISTEN'
    | 'IMU'
    | 'GNSS'
    | 'VISION'
    | 'DERIVED'
    | 'PREDICTED'
    | 'SIMULATED'
    | 'UNKNOWN';

export type TelemetryStatus = 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'REJECTED';

export interface TelemetryDerivation {
    algorithm: string;
    version: string;
    inputs: string[];
}

export interface TelemetrySignal {
    value: number | null;
    unit: string;
    source: TelemetrySource;
    sourceTimestampMs: number;
    receivedTimestampMs: number;
    quality: number;
    status: TelemetryStatus;
    derivation?: TelemetryDerivation;
}

/**
 * The deliberately small, stable context surface available to the live coach.
 * Raw CAN, arbitrary ECU memory and control-authority state are not exposed.
 */
export interface TelemetryFrameContext {
    sessionId: string;
    timestampMs: number;
    speedKmh: TelemetrySignal;
    throttlePercentage: TelemetrySignal;
    brakePressureBar: TelemetrySignal;
    lateralG: TelemetrySignal;
    steeringAngleDeg: TelemetrySignal;
    oilPressureKpa: TelemetrySignal;
}

export type TrackCoachSignalName = Exclude<keyof TelemetryFrameContext, 'sessionId' | 'timestampMs'>;

export const TRACK_COACH_SIGNAL_NAMES: TrackCoachSignalName[] = [
    'speedKmh',
    'throttlePercentage',
    'brakePressureBar',
    'lateralG',
    'steeringAngleDeg',
    'oilPressureKpa',
];

export const MAX_LIVE_SIGNAL_AGE_MS = 1_500;
export const MIN_LIVE_SIGNAL_QUALITY = 0.5;

const LIVE_SOURCES = new Set<TelemetrySource>([
    'OBD',
    'CAN_LISTEN',
    'IMU',
    'GNSS',
    'VISION',
    'DERIVED',
]);

export function isUsableCoachSignal(
    signal: TelemetrySignal,
    nowMs: number,
    maxAgeMs = MAX_LIVE_SIGNAL_AGE_MS,
): boolean {
    if (signal.value === null || !Number.isFinite(signal.value)) return false;
    if (signal.status !== 'FRESH' || !LIVE_SOURCES.has(signal.source)) return false;
    if (!Number.isFinite(signal.quality) || signal.quality < MIN_LIVE_SIGNAL_QUALITY || signal.quality > 1) return false;
    if (!Number.isFinite(signal.sourceTimestampMs) || signal.sourceTimestampMs > nowMs + 250) return false;
    if (nowMs - signal.sourceTimestampMs > maxAgeMs) return false;
    if (signal.source === 'DERIVED' && !signal.derivation) return false;
    return true;
}

export function usableSignalEntries(frame: TelemetryFrameContext, nowMs = frame.timestampMs) {
    return TRACK_COACH_SIGNAL_NAMES.flatMap((name) => {
        const signal = frame[name];
        return isUsableCoachSignal(signal, nowMs) ? [{ name, signal }] : [];
    });
}

