import { describe, expect, it } from 'vitest';
import { TrackCoachMemory } from '../services/ai/TrackCoachMemory';
import type {
    TelemetryFrameContext,
    TelemetrySignal,
    TelemetrySource,
} from '../services/ai/TrackCoachContracts';

function signal(value: number, timestampMs: number, source: TelemetrySource = 'OBD'): TelemetrySignal {
    return {
        value,
        unit: 'unit',
        source,
        sourceTimestampMs: timestampMs,
        receivedTimestampMs: timestampMs,
        quality: 0.9,
        status: 'FRESH',
        derivation: source === 'DERIVED'
            ? { algorithm: 'test', version: '1', inputs: ['speed'] }
            : undefined,
    };
}

function frame(timestampMs: number, source: TelemetrySource = 'OBD'): TelemetryFrameContext {
    return {
        sessionId: 'session-1',
        timestampMs,
        speedKmh: signal(100, timestampMs, source),
        throttlePercentage: signal(50, timestampMs, source),
        brakePressureBar: signal(0, timestampMs, source),
        lateralG: signal(0.5, timestampMs, source),
        steeringAngleDeg: signal(10, timestampMs, source),
        oilPressureKpa: signal(350, timestampMs, source),
    };
}

describe('TrackCoachMemory', () => {
    it('retains a bounded ten-minute window', () => {
        const memory = new TrackCoachMemory({ minimumFrameIntervalMs: 0 });
        memory.appendFrame(frame(0));
        memory.appendFrame(frame(600_001));
        const snapshot = memory.snapshot(600_001);
        expect(snapshot.retainedFrameCount).toBe(1);
        expect(snapshot.windowStartMs).toBe(1);
    });

    it('does not expose simulated signals as live coaching evidence', () => {
        const memory = new TrackCoachMemory();
        memory.appendFrame(frame(10_000, 'SIMULATED'));
        expect(memory.toRealtimeText(10_000)).toBeNull();
        expect(memory.snapshot(10_000).limitations).toContain(
            'No fresh, sufficiently qualified live signals are available.',
        );
    });

    it('includes source, age and quality for qualified values', () => {
        const memory = new TrackCoachMemory();
        memory.appendFrame(frame(10_000));
        const snapshot = memory.snapshot(10_200);
        expect(snapshot.latestSignals.speedKmh).toMatchObject({
            value: 100,
            source: 'OBD',
            ageMs: 200,
            quality: 0.9,
        });
    });

    it('downsamples frames before they enter conversational memory', () => {
        const memory = new TrackCoachMemory({ minimumFrameIntervalMs: 200 });
        expect(memory.appendFrame(frame(1_000))).toBe(true);
        expect(memory.appendFrame(frame(1_100))).toBe(false);
        expect(memory.appendFrame(frame(1_200))).toBe(true);
        expect(memory.snapshot(1_200).retainedFrameCount).toBe(2);
    });
});

