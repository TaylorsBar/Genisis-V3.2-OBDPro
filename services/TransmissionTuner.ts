export type ShiftMode = 'ECO' | 'NORMAL' | 'SPORT' | 'RACE' | 'MANUAL';

export class TransmissionTuner {
    /**
     * Optimizes shift points based on mode.
     * @param baseRpm Original shift RPM
     * @param throttle Throttle position (0-100)
     * @param mode Selected shift mode
     * @returns Optimized shift RPM
     */
    public static optimizeShiftPoint(baseRpm: number, throttle: number, mode: ShiftMode): number {
        switch (mode) {
            case 'ECO':
                return Math.max(1800, baseRpm * 0.85);
            case 'SPORT':
                return Math.min(7200, baseRpm * 1.15 + (throttle > 80 ? 500 : 0));
            case 'RACE':
                return Math.min(7500, baseRpm * 1.3 + (throttle > 50 ? 800 : 0));
            case 'MANUAL':
                return 8000; // Hard limit
            case 'NORMAL':
            default:
                return baseRpm;
        }
    }

    /**
     * Generates a full 16x16 TCU shift map for a given mode.
     */
    public static generateShiftMap(mode: ShiftMode): number[][] {
        const map: number[][] = [];
        for (let r = 0; r < 16; r++) {
            const throttle = (r / 15) * 100;
            const row: number[] = [];
            for (let c = 0; c < 16; c++) {
                const baseRpm = 2500 + (throttle * 20); // Simple base schedule
                row.push(this.optimizeShiftPoint(baseRpm, throttle, mode));
            }
            map.push(row);
        }
        return map;
    }
}
