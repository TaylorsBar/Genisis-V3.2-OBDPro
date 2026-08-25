import { TuningTableType, PlatformConfig } from '../types';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class TuningValidator {
    /**
     * Validates a tuning map against platform constraints and safety rules.
     */
    public static validateMap(
        table: TuningTableType, 
        map: number[][], 
        config: PlatformConfig,
        xAxis: number[],
        yAxis: number[]
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (let r = 0; r < map.length; r++) {
            for (let c = 0; c < map[0].length; c++) {
                const val = map[r][c];
                const rpm = xAxis[c];
                const load = yAxis[r];

                switch (table) {
                    case 'ign':
                        if (val > 55) errors.push(`[IGN] Extreme advance at ${rpm} RPM / ${load}% Load: ${val}°`);
                        if (val < -30) warnings.push(`[IGN] High retard at ${rpm} RPM / ${load}% Load: ${val}° (Potential EGT risk)`);
                        break;
                    case 'throttle':
                        if (val < 0 || val > 100) errors.push(`[Throttle] Out of bounds value: ${val}%`);
                        // Check for non-monotonic throttle (throttle should generally increase with pedal)
                        if (r > 0 && val < map[r-1][c]) {
                            warnings.push(`[Throttle] Non-monotonic response at ${rpm} RPM: ${val}% is less than previous step.`);
                        }
                        break;
                    case 'tcu':
                        if (val > config.maxRpm) errors.push(`[TCU] Shift RPM ${val} exceeds engine redline ${config.maxRpm}`);
                        if (val < 1000) warnings.push(`[TCU] Unusually low shift RPM: ${val}`);
                        break;
                    case 'boost':
                        if (val > 3.0) errors.push(`[Boost] Dangerous boost target: ${val} bar`);
                        break;
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}
