import {
    GoogleGenAI,
    Modality,
    type LiveServerMessage,
} from '@google/genai';
import { TelemetryFrameContext } from './TrackCoachContracts';
import { TrackCoachMemory } from './TrackCoachMemory';
import {
    GEMINI_TRACK_COACH_MODEL,
    GEMINI_TRACK_COACH_SYSTEM_INSTRUCTION,
} from './TrackCoachPolicy';
import type { GeminiLiveToken } from './GeminiLiveTokenService';

type CoachState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'CAPTURING' | 'CLOSED' | 'ERROR';

interface LiveSessionLike {
    sendRealtimeInput(params: {
        audio?: { data: string; mimeType: string };
        video?: { data: string; mimeType: string };
        text?: string;
        audioStreamEnd?: boolean;
    }): void;
    close(): void;
}

interface LiveSessionCallbacks {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (event: ErrorEvent) => void;
    onclose: (event: CloseEvent) => void;
}

export interface GeminiTrackCoachOptions {
    getApplicationAuthToken: () => Promise<string>;
    capturePolicy: () => { allowed: boolean; reason?: string };
    tokenEndpoint?: string;
    memory?: TrackCoachMemory;
    onStateChange?: (state: CoachState) => void;
    onTranscript?: (role: 'user' | 'coach', text: string) => void;
    onError?: (error: Error) => void;
    connectSession?: (
        token: GeminiLiveToken,
        callbacks: LiveSessionCallbacks,
    ) => Promise<LiveSessionLike>;
}

class PcmAudioPlayer {
    private context: AudioContext | null = null;
    private scheduledSources = new Set<AudioBufferSourceNode>();
    private nextStartTime = 0;

    async enqueue(base64Pcm16: string): Promise<void> {
        const bytes = base64ToBytes(base64Pcm16);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
        for (let index = 0; index < samples.length; index++) {
            samples[index] = view.getInt16(index * 2, true) / 0x8000;
        }

        this.context ??= new AudioContext();
        await this.context.resume();
        const audioBuffer = this.context.createBuffer(1, samples.length, 24_000);
        audioBuffer.copyToChannel(samples, 0);

        const source = this.context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.context.destination);
        const startTime = Math.max(this.context.currentTime, this.nextStartTime);
        source.start(startTime);
        this.nextStartTime = startTime + audioBuffer.duration;
        this.scheduledSources.add(source);
        source.onended = () => this.scheduledSources.delete(source);
    }

    interrupt(): void {
        for (const source of this.scheduledSources) {
            try { source.stop(); } catch { /* already stopped */ }
        }
        this.scheduledSources.clear();
        this.nextStartTime = this.context?.currentTime ?? 0;
    }

    async dispose(): Promise<void> {
        this.interrupt();
        await this.context?.close();
        this.context = null;
    }
}

export class GeminiTrackCoachLiveClient {
    private readonly options: GeminiTrackCoachOptions;
    private readonly memory: TrackCoachMemory;
    private readonly audioPlayer = new PcmAudioPlayer();
    private session: LiveSessionLike | null = null;
    private state: CoachState = 'IDLE';
    private captureContext: AudioContext | null = null;
    private captureNode: AudioWorkletNode | null = null;
    private captureSource: MediaStreamAudioSourceNode | null = null;
    private silentGain: GainNode | null = null;
    private mediaStream: MediaStream | null = null;
    private videoCanvas: HTMLCanvasElement | null = null;
    private videoTimer: number | null = null;
    private videoFrameInFlight = false;
    private lastTelemetrySendMs = Number.NEGATIVE_INFINITY;

    constructor(options: GeminiTrackCoachOptions) {
        this.options = options;
        this.memory = options.memory ?? new TrackCoachMemory();
    }

    getState(): CoachState {
        return this.state;
    }

    async connect(): Promise<void> {
        if (this.session) return;
        this.setState('CONNECTING');
        try {
            const token = await this.fetchEphemeralToken();
            const callbacks: LiveSessionCallbacks = {
                onopen: () => this.setState('CONNECTED'),
                onmessage: (message) => { void this.handleServerMessage(message); },
                onerror: () => this.fail(new Error('Gemini Live session error.')),
                onclose: () => {
                    this.session = null;
                    if (this.state !== 'CLOSED') this.setState('IDLE');
                },
            };
            this.session = this.options.connectSession
                ? await this.options.connectSession(token, callbacks)
                : await this.connectGoogleSession(token, callbacks);
            if (this.state === 'CONNECTING') this.setState('CONNECTED');
        } catch (error) {
            this.fail(asError(error));
            throw error;
        }
    }

