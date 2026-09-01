import type { SensorDataPoint } from '../../types';
import type {
    TelemetryFrameContext,
    TelemetrySignal,
    TelemetrySource,
    TelemetryStatus,
} from './TrackCoachContracts';

export type LegacyCoachField =
    | 'speed'
    | 'throttlePos'
    | 'gForceY'
    | 'steeringAngle'
    | 'oilPressure';

export interface ChannelEvidence {
    source: Exclude<TelemetrySource, 'UNKNOWN'>;
    sourceTimestampMs: number;
    receivedTimestampMs: number;
    quality: number;
    status: TelemetryStatus;
    derivation?: TelemetrySignal['derivation'];
}

export type CoachEvidenceMap = Partial<Record<LegacyCoachField, ChannelEvidence>>;

export interface BuildCoachFrameOptions {
    sessionId: string;
    capturedAtMs: number;
    frame: SensorDataPoint;
    evidence: CoachEvidenceMap;
}

/**
 * Compatibility boundary for the legacy aggregate SensorDataPoint model.
 *
 * A numeric value alone is never evidence. Each channel must carry explicit
 * source, timestamp, status and quality metadata before it can enter the live
 * coach. This prevents the legacy simulator/default-value fallbacks from being
 * represented as measured OBD or sensor data.
 */
export function buildTrackCoachFrame({
    sessionId,
    capturedAtMs,
    frame,
    evidence,
}: BuildCoachFrameOptions): TelemetryFrameContext {
    return {
        sessionId,
        timestampMs: capturedAtMs,
        speedKmh: signal(frame.speed, 'km/h', evidence.speed, capturedAtMs),
        throttlePercentage: signal(frame.throttlePos, '%', evidence.throttlePos, capturedAtMs),
        brakePressureBar: unavailable('bar', capturedAtMs),
        lateralG: signal(frame.gForceY, 'g', evidence.gForceY, capturedAtMs),
        steeringAngleDeg: signal(frame.steeringAngle, 'deg', evidence.steeringAngle, capturedAtMs),
        oilPressureKpa: signal(frame.oilPressure, 'kPa', evidence.oilPressure, capturedAtMs),
    };
}

function signal(
    value: number | undefined,
    unit: string,
    evidence: ChannelEvidence | undefined,
    nowMs: number,
): TelemetrySignal {
    if (!evidence || typeof value !== 'number' || !Number.isFinite(value)) {
        return unavailable(unit, nowMs);
    }
    return {
        value,
        unit,
        ...evidence,
    };
}

function unavailable(unit: string, nowMs: number): TelemetrySignal {
    return {
        value: null,
        unit,
        source: 'UNKNOWN',
        sourceTimestampMs: nowMs,
        receivedTimestampMs: nowMs,
        quality: 0,
        status: 'UNAVAILABLE',
    };
}
