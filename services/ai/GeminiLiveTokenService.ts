import { GoogleGenAI, Modality } from '@google/genai';
import {
    GEMINI_TRACK_COACH_MODEL,
    GEMINI_TRACK_COACH_SYSTEM_INSTRUCTION,
} from './TrackCoachPolicy';

export interface GeminiLiveToken {
    token: string;
    expiresAtMs: number;
    newSessionExpiresAtMs: number;
    model: string;
}

interface AuthTokenIssuer {
    authTokens: {
        create(params: unknown): Promise<{ name?: string }>;
    };
}

export async function issueOneUseTrackCoachToken(
    client: AuthTokenIssuer,
    nowMs = Date.now(),
): Promise<GeminiLiveToken> {
    const expiresAtMs = nowMs + 30 * 60 * 1_000;
    const newSessionExpiresAtMs = nowMs + 60 * 1_000;

    const token = await client.authTokens.create({
        config: {
            uses: 1,
            expireTime: new Date(expiresAtMs).toISOString(),
            newSessionExpireTime: new Date(newSessionExpiresAtMs).toISOString(),
            liveConnectConstraints: {
                model: GEMINI_TRACK_COACH_MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    temperature: 0.2,
                    systemInstruction: GEMINI_TRACK_COACH_SYSTEM_INSTRUCTION,
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Charon' },
                        },
                    },
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
            },
            lockAdditionalFields: [],
        },
    });

    if (!token.name) throw new Error('Gemini did not return an ephemeral token.');
    return {
        token: token.name,
        expiresAtMs,
        newSessionExpiresAtMs,
        model: GEMINI_TRACK_COACH_MODEL,
    };
}

export async function issueOneUseTrackCoachTokenFromEnvironment(
    nowMs = Date.now(),
): Promise<GeminiLiveToken> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');
    const client = new GoogleGenAI({ apiKey });
    return issueOneUseTrackCoachToken(client, nowMs);
}

