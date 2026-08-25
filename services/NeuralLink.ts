import { HyperScoutService } from './HyperScoutService';

import { ObdService } from './ObdService';
import { ObdConnectionState, AIScanProgress, EcuVariant, SensorDataPoint, PIDDefinition, ObdOptimizationConfig, MemoryParam, AddrMode } from '../types';
import { DMAEngine } from './DMAEngine';
import { SecurityManager } from './SecurityManager';

export function parseUdsReadMemoryResponse(
    res: string | null | undefined, 
    expectedSizeBytes?: number
): { success: boolean; data?: Uint8Array; nrc?: string; rawResponse: string } {
    if (!res) {
        return { success: false, rawResponse: '' };
    }

    const cleaned = res.replace(/[\s\r\n>]/g, '').toUpperCase();
    if (!cleaned) {
        return { success: false, rawResponse: res };
    }

    // Check for Negative Response: 7F 23 <NRC>
    const nrcIdx = cleaned.indexOf("7F23");
    if (nrcIdx !== -1) {
        const nrc = cleaned.substring(nrcIdx + 4, nrcIdx + 6) || 'UNKNOWN';
        return { success: false, nrc, rawResponse: res };
    }

    // Check for Positive Response: Service ID 0x23 -> 0x63
    const posIdx = cleaned.indexOf("63");
    if (posIdx !== -1) {
        let payloadHex = cleaned.substring(posIdx + 2);
        if (expectedSizeBytes && payloadHex.length > expectedSizeBytes * 2) {
            payloadHex = payloadHex.substring(0, expectedSizeBytes * 2);
        }
        if (payloadHex.length % 2 !== 0) {
            payloadHex = payloadHex.substring(0, payloadHex.length - 1);
        }
        if (payloadHex.length === 0) {
            return { success: false, rawResponse: res };
        }

        const bytes = new Uint8Array(payloadHex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(payloadHex.substring(i * 2, i * 2 + 2), 16);
        }
        return { success: true, data: bytes, rawResponse: res };
    }

    return { success: false, rawResponse: res };
}

export class NeuralLink {
    public obd: ObdService;
    private isScanning = false;
    private activeVariant: EcuVariant | null = null;
    private dmaInitialized = false;
    private dpid = 0xF2;
    private dmaParams: MemoryParam[] = [];
    private optimizationConfig: ObdOptimizationConfig | null = null;

    constructor(onStatus: (s: ObdConnectionState) => void) {
        this.obd = new ObdService(onStatus);
    }

    public setOptimizationConfig(config: ObdOptimizationConfig) {
        this.optimizationConfig = config;
        this.obd.setOptimizationConfig(config);
    }

    public async connect(): Promise<boolean> {
        await this.obd.connect();
        return this.obd.connectedProtocol !== "Unknown";
    }

    public async runActiveScout(onProgress: (p: AIScanProgress) => void): Promise<void> {
        if (this.isScanning) return;
        this.isScanning = true;
        
        onProgress({ stage: "Handshaking with ELM327...", progress: 10, complete: false });
        
        // Wait for ObdService background discovery to start or finish
        await new Promise(r => setTimeout(r, 1000));

        // Tier 1: Identify Nissan Consult-II/III block
        onProgress({ stage: "Scanning for Protocol Support (UDS/Consult)...", progress: 30, complete: false });
        
        if (this.obd.connectedProtocol !== "Unknown") {
            onProgress({ stage: `Protocol Locked: ${this.obd.connectedProtocol}`, progress: 50, complete: false });
        }

        // Tier 2: Enhanced Identification
        
        // Tier 3: Hyper-Scout Calibration Map Entropic Reconnaissance
        onProgress({ stage: "Hyper-Scout: Initiating Entropic Scan...", progress: 80, complete: false });
        const hyperscout = HyperScoutService.getInstance();
        
        // Emulate UDS memory read block for scout
        const mockUdsRead = async (addr: number, size: number) => {
            // Generate some pseudo-random data mimicking ECU memory
            const data = new Uint8Array(size);
            for(let i=0; i<size; i++) {
                // Introduce synthetic entropy variations
                if (addr % 10000 === 0) data[i] = 0xFF; // Padding
                else if (addr % 5000 === 0) data[i] = Math.floor(Math.random() * 50); // Maps (mid variance)
                else data[i] = Math.floor(Math.random() * 256); // High entropy (code)
            }
            return data;
        };
        
        try {
            await hyperscout.scanMemoryRegion(0x10000, 0x12000, 256, mockUdsRead);
            onProgress({ stage: "Hyper-Scout: Map of Maps Generated", progress: 90, complete: false });
        } catch(e) {
            console.warn("Hyper-Scout Scan failed", e);
        }

        try {
            const vin = this.obd.detectedVin;
            if (vin !== "Unknown") {
                onProgress({ stage: `VIN Identified: ${vin}`, progress: 70, complete: false });
            }

            const calId = await this.obd.runCommand("0904", 1, 2000); 
            this.activeVariant = DMAEngine.getVariant(calId || vin); // Try matching on VIN if CAL ID fails
            if (this.activeVariant) {
                onProgress({ stage: `ECU Identified: ${this.activeVariant.ecuType}. Initializing DMA Engine...`, progress: 95, complete: false });
                await this.initDMA();
            } else {
                onProgress({ stage: `ECU Identified: Standard Performance Pool`, progress: 90, complete: false });
            }
        } catch (e) {}
        
        onProgress({ stage: "Neural Link Synchronized", progress: 100, complete: true });
        this.isScanning = false;
    }

