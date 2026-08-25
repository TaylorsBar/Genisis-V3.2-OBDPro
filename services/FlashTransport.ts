
/**
 * Generic Transport Interface for ECU Flashing
 * Abstracts the underlying hardware (J2534, ELM327, Kess) 
 * and provides a unified ISO-TP communication layer.
 */
export interface IFlashTransport {
    /**
     * Establish physical and logical connection to the vehicle network.
     */
    connect(): Promise<boolean>;

    /**
     * Terminate the connection and release hardware resources.
     */
    disconnect(): void;

    /**
     * Send a multi-frame ISO-TP message.
     * @param payload The data to be fragmented and sent.
     * @param onProgress Optional callback for transmission progress (0-100).
     */
    transmit(payload: Uint8Array, onProgress?: (progress: number) => void): Promise<boolean>;

    /**
     * Receive and reassemble a multi-frame ISO-TP message from the network.
     * @param timeoutMs Maximum time to wait for the complete message.
     */
    receive(timeoutMs?: number): Promise<Uint8Array | null>;
}
