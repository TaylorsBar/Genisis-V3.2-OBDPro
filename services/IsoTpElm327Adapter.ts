import { ObdService } from './ObdService';
import { IFlashTransport } from './FlashTransport';

export class IsoTpElm327Adapter implements IFlashTransport {
    // Instead of `driver`, we inject your ObdService
    constructor(private obd: ObdService) {}

    public async connect(): Promise<boolean> {
        // ELM327 specific setup for flashing
        await this.obd.runCommand("AT Z", 1, 1000); // Reset
        await this.obd.runCommand("AT E0", 1, 500); // Echo off
        await this.obd.runCommand("AT L0", 1, 500); // Linefeeds off
        await this.obd.runCommand("AT H1", 1, 500); // Headers on (needed for reassembly)
        await this.obd.runCommand("AT SP 6", 1, 1000); // Set Protocol 6 (ISO 15765-4 CAN 11/500)
        await this.obd.runCommand("AT SH 7E0", 1, 500); // Set Header to Engine ECU
        
        // --- THROUGHPUT OPTIMIZATIONS ---
        // AT ST (Separation Time) - 00 = Fast as possible. 
        // Note: Some clones need 02 or 05 to avoid buffer overrun.
        await this.obd.runCommand("AT ST 00", 1, 500); 
        
        // AT BS (Block Size) - Set to 0 to send all CFs in one go (if ECU supports)
        // Or set to a small value (e.g. 08) if the ELM327 buffer is tiny.
        await this.obd.runCommand("AT BS 00", 1, 500);
        
        // AT CAF0 (CAN Auto Formatting Off) - We handle PCI bytes manually in transmit()
        await this.obd.runCommand("AT CAF 0", 1, 500);

        return true;
    }

    public disconnect(): void {
        // Return to standard OBD mode
        this.obd.runCommand("AT Z", 0, 500).catch(() => {});
    }

    public async receive(timeoutMs: number = 2000): Promise<Uint8Array | null> {
        // Use an empty command to poll the buffer if needed, 
        // but typically receive() is called after a transmit() that expects a response.
        const res = await this.obd.runCommand("", 0, timeoutMs);
        return this.receiveMessage(res);
    }

    /**
     * Translates a raw CAN frame (Uint8Array of exactly 8 bytes) 
     * into an ELM327 "8 <hex>" ASCII command and runs it.
     */
    private async sendRawCan(frame: Uint8Array): Promise<string> {
        const hex = Array.from(frame)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
        // ELM327 raw CAN command: "8 <bytes>"
        return await this.obd.runCommand(`8 ${hex}`, 1, 2000);
    }