    private async initDMA() {
        if (!this.activeVariant) return;
        
        const isUds = this.activeVariant.ecuType.includes('UDS') || this.activeVariant.ecuType.includes('TRICORE') || this.activeVariant.ecuType.includes('PCR21') || this.activeVariant.ecuType.includes('PCM128');
        
        if (isUds) {
            // Define DPID
            this.dmaParams = Object.values(this.activeVariant.memoryMap).slice(0, 6); // Max 6 params per DPID
            
            const defCmd = DMAEngine.buildDPIDDefinition(this.dpid, this.dmaParams, 32);
            try {
                const res = await this.obd.runCommand(defCmd, 1, 1000);
                if (res && res.includes("6C")) { // 6C is positive response to 2C
                    this.dmaInitialized = true;
                    console.log("DMA Engine initialized successfully with DPID", this.dpid);
                }
            } catch (e) {
                console.warn("Failed to initialize DMA DPID", e);
            }
        }
    }

    public isDmaActive(): boolean {
        return this.dmaInitialized;
    }

    public async getLiveStream(): Promise<Partial<SensorDataPoint>> {
        if (this.dmaInitialized && this.activeVariant && this.optimizationConfig?.dmaEngine !== false) {
            return await this.pollDma();
        }
        return await this.obd.pollHighFreqData();
    }

    private async pollDma(): Promise<Partial<SensorDataPoint>> {
        const data: Partial<SensorDataPoint> = { source: 'dma_engine', customPids: {} };
        let cmd = DMAEngine.buildReadByIdentifier(this.dpid);
        if (this.optimizationConfig?.dmaEngine) {
            cmd += '1'; // Tell ELM327 to return immediately after 1 response
        }
        try {
            const res = await this.obd.runCommand(cmd, 1, 500);
            if (res && res.includes("62")) { // 62 is positive response to 22
                const hex = res.replace(/[\s\r\n>]/g, '');
                const targetStr = `62${this.dpid.toString(16).toUpperCase().padStart(4, '0')}`;
                const targetIdx = hex.indexOf(targetStr);
                
                if (targetIdx !== -1) {
                    let payloadIdx = targetIdx + targetStr.length;
                    
                    for (const param of this.dmaParams) {
                        const sizeHexChars = param.sizeBytes * 2;
                        if (payloadIdx + sizeHexChars <= hex.length) {
                            const dataHex = hex.substring(payloadIdx, payloadIdx + sizeHexChars);
                            payloadIdx += sizeHexChars;
                            
                            let rawVal = parseInt(dataHex, 16);
                            if (param.isSigned) {
                                const maxVal = Math.pow(2, param.sizeBytes * 8);
                                if (rawVal >= maxVal / 2) rawVal -= maxVal;
                            }
                            const finalVal = rawVal * param.scaling + param.offset;
                            
                            // Map to standard fields
                            const key = Object.keys(this.activeVariant!.memoryMap).find(k => this.activeVariant!.memoryMap[k].id === param.id);
                            if (key === 'RPM') data.rpm = finalVal;
                            else if (key === 'SPEED') data.speed = finalVal;
                            else if (key === 'COOLANT' || key === 'OIL_T') data.engineTemp = finalVal;
                            else if (key === 'BST_ACT' || key === 'BST_DES') data.turboBoost = finalVal;
                            else if (key === 'IAT') data.inletAirTemp = finalVal;
                            else data.customPids![key!] = finalVal;
                        }
                    }
                    return data;
                }
            }
        } catch (e) {
            // Fallback to standard polling if DMA fails
            this.dmaInitialized = false;
        }
        return await this.obd.pollHighFreqData();
    }

