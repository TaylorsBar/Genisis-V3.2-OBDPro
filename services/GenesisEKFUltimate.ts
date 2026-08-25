import { VisionGroundTruth, VisualOdometryResult } from './VisionGroundTruth';
import { MathKernel } from './MathKernel';

/**
 * GenesisEKFUltimate v5.1 "WebGPU Accelerated"
 * Master State Estimator: 13-Dimensional Multi-Axis Sensor Fusion
 */

type Vec13 = number[]; 
type Mat13 = number[]; 

class Math13D {
    private static kernel = MathKernel.getInstance();

    static identity(): Mat13 {
        const m = new Array(169).fill(0);
        for(let i=0; i<13; i++) m[i*13+i] = 1;
        return m;
    }

    static addVec(a: Vec13, b: Vec13): Vec13 { return a.map((v, i) => v + b[i]); }
    static scaleVec(v: Vec13, s: number): Vec13 { return v.map(x => x * s); }
    
    static multMatVec(A: Mat13, v: Vec13): Vec13 {
        const res = new Array(13).fill(0);
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) res[r] += A[r*13+c] * v[c];
        }
        return res;
    }

    static multMat(A: Mat13, B: Mat13): Mat13 {
        const C = new Array(169).fill(0);
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) {
                for(let k=0; k<13; k++) C[r*13+c] += A[r*13+k] * B[k*13+c];
            }
        }
        return C;
    }

    static transpose(A: Mat13): Mat13 {
        const T = new Array(169).fill(0);
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) T[c*13+r] = A[r*13+c];
        }
        return T;
    }

    static mahalanobis(residual: number, S: number): number {
        return (residual * residual) / S;
    }
}

export class GenesisEKFUltimate {
    public x: Vec13 = new Array(13).fill(0); 
    public P: Mat13 = Math13D.identity(); 
    public Q: Mat13 = new Array(169).fill(0); 
    public residuals: Record<string, number> = {}; 
    
    private visionModule: VisionGroundTruth;
    public isInitialized = false;
    private worker: Worker | null = null;
    private sharedX: Float64Array | null = null;
    private sharedP: Float64Array | null = null;
    private predictionBatch: any[] = [];
    private lastBatchTime = 0;
    private mathKernel = MathKernel.getInstance();

    private readonly GRAVITY = 9.80665;
    private readonly CHI_SQUARE_3SIGMA = 16.0; 
    private readonly BIAS_LEARNING_RATE = 0.0001; 
    private innovationBuffer: number[] = [];
    private adaptiveRScale = 1.0;
    private updateCount = 0;
    public gpuActive = false;
    private lastExternalVelocityFuseTime = 0;

    constructor() {
        this.visionModule = new VisionGroundTruth();
        this.initNoises();
        this.gpuActive = false; // Bypass WebGPU offloading for ultra-low latency synchronous EKF tracking
        this.worker = null;     // Bypass Worker offloading to prevent asynchronous postMessage congestion
    }

    private initNoises() {
        for(let i=0; i<3; i++) this.Q[i*13+i] = 0.00005; // Pos precision
        for(let i=3; i<6; i++) this.Q[i*13+i] = 0.001;   // Vel precision
        for(let i=6; i<9; i++) this.Q[i*13+i] = 1e-8;    // Bias stability
        this.Q[9*13+9] = 0.0005;  // Orientation
        this.Q[10*13+10] = 0.002; // Rate
        this.Q[11*13+11] = 0.002; // Pitch
        this.Q[12*13+12] = 0.002; // Roll
    }

    public predict(accel: [number, number, number], gyro: [number, number, number], dt: number): void {
        if (dt <= 0 || !isFinite(dt)) return;
        // Low-latency synchronous single-step EKF propagation on the CPU
        this.internalPredict(accel, gyro, dt);
    }

    private async processPredictionBatchGPU() {
        const batchSize = this.predictionBatch.length;
        if (batchSize === 0) return;

        try {
            const stateX = new Float32Array(this.x);
            const covarianceP = new Float32Array(this.P);
            const processNoiseQ = new Float32Array(this.Q);

            const result = await this.mathKernel.gpuPropagateKinematics(
                stateX,
                covarianceP,
                processNoiseQ,
                this.predictionBatch
            );

            this.x = Array.from(result.x);
            this.P = Array.from(result.P);
        } catch (e) {
            console.warn("GPU Offload failed, falling back to CPU", e);
            this.predictionBatch.forEach(p => this.internalPredict(p.accel, p.gyro, p.dt));
        }

        this.predictionBatch = [];
        this.gpuActive = true;
    }

