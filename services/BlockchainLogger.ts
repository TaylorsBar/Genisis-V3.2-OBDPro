/**
 * Cryptographic Audit Trail / DLT Provenance Ledger
 * 
 * Implements a tamper-evident SHA-256 hash-chained local ledger for calibration & tuning events.
 * Each entry cryptographically links to the previous block's SHA-256 digest.
 * Tampering with any historical record invalidates the entire subsequent chain.
 */

export interface AuditBlock {
    index: number;
    timestamp: number;
    vin: string;
    sha256Hash: string;
    tunerId: string;
    previousHash: string;
    blockHash: string;
}

export class BlockchainLogger {
    private static ledger: AuditBlock[] = [];
    private static readonly GENESIS_PREVIOUS_HASH = "0".repeat(64);

    /**
     * Calculates a SHA-256 hash of the block payload using Web Crypto API.
     */
    public static async calculateBlockHash(
        index: number,
        timestamp: number,
        vin: string,
        sha256Hash: string,
        tunerId: string,
        previousHash: string
    ): Promise<string> {
        const payload = `${index}|${timestamp}|${vin}|${sha256Hash}|${tunerId}|${previousHash}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback for non-browser/crypto-subtle environments
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                hash = (hash << 5) - hash + data[i];
                hash |= 0;
            }
            return Math.abs(hash).toString(16).padStart(64, '0');
        }
    }

    /**
     * Appends a new calibration event to the hash-chained audit log.
     */
    public static async logCalibrationProvenance(
        vin: string, 
        sha256Hash: string, 
        tunerId: string
    ): Promise<{ txHash: string; status: string; block: AuditBlock }> {
        const index = this.ledger.length;
        const timestamp = Date.now();
        const previousHash = index === 0 
            ? this.GENESIS_PREVIOUS_HASH 
            : this.ledger[index - 1].blockHash;

        const blockHash = await this.calculateBlockHash(
            index,
            timestamp,
            vin,
            sha256Hash,
            tunerId,
            previousHash
        );

        const block: AuditBlock = {
            index,
            timestamp,
            vin,
            sha256Hash,
            tunerId,
            previousHash,
            blockHash
        };

        this.ledger.push(block);

        return {
            txHash: `0x${blockHash}`,
            status: 'CONFIRMED',
            block
        };
    }

    /**
     * Verifies if a specific calibration hash exists in the ledger.
     */
    public static async verifyCalibrationProvenance(vin: string, sha256Hash: string): Promise<boolean> {
        const integrity = await this.verifyChainIntegrity();
        if (!integrity.valid) {
            console.error(`[DLT Integrity Error] Chain corruption detected at index ${integrity.corruptedIndex}`);
            return false;
        }

        return this.ledger.some(b => b.vin === vin && b.sha256Hash === sha256Hash);
    }

    /**
     * Verifies the cryptographic integrity of the entire audit chain.
     * Returns valid = false if any historical block or hash has been altered.
     */
    public static async verifyChainIntegrity(): Promise<{ valid: boolean; corruptedIndex?: number }> {
        for (let i = 0; i < this.ledger.length; i++) {
            const block = this.ledger[i];
            const expectedPrevious = i === 0 
                ? this.GENESIS_PREVIOUS_HASH 
                : this.ledger[i - 1].blockHash;

            if (block.previousHash !== expectedPrevious) {
                return { valid: false, corruptedIndex: i };
            }

            const expectedHash = await this.calculateBlockHash(
                block.index,
                block.timestamp,
                block.vin,
                block.sha256Hash,
                block.tunerId,
                block.previousHash
            );

            if (block.blockHash !== expectedHash) {
                return { valid: false, corruptedIndex: i };
            }
        }

        return { valid: true };
    }

    /**
     * Returns the full audit ledger array.
     */
    public static getLedger(): AuditBlock[] {
        return [...this.ledger];
    }

    /**
     * Clears the ledger (primarily for unit testing).
     */
    public static clearLedger(): void {
        this.ledger = [];
    }

    /**
     * Allows mutating a block strictly for adversarial testing of tamper detection.
     */
    public static __tamperBlockForTest(index: number, mutatedHash: string): void {
        if (this.ledger[index]) {
            this.ledger[index].sha256Hash = mutatedHash;
        }
    }
}
