# Multimodal Track Coach and Edge Diagnostic Extraction

This increment extracts the useful intent from the experimental `GeminiTrackCoachLiveClient` and `LiteRTDiagnosticEngine` prototypes without treating them as production evidence.

## Promoted behavior

- one-use Gemini Live tokens are minted on an authenticated backend;
- the long-lived Gemini API key never enters the browser bundle;
- Gemini Live uses the supported Google GenAI SDK and realtime input surface;
- microphone capture uses `AudioWorklet`, not deprecated `ScriptProcessorNode`;
- 24 kHz PCM response audio is queued and can be interrupted;
- camera frames are bounded to one frame per second and capture resources are released;
- telemetry is admitted only with source, timestamp, age, quality and status;
- simulated, stale, rejected and unknown-source signals cannot enter live coaching context;
- conversational memory is ephemeral, bounded to ten minutes and not silently persisted;
- the coach is advisory-only and exposes no control tools;
- on-device diagnostic output is parsed fail-closed and presented as a hypothesis;
- the LiteRT-LM runtime is dependency-injected and reports unavailable truthfully.

## Not promoted

- direct WebSocket URLs containing a permanent API key;
- mock diagnoses or default invented repair advice;
- the fictional `window.litert.createInferenceSession` API;
- automatic ECU actions, tuning, DTC clearing or active tests;
- unqualified telemetry text;
- camera observations as fusion ground truth;
- claims that the browser LiteRT-LM runtime is production-ready.

## Current LiteRT-LM web constraint

Google documents `@litert-lm/core` as an early-preview WebGPU text API. During this extraction, npm package `0.16.0` contained only `package.json` and no declared `dist` implementation. The dependency is therefore not shipped. A browser runtime adapter can be enabled only after the exact package/model combination passes the model tester and target-device benchmarks. Android should use the stable native LiteRT-LM lane first.

Primary references:

- [Gemini Live WebSocket guide](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket)
- [Gemini Live ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)
- [Gemini Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- [LiteRT-LM Web API](https://ai.google.dev/edge/litert-lm/js)

## Required next evidence

1. Firebase-authenticated token issuance in the deployed environment.
2. Target Android device audio latency and interruption tests.
3. Consent and track-mode gating for microphone/camera capture.
4. Recorded-session evaluation for stale-data and hallucinated-marker failures.
5. LiteRT-LM Android model selection, memory budget and diagnostic eval corpus.
6. No-screen-while-moving HMI validation.