    private internalPredictStateOnly(accel: [number, number, number], gyro: [number, number, number], dt: number): void {
        if (!this.isInitialized) return;
        const [px, py, pz, vx, vy, vz, bx, by, bz, yaw, yaw_rate, pitch, roll] = this.x;

        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cr = Math.cos(roll), sr = Math.sin(roll);

        const abx = accel[0] - bx;
        const aby = accel[1] - by;
        const abz = accel[2] - bz;

        const ax_w = abx * (cy * cp) + aby * (cy * sp * sr - sy * cr) + abz * (cy * sp * cr + sy * sr);
        const ay_w = abx * (sy * cp) + aby * (sy * sp * sr + cy * cr) + abz * (sy * sp * cr - cy * sr);
        const az_w = abx * (-sp) + aby * (cp * sr) + abz * (cp * cr) + this.GRAVITY;

        this.x[0] = px + vx * dt + 0.5 * ax_w * dt * dt;
        this.x[1] = py + vy * dt + 0.5 * ay_w * dt * dt;
        this.x[2] = pz + vz * dt + 0.5 * az_w * dt * dt;
        this.x[3] = vx + ax_w * dt;
        this.x[4] = vy + ay_w * dt;
        this.x[5] = vz + az_w * dt;
        this.x[9] = yaw + (gyro[2] * (cr / cp) + gyro[1] * (sr / cp)) * dt;
        this.x[10] = gyro[2]; 
        this.x[11] = pitch + (gyro[1] * cr - gyro[2] * sr) * dt;
        this.x[12] = roll + (gyro[0] + gyro[1] * sr * (sp / cp) + gyro[2] * cr * (sp / cp)) * dt;

        this.applyKinematicConstraints(dt);
        if (!this.x.every(isFinite)) this.resetState();
    }

    
    // UKF Constants
    private readonly UKF_N = 13;
    private readonly UKF_ALPHA = 1e-3;
    private readonly UKF_KAPPA = 0;
    private readonly UKF_BETA = 2;
    private readonly UKF_LAMBDA = (this.UKF_ALPHA * this.UKF_ALPHA) * (this.UKF_N + this.UKF_KAPPA) - this.UKF_N;