    /**
     * The actual transmit function. 
     * Replaces your `driver.write` logic with synchronous ELM327 command chains.
     */
    public async transmit(payload: Uint8Array, txCb?: (progress: number) => void): Promise<boolean> {
        const len = payload.length;

        // 1. Single Frame (SF) - ELM327 just sends it
        if (len <= 7) {
            const sf = new Uint8Array(len + 1);
            sf[0] = len; 
            sf.set(payload, 1);
            const res = await this.sendRawCan(sf);
            // UDS positive response might be 0x76 or 0x74 here
            return res.includes("76") || res.includes("74");
        }

        // 2. First Frame (FF) - Send and wait for Flow Control (FC) response
        const ff = new Uint8Array(8);
        ff[0] = 0x10 | ((len >> 8) & 0x0F);
        ff[1] = len & 0xFF;
        ff.set(payload.slice(0, 6), 2);

        // Send FF, the ECU replies immediately with a Flow Control frame (e.g., "30 00 00")
        let fcResponse = await this.sendRawCan(ff);
        
        // Parse FC from ELM327 ASCII response
        // Response comes back as something like "30 00 00" or "30 01 14"
        const parsedFc = this.parseFlowControl(fcResponse);
        if (!parsedFc) {
            console.error("ISO-TP: Invalid FC response", fcResponse);
            return false;
        }

        let offset = 6;
        let seq = 1;
        let blocksSent = 0;
        let fc = parsedFc;

        // 3. Consecutive Frames (CF) - Loop with Flow Control enforcement
        while (offset < len) {
            // Respect Block Size (BS)
            if (fc.blockSize > 0 && blocksSent >= fc.blockSize) {
                // We hit the block size. The ECU will send a new FC frame 
                // in response to the *next* CF, but the ELM327 doesn't 
                // auto-send it. We must read it manually.
                // In practice, to keep it simple, we just send the next CF 
                // and parse the FC *from the response of that CF*.
            }

            const cf = new Uint8Array(8);
            cf[0] = 0x20 | (seq & 0x0F);
            const chunk = payload.slice(offset, Math.min(offset + 7, len));
            cf.set(chunk, 1);

            // Send CF - the response from the ELM327 may contain:
            // a. The next FC frame (if blockSize was hit)
            // b. The final UDS response (if this was the last CF)
            const cfResponse = await this.sendRawCan(cf);

            // Check if response is a new Flow Control
            const newFc = this.parseFlowControl(cfResponse);
            if (newFc) {
                fc = newFc; // Update parameters
                blocksSent = 0; // Reset block count
            }

            // If response is the actual UDS positive response (e.g., "76", "74") we are done
            if (cfResponse.includes("76") || cfResponse.includes("74")) {
                if (txCb) txCb(100);
                return true;
            }

            // Separation Time (STmin) - ELM327 handles most of this, 
            // but we apply a simple delay if needed
            if (fc.stMin > 0 && fc.stMin <= 0x7F) {
                await this.delay(fc.stMin); // ms
            }

            offset += 7;
            seq = (seq + 1) % 16;
            blocksSent++;
            if (txCb) txCb((offset / len) * 100);
        }

        return true;
    }

    /**
     * Parses an ELM327 ASCII response to see if it contains a Flow Control frame (0x30)
     */
    private parseFlowControl(response: string): { blockSize: number; stMin: number } | null {
        const clean = response.replace(/[\s\r\n>]/g, '').toUpperCase();
        // FC is identified by 0x30 as the first byte in the raw CAN response.
        // ELM327 returns it as "30 00 00" or "30 01 14"
        const idx = clean.indexOf("30");
        if (idx !== -1 && clean.length >= idx + 6) {
            const fs = parseInt(clean.substring(idx + 2, idx + 4), 16); // Flow Status
            // 0x00 = CTS, 0x01 = Wait, 0x02 = Overflow
            if (fs === 0x00) {
                const bs = parseInt(clean.substring(idx + 4, idx + 6), 16);
                const stMin = parseInt(clean.substring(idx + 6, idx + 8), 16);
                return { blockSize: bs, stMin };
            }
        }
        return null;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(res => setTimeout(res, ms));
    }

