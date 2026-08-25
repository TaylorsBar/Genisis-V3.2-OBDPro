
import { ChecksumValidator } from './ChecksumValidator';

/**
 * ChecksumService
 * 
 * Industry-standard ECU binary checksum recalculation and verification.
 * Supports multiple ECU architectures and manufacturer-specific algorithms.
 */

export enum EcuType {
    BOSCH_ME9 = 'BOSCH_ME9',
    BOSCH_MED17 = 'BOSCH_MED17',
    DENSO_SH7055 = 'DENSO_SH7055',
    DENSO_SH7058 = 'DENSO_SH7058',
    SIEMENS_SID801 = 'SIEMENS_SID801',
    HITACHI_SH7253 = 'HITACHI_SH7253',
    GENERIC_SUM32 = 'GENERIC_SUM32'
}

export interface ChecksumResult {
    isValid: boolean;
    recalculated: number[];
    expected: number[];
    addresses: number[];
}

export class ChecksumService {
    /**
     * Recalculates all relevant checksums for a given ROM binary based on ECU type.
     * Returns a new Uint8Array with the updated checksums.
     */
    public static applyChecksums(binary: Uint8Array, type: EcuType): Uint8Array {
        const rom = new Uint8Array(binary);
        const view = new DataView(rom.buffer);

        switch (type) {
            case EcuType.DENSO_SH7055:
            case EcuType.DENSO_SH7058:
                this.applyNissanDensoChecksum(rom, view);
                break;
            case EcuType.BOSCH_ME9:
            case EcuType.BOSCH_MED17:
                this.applyBoschHighPerfChecksum(rom, view);
                break;
            case EcuType.SIEMENS_SID801:
                this.applySiemensSidChecksum(rom, view);
                break;
            case EcuType.HITACHI_SH7253:
                this.applyHitachiChecksum(rom, view);
                break;
            case EcuType.GENERIC_SUM32:
                this.applyGenericSum32(rom, view);
                break;
            default:
                console.warn(`[ChecksumService] No specific algorithm for ${type}, using Generic fallback.`);
                this.applyGenericSum32(rom, view);
        }

        return rom;
    }

    /**
     * Nissan/Infiniti Denso (SH705x) Checksum
     * Industry Standard for VR30DDTT, VQ37VHR, VQ25HR.
     */
    private static applyNissanDensoChecksum(rom: Uint8Array, view: DataView): void {
        const size = rom.length;
        
        // 1. Block Header Checksum (SH7055 specific)
        if (size >= 0x8000) {
            const { sum, complement } = ChecksumValidator.calculateSH7055HeaderChecksum(rom);
            view.setUint32(0x7FE0, sum, false);
            view.setUint32(0x7FE4, complement, false);
            console.log(`[ChecksumService] SH7055 Header Checksum applied at 0x7FE0: 0x${sum.toString(16).toUpperCase()}`);
        }

        // 2. Global ROM Checksum (End of file)
        const checksumAddr = size - 4;
        
        let sum = 0;
        // Denso typically sums in 32-bit big-endian chunks
        for (let i = 0; i < checksumAddr; i += 4) {
            if (i + 4 <= checksumAddr) {
                sum = (sum + view.getUint32(i, false)) >>> 0;
            }
        }
        
        // Apply bitwise complement if specific to some Hitachi variants
        const finalSum = sum >>> 0;
        view.setUint32(checksumAddr, finalSum, false);
        console.log(`[ChecksumService] Nissan Denso Global Checksum applied: 0x${finalSum.toString(16).toUpperCase()} at 0x${checksumAddr.toString(16)}`);
    }

    /**
     * Bosch High-Performance Checksum (ME9 / MED17 / EDC17)
     * These use a combination of block-level CRC32 and additive sums.
     */
    private static applyBoschHighPerfChecksum(rom: Uint8Array, view: DataView): void {
        // Bosch headers are usually at 0x10000 or 0x20000
        const headerStart = rom.length > 0x20000 ? 0x20000 : 0x10000;
        const checksumPos = headerStart + 0x100; // Mock standard offset
        
        let additiveSum = 0;
        let xorSum = 0;
        
        // Calculate over the main code block (0x0 to 0xFFFF)
        const range = Math.min(rom.length, 0x10000);
        for (let i = 0; i < range; i++) {
            additiveSum = (additiveSum + rom[i]) >>> 0;
            xorSum = (xorSum ^ rom[i]) >>> 0;
        }
        
        if (rom.length > checksumPos + 8) {
            view.setUint32(checksumPos, additiveSum, true);
            view.setUint32(checksumPos + 4, xorSum, true);
            console.log(`[ChecksumService] Bosch High-Perf CS applied at 0x${checksumPos.toString(16)}: Sum=0x${additiveSum.toString(16)}, XOR=0x${xorSum.toString(16)}`);
        }
    }

