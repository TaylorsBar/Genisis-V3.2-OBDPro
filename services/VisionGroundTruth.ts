
import { OpticalFlowProcessor, TrackedPoint } from './OpticalFlowProcessor';

/**
 * VisionGroundTruth Module
 * 
 * This module acts as the bridge between raw camera data and state estimation.
 * It can operate in two modes:
 * 1. Simulation: Generates synthetic noisy speed data based on physics engine ground truth.
 * 2. Real-Time: Processes video frames using Optical Flow to estimate velocity.
 */

export interface VisualOdometryResult {
    speed: number;       // Estimated speed in km/h
    yawRate: number;     // Estimated yaw rate in rad/s
    slipAngle: number;   // Estimated visual slip angle in degrees
    confidence: number;  // 0.0 to 1.0
    isTracking: boolean; // True if visual features are locked
    features?: TrackedPoint[]; // Debug features for visualization
}

export class VisionGroundTruth {
    private processor: OpticalFlowProcessor;
    private features: TrackedPoint[] = [];
    
    private worker: Worker | null = null;
    private isWorkerReady = false;
    private pendingResolve: ((res: VisualOdometryResult) => void) | null = null;
    
    // Simulation parameters
    private opticalNoiseFactor: number = 1.2;
    private trackingQuality: number = 1.0;

    // Real-world calibration (Arbitrary scale for demo)
    // Pixels/sec to KM/H conversion factor depends on camera FOV, height, and resolution
    private readonly OPTICAL_SCALE_FACTOR = 0.5; 

    constructor() {
        this.processor = new OpticalFlowProcessor();
        
        // Initialize Web Worker
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker(new URL('../workers/opticalFlowWorker.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = (e) => {
                const { type, payload } = e.data;
                if (type === 'INIT_DONE') {
                    this.isWorkerReady = true;
                } else if (type === 'FEATURES_DETECTED') {
                    this.features = [...this.features, ...payload];
                    this.continueProcessing();
                } else if (type === 'FEATURES_TRACKED') {
                    this.finishProcessing(payload);
                }
            };
        }
    }

    private currentImageData: ImageData | null = null;
    private currentDt: number = 0;

    private continueProcessing() {
        if (!this.worker || !this.currentImageData) return;
        this.worker.postMessage({
            type: 'TRACK_FEATURES',
            payload: { imageData: this.currentImageData, features: this.features }
        });
    }

