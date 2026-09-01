import { describe, expect, it, vi } from 'vitest';
import { issueOneUseTrackCoachToken } from '../services/ai/GeminiLiveTokenService';
import { GEMINI_TRACK_COACH_MODEL } from '../services/ai/TrackCoachPolicy';

describe('GeminiLiveTokenService', () => {
    it('issues a one-use, constrained token without returning a server API key', async () => {
        const create = vi.fn().mockResolvedValue({ name: 'ephemeral-token' });
        const nowMs = Date.UTC(2026, 8, 1, 0, 0, 0);
        const result = await issueOneUseTrackCoachToken({ authTokens: { create } }, nowMs);

        expect(result).toEqual({
            token: 'ephemeral-token',
            expiresAtMs: nowMs + 30 * 60 * 1_000,
            newSessionExpiresAtMs: nowMs + 60 * 1_000,
            model: GEMINI_TRACK_COACH_MODEL,
        });
        const request = create.mock.calls[0][0];
        expect(request.config.uses).toBe(1);
        expect(request.config.liveConnectConstraints.model).toBe(GEMINI_TRACK_COACH_MODEL);
        expect(request.config.liveConnectConstraints.config.responseModalities).toEqual(['AUDIO']);
        expect(JSON.stringify(result)).not.toContain('GEMINI_API_KEY');
    });

    it('fails closed when the provider returns no token', async () => {
        await expect(issueOneUseTrackCoachToken({
            authTokens: { create: vi.fn().mockResolvedValue({}) },
        })).rejects.toThrow('did not return an ephemeral token');
    });
});