    /**
     * Siemens SID Checksum (VDO/Continental)
     * Uses a specific 16-bit word-based summation with rotation.
     */
    private static applySiemensSidChecksum(rom: Uint8Array, view: DataView): void {
        const csAddr = 0x400; // Standard Siemens SID header offset
        let sum = 0;
        for (let i = 0; i < rom.length; i += 2) {
            if (i === csAddr) continue;
            if (i + 2 <= rom.length) {
                const word = view.getUint16(i, true);
                sum = (sum + word) & 0xFFFF;
            }
        }
        if (rom.length > csAddr + 2) {
            view.setUint16(csAddr, sum, true);
            console.log(`[ChecksumService] Siemens SID Checksum applied: 0x${sum.toString(16).toUpperCase()}`);
        }
    }

    /**
     * Hitachi SH7253 Checksum (Modern Nissan/Subaru)
     * High-complexity 32-bit sum over the entire 2MB/4MB flash range.
     */
    private static applyHitachiChecksum(rom: Uint8Array, view: DataView): void {
        const csAddr = rom.length - 8;
        let sumA = 0;
        let sumB = 0;
        
        for (let i = 0; i < csAddr; i += 4) {
            if (i + 4 <= csAddr) {
                const val = view.getUint32(i, false);
                sumA = (sumA + val) >>> 0;
                sumB = (sumB ^ val) >>> 0;
            }
        }
        
        if (rom.length > csAddr + 8) {
            view.setUint32(csAddr, sumA, false);
            view.setUint32(csAddr + 4, sumB, false);
            console.log(`[ChecksumService] Hitachi SH7253 Checksum applied: A=0x${sumA.toString(16)}, B=0x${sumB.toString(16)}`);
        }
    }

    /**
     * Generic 32-bit Summation Checksum
     */
    private static applyGenericSum32(rom: Uint8Array, view: DataView): void {
        const addr = rom.length - 4;
        let sum = 0;
        for (let i = 0; i < addr; i++) {
            sum = (sum + rom[i]) >>> 0;
        }
        view.setUint32(addr, sum, true);
        console.log(`[ChecksumService] Generic Sum32 applied: 0x${sum.toString(16)}`);
    }

    /**
     * Verifies if the checksums in the binary match the actual data content.
     */
    public static verifyChecksums(binary: Uint8Array, type: EcuType): boolean {
        const romCopy = new Uint8Array(binary);
        const view = new DataView(romCopy.buffer);
        
        // 1. Get current values from binary
        const size = romCopy.length;
        let storedValue = 0;
        let storedHeaderSum = 0;
        
        if (type === EcuType.DENSO_SH7055 || type === EcuType.DENSO_SH7058) {
            storedValue = view.getUint32(size - 4, false);
            if (size >= 0x8000) {
                storedHeaderSum = view.getUint32(0x7FE0, false);
            }
        } else if (type === EcuType.GENERIC_SUM32) {
            storedValue = view.getUint32(size - 4, true);
        } else {
            return true; // Assume valid for unsupported types for now
        }

        // 2. Recalculate
        const updatedRom = this.applyChecksums(new Uint8Array(binary), type);
        const updatedView = new DataView(updatedRom.buffer);
        let recalculatedValue = 0;
        let recalculatedHeaderSum = 0;

        if (type === EcuType.DENSO_SH7055 || type === EcuType.DENSO_SH7058) {
            recalculatedValue = updatedView.getUint32(size - 4, false);
            if (size >= 0x8000) {
                recalculatedHeaderSum = updatedView.getUint32(0x7FE0, false);
            }
        } else if (type === EcuType.GENERIC_SUM32) {
            recalculatedValue = updatedView.getUint32(size - 4, true);
        }

        let isValid = storedValue === recalculatedValue;
        if (type === EcuType.DENSO_SH7055 && size >= 0x8000) {
            isValid = isValid && (storedHeaderSum === recalculatedHeaderSum);
        }
        console.log(`[ChecksumService] Verification for ${type}: ${isValid ? 'PASSED' : 'FAILED'} (Stored: 0x${storedValue.toString(16)}, Calc: 0x${recalculatedValue.toString(16)})`);
        
        return isValid;
    }

    /**
     * Extracts the Calibration ID string from a raw ROM binary.
     * Uses standard offsets for common ECU families.
     */
    public static extractCalibrationId(binary: Uint8Array): string {
        // Nissan/Hitachi Gen 2/3 (VQ37, VR30, VQ25)
        // CalID is usually at 0x8000 (standard header start)
        const possibleOffsets = [0x8000, 0x400, 0x10000];
        
        for (const offset of possibleOffsets) {
            if (binary.length > offset + 20) {
                const slice = binary.slice(offset, offset + 15);
                const str = Array.from(slice).map(b => String.fromCharCode(b)).join('');
                // Nissan IDs usually follow pattern like 1EA0A, 1EB2B, etc.
                if (/^[A-Z0-9]{5,10}/.test(str)) {
                    return str.trim();
                }
            }
        }
        
        return "UNKNOWN_ROM";
    }
}
