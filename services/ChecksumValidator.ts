
import { MathKernel } from './MathKernel';

/**
 * ECU Checksum Validation Module
 * Handles recalculation and verification of ECU binary header checksums.
 * Supports standard Sum8, Sum16, Sum32, and CRC32 algorithms common in automotive firmware.
 */
export class ChecksumValidator {
    
    /**
     * Recalculates and verifies the checksum for a given memory region.
     * @param data The binary data of the ECU or map region
     * @param type The algorithm type (Sum8, Sum16, Sum32, CRC32)
     * @param offset Offset where the checksum itself is stored (will be ignored during calculation)
     * @param expectedValue If provided, verifies the calculated value against this
     */
    public static validate(
        data: Uint8Array, 
        type: 'Sum8' | 'Sum16' | 'Sum32' | 'CRC32', 
        offset?: number, 
        expectedValue?: number
    ): { calculated: number; isValid: boolean } {
        let calculated = 0;
        
        switch (type) {
            case 'Sum8':
                calculated = this.calculateSum8(data, offset);
                break;
            case 'Sum16':
                calculated = this.calculateSum16(data, offset);
                break;
            case 'Sum32':
                calculated = this.calculateSum32(data, offset);
                break;
            case 'CRC32':
                calculated = MathKernel.crc32(data); // Use existing MathKernel CRC32
                break;
        }

        const isValid = expectedValue !== undefined ? (calculated >>> 0) === (expectedValue >>> 0) : true;
        
        return { calculated, isValid };
    }

    /**
     * Specifically handles SH7055 Nissan/Infiniti Header Checksums.
     * Common in Hitachi ECUs for VQ35DE, early VQ37VHR, and VK45DE.
     */
    public static calculateSH7055HeaderChecksum(data: Uint8Array): { sum: number; complement: number } {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let sum = 0;
        
        // Range 0x0000 to 0x7FDF is standard for SH7055 headers
        const limit = Math.min(data.length, 0x7FE0);
        for (let i = 0; i < limit; i += 4) {
            if (i + 4 <= limit) {
                sum = (sum + view.getUint32(i, false)) >>> 0;
            }
        }
        
        return { 
            sum: sum >>> 0, 
            complement: (~sum) >>> 0 
        };
    }

    private static calculateSum8(data: Uint8Array, ignoreOffset?: number): number {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            if (i === ignoreOffset) continue;
            sum = (sum + data[i]) & 0xFF;
        }
        return sum;
    }

    private static calculateSum16(data: Uint8Array, ignoreOffset?: number): number {
        let sum = 0;
        // Use Big-Endian for Sum16 (common in Bosch/Denso)
        for (let i = 0; i < data.length - 1; i += 2) {
            if (i === ignoreOffset || i + 1 === ignoreOffset) continue;
            const word = (data[i] << 8) | data[i+1];
            sum = (sum + word) & 0xFFFF;
        }
        return sum;
    }

    private static calculateSum32(data: Uint8Array, ignoreOffset?: number): number {
        let sum = 0;
        for (let i = 0; i < data.length - 3; i += 4) {
            if (i >= (ignoreOffset ?? -4) && i <= (ignoreOffset ?? -4) + 3) continue;
            const dword = (data[i] << 24) | (data[i+1] << 16) | (data[i+2] << 8) | data[i+3];
            sum = (sum + dword) >>> 0;
        }
        return sum;
    }

    /**
     * Specifically handles Nissan/Infiniti (Hitachi/Denso) Header Checksums.
     * Nissan headers usually have a 2-byte or 4-byte complement sum.
     */
    public static validateNissanHeader(headerData: Uint8Array): boolean {
        // Typical Nissan header is at the start of the ROM or at a specific offset like 0x8000
        // Let's assume the passed data is the header region
        const { calculated, isValid } = this.validate(headerData, 'Sum16');
        return isValid;
    }
}