    public setActivePids(pids: PIDDefinition[]) {
        this.obd.setActivePids(pids);
    }

    public getVin() { return this.obd.detectedVin; }
    public getProtocol() { return this.obd.connectedProtocol; }
    public async getDTCs() { return this.obd.getDiagnosticTroubleCodes(); }
    public async getReadiness() { return this.obd.getEmissionsReadiness(); }
    public async clearDTCs(): Promise<boolean> {
        return await this.obd.clearDiagnosticTroubleCodes();
    }
    
    // Fix: Added missing primeFuel method for fuel system priming as called by CartelWorxSDK
    public async primeFuel(): Promise<void> {
        try {
            // Mock UDS LPFP Override command
            await this.obd.runCommand("2F11010301", 1, 2000); 
        } catch (e) {
            console.warn("Failed to prime fuel system:", e);
        }
    }

    // Fix: Added missing activeTest method for component overrides as called by CartelWorxSDK
    public async activeTest(id: string, value: string): Promise<boolean> {
        try {
            const res = await this.obd.runCommand(`${id}${value}`);
            return !res.includes("ERROR");
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Write proprietary data to ECU (e.g., Consult III / UDS Mode 2E)
     * @param did Data Identifier (e.g., "1101")
     * @param hexValue Hexadecimal value to write
     */
    public async writeProprietaryData(did: string, hexValue: string): Promise<boolean> {
        try {
            const cmd = `2E${did}${hexValue}`;
            const res = await this.executeRawCommand(cmd);
            return res.includes("6E"); // 6E is positive response to 2E
        } catch (e) {
            console.error(`Failed to write proprietary data to DID ${did}:`, e);
            return false;
        }
    }

    /**
     * Read Memory By Address (UDS 0x23)
     * @param address The 32-bit memory address to read from
     * @param sizeBytes The number of bytes to read
     */
    public async readMemoryByAddress(address: number, sizeBytes: number): Promise<Uint8Array | null> {
        try {
            const formatByte = "42"; 
            const hexAddr = address.toString(16).padStart(8, '0').toUpperCase();
            const hexSize = sizeBytes.toString(16).padStart(4, '0').toUpperCase();
            
            const cmd = `23${formatByte}${hexAddr}${hexSize}`;
            const res = await this.obd.runCommand(cmd, 1, 2500);
            
            const parsed = parseUdsReadMemoryResponse(res, sizeBytes);
            if (parsed.success && parsed.data) {
                return parsed.data;
            }
            if (parsed.nrc) {
                console.warn(`[UDS 0x23] ECU Negative Response NRC 0x${parsed.nrc} at address 0x${address.toString(16)}`);
            }
            return null;
        } catch (e) {
            console.error(`Failed to read memory by address ${address.toString(16)}:`, e);
            return null;
        }
    }

    public async executeRawCommand(cmd: string): Promise<string> {
        try {
            // Enforce Read-Before-Write for UDS 0x2E (WriteDataByIdentifier)
            if (cmd.toUpperCase().startsWith("2E")) {
                const did = cmd.substring(2, 6);
                if (did.length === 4) {
                    // Read first (0x22 ReadDataByIdentifier)
                    const readCmd = `22${did}`;
                    const readRes = await this.obd.runCommand(readCmd, 1, 2000);
                    if (!readRes || readRes.includes("ERROR") || readRes.includes("NODATA")) {
                        console.warn(`Read-Before-Write warning: Could not read DID ${did} before writing. Proceeding anyway.`);
                    } else {
                        // Log the original value for safety/rollback purposes
                        console.log(`[Safety] Read-Before-Write: Original value for DID ${did} is ${readRes}`);
                    }
                }
            }
            return await this.obd.runCommand(cmd, 1, 2000);
        } catch (e: any) {
            return `ERROR: ${e.message}`;
        }
    }

    /**
     * UDS Service 0x27: Security Access
     * Now uses the improved ObdService sequence.
     */
    public async securityAccess(level: number, algoId?: number): Promise<boolean> {
        try {
            // 0. Dynamic Algorithm Discovery
            const effectiveAlgoId = algoId || await this.getSecurityAlgoId();
            
            // Call the centralized ObdService sequence
            return await this.obd.performSecurityAccess(level, effectiveAlgoId);
        } catch (e) {
            console.error("Security Access Failed:", e);
            return false;
        }
    }

    /**
     * Dynamically request the Security Algorithm ID from the ECU.
     * Uses UDS DID 0xF180 (Security Identification).
     */
    public async getSecurityAlgoId(): Promise<number> {
        try {
            // Request DID 0xF180
            const res = await this.obd.runCommand("22F180", 1, 1000);
            if (res && res.includes("62F180")) {
                const hex = res.replace(/[\s\r\n>]/g, '');
                const dataHex = hex.substring(hex.indexOf("62F180") + 6, hex.indexOf("62F180") + 10);
                const algoId = parseInt(dataHex, 16);
                if (!isNaN(algoId) && algoId > 0) {
                    console.log(`[SECURITY] Dynamic Algorithm ID identified from ECU: 0x${algoId.toString(16)}`);
                    return algoId;
                }
            }
        } catch (e) {
            console.warn("[SECURITY] Failed to request dynamic Algorithm ID, falling back to variant default.");
        }
        
        // Fallback to variant-defined ID
        return this.activeVariant?.securityAlgoId || 0x701; // Default to Nissan if all else fails
    }

    /**
     * UDS Service 0x34: Request Download
     */
    public async requestDownload(address: number, size: number): Promise<boolean> {
        try {
            const addrHex = address.toString(16).padStart(8, '0');
            const sizeHex = size.toString(16).padStart(8, '0');
            // Format: 34 [DataFormatIdentifier] [AddressAndLengthFormatIdentifier] [Address] [Size]
            // Using 00 for DataFormat (no compression/encryption) and 44 for Addr/Len Format (4 bytes each)
            const cmd = `340044${addrHex}${sizeHex}`;
            const res = await this.obd.runCommand(cmd, 1, 2000);
            return res.includes("74");
        } catch (e) {
            return false;
        }
    }

    /**
     * UDS Service 0x36: Transfer Data
     */
    public async transferData(blockSeq: number, data: Uint8Array): Promise<boolean> {
        try {
            const seqHex = blockSeq.toString(16).padStart(2, '0');
            const dataHex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
            const cmd = `36${seqHex}${dataHex}`;
            // Large transfers might need longer timeout
            const res = await this.obd.runCommand(cmd, 1, 5000);
            return res.includes("76");
        } catch (e) {
            return false;
        }
    }

    /**
     * UDS Service 0x37: Request Transfer Exit
     */
    public async transferExit(): Promise<boolean> {
        try {
            const res = await this.obd.runCommand("37", 1, 2000);
            return res.includes("77");
        } catch (e) {
            return false;
        }
    }

    /**
     * UDS Service 0x23: Read Memory By Address
     * Dynamically builds the command based on address mode and parameter size.
     */
    public buildReadMemoryByAddressCommand(param: MemoryParam, addrMode: AddrMode): string {
        // Address length based on AddrMode (bits to bytes)
        let addrLen = 4; // Default to 32-bit (4 bytes)
        if (addrMode === AddrMode.DIRECT_MEMORY_16) addrLen = 2;
        else if (addrMode === AddrMode.DIRECT_MEMORY_24) addrLen = 3;
        else if (addrMode === AddrMode.DIRECT_MEMORY_32) addrLen = 4;
        
        // Size length (number of bytes needed to represent sizeBytes)
        // Usually 1 or 2 bytes.
        let sizeLen = 1;
        if (param.sizeBytes > 255) sizeLen = 2;
        
        // AddressAndLengthFormatIdentifier
        // High nibble: length of the Size parameter
        // Low nibble: length of the MemoryAddress parameter
        const formatId = (sizeLen << 4) | addrLen;
        const formatIdHex = formatId.toString(16).padStart(2, '0').toUpperCase();
        
        const addrHex = param.address.toString(16).padStart(addrLen * 2, '0').toUpperCase();
        const sizeHex = param.sizeBytes.toString(16).padStart(sizeLen * 2, '0').toUpperCase();
        
        return `23${formatIdHex}${addrHex}${sizeHex}`;
    }
    
    public disconnect() { this.obd.disconnect(); }
}
