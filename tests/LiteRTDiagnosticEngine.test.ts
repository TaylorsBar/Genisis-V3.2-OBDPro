import { describe, expect, it, vi } from 'vitest';
import {
    LiteRTDiagnosticEngine,
    parseDiagnosticOutput,
    type LiteRTRuntimeFactory,
} from '../services/ai/LiteRTDiagnosticEngine';

const snapshot = {
    capturedAtMs: 10_000,
    signals: {
        coolantTemp: {
            value: 92,
            unit: '°C',
            source: 'OBD' as const,
            sourceTimestampMs: 9_900,
            receivedTimestampMs: 9_950,
            quality: 0.95,
            status: 'FRESH' as const,
        },
    },
};

describe('LiteRTDiagnosticEngine', () => {
    it('uses an injected, availability-tested runtime and preserves evidence channels', async () => {
        const deleteEngine = vi.fn();
        const sendMessage = vi.fn().mockResolvedValue({
            content: [{
                type: 'text',
                text: JSON.stringify({
                    faultCode: 'P0420',
                    confidence: 0.7,
                    probableCause: 'Catalyst efficiency is below the expected threshold.',
                    recommendedAction: 'Compare upstream and downstream oxygen-sensor waveforms.',
                    severity: 'MEDIUM',
                    limitations: ['One coolant sample does not confirm catalyst failure.'],
                }),
            }],
        });
        const runtime: LiteRTRuntimeFactory = {
            runtimeId: 'fake-litert-web',
            create: vi.fn().mockResolvedValue({
                createConversation: vi.fn().mockResolvedValue({ sendMessage }),
                delete: deleteEngine,
            }),
        };
        const engine = new LiteRTDiagnosticEngine(runtime);
        await engine.initializeEngine('/models/diagnostic.litertlm');
        const result = await engine.analyzeFaultCode('P0420', snapshot);

        expect(result.status).toBe('ANALYZED');
        expect(result.evidenceChannels).toEqual(['coolantTemp']);
        expect(result.modelId).toBe('fake-litert-web');
        expect(sendMessage).toHaveBeenCalledOnce();
        await engine.dispose();
        expect(deleteEngine).toHaveBeenCalledOnce();
    });

    it('does not call a model when evidence is simulated', async () => {
        const sendMessage = vi.fn();
        const runtime: LiteRTRuntimeFactory = {
            runtimeId: 'fake',
            create: vi.fn().mockResolvedValue({
                createConversation: vi.fn().mockResolvedValue({ sendMessage }),
                delete: vi.fn(),
            }),
        };
        const engine = new LiteRTDiagnosticEngine(runtime);
        await engine.initializeEngine('/models/diagnostic.litertlm');
        const result = await engine.analyzeFaultCode('P0420', {
            ...snapshot,
            signals: {
                coolantTemp: { ...snapshot.signals.coolantTemp, source: 'SIMULATED' },
            },
        });
        expect(result.status).toBe('INCONCLUSIVE');
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('fails closed on malformed model output', () => {
        const result = parseDiagnosticOutput('not-json', 'P0420', ['coolantTemp'], 'model');
        expect(result.status).toBe('INCONCLUSIVE');
        expect(result.confidence).toBe(0);
        expect(result.evidenceChannels).toEqual([]);
    });

    it('reports the preview runtime as unavailable instead of pretending to initialize', async () => {
        const engine = new LiteRTDiagnosticEngine();
        await expect(engine.initializeEngine('/models/diagnostic.litertlm')).rejects.toThrow('unavailable');
        expect(engine.getState()).toBe('UNAVAILABLE');
    });
});

