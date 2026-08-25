
export interface TuningMap {
    id: string;
    description: string;
    start: number;
    size: number;
    safeRange: { min: number, max: number };
}

// NOTE: These are abstract structures. In a real environment, these would be 
// populated by a secure, vehicle-specific definition database
interface EcuPlatformDef {
    id: string;
    description: string;
    protectedRanges: { start: number, end: number, label: string }[];
    features: Record<string, TuningMap>;
}

const ECU_PLATFORMS: Record<string, EcuPlatformDef> = {
    'INFINITI_G25_2011': {
        id: 'INFINITI_G25_2011',
        description: 'Nissan/Infiniti VQ25HR (7058 Platform)',
        protectedRanges: [
            { start: 0x00000, end: 0x07FFF, label: 'Secondary Bootloader / Recov' },
            { start: 0x10000, end: 0x10FFF, label: 'Serial & Immobilizer NVM' },
            { start: 0xF0000, end: 0xFFFFF, label: 'Service Table Descriptors' }
        ],
        features: {
            'GHOST_CAM': {
                id: 'IDLE_ADJ_01',
                description: 'Idle RPM and Timing Stability',
                start: 0x20500, // Normalized for typical SH7058 maps
                size: 16,
                safeRange: { min: 650, max: 950 }
            },
            'LAUNCH_CONTROL': {
                id: 'LAUNCH_ADJ_01',
                description: 'Launch RPM Limit',
                start: 0x20600,
                size: 4,
                safeRange: { min: 2500, max: 4500 }
            }
        }
    }
};

export class MemoryProtector {
    private static currentEcuId = 'INFINITI_G25_2011'; 

    public static isSafeToWrite(featureId: string, value: number): { safe: boolean; reason?: string } {
        const platform = ECU_PLATFORMS[this.currentEcuId];
        if (!platform) return { safe: false, reason: "ECU Platform not identified." };

        const map = platform.features[featureId];
        if (!map) return { safe: false, reason: "Feature not found in platform definition." };
        
        // 1. Boundary Check
        if (value < map.safeRange.min || value > map.safeRange.max) {
            return { safe: false, reason: `Safety Threshold violation: ${value} is outside verified stable range [${map.safeRange.min}-${map.safeRange.max}].` };
        }

        // 2. Overlap Check (Atomic Protection)
        const targetStart = map.start;
        const targetEnd = map.start + map.size;

        for (const range of platform.protectedRanges) {
            if ((targetStart >= range.start && targetStart <= range.end) || 
                (targetEnd >= range.start && targetEnd <= range.end)) {
                return { safe: false, reason: `CRITICAL: Overlap detected with ${range.label} range. Write ABORTED.` };
            }
        }
        
        return { safe: true };
    }

    public static getFeatureMap(featureId: string): TuningMap | undefined {
        return ECU_PLATFORMS[this.currentEcuId]?.features[featureId];
    }
}
