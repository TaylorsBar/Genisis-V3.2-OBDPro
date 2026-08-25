
/**
 * Genesis Core Worker (v2.0)
 * Master State Estimator: 13-Dimensional State Vector
 */

type Vec13 = number[]; 
type Mat13 = number[];

class Math13D {
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

class EKF {
    public x: Vec13 = new Array(13).fill(0);
    public P: Mat13 = Math13D.identity();
    public Q: Mat13 = new Array(169).fill(0);
    public isInitialized = false;
    public lastExternalVelocityFuseTime = 0;

    private sharedX: Float64Array | null = null;
    private sharedP: Float64Array | null = null;

    private readonly GRAVITY = 9.80665;
    private readonly CHI_SQUARE_3SIGMA = 9.0;

    constructor() {
        for(let i=0; i<3; i++) this.Q[i*13+i] = 0.001;
        for(let i=3; i<6; i++) this.Q[i*13+i] = 0.05;
        for(let i=6; i<9; i++) this.Q[i*13+i] = 0.00001;
        this.Q[9*13+9] = 0.01;
        this.Q[10*13+10] = 0.05;
        this.Q[11*13+11] = 0.005;
        this.Q[12*13+12] = 0.005;
    }

    public setSharedBuffers(sabX: ArrayBuffer, sabP: ArrayBuffer) {
        this.sharedX = new Float64Array(sabX);
        this.sharedP = new Float64Array(sabP);
        this.sharedX.set(this.x);
        this.sharedP.set(this.P);
    }

    private syncToShared() {
        if (this.sharedX) this.sharedX.set(this.x);
        if (this.sharedP) this.sharedP.set(this.P);
    }

    predict(accel: [number, number, number], gyro: [number, number, number], dt: number) {
        if (dt <= 0 || !isFinite(dt)) return;
        if (!this.isInitialized) {
            this.isInitialized = true;
        }

        const [px, py, pz, vx, vy, vz, bx, by, bz, yaw, yaw_rate, pitch, roll] = this.x;

        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cr = Math.cos(roll), sr = Math.sin(roll);

        const abx = accel[0] - bx;
        const aby = accel[1] - by;
        const abz = accel[2] - bz;

        // Rotation Matrix R_wb (Body to World)
        const R00 = cy * cp;
        const R01 = cy * sp * sr - sy * cr;
        const R02 = cy * sp * cr + sy * sr;
        const R10 = sy * cp;
        const R11 = sy * sp * sr + cy * cr;
        const R12 = sy * sp * cr - cy * sr;
        const R20 = -sp;
        const R21 = cp * sr;
        const R22 = cp * cr;

        // World-Frame Acceleration Projection (R_wb * a_body)
        const ax_w = abx * R00 + aby * R01 + abz * R02;
        const ay_w = abx * R10 + aby * R11 + abz * R12;
        const az_w = abx * R20 + aby * R21 + abz * R22 + this.GRAVITY;

        // Position Propagation
        this.x[0] = px + vx * dt + 0.5 * ax_w * dt * dt;
        this.x[1] = py + vy * dt + 0.5 * ay_w * dt * dt;
        this.x[2] = pz + vz * dt + 0.5 * az_w * dt * dt;
        
        // Velocity Propagation
        this.x[3] = vx + ax_w * dt;
        this.x[4] = vy + ay_w * dt;
        this.x[5] = vz + az_w * dt;
        
        // Kinematic Vehicle Constraints & Stabilization (lateral/vertical limits & offline adaptive decay)
        this.applyKinematicConstraints(dt);
        
        // Attitude Propagation via Euler rates
        this.x[9] = yaw + (gyro[2] * (cr / cp) + gyro[1] * (sr / cp)) * dt;
        this.x[10] = gyro[2];
        this.x[11] = pitch + (gyro[1] * cr - gyro[2] * sr) * dt;
        this.x[12] = roll + (gyro[0] + gyro[1] * sr * (sp / cp) + gyro[2] * cr * (sp / cp)) * dt;

        const F = Math13D.identity();
        F[0*13+3] = dt; F[1*13+4] = dt; F[2*13+5] = dt;
        F[3*13+6] = -dt; F[4*13+7] = -dt; F[5*13+8] = -dt;
        F[9*13+10] = dt;

        this.P = Math13D.multMat(F, Math13D.multMat(this.P, Math13D.transpose(F)));
        for(let i=0; i<169; i++) this.P[i] += this.Q[i];

        if (!this.x.every(isFinite)) {
            this.x = new Array(13).fill(0);
            this.P = Math13D.identity();
            for(let i=0; i<13; i++) this.P[i*13+i] = 100;
            this.isInitialized = false;
        }

        this.syncToShared();
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

        // Non-holonomic lateral velocity constraint
        const yawRateVal = Math.abs(this.x[10]);
        const constraintWeight = 0.05 + yawRateVal * 0.1;
        this.update(0, vy_b, H, constraintWeight);

        // Non-holonomic vertical velocity constraint (cars don't fly)
        const H_z = new Array(13).fill(0);
        H_z[5] = 1;
        this.update(0, this.x[5], H_z, 0.05);

        // Offline dead-reckoning stabilization decay
        const now = Date.now();
        const timeSinceFuse = now - this.lastExternalVelocityFuseTime;
        if (timeSinceFuse > 3000) {
            const decay = Math.pow(0.90, dt); // ~10% decay per second when offline
            this.x[3] *= decay;
            this.x[4] *= decay;
            this.x[5] *= decay;
        } else {
            const decay = Math.pow(0.995, dt); // Very light online decay
            this.x[3] *= decay;
            this.x[4] *= decay;
            this.x[5] *= decay;
        }
    }

