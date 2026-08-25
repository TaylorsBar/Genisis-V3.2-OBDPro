
/**
 * Tuning & Control Optimization Worker
 * Offloads Recursive Least Squares (RLS) system identification and 
 * Model Predictive Control (MPC) optimization from the main thread.
 */

// Simple Matrix Helpers to avoid external dependencies in worker context
class MatrixMath {
    static multiply(A: number[][], B: number[][]): number[][] {
        const result = new Array(A.length).fill(0).map(() => new Array(B[0].length).fill(0));
        for (let i = 0; i < A.length; i++) {
            for (let j = 0; j < B[0].length; j++) {
                for (let k = 0; k < A[0].length; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        return result;
    }

    static add(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((val, j) => val + B[i][j]));
    }

    static subtract(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((val, j) => val - B[i][j]));
    }

    static transpose(A: number[][]): number[][] {
        return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
    }

    static scale(A: number[][], s: number): number[][] {
        return A.map(row => row.map(val => val * s));
    }
}

/**
 * Recursive Least Squares (RLS) Identification
 * Identified Model: y(k) = theta^T * phi(k)
 */
class RLS {
    private theta: number[][]; // Parameters
    private P: number[][];     // Covariance
    private lambda: number;    // Forgetting factor

    constructor(dim: number, lambda: number = 0.98) {
        this.theta = new Array(dim).fill(0).map(() => [0]);
        this.P = new Array(dim).fill(0).map((_, i) => 
            new Array(dim).fill(0).map((_, j) => i === j ? 1000 : 0)
        );
        this.lambda = lambda;
    }

    public update(phi: number[], y: number): number[] {
        const phiMat = phi.map(v => [v]);
        const phiT = MatrixMath.transpose(phiMat);

        // 1. Calculate gain L(k)
        // L = P * phi / (lambda + phi^T * P * phi)
        const Pphi = MatrixMath.multiply(this.P, phiMat);
        const phiTPphi = MatrixMath.multiply(phiT, Pphi)[0][0];
        const denom = this.lambda + phiTPphi;
        const L = MatrixMath.scale(Pphi, 1 / denom);

        // 2. Prediction error
        const yPred = MatrixMath.multiply(phiT, this.theta)[0][0];
        const error = y - yPred;

        // 3. Update theta
        const deltaTheta = MatrixMath.scale(L, error);
        this.theta = MatrixMath.add(this.theta, deltaTheta);

        // 4. Update Covariance P
        // P = (P - L * phi^T * P) / lambda
        const LphiT = MatrixMath.multiply(L, phiT);
        const LphiTP = MatrixMath.multiply(LphiT, this.P);
        this.P = MatrixMath.scale(MatrixMath.subtract(this.P, LphiTP), 1 / this.lambda);

        return this.theta.map(v => v[0]);
    }

    public getParams(): number[] {
        return this.theta.map(v => v[0]);
    }
}

/**
 * Model Predictive Control (MPC) Optimizer
 */
class MPCOptimizer {
    private horizon: number = 5;
    private dt: number = 0.05;

    public optimize(
        currentRpm: number,
        currentLoad: number,
        targetLoad: number,
        currentBoost: number,
        targetBoost: number,
        params: number[] // [loadGain, boostGain, boostDecay]
    ): { optimalThrottle: number, optimalWastegate: number } {
        let bestCost = Infinity;
        let bestThrottle = 0;
        let bestWastegate = 0;

        const loadGain = params[0] || 0.8;
        const boostGain = params[1] || 0.03;
        const boostDecay = params[2] || 0.2;

        // Grid search for MPC optimization
        const throttleOptions = [0, 20, 40, 60, 80, 100];
        const wastegateOptions = [0, 25, 50, 75, 100];

        for (const throttle of throttleOptions) {
            for (const wastegate of wastegateOptions) {
                let cost = 0;
                let simRpm = currentRpm;
                let simLoad = currentLoad;
                let simBoost = currentBoost;

                for (let i = 0; i < this.horizon; i++) {
                    const loadDerivative = (throttle - simLoad) * loadGain;
                    const boostDerivative = (wastegate * boostGain * (simRpm / 1000)) - (simBoost * boostDecay);
                    
                    simLoad += loadDerivative * this.dt;
                    simBoost += boostDerivative * this.dt;
                    simRpm += (simLoad * 15) * this.dt; 

                    const loadError = targetLoad - simLoad;
                    const boostError = targetBoost - simBoost;
                    
                    cost += (loadError * loadError) * 1.0;
                    cost += (boostError * boostError) * 5.0;
                    cost += (throttle * throttle) * 0.0001;
                    cost += (wastegate * wastegate) * 0.0001;
                }

                if (cost < bestCost) {
                    bestCost = cost;
                    bestThrottle = throttle;
                    bestWastegate = wastegate;
                }
            }
        }

        return { optimalThrottle: bestThrottle, optimalWastegate: bestWastegate };
    }
}

const rls = new RLS(3); // [load_eff, boost_eff, const]
const mpc = new MPCOptimizer();

self.onmessage = (e: MessageEvent) => {
    const { type, payload, id } = e.data;

    switch (type) {
        case 'UPDATE_RLS': {
            const { phi, y } = payload;
            const theta = rls.update(phi, y);
            (self as any).postMessage({ id, type: 'RLS_UPDATED', payload: theta });
            break;
        }

        case 'OPTIMIZE_MPC': {
            const { currentRpm, currentLoad, targetLoad, currentBoost, targetBoost, params } = payload;
            const result = mpc.optimize(currentRpm, currentLoad, targetLoad, currentBoost, targetBoost, params);
            (self as any).postMessage({ id, type: 'MPC_OPTIMIZED', payload: result });
            break;
        }
        
        case 'GET_PARAMS': {
            (self as any).postMessage({ id, type: 'PARAMS_RESULT', payload: rls.getParams() });
            break;
        }
    }
};
