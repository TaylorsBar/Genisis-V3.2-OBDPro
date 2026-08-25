import { CanMapping } from '../types';

/**
 * Decodes a value from a CAN frame payload (hex strings).
 */
export function decodeCanValue(hexData: string[], mapping: CanMapping): number {
    // 1. Convert hex byte array to big bit string or actual buffer
    // Assuming hexData is something like ["AA", "BB", "01", ...]
    const bytes = hexData.map(h => parseInt(h, 16));
    
    // Convert to a BigInt bit representation based on byte order
    let bitValue = BigInt(0);
    if (mapping.byteOrder === 'big') {
        // Motorola: High byte first
        for (let i = 0; i < bytes.length; i++) {
            bitValue = (bitValue << BigInt(8)) | BigInt(bytes[i]);
        }
    } else {
        // Intel: Low byte first
        for (let i = bytes.length - 1; i >= 0; i--) {
            bitValue = (bitValue << BigInt(8)) | BigInt(bytes[i]);
        }
    }

    // Now extract the bits
    // startBit is usually 0-indexed from the LEAST significant bit position if we view the whole frame
    // In CAN, startBit depends on the standard used (Motorola vs Intel)
    // Here we'll use a simplified version: startBit is bit index from the start of the buffer (0-63)
    
    const totalBits = bytes.length * 8;
    let extracted: bigint;
    
    if (mapping.byteOrder === 'big') {
        // In Motorola, bits are often numbered differently, but let's stick to a standard:
        // Left-to-right (MSB at index 0) or standard bit-shifting.
        // Let's assume startBit is index of start bit in the bitValue (MSB = totalBits-1)
        // Shift right to bring value to LSB position
        const shift = BigInt(totalBits - (mapping.startBit + mapping.bitLength));
        const mask = (BigInt(1) << BigInt(mapping.bitLength)) - BigInt(1);
        extracted = (bitValue >> shift) & mask;
    } else {
        // Intel: startBit is usually LSB position
        const shift = BigInt(mapping.startBit);
        const mask = (BigInt(1) << BigInt(mapping.bitLength)) - BigInt(1);
        extracted = (bitValue >> shift) & mask;
    }

    let result = Number(extracted);

    // Handle Signed
    if (mapping.isSigned) {
        const msbMask = BigInt(1) << BigInt(mapping.bitLength - 1);
        if (extracted & msbMask) {
            // Negative value - two's complement
            const rangeMask = (BigInt(1) << BigInt(mapping.bitLength)) - BigInt(1);
            result = -Number(((extracted ^ rangeMask) + BigInt(1)) & rangeMask);
        }
    }

    // Apply Scaling and Offset
    return result * mapping.scaling + mapping.offset;
}
