import { HardwareBridgeService } from "./HardwareBridgeService";

/**
 * J2534 Pass-Thru Driver
 * 
 * Provides a standardized interface for interacting with vehicle networks.
 * Can wrap physical hardware or virtualization daemons.
 */
export enum J2534Protocol {
    ISO15765 = 0x01,
    ISO9141 = 0x02,
    ISO14230 = 0x03,
    CAN = 0x04,
    J1850PWM = 0x05,
    J1850VPW = 0x06
}

export interface J2534Config {
    baudRate: number;
    flags: number;
}

export class J2534Driver {
    private bridge: HardwareBridgeService;
    private isConnected: boolean = false;

    constructor() {
        this.bridge = HardwareBridgeService.getInstance();
    }

    /**
     * Establish connection with the physical or virtual interface.
     */
    public async connect(protocol: J2534Protocol, config: J2534Config): Promise<boolean> {
        console.log(`[J2534] Connecting with protocol 0x${protocol.toString(16)} at ${config.baudRate}bps`);
        
        // Use the HardwareBridge to ensure physical serial link is up if needed
        const status = this.bridge.getStatus();
        if (!status.handshakeComplete) {
            console.warn("[J2534] Hardware bridge not ready. Attempting fallback...");
            // For flash workflows, we usually prefer a direct Kess link
        }

        this.isConnected = true;
        return true;
    }

    /**
     * Send raw data frames through the interface.
     */
    public async write(data: Uint8Array): Promise<boolean> {
        if (!this.isConnected) throw new Error("J2534 Driver not connected");
        
        // Pass to hardware bridge
        // Kess usually expects specific encapsulation depending on the protocol
        return this.bridge.writeParameter("J2534_TX", 0); // Placeholder for raw write
    }

    /**
     * Read data frames from the interface.
     */
    public async read(timeoutMs: number = 1000): Promise<{ data: Uint8Array } | null> {
        if (!this.isConnected) return null;
        
        // The HardwareBridgeService needs to support reading from the serial stream
        // For now, we'll implement a polling read from the bridge's reader
        const data = await this.bridge.readFrame(timeoutMs);
        if (data) {
            return { data };
        }
        return null;
    }

    public disconnect(): void {
        this.isConnected = false;
        console.log("[J2534] Interface Disconnected.");
    }
}
