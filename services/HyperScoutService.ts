/**
 * Hyper-Scout Engine (Gena.I RE Engine)
 * 
 * Implements real-time ECU memory mapping via Unified Diagnostic Services (UDS).
 * Uses a Shannon Entropy and Statistical Variance Dual-Classifier to identify
 * structured calibration tables vs executable code vs padding.
 * Incorporates Adaptive Stride Optimization to reduce scan time.
 */

export interface MapRegion {
    address: number;
    size: number;
    entropy: number;
    variance: number;
    type: 'CALIBRATION_TABLE' | 'EXECUTABLE_CODE' | 'PADDING' | 'UNKNOWN';
}

export class HyperScoutService {
    private static instance: HyperScoutService;
    private memoryCache: Map<number, Uint8Array> = new Map();

    // Classification Thresholds
    private readonly CAL_ENTROPY_MIN = 4.5;
    private readonly CAL_ENTROPY_MAX = 5.8;
    private readonly CAL_VARIANCE_MIN = 500.0;
    
    private readonly CODE_ENTROPY_MIN = 6.5;
    private readonly PADDING_ENTROPY_MAX = 2.0;

    private constructor() {}

    public static getInstance(): HyperScoutService {
        if (!HyperScoutService.instance) {
            HyperScoutService.instance = new HyperScoutService();
        }
        return HyperScoutService.instance;
    }

    /**
     * Calculates Shannon Entropy of a memory block (in bits)
     */
    public calculateShannonEntropy(data: Uint8Array): number {
        if (data.length === 0) return 0;
        const frequencies = new Array(256).fill(0);
        for (let i = 0; i < data.length; i++) {
            frequencies[data[i]]++;
        }
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (frequencies[i] > 0) {
                const p = frequencies[i] / data.length;
                entropy -= p * Math.log2(p);
            }
        }
        return entropy;
    }

    /**
     * Calculates Statistical Variance of a memory block
     */
    public calculateVariance(data: Uint8Array): number {
        if (data.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        const mean = sum / data.length;
        let squaredDiffSum = 0;
        for (let i = 0; i < data.length; i++) {
            const diff = data[i] - mean;
            squaredDiffSum += diff * diff;
        }
        return squaredDiffSum / data.length;
    }

    /**
     * Dual-Classifier using Entropy and Variance
     */
    public classifyRegion(data: Uint8Array): 'CALIBRATION_TABLE' | 'EXECUTABLE_CODE' | 'PADDING' | 'UNKNOWN' {
        const entropy = this.calculateShannonEntropy(data);
        const variance = this.calculateVariance(data);

        if (entropy >= this.CAL_ENTROPY_MIN && entropy <= this.CAL_ENTROPY_MAX && variance > this.CAL_VARIANCE_MIN) {
            return 'CALIBRATION_TABLE';
        } else if (entropy > this.CODE_ENTROPY_MIN) {
            return 'EXECUTABLE_CODE';
        } else if (entropy < this.PADDING_ENTROPY_MAX) {
            return 'PADDING';
        }
        return 'UNKNOWN';
    }

    /**
     * Adaptive Stride Optimization (skip-forward on hit logic)
     * Scans a large memory region in sub-linear time.
     */
    public async scanMemoryRegion(
        startAddress: number,
        endAddress: number,
        windowSize: number = 256,
        readUdsBlock: (addr: number, size: number) => Promise<Uint8Array | null>
    ): Promise<MapRegion[]> {
        const discoveredMaps: MapRegion[] = [];
        let currentAddress = startAddress;

        // Base Stride for general scanning
        const BASE_STRIDE = windowSize;
        // Skip-forward stride when a map is hit, to bypass large identified blocks quickly
        const SKIP_FORWARD_STRIDE = windowSize * 8; 

        while (currentAddress < endAddress) {
            const data = await readUdsBlock(currentAddress, windowSize);
            if (!data) {
                currentAddress += BASE_STRIDE;
                continue;
            }

            const entropy = this.calculateShannonEntropy(data);
            const variance = this.calculateVariance(data);
            const classification = this.classifyRegion(data);

            if (classification === 'CALIBRATION_TABLE') {
                discoveredMaps.push({
                    address: currentAddress,
                    size: windowSize,
                    entropy,
                    variance,
                    type: classification
                });
                
                // Adaptive Stride Logic: "skip-forward on hit"
                // Once we hit a calibration table, we know it's a dense map area,
                // we can skip forward larger chunks assuming continuous tables or moving to next boundary
                currentAddress += SKIP_FORWARD_STRIDE;
            } else if (classification === 'PADDING') {
                // Padding is usually large blocks of 00 or FF, skip fast
                currentAddress += SKIP_FORWARD_STRIDE;
            } else {
                // Standard step
                currentAddress += BASE_STRIDE;
            }
        }

        return discoveredMaps;
    }
    
    /**
     * Map of Maps Generator
     */
    public generateMapOfMaps(regions: MapRegion[]) {
        return regions.filter(r => r.type === 'CALIBRATION_TABLE');
    }
}