    private finishProcessing(trackedFeatures: TrackedPoint[]) {
        let estimatedSpeed = 0;
        let yawRate = 0;
        let slipAngle = 0;
        let confidence = 0;
        
        if (this.features.length > 0) {
            let validCount = 0;
            const dxs: number[] = [];
            const dys: number[] = [];

            trackedFeatures.forEach(p => {
                const prev = this.features.find(f => f.id === p.id);
                if (prev) {
                    const dx = p.x - prev.x;
                    const dy = p.y - prev.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < (this.currentImageData?.width || 320) * 0.2) {
                        dxs.push(dx);
                        dys.push(dy);
                    }
                }
            });

            if (dxs.length > 0) {
                dxs.sort((a, b) => a - b);
                dys.sort((a, b) => a - b);
                const medianDx = dxs[Math.floor(dxs.length / 2)];
                const medianDy = dys[Math.floor(dys.length / 2)];
                
// RANSAC Outlier Rejection for VO-FLOW
                let inlierDxSum = 0;
                let inlierDySum = 0;
                let inlierCount = 0;
                
                // Estimate motion model parameters (translation only for simplicity here)
                const numIterations = 50;
                const inlierThreshold = 2.0; // pixels
                let bestInliers: number[] = [];
                
                if (dxs.length > 3) {
                    for (let iter = 0; iter < numIterations; iter++) {
                        // Randomly sample 2 points to form a basic translation model
                        const idx1 = Math.floor(Math.random() * dxs.length);
                        const idx2 = Math.floor(Math.random() * dxs.length);
                        if (idx1 === idx2) continue;
                        
                        const modelDx = (dxs[idx1] + dxs[idx2]) / 2;
                        const modelDy = (dys[idx1] + dys[idx2]) / 2;
                        
                        let currentInliers: number[] = [];
                        for (let i = 0; i < dxs.length; i++) {
                            const errDx = dxs[i] - modelDx;
                            const errDy = dys[i] - modelDy;
                            const dist = Math.sqrt(errDx * errDx + errDy * errDy);
                            if (dist < inlierThreshold) {
                                currentInliers.push(i);
                            }
                        }
                        
                        if (currentInliers.length > bestInliers.length) {
                            bestInliers = currentInliers;
                        }
                    }
                }
                
                if (bestInliers.length > 0) {
                    bestInliers.forEach(i => {
                        inlierDxSum += dxs[i];
                        inlierDySum += dys[i];
                        inlierCount++;
                    });
                } else {
                    // Fallback to Median Absolute Deviation (MAD) if RANSAC fails or not enough points
                    const madDx = dxs.reduce((acc, val) => acc + Math.abs(val - medianDx), 0) / dxs.length;
                    const madDy = dys.reduce((acc, val) => acc + Math.abs(val - medianDy), 0) / dys.length;
                    
                    const thresholdDx = Math.max(madDx * 2.0, 1.0);
                    const thresholdDy = Math.max(madDy * 2.0, 1.0);

                    for (let i = 0; i < dxs.length; i++) {
                        if (Math.abs(dxs[i] - medianDx) <= thresholdDx && Math.abs(dys[i] - medianDy) <= thresholdDy) {
                            inlierDxSum += dxs[i];
                            inlierDySum += dys[i];
                            inlierCount++;
                        }
                    }
                }
                
                if (inlierCount > 0) {
                    const avgDx = inlierDxSum / inlierCount;
                    const avgDy = inlierDySum / inlierCount;
                    const avgPixelDisp = Math.sqrt(avgDx*avgDx + avgDy*avgDy);
                    
                    const pixelsPerSecond = avgPixelDisp / this.currentDt;
                    estimatedSpeed = pixelsPerSecond * this.OPTICAL_SCALE_FACTOR;
                    
                    const dxPerSecond = avgDx / this.currentDt;
                    yawRate = dxPerSecond * 0.01;
                    
                    if (Math.abs(avgDy) > 0.1) {
                        slipAngle = Math.atan2(avgDx, Math.abs(avgDy)) * (180 / Math.PI);
                    }
                    
                    confidence = Math.min(1.0, inlierCount / 20);
                }
            }

            this.features = trackedFeatures;
        }

        const result = {
            speed: estimatedSpeed,
            yawRate: yawRate,
            slipAngle: slipAngle,
            confidence: confidence,
            isTracking: this.features.length > 10,
            features: this.features
        };