    async startCapture(videoElement?: HTMLVideoElement): Promise<void> {
        if (!this.session || this.state !== 'CONNECTED') {
            throw new Error('Connect the live coach before starting capture.');
        }
        const decision = this.options.capturePolicy();
        if (!decision.allowed) throw new Error(decision.reason ?? 'Capture is not permitted in the current mode.');

        this.captureContext = new AudioContext();
        await this.captureContext.audioWorklet.addModule('/worklets/genesis-pcm-capture.js');
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: false,
        });

        this.captureSource = this.captureContext.createMediaStreamSource(this.mediaStream);
        this.captureNode = new AudioWorkletNode(this.captureContext, 'genesis-pcm-capture');
        this.silentGain = this.captureContext.createGain();
        this.silentGain.gain.value = 0;
        this.captureNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
            if (this.state !== 'CAPTURING') return;
            const pcm16 = float32ToPcm16(event.data);
            this.session?.sendRealtimeInput({
                audio: {
                    data: bytesToBase64(new Uint8Array(pcm16.buffer)),
                    mimeType: `audio/pcm;rate=${this.captureContext?.sampleRate ?? 48_000}`,
                },
            });
        };
        this.captureSource.connect(this.captureNode);
        this.captureNode.connect(this.silentGain);
        this.silentGain.connect(this.captureContext.destination);
        await this.captureContext.resume();

        if (videoElement) {
            this.videoCanvas = document.createElement('canvas');
            this.videoCanvas.width = 640;
            this.videoCanvas.height = 360;
            this.scheduleVideoFrame(videoElement);
        }
        this.setState('CAPTURING');
    }

    sendTelemetryContext(frame: TelemetryFrameContext): boolean {
        this.memory.appendFrame(frame);
        if (!this.session || (this.state !== 'CONNECTED' && this.state !== 'CAPTURING')) return false;
        if (frame.timestampMs - this.lastTelemetrySendMs < 500) return false;
        const context = this.memory.toRealtimeText(frame.timestampMs);
        if (!context) return false;
        this.session.sendRealtimeInput({ text: context });
        this.lastTelemetrySendMs = frame.timestampMs;
        return true;
    }

    async stopCapture(): Promise<void> {
        if (this.videoTimer !== null) window.clearTimeout(this.videoTimer);
        this.videoTimer = null;
        this.videoFrameInFlight = false;
        this.captureNode?.disconnect();
        this.captureSource?.disconnect();
        this.silentGain?.disconnect();
        this.captureNode = null;
        this.captureSource = null;
        this.silentGain = null;
        for (const track of this.mediaStream?.getTracks() ?? []) track.stop();
        this.mediaStream = null;
        await this.captureContext?.close();
        this.captureContext = null;
        this.videoCanvas = null;
        this.session?.sendRealtimeInput({ audioStreamEnd: true });
        if (this.session && this.state !== 'CLOSED') this.setState('CONNECTED');
    }

    async close(): Promise<void> {
        await this.stopCapture();
        this.session?.close();
        this.session = null;
        await this.audioPlayer.dispose();
        this.memory.clear();
        this.setState('CLOSED');
    }

    private async fetchEphemeralToken(): Promise<GeminiLiveToken> {
        const applicationToken = await this.options.getApplicationAuthToken();
        const response = await fetch(this.options.tokenEndpoint ?? '/api/gemini/live-token', {
            method: 'POST',
            headers: { Authorization: `Bearer ${applicationToken}` },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Live token request failed (${response.status}).`);
        const body = await response.json() as GeminiLiveToken;
        if (!body.token || body.newSessionExpiresAtMs <= Date.now()) {
            throw new Error('Backend returned an unusable live token.');
        }
        return body;
    }

    private async connectGoogleSession(
        token: GeminiLiveToken,
        callbacks: LiveSessionCallbacks,
    ): Promise<LiveSessionLike> {
        const ai = new GoogleGenAI({ apiKey: token.token });
        return ai.live.connect({
            model: token.model || GEMINI_TRACK_COACH_MODEL,
            config: {
                responseModalities: [Modality.AUDIO],
                temperature: 0.2,
                systemInstruction: GEMINI_TRACK_COACH_SYSTEM_INSTRUCTION,
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks,
        });
    }

    private async handleServerMessage(message: LiveServerMessage): Promise<void> {
        const content = message.serverContent;
        if (content?.interrupted) this.audioPlayer.interrupt();
        const inputText = content?.inputTranscription?.text?.trim();
        const outputText = content?.outputTranscription?.text?.trim();
        if (inputText) {
            this.memory.appendEvent({ timestampMs: Date.now(), kind: 'DRIVER_QUESTION', text: inputText });
            this.options.onTranscript?.('user', inputText);
        }
        if (outputText) {
            this.memory.appendEvent({ timestampMs: Date.now(), kind: 'COACH_RESPONSE', text: outputText });
            this.options.onTranscript?.('coach', outputText);
        }

        for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
                await this.audioPlayer.enqueue(part.inlineData.data);
            }
        }
    }

    private scheduleVideoFrame(videoElement: HTMLVideoElement): void {
        this.videoTimer = window.setTimeout(async () => {
            if (this.state !== 'CAPTURING' || !this.videoCanvas || this.videoFrameInFlight) return;
            this.videoFrameInFlight = true;
            try {
                if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    const context = this.videoCanvas.getContext('2d', { alpha: false });
                    context?.drawImage(videoElement, 0, 0, this.videoCanvas.width, this.videoCanvas.height);
                    const blob = await canvasToBlob(this.videoCanvas, 'image/jpeg', 0.7);
                    this.session?.sendRealtimeInput({
                        video: {
                            data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
                            mimeType: 'image/jpeg',
                        },
                    });
                }
            } catch (error) {
                this.options.onError?.(asError(error));
            } finally {
                this.videoFrameInFlight = false;
                if (this.state === 'CAPTURING') this.scheduleVideoFrame(videoElement);
            }
        }, 1_000);
    }

    private setState(state: CoachState): void {
        this.state = state;
        this.options.onStateChange?.(state);
    }

    private fail(error: Error): void {
        this.setState('ERROR');
        this.options.onError?.(error);
    }
}

function float32ToPcm16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let index = 0; index < input.length; index++) {
        const sample = Math.max(-1, Math.min(1, input[index]));
        output[index] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
    }
    return output;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Video frame encoding failed.')), type, quality);
    });
}

function asError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}