    // Cholesky decomposition for generating sigma points
    private cholesky(A: number[], n: number): number[] {
        const L = new Array(n * n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) {
                let sum = 0;
                for (let k = 0; k < j; k++) {
                    sum += L[i * n + k] * L[j * n + k];
                }
                if (i === j) {
                    L[i * n + j] = Math.sqrt(Math.max(0, A[i * n + i] - sum));
                } else {
                    L[i * n + j] = (1.0 / L[j * n + j]) * (A[i * n + j] - sum);
                }
            }
        }
        return L;
    }

    private ukfPredict(accel: [number, number, number], gyro: [number, number, number], dt: number): void {
        if (!this.isInitialized) {
            this.isInitialized = true;
        }
        if (dt <= 0 || !isFinite(dt)) return;

        const N = this.UKF_N;
        const LAMBDA = this.UKF_LAMBDA;
        
        // 1. Generate Sigma Points
        const sigmaPoints: number[][] = [];
        sigmaPoints.push([...this.x]);
        
        // Scale covariance matrix
        const scale = Math.sqrt(N + LAMBDA);
        const P_scaled = this.P.map(v => v * (N + LAMBDA));
        
        // Compute Cholesky L of (N+LAMBDA)*P
        const L = this.cholesky(P_scaled, N);
        
        for (let i = 0; i < N; i++) {
            const col = new Array(N).fill(0);
            for (let j = 0; j < N; j++) {
                col[j] = L[j * N + i]; // Take i-th column of L
            }
            sigmaPoints.push(Math13D.addVec(this.x, col));
            sigmaPoints.push(Math13D.addVec(this.x, Math13D.scaleVec(col, -1)));
        }

        // 2. Propagate Sigma Points through Non-linear Transition Function
        const propagatedPoints: number[][] = [];
        for (let i = 0; i < sigmaPoints.length; i++) {
            const state = sigmaPoints[i];
            const [px, py, pz, vx, vy, vz, bx, by, bz, yaw, yaw_rate, pitch, roll] = state;
            
            const cy = Math.cos(yaw), sy = Math.sin(yaw);
            const cp = Math.cos(pitch), sp = Math.sin(pitch);
            const cr = Math.cos(roll), sr = Math.sin(roll);
            
            const abx = accel[0] - bx;
            const aby = accel[1] - by;
            const abz = accel[2] - bz;
            
            const R00 = cy * cp;
            const R01 = cy * sp * sr - sy * cr;
            const R02 = cy * sp * cr + sy * sr;
            const R10 = sy * cp;
            const R11 = sy * sp * sr + cy * cr;
            const R12 = sy * sp * cr - cy * sr;
            const R20 = -sp;
            const R21 = cp * sr;
            const R22 = cp * cr;
            
            const ax_w = abx * R00 + aby * R01 + abz * R02;
            const ay_w = abx * R10 + aby * R11 + abz * R12;
            const az_w = abx * R20 + aby * R21 + abz * R22 + this.GRAVITY;
            
            const newState = new Array(N).fill(0);
            newState[0] = px + vx * dt + 0.5 * ax_w * dt * dt;
            newState[1] = py + vy * dt + 0.5 * ay_w * dt * dt;
            newState[2] = pz + vz * dt + 0.5 * az_w * dt * dt;
            newState[3] = vx + ax_w * dt;
            newState[4] = vy + ay_w * dt;
            newState[5] = vz + az_w * dt;
            newState[6] = bx;
            newState[7] = by;
            newState[8] = bz;
            newState[9] = yaw + (gyro[2] * (cr / cp) + gyro[1] * (sr / cp)) * dt;
            newState[10] = gyro[2]; 
            newState[11] = pitch + (gyro[1] * cr - gyro[2] * sr) * dt;
            newState[12] = roll + (gyro[0] + gyro[1] * sr * (sp / cp) + gyro[2] * cr * (sp / cp)) * dt;
            
            propagatedPoints.push(newState);
        }

        // 3. Compute new Mean and Covariance
        const Wm = new Array(2 * N + 1).fill(1 / (2 * (N + LAMBDA)));
        const Wc = new Array(2 * N + 1).fill(1 / (2 * (N + LAMBDA)));
        Wm[0] = LAMBDA / (N + LAMBDA);
        Wc[0] = LAMBDA / (N + LAMBDA) + (1 - this.UKF_ALPHA * this.UKF_ALPHA + this.UKF_BETA);
        
        let newX = new Array(N).fill(0);
        for (let i = 0; i < 2 * N + 1; i++) {
            newX = Math13D.addVec(newX, Math13D.scaleVec(propagatedPoints[i], Wm[i]));
        }
        
        let newP = new Array(N * N).fill(0);
        for (let i = 0; i < 2 * N + 1; i++) {
            const diff = Math13D.addVec(propagatedPoints[i], Math13D.scaleVec(newX, -1));
            // newP += Wc[i] * (diff * diff^T)
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    newP[r * N + c] += Wc[i] * diff[r] * diff[c];
                }
            }
        }
        
        // Add Process Noise
        for (let i = 0; i < N * N; i++) {
            newP[i] += this.Q[i];
        }
        
        this.x = newX;
        this.P = newP;
        
        this.applyKinematicConstraints(dt);
        if (!this.x.every(isFinite)) this.resetState();
    }

    private internalPredict(accel: [number, number, number], gyro: [number, number, number], dt: number): void {
        // High-precision EKF formulation for strapdown inertial navigation.
        // Bypasses UKF to prevent numeric variance-amplification and maintain superior O(N^2) latency characteristics.
        if (!this.isInitialized) return;
        const [px, py, pz, vx, vy, vz, bx, by, bz, yaw, yaw_rate, pitch, roll] = this.x;

        // 1. Strapdown Navigation
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cr = Math.cos(roll), sr = Math.sin(roll);

        const abx = accel[0] - bx;
        const aby = accel[1] - by;
        const abz = accel[2] - bz;

        const R00 = cy * cp;
        const R01 = cy * sp * sr - sy * cr;
        const R02 = cy * sp * cr + sy * sr;
        const R10 = sy * cp;
        const R11 = sy * sp * sr + cy * cr;
        const R12 = sy * sp * cr - cy * sr;
        const R20 = -sp;
        const R21 = cp * sr;
        const R22 = cp * cr;

        const ax_w = abx * R00 + aby * R01 + abz * R02;
        const ay_w = abx * R10 + aby * R11 + abz * R12;
        const az_w = abx * R20 + aby * R21 + abz * R22 + this.GRAVITY;

        // 2. State Propagation
        this.x[0] = px + vx * dt + 0.5 * ax_w * dt * dt;
        this.x[1] = py + vy * dt + 0.5 * ay_w * dt * dt;
        this.x[2] = pz + vz * dt + 0.5 * az_w * dt * dt;
        this.x[3] = vx + ax_w * dt;
        this.x[4] = vy + ay_w * dt;
        this.x[5] = vz + az_w * dt;
        
        this.x[9] = yaw + (gyro[2] * (cr / cp) + gyro[1] * (sr / cp)) * dt;
        this.x[10] = gyro[2]; 
        this.x[11] = pitch + (gyro[1] * cr - gyro[2] * sr) * dt;
        this.x[12] = roll + (gyro[0] + gyro[1] * sr * (sp / cp) + gyro[2] * cr * (sp / cp)) * dt;

        // Kinematic Vehicle Constraints
        this.applyKinematicConstraints(dt);

        // 3. Covariance Propagation
        const F = Math13D.identity();
        F[0*13+3] = dt; F[1*13+4] = dt; F[2*13+5] = dt;
        F[3*13+6] = -dt; F[4*13+7] = -dt; F[5*13+8] = -dt;
        F[9*13+10] = dt;

        this.P = Math13D.multMat(F, Math13D.multMat(this.P, Math13D.transpose(F)));
        for(let i=0; i<169; i++) this.P[i] += this.Q[i];

        if (this.updateCount % 10 === 0) {
            const Pt = Math13D.transpose(this.P);
            for(let i=0; i<169; i++) this.P[i] = (this.P[i] + Pt[i]) * 0.5;
        }

        if (!this.x.every(isFinite)) this.resetState();
    }

    private applyKinematicConstraints(dt: number) {
        if (!this.isInitialized) return;
        const yaw = this.x[9];
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const vx_w = this.x[3], vy_w = this.x[4];
        const vy_b = -vx_w * sy + vy_w * cy; 

        const H = new Array(13).fill(0);
        H[3] = -sy; H[4] = cy;
        H[9] = -vx_w * cy - vy_w * sy;

        const yawRateVal = Math.abs(this.x[10]);
        const constraintWeight = 0.05 + yawRateVal * 0.1;
        this.update(0, vy_b, H, constraintWeight, 'lateralConstraint');

        // Constrain vertical velocity to 0 (flat earth assumption)
        const H_z = new Array(13).fill(0);
        H_z[5] = 1;
        this.update(0, this.x[5], H_z, 0.05, 'verticalConstraint');

        // Offline dead-reckoning stabilization decay:
        // Only apply significant decay when we haven't had an external speed update in the last 3 seconds
        const now = Date.now();
        const timeSinceFuse = now - this.lastExternalVelocityFuseTime;
        if (timeSinceFuse > 3000) {
            const decay = Math.pow(0.90, dt); // ~10% decay per second when offline to keep it extremely stable
            this.x[3] *= decay;
            this.x[4] *= decay;
            this.x[5] *= decay;
        } else {
            // Very light decay when online to filter noise without lagging the physical speed
            const decay = Math.pow(0.995, dt); 
            this.x[3] *= decay;
            this.x[4] *= decay;
            this.x[5] *= decay;
        }
    }

    private update(z: number, h_x: number, H: Vec13, R_base: number, sensorName?: string): void {
        const y = z - h_x;
        if (sensorName) {
            this.residuals[sensorName] = y;
        }
        
        this.innovationBuffer.push(y * y);
        if (this.innovationBuffer.length > 20) {
            const avgInn = this.innovationBuffer.reduce((a,b)=>a+b, 0) / 20;
            this.adaptiveRScale = 0.8 * this.adaptiveRScale + 0.2 * Math.min(5.0, Math.max(1.0, avgInn / (R_base + 0.001)));
            this.innovationBuffer.shift();
        }
        const R = R_base * this.adaptiveRScale;

        const PH_t = Math13D.multMatVec(this.P, H);
        let S = R;
        for(let i=0; i<13; i++) S += H[i] * PH_t[i];
        
        if (Math.abs(S) < 1e-12) return;
        const mDist = Math13D.mahalanobis(y, S);
        if (this.updateCount > 10 && mDist > this.CHI_SQUARE_3SIGMA) return;

        const K = Math13D.scaleVec(PH_t, 1/S);
        this.x = Math13D.addVec(this.x, Math13D.scaleVec(K, y));
        this.updateCount++;

        const I = Math13D.identity();
        const KH = new Array(169).fill(0);
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) KH[r*13+c] = K[r] * H[c];
        }
        
        const ImKH = I.map((v, i) => v - KH[i]);
        let P_new = Math13D.multMat(ImKH, Math13D.multMat(this.P, Math13D.transpose(ImKH)));
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) P_new[r*13+c] += K[r] * R * K[c];
        }
        
        // Symmetry enforcement
        for(let r=0; r<13; r++) {
            for(let c=r+1; c<13; c++) {
                const sym = (P_new[r*13+c] + P_new[c*13+r]) / 2.0;
                P_new[r*13+c] = sym;
                P_new[c*13+r] = sym;
            }
        }
        
        this.P = P_new;
    }

    public fuseGps(speed: number, accuracy: number = 1.0): void {
        this.lastExternalVelocityFuseTime = Date.now();
        if (this.worker) {
            this.worker.postMessage({ type: 'EKF_FUSE_GPS', payload: { speed, accuracy } });
            return;
        }
        if (!this.isInitialized) { this.x[3] = speed; this.isInitialized = true; return; }
        let vMag = Math.sqrt(this.x[3]**2 + this.x[4]**2 + this.x[5]**2);
        const H = new Array(13).fill(0);
        H[3] = this.x[3]/(vMag+0.01); H[4] = this.x[4]/(vMag+0.01); H[5] = this.x[5]/(vMag+0.01);
        this.update(speed, vMag, H, Math.max(0.1, accuracy), 'gpsSpeed');
    }

    public fuseObdSpeed(speedMs: number): void {
        this.lastExternalVelocityFuseTime = Date.now();
        if (this.worker) {
            this.worker.postMessage({ type: 'EKF_FUSE_OBD', payload: { speed: speedMs } });
            return;
        }
        if (!this.isInitialized) { this.x[3] = speedMs; this.isInitialized = true; return; }
        const H = new Array(13).fill(0); H[3] = 1;
        this.update(speedMs, this.x[3], H, 0.02, 'obdSpeed');
    }

    /**
     * ZUPT (Zero Velocity Update) auto-calibrates IMU bias when stationary.
     */
    public applyZupt(accel: [number, number, number], gyro: [number, number, number]): void {
        const accelMag = Math.sqrt(accel[0]**2 + accel[1]**2 + accel[2]**2);
        const gyroMag = Math.sqrt(gyro[0]**2 + gyro[1]**2 + gyro[2]**2);
        
        if ((Math.abs(accelMag - this.GRAVITY) < 0.1 || accelMag < 0.1) && gyroMag < 0.05) {
            const xRef = this.sharedX || this.x;
            xRef[6] = (xRef[6] * (1 - this.BIAS_LEARNING_RATE)) + (accel[0] * this.BIAS_LEARNING_RATE);
            xRef[7] = (xRef[7] * (1 - this.BIAS_LEARNING_RATE)) + (accel[1] * this.BIAS_LEARNING_RATE);
            xRef[8] = (xRef[8] * (1 - this.BIAS_LEARNING_RATE)) + ((accel[2] - this.GRAVITY) * this.BIAS_LEARNING_RATE);
            this.fuseGps(0, 0.01);
        }
    }

    public fuseVisionYawRate(yawRate: number, confidence: number): void {
        if (this.worker) {
            this.worker.postMessage({ type: 'EKF_FUSE_VISION_YAW', payload: { yawRate, confidence } });
            return;
        }
        if (!this.isInitialized) return;
        const H = new Array(13).fill(0);
        H[10] = 1;
        const R = Math.max(0.005, 1.0 - confidence);
        this.update(yawRate, this.x[10], H, R, 'visionYawRate');
    }

    public fuseVisionSpeed(speedMs: number, confidence: number): void {
        this.lastExternalVelocityFuseTime = Date.now();
        if (this.worker) {
            this.worker.postMessage({ type: 'EKF_FUSE_VISION_SPEED', payload: { speed: speedMs, confidence } });
            return;
        }
        if (!this.isInitialized) { this.x[3] = speedMs; this.isInitialized = true; return; }
        const H = new Array(13).fill(0); H[3] = 1;
        // The higher the confidence, the lower the R (noise)
        const R = Math.max(0.01, (1.0 - confidence) * 2.0); 
        this.update(speedMs, this.x[3], H, R, 'visionSpeed');
    }

    public getEstimatedSpeed(): number {
        const x = (this.worker && this.sharedX) ? this.sharedX : this.x;
        return Math.sqrt(x[3]**2 + x[4]**2 + x[5]**2);
    }

    public getEstimatedYawRate(): number {
        const x = (this.worker && this.sharedX) ? this.sharedX : this.x;
        return x[10];
    }

    public getUncertainty(): number { 
        const P = (this.worker && this.sharedP) ? this.sharedP : this.P;
        return P[0] + P[3*13+3] + P[10*13+10]; 
    }

    public resetState() {
        this.x = new Array(13).fill(0);
        this.P = Math13D.identity();
        this.isInitialized = false;
        if (this.worker) {
            this.worker.postMessage({ type: 'RESET_STATE' });
        }
    }

    public async processCameraFrame(img: ImageData, dt: number): Promise<VisualOdometryResult> { return this.visionModule.processRealFrame(img, dt); }
}