    /**
     * Reassembles a large message from multiple ISO-TP frames natively.
     * Implements receive logic for UDS multi-frame responses.
     */
    public async receiveMessage(initialResponse: string): Promise<Uint8Array | null> {
        const lines = initialResponse.split('\n')
            .map(l => l.replace(/[\s\r>]/g, '').toUpperCase())
            .filter(l => l.length >= 2);
        
        let foundFf = false;
        let expectedLen = 0;
        let payload: Uint8Array | null = null;
        let currentOffset = 0;
        let expectedSeq = 1;

        // Collect all lines to process
        let allLines = [...lines];

        // 1. First Pass: Parse the First Frame (FF) or Single Frame (SF)
        for (let i = 0; i < allLines.length; i++) {
            let line = allLines[i];
            
            // Strip headers if present
            if (line.startsWith("7E8") || line.startsWith("7E9")) {
                line = line.substring(3);
            } else if (line.length % 2 !== 0 && line.length >= 3) {
                line = line.substring(3);
            } else if (line.length >= 8 && line.length % 2 === 0 && parseInt(line.substring(0, 4), 16) > 0x0FFF) {
                if (line.length >= 10 && (line.substring(0, 2) === '18' || line.substring(0, 2) === '19')) {
                    line = line.substring(8);
                }
            }

            if (line.length < 2) continue;

            const byte0 = parseInt(line.substring(0, 2), 16);
            const pci = byte0 >> 4;

            if (pci === 0) {
                // Single Frame (SF)
                const len = byte0 & 0x0F;
                if (len > 0 && line.length >= 2 + len * 2) {
                    const payloadHex = line.substring(2, 2 + len * 2);
                    return this.hexToBytes(payloadHex);
                }
            } else if (pci === 1) {
                // First Frame (FF)
                const byte1 = parseInt(line.substring(2, 4), 16);
                expectedLen = ((byte0 & 0x0F) << 8) | byte1;
                payload = new Uint8Array(expectedLen);
                
                // Copy the first 6 bytes of payload from FF (from hex index 4 to 16)
                const ffPayloadHex = line.substring(4, 16);
                const ffBytes = this.hexToBytes(ffPayloadHex);
                
                const toCopyFf = Math.min(ffBytes.length, expectedLen);
                payload.set(ffBytes.slice(0, toCopyFf), 0);
                currentOffset = toCopyFf;
                
                foundFf = true;
                // Remove FF from lines list so we don't re-process it as CF
                allLines.splice(i, 1);
                break;
            }
        }

        if (!foundFf || !payload) {
            return null;
        }

        // 2. Transmit Flow Control (FC) frame to prompt Consecutive Frames (CFs)
        const fc = new Uint8Array(8);
        fc[0] = 0x30; // CTS (Clear To Send)
        fc[1] = 0x00; // Block Size = 0 (Send all remaining)
        fc[2] = 0x00; // STmin = 0 (No minimum delay requested)

        const cfResponse = await this.sendRawCan(fc);

        // 3. Process CFs in response
        const cfLines = cfResponse.split('\n')
            .map(l => l.replace(/[\s\r>]/g, '').toUpperCase())
            .filter(l => l.length >= 2);
        
        allLines = [...allLines, ...cfLines];

        // Process Consecutive Frames sequentially
        const processLines = (linesToProcess: string[]) => {
            for (let line of linesToProcess) {
                if (line.startsWith("7E8") || line.startsWith("7E9")) {
                    line = line.substring(3);
                } else if (line.length % 2 !== 0 && line.length >= 3) {
                    line = line.substring(3);
                } else if (line.length >= 8 && line.length % 2 === 0 && parseInt(line.substring(0, 4), 16) > 0x0FFF) {
                    if (line.length >= 10 && (line.substring(0, 2) === '18' || line.substring(0, 2) === '19')) {
                        line = line.substring(8);
                    }
                }

                if (line.length < 2) continue;

                const byte0 = parseInt(line.substring(0, 2), 16);
                const pci = byte0 >> 4;

                if (pci === 2) {
                    const seq = byte0 & 0x0F;
                    if (seq === expectedSeq) {
                        const chunkHex = line.substring(2);
                        const chunkBytes = this.hexToBytes(chunkHex);
                        
                        const toCopy = Math.min(chunkBytes.length, expectedLen - currentOffset);
                        payload!.set(chunkBytes.slice(0, toCopy), currentOffset);
                        currentOffset += toCopy;
                        
                        expectedSeq = (expectedSeq + 1) % 16;

                        if (currentOffset >= expectedLen) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        // First pass of processing CFs
        let completed = processLines(allLines);
        if (completed) {
            return payload;
        }

        // 4. Fallback Polling Loop: If we are still missing frames, poll ELM327 buffer
        let pollCount = 0;
        while (currentOffset < expectedLen && pollCount < 3) {
            await this.delay(10);
            const extraRes = await this.obd.runCommand("", 0, 500);
            if (!extraRes || extraRes.trim() === "" || extraRes.includes("?")) {
                pollCount++;
                continue;
            }

            const extraLines = extraRes.split('\n')
                .map(l => l.replace(/[\s\r>]/g, '').toUpperCase())
                .filter(l => l.length >= 2);

            completed = processLines(extraLines);
            if (completed) {
                return payload;
            }
            pollCount++;
        }

        if (currentOffset >= expectedLen) {
            return payload;
        }

        console.error(`ISO-TP: Reassembly timed out. Got ${currentOffset}/${expectedLen} bytes.`);
        return null;
    }

    private hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(Math.floor(hex.length / 2));
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }
}