    update(z: number, h_x: number, H: number[], R_base: number) {
        const y = z - h_x;
        const PH_t = Math13D.multMatVec(this.P, H);
        let S = R_base;
        for(let i=0; i<13; i++) S += H[i] * PH_t[i];
        
        if (Math.abs(S) < 1e-12) return;

        const mDist = Math13D.mahalanobis(y, S);
        if (mDist > this.CHI_SQUARE_3SIGMA) return;

        const K = Math13D.scaleVec(PH_t, 1/S);
        this.x = Math13D.addVec(this.x, Math13D.scaleVec(K, y));
        
        // Joseph Form for numerical stability
        const I = Math13D.identity();
        const KH = new Array(169).fill(0);
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) KH[r*13+c] = K[r] * H[c];
        }
        
        const ImKH = I.map((v, i) => v - KH[i]);
        const ImKH_t = Math13D.transpose(ImKH);
        
        let P_new = Math13D.multMat(ImKH, Math13D.multMat(this.P, ImKH_t));
        for(let r=0; r<13; r++) {
            for(let c=0; c<13; c++) P_new[r*13+c] += K[r] * R_base * K[c];
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

        if (!this.x.every(isFinite)) {
            this.x = new Array(13).fill(0);
            this.P = Math13D.identity();
            for(let i=0; i<13; i++) this.P[i*13+i] = 100;
            this.isInitialized = false;
        }

        this.syncToShared();
    }
}

const ekf = new EKF();

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'RESET_STATE':
            ekf.x = new Array(13).fill(0);
            ekf.P = Math13D.identity();
            ekf.isInitialized = false;
            ekf.setSharedBuffers(new ArrayBuffer(13 * 8), new ArrayBuffer(169 * 8)); // reset buffers
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;

        case 'INIT_SHARED':
            ekf.setSharedBuffers(payload.sabX, payload.sabP);
            break;

        case 'EKF_PREDICT':
            ekf.predict(payload.accel, payload.gyro, payload.dt);
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;
        
        case 'EKF_PREDICT_BATCH':
            payload.forEach((p: any) => {
                ekf.predict(p.accel, p.gyro, p.dt);
            });
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;
        
        case 'EKF_FUSE_GPS':
            ekf.lastExternalVelocityFuseTime = Date.now();
            if (!ekf.isInitialized) { ekf.x[3] = payload.speed; ekf.isInitialized = true; }
            else {
                let vMag = Math.sqrt(ekf.x[3]**2 + ekf.x[4]**2 + ekf.x[5]**2);
                const H = new Array(13).fill(0);
                H[3] = ekf.x[3]/(vMag+0.01);
                H[4] = ekf.x[4]/(vMag+0.01);
                H[5] = ekf.x[5]/(vMag+0.01);
                ekf.update(payload.speed, vMag, H, Math.max(0.1, payload.accuracy));
            }
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;

        case 'EKF_FUSE_OBD':
            ekf.lastExternalVelocityFuseTime = Date.now();
            if (!ekf.isInitialized) { ekf.x[3] = payload.speed; ekf.isInitialized = true; }
            else {
                const H = new Array(13).fill(0);
                H[3] = 1;
                ekf.update(payload.speed, ekf.x[3], H, 0.02);
            }
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;

        case 'EKF_FUSE_VISION_YAW':
            if (ekf.isInitialized) {
                const H = new Array(13).fill(0);
                H[10] = 1;
                const R = Math.max(0.005, 1.0 - payload.confidence);
                ekf.update(payload.yawRate, ekf.x[10], H, R);
            }
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;

        case 'EKF_FUSE_VISION_SPEED':
            ekf.lastExternalVelocityFuseTime = Date.now();
            if (ekf.isInitialized) {
                const H = new Array(13).fill(0);
                H[3] = 1;
                const R = Math.max(0.01, (1.0 - payload.confidence) * 2.0);
                ekf.update(payload.speed, ekf.x[3], H, R);
            } else {
                ekf.x[3] = payload.speed;
                ekf.isInitialized = true;
            }
            (self as any).postMessage({ type: 'EKF_STATE', x: ekf.x, P: ekf.P });
            break;

        case 'MAP_SMOOTH':
            const { buffer, rows, cols, factor } = payload;
            const out = new Float64Array(buffer.length);
            const kernel = [[1, 2, 1], [2, 4, 2], [1, 2, 1]].map(row => row.map(v => v / 16));
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    let sum = 0;
                    for (let kr = -1; kr <= 1; kr++) {
                        for (let kc = -1; kc <= 1; kc++) {
                            const rowIdx = Math.min(Math.max(r + kr, 0), rows - 1);
                            const colIdx = Math.min(Math.max(c + kc, 0), cols - 1);
                            sum += buffer[rowIdx * cols + colIdx] * kernel[kr + 1][kc + 1];
                        }
                    }
                    out[r * cols + c] = (buffer[r * cols + c] * (1 - factor)) + (sum * factor);
                }
            }
            (self as any).postMessage({ type: 'MAP_SMOOTHED', buffer: out }, [out.buffer]);
            break;
    }
};
