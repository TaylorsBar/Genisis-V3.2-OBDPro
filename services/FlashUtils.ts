
export const calculateCRC32 = (data: Uint8Array): number => {
    let crc = 0xFFFFFFFF;
    for (const byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
};

export const prepareChunkedData = (data: Uint8Array, blockSize: number = 0x80): Uint8Array[] => {
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < data.length; i += blockSize) {
        chunks.push(data.slice(i, i + blockSize));
    }
    return chunks;
};
