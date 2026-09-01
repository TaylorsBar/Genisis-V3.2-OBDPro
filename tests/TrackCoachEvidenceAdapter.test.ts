import { describe, expect, it } from 'vitest';
import type { SensorDataPoint } from '../types';
import { buildTrackCoachFrame } from '../services/ai/TrackCoachEvidenceAdapter';
import { usableSignalEntries } from '../services/ai/TrackCoachContracts';

const baseFrame = {
    time: 10_000,
    speed: 80,
    throttlePos: 35,
    gForceY: 0.6,
    steeringAngle: 7,
    oilPressure: 380,
} as SensorDataPoint;

describe('TrackCoachEvidenceAdapter', () => {
    it('does not promote unprovenanced legacy values into live evidence', () => {
        const frame = buildTrackCoachFrame({
            sessionId: 'session-1',
            capturedAtMs: 10_000,
            frame: baseFrame,
            evidence: {},
        });

        expect(usableSignalEntries(frame)).toEqual([]);
        expect(frame.speedKmh.status).toBe('UNAVAILABLE');
        expect(frame.oilPressureKpa.source).toBe('UNKNOWN');
    });

    it('passes only explicitly qualified channels', () => {
        const frame = buildTrackCoachFrame({
            sessionId: 'session-1',
            capturedAtMs: 10_100,
            frame: baseFrame,
            evidence: {
                speed: {
                    source: 'OBD',
                    sourceTimestampMs: 10_000,
                    receivedTimestampMs: 10_010,
                    quality: 0.95,
                    status: 'FRESH',
                },
                throttlePos: {
                    source: 'SIMULATED',
                    sourceTimestampMs: 10_000,
                    receivedTimestampMs: 10_010,
                    quality: 1,
                    status: 'FRESH',
                },
            },
        });

        expect(usableSignalEntries(frame).map(({ name }) => name)).toEqual(['speedKmh']);
    });
});
