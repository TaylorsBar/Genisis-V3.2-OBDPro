const fs = require('fs');
let content = fs.readFileSync('services/GenesisEKFUltimate.ts', 'utf8');

const ukfLogic = `
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
        if (!this.isInitialized || dt <= 0 || !isFinite(dt)) return;

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
`;

content = content.replace(/private internalPredict\(accel: \[number, number, number\], gyro: \[number, number, number\], dt: number\): void \{/,
  ukfLogic + '\n    private internalPredict(accel: [number, number, number], gyro: [number, number, number], dt: number): void {\n        this.ukfPredict(accel, gyro, dt);\n        return;\n');

fs.writeFileSync('services/GenesisEKFUltimate.ts', content);
console.log("UKF implemented in GenesisEKFUltimate.ts");
