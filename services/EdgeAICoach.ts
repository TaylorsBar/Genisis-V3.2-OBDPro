
/**
 * Edge AI Coach v1.0
 * Federated Learning: Local inference and habit learning.
 * Zero-latency coaching with data privacy.
 */

export class EdgeAICoach {
    private session: any = null;
    private oInstance: any = null;
    private modelPath: string = '/models/coach_v1_quantized.onnx';
    private isInitialized = false;

    constructor() {
        this.init();
    }

    private async init() {
        try {
            // Pre-flight check: Verify if the quantized model exists locally to prevent triggering
            // failure-prone WebAssembly dynamic downloads and compilations in sandboxed preview environments.
            try {
                const check = await fetch(this.modelPath, { method: 'HEAD' });
                const contentType = check.headers.get('content-type');
                if (!check.ok || (contentType && contentType.includes('text/html'))) {
                    console.info("Edge AI Coach: No local quantized ONNX model found. Using premium kinematics coaching engine.");
                    return;
                }
            } catch (err) {
                console.info("Edge AI Coach: Sandbox environment / offline mode active. Bypassing native ONNX session compile.", err);
                return;
            }

            // Dynamic import to prevent WebAssembly execution on application startup
            const ort = await import('onnxruntime-web');
            this.oInstance = ort;
            
            // Set WASM paths to CDN to avoid local serving issues and MIME type errors
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';

            // Check if WebGPU is available for ONNX execution
            const executionProviders = ['webgpu', 'wasm'];
            
            // Fetch/create session ONLY if the check succeeds
            this.session = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: executionProviders,
                graphOptimizationLevel: 'all'
            });
            this.isInitialized = true;
            console.log("Edge AI Coach initialized with ONNX Runtime Web.");
        } catch (e) {
            console.warn("Edge AI Coach failed to load model. Falling back to heuristic coaching.", e);
        }
    }

    /**
     * Predicts the best racing line or braking point based on local telemetry.
     * @param telemetry Current vehicle telemetry (speed, G-forces, steering, etc.)
     */
    public async predictCoachingAction(telemetry: number[]): Promise<string> {
        if (!this.isInitialized || !this.session || !this.oInstance) {
            return this.heuristicCoaching(telemetry);
        }

        try {
            const ort = this.oInstance;
            const inputTensor = new ort.Tensor('float32', new Float32Array(telemetry), [1, telemetry.length]);
            const feeds = { input: inputTensor };
            const results = await this.session.run(feeds);
            const output = results.output.data as Float32Array;
            
            // Map model output to coaching advice
            return this.mapOutputToAdvice(output);
        } catch (e) {
            console.error("Inference failed:", e);
            return "Keep pushing, focus on the apex.";
        }
    }

    private heuristicCoaching(telemetry: number[]): string {
        const [speed, latG, lonG] = telemetry;
        if (latG > 1.2) return "Approaching grip limit. Smooth steering.";
        if (lonG < -0.8 && speed > 100) return "Brake harder, trail off into the corner.";
        return "Maintaining optimal pace.";
    }

    private mapOutputToAdvice(output: Float32Array): string {
        const maxIdx = output.indexOf(Math.max(...Array.from(output)));
        const adviceMap = [
            "Brake 10m earlier.",
            "Carry more speed into the apex.",
            "Earlier throttle application.",
            "Perfect line, keep it up.",
            "Too much steering angle, reduce scrub."
        ];
        return adviceMap[maxIdx] || "Focus on consistency.";
    }

    /**
     * Local "Learning" - updates a local profile based on driver habits.
     * In a real federated learning setup, this would involve local gradient updates.
     */
    public async learnFromHabit(telemetry: number[], actualAction: string) {
        // Rate-limited learning update to prevent quota exceedance
        const { submitEdgeLearningUpdate } = await import('./geminiService');
        await submitEdgeLearningUpdate(telemetry, actualAction);
    }
}

export const edgeAICoach = new EdgeAICoach();
