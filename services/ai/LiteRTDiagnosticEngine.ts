import {
    TelemetrySignal,
    isUsableCoachSignal,
} from './TrackCoachContracts';

export type LiteRTDiagnosticState =
    | 'UNINITIALIZED'
    | 'LOADING'
    | 'READY'
    | 'UNAVAILABLE'
    | 'FAILED'
    | 'DISPOSED';

export interface DiagnosticEvidenceSnapshot {
    capturedAtMs: number;
    signals: Record<string, TelemetrySignal>;
}

export interface DiagnosticResult {
    status: 'ANALYZED' | 'INCONCLUSIVE';
    faultCode: string;
    confidence: number;
    probableCause: string;
    recommendedAction: string;
    severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
    evidenceChannels: string[];
    limitations: string[];
    modelId: string;
}

interface LiteRTResponse {
    content?: Array<{ type?: string; text?: string }>;
}

export interface LiteRTConversation {
    sendMessage(message: string): Promise<LiteRTResponse>;
    cancel?(): void;
}

export interface LiteRTEngine {
    createConversation(config: {
        preface: { messages: Array<{ role: 'system'; content: string }> };
    }): Promise<LiteRTConversation>;
    delete(): Promise<void>;
}

export interface LiteRTRuntimeFactory {
    runtimeId: string;
    create(settings: {
        model: string | Blob | ReadableStream<Uint8Array>;
        mainExecutorSettings: { maxNumTokens: number };
    }): Promise<LiteRTEngine>;
}

/**
 * Honest adapter around LiteRT-LM. The browser runtime is injected because the
 * documented JS package is early preview and must be availability-tested before
 * it is included in a commercial build. Android can inject its native bridge.
 */
export class LiteRTDiagnosticEngine {
    private readonly runtimeFactory?: LiteRTRuntimeFactory;
    private engine: LiteRTEngine | null = null;
    private conversation: LiteRTConversation | null = null;
    private state: LiteRTDiagnosticState = 'UNINITIALIZED';
    private modelId = 'uninitialized';

    constructor(runtimeFactory?: LiteRTRuntimeFactory) {
        this.runtimeFactory = runtimeFactory;
    }

    getState(): LiteRTDiagnosticState {
        return this.state;
    }

    async initializeEngine(model: string | Blob | ReadableStream<Uint8Array>): Promise<void> {
        if (!this.runtimeFactory) {
            this.state = 'UNAVAILABLE';
            throw new Error('LiteRT-LM runtime is unavailable in this build.');
        }
        this.state = 'LOADING';
        try {
            this.engine = await this.runtimeFactory.create({
                model,
                mainExecutorSettings: { maxNumTokens: 2_048 },
            });
            this.conversation = await this.engine.createConversation({
                preface: {
                    messages: [{
                        role: 'system',
                        content: [
                            'You are an offline automotive diagnostic assistant.',
                            'Return only JSON matching the requested schema.',
                            'Treat causes as hypotheses and recommend verification checks.',
                            'Never claim that missing, stale, simulated or rejected data was measured.',
                            'Never recommend ECU writes, DTC clearing or operation of an unsafe vehicle.',
                        ].join(' '),
                    }],
                },
            });
            this.modelId = this.runtimeFactory.runtimeId;
            this.state = 'READY';
        } catch (error) {
            this.state = 'FAILED';
            throw error;
        }
    }

    async analyzeFaultCode(
        dtcCode: string,
        snapshot: DiagnosticEvidenceSnapshot,
    ): Promise<DiagnosticResult> {
        const faultCode = dtcCode.trim().toUpperCase();
        if (!/^[PCBU][0-9A-F]{4}$/.test(faultCode)) {
            return inconclusive(faultCode || 'UNKNOWN', this.modelId, ['Invalid SAE DTC format.']);
        }
        if (this.state !== 'READY' || !this.conversation) {
            throw new Error('LiteRT-LM engine is not ready.');
        }

        const evidence = Object.entries(snapshot.signals).flatMap(([channel, signal]) => {
            if (!isUsableCoachSignal(signal, snapshot.capturedAtMs, 5_000)) return [];
            return [{
                channel,
                value: signal.value,
                unit: signal.unit,
                source: signal.source,
                ageMs: Math.max(0, snapshot.capturedAtMs - signal.sourceTimestampMs),
                quality: signal.quality,
                derivation: signal.derivation,
            }];
        });

        if (evidence.length === 0) {
            return inconclusive(faultCode, this.modelId, ['No fresh, qualified evidence channels were available.']);
        }

        const prompt = JSON.stringify({
            task: 'Generate diagnostic hypotheses from the supplied evidence only.',
            faultCode,
            evidence,
            outputSchema: {
                faultCode: 'string',
                confidence: 'number from 0 to 1',
                probableCause: 'single hypothesis, not a confirmed diagnosis',
                recommendedAction: 'non-destructive verification check',
                severity: 'LOW | MEDIUM | CRITICAL',
                limitations: 'string[]',
            },
        });

        const response = await this.conversation.sendMessage(prompt);
        const rawText = response.content
            ?.filter((part) => part.type === 'text' || part.text)
            .map((part) => part.text ?? '')
            .join('')
            .trim() ?? '';
        return parseDiagnosticOutput(rawText, faultCode, evidence.map((item) => item.channel), this.modelId);
    }

    async dispose(): Promise<void> {
        this.conversation?.cancel?.();
        await this.engine?.delete();
        this.conversation = null;
        this.engine = null;
        this.state = 'DISPOSED';
    }
}

export function parseDiagnosticOutput(
    rawText: string,
    expectedFaultCode: string,
    evidenceChannels: string[],
    modelId: string,
): DiagnosticResult {
    try {
        const parsed = JSON.parse(stripSingleJsonFence(rawText)) as Record<string, unknown>;
        const severity = parsed.severity;
        const confidence = parsed.confidence;
        const probableCause = parsed.probableCause;
        const recommendedAction = parsed.recommendedAction;
        if (!['LOW', 'MEDIUM', 'CRITICAL'].includes(String(severity))) throw new Error('Invalid severity.');
        if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
            throw new Error('Invalid confidence.');
        }
        if (typeof probableCause !== 'string' || !probableCause.trim()) throw new Error('Missing hypothesis.');
        if (typeof recommendedAction !== 'string' || !recommendedAction.trim()) throw new Error('Missing verification action.');

        return {
            status: 'ANALYZED',
            faultCode: expectedFaultCode,
            confidence,
            probableCause: probableCause.trim().slice(0, 500),
            recommendedAction: recommendedAction.trim().slice(0, 500),
            severity: severity as DiagnosticResult['severity'],
            evidenceChannels: [...evidenceChannels],
            limitations: Array.isArray(parsed.limitations)
                ? parsed.limitations.filter((item): item is string => typeof item === 'string').slice(0, 10)
                : [],
            modelId,
        };
    } catch {
        return inconclusive(expectedFaultCode, modelId, ['The on-device model did not return valid diagnostic JSON.']);
    }
}

function stripSingleJsonFence(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match?.[1]?.trim() ?? trimmed;
}

function inconclusive(faultCode: string, modelId: string, limitations: string[]): DiagnosticResult {
    return {
        status: 'INCONCLUSIVE',
        faultCode,
        confidence: 0,
        probableCause: 'Insufficient evidence for a diagnostic hypothesis.',
        recommendedAction: 'Collect fresh measurements and follow the manufacturer diagnostic procedure.',
        severity: 'LOW',
        evidenceChannels: [],
        limitations,
        modelId,
    };
}

