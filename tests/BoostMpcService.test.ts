import { describe, it, expect, beforeEach } from 'vitest';
import { BoostMpcService } from '../services/ATEngine';

describe('BoostMpcService', () => {
    let mpc: BoostMpcService;

    beforeEach(() => {
        mpc = new BoostMpcService();
    });

    it('should optimize wastegate for target boost', async () => {
        // Current boost 1.0, target 1.5. Wastegate should increase.
        const result = await mpc.optimizeControl(2000, 100, 100, 1.0, 1.5);
        expect(result.optimalWastegate).toBeGreaterThan(0);
    });

    it('should minimize wastegate when boost is over target', async () => {
        // Current boost 2.0, target 1.5. Wastegate should be 0.
        const result = await mpc.optimizeControl(2000, 100, 100, 2.0, 1.5);
        expect(result.optimalWastegate).toBe(0);
    });

    it('should optimize throttle for target load', async () => {
        // Current load 50, target 100. Throttle should increase.
        const result = await mpc.optimizeControl(2000, 50, 100, 1.0, 1.0);
        expect(result.optimalThrottle).toBeGreaterThan(50);
    });

    it('should handle zero target boost', async () => {
        const result = await mpc.optimizeControl(2000, 100, 100, 1.0, 0);
        expect(result.optimalWastegate).toBe(0);
    });
});