        if (this.pendingResolve) {
            this.pendingResolve(result);
            this.pendingResolve = null;
        }
    }

    /**
     * Processes a real video frame to extract velocity.
     */
    public async processRealFrame(imageData: ImageData, dt: number): Promise<VisualOdometryResult> {
        if (this.worker) {
            return new Promise((resolve) => {
                this.pendingResolve = resolve;
                this.currentImageData = imageData;
                this.currentDt = dt;

                if (!this.isWorkerReady) {
                    this.worker!.postMessage({
                        type: 'INIT',
                        payload: { width: imageData.width, height: imageData.height }
                    });
                }

                if (this.features.length < 50) {
                    this.worker!.postMessage({
                        type: 'DETECT_FEATURES',
                        payload: { imageData, maxPoints: 100 - this.features.length }
                    });
                } else {
                    this.continueProcessing();
                }
            });
        }

        // Fallback to synchronous processing if worker is not available
        this.processor.init(imageData.width, imageData.height);

        // 1. Feature Replenishment
        // If we lost too many points, detect new ones
        if (this.features.length < 50) {
            const newFeatures = this.processor.detectFeatures(imageData, 100 - this.features.length);
            // Assign unique IDs if not present (processor does this, but ensuring consistency)
            this.features = [...this.features, ...newFeatures];
        }

        // 2. Feature Tracking (Optical Flow)
        let estimatedSpeed = 0;
        let yawRate = 0;
        let slipAngle = 0;
        let confidence = 0;
        
        if (this.features.length > 0) {
            const trackedFeatures = this.processor.trackFeatures(imageData, this.features);
            
            // 3. Velocity Estimation
            let validCount = 0;
            const dxs: number[] = [];
            const dys: number[] = [];

            trackedFeatures.forEach(p => {
                const prev = this.features.find(f => f.id === p.id);
                if (prev) {
                    const dx = p.x - prev.x;
                    const dy = p.y - prev.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    // Filter massive jumps
                    if (dist < imageData.width * 0.2) {
                        dxs.push(dx);
                        dys.push(dy);
                    }
                }
            });

            if (dxs.length > 0) {
                // Median filtering for robust estimation
                dxs.sort((a, b) => a - b);
                dys.sort((a, b) => a - b);
                const medianDx = dxs[Math.floor(dxs.length / 2)];
                const medianDy = dys[Math.floor(dys.length / 2)];
                
                // Calculate average of inliers (within 1.5x MAD of median)
                let inlierDxSum = 0;
                let inlierDySum = 0;
                let inlierCount = 0;
                
                // Approximate MAD (Median Absolute Deviation)
                const madDx = dxs.reduce((acc, val) => acc + Math.abs(val - medianDx), 0) / dxs.length;
                const madDy = dys.reduce((acc, val) => acc + Math.abs(val - medianDy), 0) / dys.length;
                
                const thresholdDx = Math.max(madDx * 2.0, 1.0);
                const thresholdDy = Math.max(madDy * 2.0, 1.0);

                for (let i = 0; i < dxs.length; i++) {
                    if (Math.abs(dxs[i] - medianDx) <= thresholdDx && Math.abs(dys[i] - medianDy) <= thresholdDy) {
                        inlierDxSum += dxs[i];
                        inlierDySum += dys[i];
                        inlierCount++;
                    }
                }
                
                if (inlierCount > 0) {
                    const avgDx = inlierDxSum / inlierCount;
                    const avgDy = inlierDySum / inlierCount;
                    const avgPixelDisp = Math.sqrt(avgDx*avgDx + avgDy*avgDy);
                    
                    const pixelsPerSecond = avgPixelDisp / dt;
                    estimatedSpeed = pixelsPerSecond * this.OPTICAL_SCALE_FACTOR;
                    
                    const dxPerSecond = avgDx / dt;
                    yawRate = dxPerSecond * 0.01;
                    
                    if (Math.abs(avgDy) > 0.1) {
                        slipAngle = Math.atan2(avgDx, Math.abs(avgDy)) * (180 / Math.PI);
                    }
                    
                    confidence = Math.min(1.0, inlierCount / 20); // 20+ inliers = full confidence
                }
            }

            this.features = trackedFeatures;
        }

        return {
            speed: estimatedSpeed,
            yawRate: yawRate,
            slipAngle: slipAngle,
            confidence: confidence,
            isTracking: this.features.length > 10,
            features: this.features
        };
    }

    /**
     * Simulates processing the next frame to extract velocity.
     * Used when camera is not available.
     */
    public computeVisualOdometry(trueSpeedSim: number, _dt: number, lightingCondition: number = 1.0): VisualOdometryResult {
        // 1. Determine Tracking Quality based on lighting and speed (motion blur)
        let quality = lightingCondition;
        
        if (trueSpeedSim > 220) {
            quality *= 0.7; // Motion blur degradation at high speed
        }

        // Random fluctuation in feature tracking quality (simulating texture loss)
        const featureNoise = (Math.random() - 0.5) * 0.15;
        this.trackingQuality = Math.max(0, Math.min(1, quality + featureNoise));

        // 2. Tracking Loss Threshold
        if (this.trackingQuality < 0.3) {
            return {
                speed: 0,
                yawRate: 0,
                slipAngle: 0,
                confidence: 0,
                isTracking: false
            };
        }

        // 3. Calculate Speed Estimate with Noise
        const speedNoise = (Math.random() - 0.5) * (this.opticalNoiseFactor + (trueSpeedSim * 0.01));
        const estimatedSpeed = Math.max(0, trueSpeedSim + speedNoise);

        return {
            speed: estimatedSpeed,
            yawRate: 0,
            slipAngle: 0,
            confidence: this.trackingQuality,
            isTracking: true
        };
    }
}
