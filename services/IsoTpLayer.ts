import { IFlashTransport } from "./FlashTransport";
import { J2534Protocol } from "./J2534Driver";

/**
 * Elite ISO-TP (ISO 15765-2) Transport Layer
 * Provides robust fragmentation, reassembly, and strict Flow Control (FC) handling
 * required for high-speed ECU reflashing over raw CAN networks.
 */
export class IsoTpLayer implements IFlashTransport {
    private driver: any;
    private blockSize: number = 0;
    private stMin: number = 0;

    constructor(driver: any) {
        this.driver = driver;
    }

    public async connect(): Promise<boolean> {
        if (this.driver.connect) {
            return await this.driver.connect(J2534Protocol.ISO15765, { baudRate: 500000, flags: 0 });
        }
        return true;
    }

    public disconnect(): void {
        if (this.driver.disconnect) {
            this.driver.disconnect();
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fragments and transmits a payload securely over ISO-TP, respecting Flow Control.
     * @param payload The raw bytes to send.
     */
    public async transmit(payload: Uint8Array, txCb?: (progress: number) => void): Promise<boolean> {
        const len = payload.length;

        if (len <= 7) {
            // Single Frame (SF)
            const frame = new Uint8Array(len + 1);
            frame[0] = len; 
            frame.set(payload, 1);
            await this.driver.write(frame);
            if (txCb) txCb(100);
            return true;
        }

        // First Frame (FF)
        const ff = new Uint8Array(8);
        ff[0] = 0x10 | ((len >> 8) & 0x0F);
        ff[1] = len & 0xFF;
        ff.set(payload.slice(0, 6), 2);
        await this.driver.write(ff);

        // Await Flow Control (FC)
        const fc = await this.waitForFlowControl();
        if (!fc) return false;

        let offset = 6;
        let seq = 1;
        let blocksSent = 0;

        while (offset < len) {
            // Respect Block Size (BS)
            if (this.blockSize > 0 && blocksSent >= this.blockSize) {
                const retryFc = await this.waitForFlowControl();
                if (!retryFc) return false;
                blocksSent = 0;
            }

            const cf = new Uint8Array(8);
            cf[0] = 0x20 | (seq & 0x0F);
            
            const chunk = payload.slice(offset, Math.min(offset + 7, len));
            cf.set(chunk, 1);
            
            await this.driver.write(cf);
            
            if (this.stMin > 0) {
                // Handle Separation Time (STmin)
                const delayMs = this.stMin < 0x80 ? this.stMin : (this.stMin - 0xF0) * 0.1;
                await this.delay(delayMs);
            }

            offset += 7;
            seq = (seq + 1) % 16;
            blocksSent++;
            
            if (txCb) txCb((offset / len) * 100);
        }

        return true;
    }

    /**
     * Legacy internal fragmentation (for testing without flow control).
     */
    public fragment(payload: Uint8Array): Uint8Array[] {
        const frames: Uint8Array[] = [];
        const len = payload.length;

        if (len <= 7) {
            const frame = new Uint8Array(len + 1);
            frame[0] = len;
            frame.set(payload, 1);
            frames.push(frame);
        } else {
            const ff = new Uint8Array(8);
            ff[0] = 0x10 | ((len >> 8) & 0x0F);
            ff[1] = len & 0xFF;
            ff.set(payload.slice(0, 6), 2);
            frames.push(ff);

            let offset = 6;
            let seq = 1;
            while (offset < len) {
                const cf = new Uint8Array(8);
                cf[0] = 0x20 | (seq & 0x0F);
                const chunk = payload.slice(offset, offset + 7);
                cf.set(chunk, 1);
                frames.push(cf);
                
                offset += 7;
                seq = (seq + 1) % 16;
            }
        }
        return frames;
    }

    /**
     * Waits for an incoming Flow Control frame (PCI starting with 0x30).
     */
    private async waitForFlowControl(timeoutMs: number = 2000): Promise<boolean> {
        // In simulation, we fake the FC immediately
        if (!this.driver.read) {
            this.blockSize = 0;
            this.stMin = 0;
            return true;
        }

        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const frame = await this.driver.read(100); // 100ms internal timeout
            if (frame && frame.data && (frame.data[0] & 0xF0) === 0x30) {
                // Flow Control logic
                const fs = frame.data[0] & 0x0F; // Flow Status
                if (fs === 0x00) { // Clear To Send
                    this.blockSize = frame.data[1];
                    this.stMin = frame.data[2];
                    return true;
                } else if (fs === 0x01) { // Wait
                    await this.delay(500); // Wait and loop
                } else if (fs === 0x02) { // Overflow/Abort
                    return false;
                }
            }
        }
        console.error("ISO-TP: Timeout waiting for Flow Control");
        return false;
    }

    /**
     * Public alias for reassembly.
     */
    public async receive(timeoutMs: number = 2000): Promise<Uint8Array | null> {
        return this.receiveMessage(timeoutMs);
    }

    /**
     * Reassembles a large message from multiple ISO-TP frames natively.
     */
    public async receiveMessage(timeoutMs: number = 2000): Promise<Uint8Array | null> {
        if (!this.driver.read) return null;
        
        const start = Date.now();
        let payload = new Uint8Array(0);
        let expectedLen = 0;
        let bytesReceived = 0;
        let expectedSeq = 1;

        while (Date.now() - start < timeoutMs) {
            const frame = await this.driver.read(500);
            if (!frame || !frame.data) continue;

            const pci = frame.data[0] >> 4;
            if (pci === 0) { // Single Frame
                const len = frame.data[0] & 0x0F;
                return new Uint8Array(frame.data.slice(1, 1 + len));
            } 
            
            if (pci === 1) { // First Frame
                expectedLen = ((frame.data[0] & 0x0F) << 8) | frame.data[1];
                payload = new Uint8Array(expectedLen);
                const chunk = frame.data.slice(2, 8);
                payload.set(chunk, 0);
                bytesReceived = 6;
                expectedSeq = 1;
                
                // Send Flow Control (Clear to Send)
                const fc = new Uint8Array([0x30, 0x00, 0x00]); // CTS, BS=0, STmin=0
                await this.driver.write(fc);
            } else if (pci === 2) { // Consecutive Frame
                if (payload.length === 0) continue; 

                const seq = frame.data[0] & 0x0F;
                if (seq !== expectedSeq) {
                    console.error(`ISO-TP: Sequence mismatch! Expected ${expectedSeq}, got ${seq}`);
                    return null;
                }
                
                const remaining = expectedLen - bytesReceived;
                const chunkSize = Math.min(7, remaining);
                const chunk = frame.data.slice(1, 1 + chunkSize);
                payload.set(chunk, bytesReceived);
                
                bytesReceived += chunkSize;
                expectedSeq = (expectedSeq + 1) % 16;
                
                if (bytesReceived >= expectedLen) {
                    return payload;
                }
            }
        }
        return null; 
    }
}

