import { describe, it, expect, beforeEach } from 'vitest';
import { BlockchainLogger } from '../services/BlockchainLogger';

describe('Phase 5: Tamper-Evident Cryptographic Audit Chain', () => {

    beforeEach(() => {
        BlockchainLogger.clearLedger();
    });

    it('logs multiple calibration events in a cryptographically chained sequence', async () => {
        const res1 = await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_STAGE1_TUNE_AAAA', 'TUNER_01');
        const res2 = await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_STAGE2_TUNE_BBBB', 'TUNER_01');
        const res3 = await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_REV_CUT_FIX_CCCC', 'TUNER_02');

        expect(res1.status).toBe('CONFIRMED');
        expect(res2.status).toBe('CONFIRMED');
        expect(res3.status).toBe('CONFIRMED');

        const ledger = BlockchainLogger.getLedger();
        expect(ledger.length).toBe(3);

        // Verify hash chaining
        expect(ledger[0].previousHash).toBe('0'.repeat(64));
        expect(ledger[1].previousHash).toBe(ledger[0].blockHash);
        expect(ledger[2].previousHash).toBe(ledger[1].blockHash);
    });

    it('verifies integrity of an untampered audit log', async () => {
        await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_STAGE1', 'TUNER_01');
        await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_STAGE2', 'TUNER_01');

        const integrity = await BlockchainLogger.verifyChainIntegrity();
        expect(integrity.valid).toBe(true);

        const verified = await BlockchainLogger.verifyCalibrationProvenance('VIN_INFINITI_G25', 'HASH_STAGE2');
        expect(verified).toBe(true);
    });

    it('detects historical record tampering and invalidates the audit chain', async () => {
        await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_GENUINE_BLOCK_0', 'TUNER_01');
        await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_GENUINE_BLOCK_1', 'TUNER_01');
        await BlockchainLogger.logCalibrationProvenance('VIN_INFINITI_G25', 'HASH_GENUINE_BLOCK_2', 'TUNER_02');

        // Adversarial attack: Alter historical block #1
        BlockchainLogger.__tamperBlockForTest(1, 'HASH_FORGED_MALICIOUS_TUNE');

        const integrity = await BlockchainLogger.verifyChainIntegrity();
        expect(integrity.valid).toBe(false);
        expect(integrity.corruptedIndex).toBe(1);

        const verified = await BlockchainLogger.verifyCalibrationProvenance('VIN_INFINITI_G25', 'HASH_GENUINE_BLOCK_2');
        expect(verified).toBe(false);
    });

});
