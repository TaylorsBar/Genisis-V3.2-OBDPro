const fs = require('fs');
let content = fs.readFileSync('services/DMAEngine.ts', 'utf8');

const monitorCode = `
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
            console.warn(\`[DMA Monitor] High Latency Detected! Avg: \${avgLatency.toFixed(2)}ms, Last: \${latencyMs.toFixed(2)}ms, Throughput: \${throughput.toFixed(2)} KB/s. Potential bottleneck in DMA transfer.\`);
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
`;

if (!content.includes('DMABufferMonitor')) {
    content += '\n' + monitorCode;
    fs.writeFileSync('services/DMAEngine.ts', content);
    console.log("DMABufferMonitor added to DMAEngine.ts");
}
