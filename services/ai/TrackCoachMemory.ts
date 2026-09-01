import {
    TelemetryFrameContext,
    TrackCoachSignalName,
    usableSignalEntries,
} from './TrackCoachContracts';

export interface CoachMemoryEvent {
    timestampMs: number;
    kind: 'DRIVER_QUESTION' | 'COACH_RESPONSE' | 'ANOMALY' | 'LAP_EVENT';
    text: string;
}

interface SignalSummary {
    unit: string;
    count: number;
    minimum: number;
    maximum: number;
    mean: number;
    latest: number;
    sources: string[];
}

export interface TrackCoachMemorySnapshot {
    schema: 'genesis.track-coach-context.v1';
    sessionId: string | null;
    windowStartMs: number;
    windowEndMs: number;
    retainedFrameCount: number;
    summaries: Partial<Record<TrackCoachSignalName, SignalSummary>>;
    latestSignals: Partial<Record<TrackCoachSignalName, {
        value: number;
        unit: string;
        source: string;
        ageMs: number;
        quality: number;
        derivation?: string;
    }>>;
    events: CoachMemoryEvent[];
    limitations: string[];
}

export interface TrackCoachMemoryOptions {
    windowMs?: number;
    minimumFrameIntervalMs?: number;
    maxFrames?: number;
    maxEvents?: number;
}

/**
 * Ephemeral, bounded ten-minute memory. It is intentionally not persisted.
 * Durable run notes require an explicit user action in the run-history lane.
 */
export class TrackCoachMemory {
    private readonly windowMs: number;
    private readonly minimumFrameIntervalMs: number;
    private readonly maxFrames: number;
    private readonly maxEvents: number;
    private frames: TelemetryFrameContext[] = [];
    private events: CoachMemoryEvent[] = [];
    private lastAcceptedFrameMs = Number.NEGATIVE_INFINITY;

    constructor(options: TrackCoachMemoryOptions = {}) {
        this.windowMs = options.windowMs ?? 10 * 60 * 1_000;
        this.minimumFrameIntervalMs = options.minimumFrameIntervalMs ?? 200;
        this.maxFrames = options.maxFrames ?? 3_000;
        this.maxEvents = options.maxEvents ?? 100;
    }

    appendFrame(frame: TelemetryFrameContext): boolean {
        if (!Number.isFinite(frame.timestampMs) || frame.timestampMs < this.lastAcceptedFrameMs) return false;
        if (frame.timestampMs - this.lastAcceptedFrameMs < this.minimumFrameIntervalMs) return false;

        this.frames.push(frame);
        this.lastAcceptedFrameMs = frame.timestampMs;
        this.prune(frame.timestampMs);
        if (this.frames.length > this.maxFrames) {
            this.frames.splice(0, this.frames.length - this.maxFrames);
        }
        return true;
    }

    appendEvent(event: CoachMemoryEvent): void {
        if (!Number.isFinite(event.timestampMs) || !event.text.trim()) return;
        this.events.push({ ...event, text: event.text.trim().slice(0, 500) });
        this.prune(event.timestampMs);
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents);
        }
    }

    snapshot(nowMs: number): TrackCoachMemorySnapshot {
        this.prune(nowMs);
        const latestFrame = this.frames.at(-1);
        const accumulators = new Map<TrackCoachSignalName, {
            unit: string;
            values: number[];
            sources: Set<string>;
        }>();

        for (const frame of this.frames) {
            for (const { name, signal } of usableSignalEntries(frame, frame.timestampMs)) {
                const current = accumulators.get(name) ?? {
                    unit: signal.unit,
                    values: [],
                    sources: new Set<string>(),
                };
                current.values.push(signal.value as number);
                current.sources.add(signal.source);
                accumulators.set(name, current);
            }
        }

        const summaries: TrackCoachMemorySnapshot['summaries'] = {};
        for (const [name, accumulator] of accumulators) {
            const values = accumulator.values;
            summaries[name] = {
                unit: accumulator.unit,
                count: values.length,
                minimum: Math.min(...values),
                maximum: Math.max(...values),
                mean: values.reduce((sum, value) => sum + value, 0) / values.length,
                latest: values.at(-1) as number,
                sources: [...accumulator.sources].sort(),
            };
        }

        const latestSignals: TrackCoachMemorySnapshot['latestSignals'] = {};
        if (latestFrame) {
            for (const { name, signal } of usableSignalEntries(latestFrame, nowMs)) {
                latestSignals[name] = {
                    value: signal.value as number,
                    unit: signal.unit,
                    source: signal.source,
                    ageMs: Math.max(0, nowMs - signal.sourceTimestampMs),
                    quality: signal.quality,
                    derivation: signal.derivation
                        ? `${signal.derivation.algorithm}@${signal.derivation.version}`
                        : undefined,
                };
            }
        }

        const limitations: string[] = [];
        if (!latestFrame) limitations.push('No telemetry frames retained.');
        if (latestFrame && Object.keys(latestSignals).length === 0) {
            limitations.push('No fresh, sufficiently qualified live signals are available.');
        }

        return {
            schema: 'genesis.track-coach-context.v1',
            sessionId: latestFrame?.sessionId ?? null,
            windowStartMs: nowMs - this.windowMs,
            windowEndMs: nowMs,
            retainedFrameCount: this.frames.length,
            summaries,
            latestSignals,
            events: [...this.events],
            limitations,
        };
    }

    toRealtimeText(nowMs: number): string | null {
        const snapshot = this.snapshot(nowMs);
        if (Object.keys(snapshot.latestSignals).length === 0) return null;
        return `[GENESIS_TRACK_CONTEXT_V1] ${JSON.stringify(snapshot)}`;
    }

    clear(): void {
        this.frames = [];
        this.events = [];
        this.lastAcceptedFrameMs = Number.NEGATIVE_INFINITY;
    }

    private prune(nowMs: number): void {
        const cutoff = nowMs - this.windowMs;
        this.frames = this.frames.filter((frame) => frame.timestampMs >= cutoff);
        this.events = this.events.filter((event) => event.timestampMs >= cutoff);
    }
}

