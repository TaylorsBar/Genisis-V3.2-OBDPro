export type ThrottleMode = 'ECO' | 'LINEAR' | 'SPORT' | 'RACE' | 'VALET';

export class ThrottleController {
    /**
     * Maps pedal position to throttle plate opening based on selected mode.
     * @param pedal Pedal position (0-100)
     * @param mode Selected throttle mode
     * @returns Throttle plate opening (0-100)
     */
    public static mapPedal(pedal: number, mode: ThrottleMode): number {
        if (pedal <= 0) return 0;
        if (pedal >= 100) return 100;

        switch (mode) {
            case 'ECO':
                // Lazy response: pedal^1.5
                return Math.pow(pedal / 100, 1.5) * 100;
            case 'SPORT':
                // Aggressive mid-range: pedal^0.7
                return Math.pow(pedal / 100, 0.7) * 100;
            case 'RACE':
                // Instant response: pedal^0.4
                return Math.pow(pedal / 100, 0.4) * 100;
            case 'VALET':
                // Capped at 30%
                return Math.min(30, pedal * 0.5);
            case 'LINEAR':
            default:
                return pedal;
        }
    }

    /**
     * Generates a full 16x16 throttle map for a given mode.
     */
    public static generateMap(mode: ThrottleMode): number[][] {
        const map: number[][] = [];
        for (let r = 0; r < 16; r++) {
            const pedal = (r / 15) * 100;
            const throttle = this.mapPedal(pedal, mode);
            map.push(new Array(16).fill(throttle));
        }
        return map;
    }
}
