import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiTrackCoachLiveClient } from '../services/ai/GeminiTrackCoachLiveClient';
import type { TelemetryFrameContext, TelemetrySignal } from '../services/ai/TrackCoachContracts';
import { GEMINI_TRACK_COACH_MODEL } from '../services/ai/TrackCoachPolicy';

function signal(value: number, timestampMs: number): TelemetrySignal {
    return {
        value,
        unit: 'unit',
        source: 'OBD',
        sourceTimestampMs: timestampMs,
        receivedTimestampMs: timestampMs,
        quality: 0.95,
        status: 'FRESH',
    };
}

function frame(timestampMs: number): TelemetryFrameContext {
    return {
        sessionId: 'session-1',
        timestampMs,
        speedKmh: signal(80, timestampMs),
        throttlePercentage: signal(35, timestampMs),
        brakePressureBar: signal(0, timestampMs),
        lateralG: signal(0.4, timestampMs),
        steeringAngleDeg: signal(8, timestampMs),
        oilPressureKpa: signal(380, timestampMs),
    };
}

describe('GeminiTrackCoachLiveClient', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('uses an authenticated ephemeral token and sends qualified realtime context', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                token: 'one-use-token',
                model: GEMINI_TRACK_COACH_MODEL,
                expiresAtMs: Date.now() + 30 * 60_000,
                newSessionExpiresAtMs: Date.now() + 60_000,
            }),
        });
        vi.stubGlobal('fetch', fetchMock);
        const sendRealtimeInput = vi.fn();
        const close = vi.fn();
        const connectSession = vi.fn().mockResolvedValue({ sendRealtimeInput, close });
        const client = new GeminiTrackCoachLiveClient({
            getApplicationAuthToken: async () => 'firebase-session-token',
            capturePolicy: () => ({ allowed: true }),
            connectSession,
        });

        await client.connect();
        expect(fetchMock).toHaveBeenCalledWith('/api/gemini/live-token', expect.objectContaining({
            method: 'POST',
            headers: { Authorization: 'Bearer firebase-session-token' },
        }));
        expect(connectSession.mock.calls[0][0].token).toBe('one-use-token');
        expect(client.sendTelemetryContext(frame(10_000))).toBe(true);
        expect(sendRealtimeInput).toHaveBeenCalledWith({
            text: expect.stringContaining('genesis.track-coach-context.v1'),
        });
        expect(sendRealtimeInput.mock.calls[0][0].text).toContain('"source":"OBD"');
        await client.close();
        expect(close).toHaveBeenCalledOnce();
    });

    it('does not transmit a frame when every signal is simulated', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                token: 'one-use-token',
                model: GEMINI_TRACK_COACH_MODEL,
                expiresAtMs: Date.now() + 30 * 60_000,
                newSessionExpiresAtMs: Date.now() + 60_000,
            }),
        }));
        const sendRealtimeInput = vi.fn();
        const client = new GeminiTrackCoachLiveClient({
            getApplicationAuthToken: async () => 'firebase-session-token',
            capturePolicy: () => ({ allowed: true }),
            connectSession: vi.fn().mockResolvedValue({ sendRealtimeInput, close: vi.fn() }),
        });
        await client.connect();
        const simulated = frame(10_000);
        for (const key of [
            'speedKmh',
            'throttlePercentage',
            'brakePressureBar',
            'lateralG',
            'steeringAngleDeg',
            'oilPressureKpa',
        ] as const) {
            simulated[key] = { ...simulated[key], source: 'SIMULATED' };
        }
        expect(client.sendTelemetryContext(simulated)).toBe(false);
        expect(sendRealtimeInput).not.toHaveBeenCalled();
    });
});

