import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenesisEKFUltimate } from '../services/GenesisEKFUltimate';

// Mock Worker since it's not available in node environment for vitest
vi.mock('../workers/genesisCoreWorker.ts', () => ({
    default: class {
        postMessage = vi.fn();
        onmessage = null;
    }
}));

describe('GenesisEKFUltimate', () => {
    let ekf: GenesisEKFUltimate;

    beforeEach(() => {
        ekf = new GenesisEKFUltimate();
        // Force main thread EKF by nulling worker
        (ekf as any).worker = null;
    });

    it('should initialize on first GPS fuse', () => {
        expect(ekf.isInitialized).toBe(false);
        ekf.fuseGps(25, 1.0);
        expect(ekf.isInitialized).toBe(true);
        expect(ekf.x[3]).toBe(25);
    });

    it('should fuse GPS speed correctly', () => {
        ekf.fuseGps(20, 1.0); // Initialize
        ekf.fuseGps(25, 0.5);
        expect(ekf.x[3]).toBeGreaterThan(20);
        expect(ekf.x[3]).toBeLessThanOrEqual(25);
    });

    it('should fuse OBD speed correctly', () => {
        ekf.fuseGps(20, 1.0); // Initialize
        ekf.fuseObdSpeed(22);
        expect(ekf.x[3]).toBeGreaterThan(20);
        expect(ekf.x[3]).toBeLessThanOrEqual(22);
    });

    it('should predict state based on IMU data', () => {
        ekf.fuseGps(20, 1.0); // Initialize at 20 m/s
        const initialSpeed = ekf.getEstimatedSpeed();
        ekf.predict([1, 0, 0], [0, 0, 0], 0.1); // Accelerate at 1 m/s^2 for 0.1s
        expect(ekf.getEstimatedSpeed()).toBeGreaterThan(initialSpeed);
    });

    it('should handle zero dt in predict', () => {
        ekf.fuseGps(20, 1.0);
        const initialX = [...ekf.x];
        ekf.predict([1, 0, 0], [0, 0, 0], 0);
        expect(ekf.x).toEqual(initialX);
    });

    it('should handle low speed in fuseGps', () => {
        ekf.fuseGps(0.1, 1.0); // Initialize
        ekf.fuseGps(1.0, 0.5); // Should update
        expect(ekf.x[3]).toBeGreaterThan(0.1);
    });

    it('should initialize on fuseObdSpeed', () => {
        ekf.fuseObdSpeed(22);
        expect(ekf.isInitialized).toBe(true);
        expect(ekf.x[3]).toBe(22);
    });

    it('should calculate uncertainty', () => {
        ekf.fuseGps(20, 1.0);
        const uncertainty = ekf.getUncertainty();
        expect(uncertainty).toBeGreaterThan(0);
    });

    it('should handle large innovation in update (Adaptive R)', () => {
        ekf.fuseGps(20, 1.0); // Initialize
        const initialP = [...ekf.P];
        ekf.fuseGps(100, 1.0); // Large innovation (80 m/s difference)
        // Adaptive R should increase R, making K smaller, so P should change less than if R was fixed
        // This is hard to test directly without exposing more, but we can check it doesn't crash
        expect(ekf.x[3]).toBeGreaterThan(20);
    });
});
