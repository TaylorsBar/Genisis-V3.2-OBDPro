
import { EcuVariant, AddrMode, MemoryParam } from '../types';
import { GenesisExpandedDb } from './GenesisExpandedDb';

/**
 * Genesis DMA Engine
 * 
 * Maps specific RAM/Flash addresses for direct memory access based on OS ID.
 * Implements UDS Service 0x23 (ReadMemoryByAddress) and 0x2C (DynamicallyDefineDataIdentifier).
 */
export class DMAEngine {
    public static getVariant(osId: string): EcuVariant | null {
        return GenesisExpandedDb.findVariant(osId);
    }

    /**
     * UDS 0x23: ReadMemoryByAddress
     */
    public static buildReadCommand(param: MemoryParam, mode: AddrMode): string {
        const addrLenBytes = mode / 8;
        const sizeLenBytes = 1;
        const formatId = (sizeLenBytes << 4) | addrLenBytes;
        const addrHex = param.address.toString(16).toUpperCase().padStart(addrLenBytes * 2, '0');
        const sizeHex = param.sizeBytes.toString(16).toUpperCase().padStart(sizeLenBytes * 2, '0');
        return `23${formatId.toString(16).toUpperCase()}${addrHex}${sizeHex}`;
    }

    /**
     * KWP2000 0x21: ReadDataByLocalIdentifier
     * Common in older Nissan/Toyota K-Line platforms.
     */
    public static buildReadByLocalId(param: MemoryParam): string {
        // Formatted as 21 [Local ID]
        const idHex = (param.address & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        return `21${idHex}`;
    }

    /**
     * UDS 0x2C 02: DynamicallyDefineDataIdentifier (By Memory Address)
     */
    public static buildDPIDDefinition(dpid: number, params: MemoryParam[], mode: AddrMode): string {
        const addrLenBytes = mode / 8;
        const sizeLenBytes = 1;
        const formatId = (sizeLenBytes << 4) | addrLenBytes;
        let cmd = `2C02${dpid.toString(16).toUpperCase().padStart(2, '0')}${formatId.toString(16).toUpperCase()}`;
        params.forEach(p => {
            const addrHex = p.address.toString(16).toUpperCase().padStart(addrLenBytes * 2, '0');
            const sizeHex = p.sizeBytes.toString(16).toUpperCase().padStart(sizeLenBytes * 2, '0');
            cmd += addrHex + sizeHex;
        });
        return cmd;
    }

    /**
     * UDS 0x22: ReadDataByIdentifier
     */
    public static buildReadByIdentifier(dpid: number): string {
        return `22${dpid.toString(16).toUpperCase().padStart(4, '0')}`;
    }
}


/**
 * Monitors memory-mapped buffer transfer latencies to detect bottlenecks
 * during high-frequency sensor data injection.
 */
export class DMABufferMonitor {
    private latencies: number[] = [];
    private readonly MAX_HISTORY = 100;
    private readonly WARNING_THRESHOLD_MS = 5.0; // 5ms threshold

    public recordTransfer(latencyMs: number, bytesTransferred: number) {
        this.latencies.push(latencyMs);
        if (this.latencies.length > this.MAX_HISTORY) {
            this.latencies.shift();
        }

        const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
        const throughput = (bytesTransferred / (Math.max(0.001, latencyMs) / 1000)) / 1024; // KB/s

        if (avgLatency > this.WARNING_THRESHOLD_MS) {
            console.warn(`[DMA Monitor] High Latency Detected! Avg: ${avgLatency.toFixed(2)}ms, Last: ${latencyMs.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} KB/s. Potential bottleneck in DMA transfer.`);
        }
    }
    
    public getStats() {
        if (this.latencies.length === 0) return { avg: 0, max: 0 };
        return {
            avg: this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length,
            max: Math.max(...this.latencies)
        };
    }
}
