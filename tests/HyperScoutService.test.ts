import { describe, it, expect } from 'vitest';
import { parseUdsReadMemoryResponse } from '../services/NeuralLink';
import { HyperScoutService } from '../services/HyperScoutService';
import { GenesisExpandedDb } from '../services/GenesisExpandedDb';
import { EcuVariant } from '../types';

describe('Phase 4: Hyper-Scout UDS Memory Read & Extensible Registry', () => {

    describe('UDS 0x23 Positive & Negative Response Parsing', () => {
        it('correctly parses positive response (0x63) payload bytes', () => {
            const rawUdsPosResponse = "AT 2342000010000004\r\n63 12 34 56 78\r\n>";
            const parsed = parseUdsReadMemoryResponse(rawUdsPosResponse, 4);

            expect(parsed.success).toBe(true);
            expect(parsed.data).toBeDefined();
            expect(parsed.data).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
        });

        it('handles UDS Negative Response (0x7F 0x23 0x31) and fails closed', () => {
            const rawUdsNegResponse = "7F2331"; // Request Out Of Range
            const parsed = parseUdsReadMemoryResponse(rawUdsNegResponse, 4);

            expect(parsed.success).toBe(false);
            expect(parsed.data).toBeUndefined();
            expect(parsed.nrc).toBe('31');
        });

        it('handles UDS Negative Response (0x7F 0x23 0x33 Security Access Denied)', () => {
            const rawUdsNegResponse = "7F 23 33";
            const parsed = parseUdsReadMemoryResponse(rawUdsNegResponse, 4);

            expect(parsed.success).toBe(false);
            expect(parsed.nrc).toBe('33');
        });

        it('returns null data on empty or malformed UDS response', () => {
            const parsedNull = parseUdsReadMemoryResponse(null);
            expect(parsedNull.success).toBe(false);

            const parsedError = parseUdsReadMemoryResponse("NO DATA");
            expect(parsedError.success).toBe(false);
        });

        it('flows extracted real bytes through to HyperScout Shannon entropy classifier', () => {
            const hyperscout = HyperScoutService.getInstance();

            // Mock ECU payload containing calibration map bytes (32 unique byte values spread across 0..255)
            // Creates entropy ~ 5.0 bits and variance > 1000
            const pattern = [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160, 168, 176, 184, 192, 200, 208, 216, 224, 232, 240, 248];
            const calBytes = new Uint8Array(256);
            for (let i = 0; i < 256; i++) {
                calBytes[i] = pattern[i % pattern.length];
            }

            const calDataHex = "63" + Array.from(calBytes, b => b.toString(16).padStart(2, '0')).join('');
            const parsed = parseUdsReadMemoryResponse(calDataHex, 256);

            expect(parsed.success).toBe(true);
            expect(parsed.data).toBeDefined();

            const entropy = hyperscout.calculateShannonEntropy(parsed.data!);
            expect(entropy).toBeGreaterThan(4.5);
            expect(entropy).toBeLessThan(5.8);

            const variance = hyperscout.calculateVariance(parsed.data!);
            expect(variance).toBeGreaterThan(500);

            const classification = hyperscout.classifyRegion(parsed.data!);
            expect(classification).toBe('CALIBRATION_TABLE');
        });
    });

    describe('GenesisExpandedDb Extensible Registry & Honest Counts', () => {
        it('queries existing honest variants with validation status tags', () => {
            const variants = GenesisExpandedDb.getAllVariants();
            expect(variants.length).toBeGreaterThanOrEqual(7);

            const counts = GenesisExpandedDb.getVariantCountsByStatus();
            expect(counts['bench_validated']).toBeGreaterThan(0);
            expect(counts['derived_from_public_service_data']).toBeGreaterThan(0);
            expect(counts['community_submitted_unverified']).toBeGreaterThan(0);

            // Verify no fabricated count: total count matches sum of status counts
            const totalStatusCount = counts['bench_validated'] + counts['derived_from_public_service_data'] + counts['community_submitted_unverified'];
            expect(totalStatusCount).toEqual(GenesisExpandedDb.getVariantCount());
        });

        it('allows dynamic registration of new ECU variants with explicit validation status', () => {
            const customVariant: EcuVariant = {
                osId: 'CUSTOM_VQ37_TEST',
                ecuType: 'NISSAN_HITACHI_SH7058',
                securityAlgoId: 0x701,
                validationStatus: 'community_submitted_unverified',
                memoryMap: {
                    'RPM': { id: 'RPM', address: 0xFFFF2000, sizeBytes: 2, isSigned: false, scaling: 12.5, offset: 0, name: 'Engine Speed', units: 'RPM' }
                }
            };

            const initialCount = GenesisExpandedDb.getVariantCount();
            const regSuccess = GenesisExpandedDb.registerVariant(customVariant);

            expect(regSuccess).toBe(true);
            expect(GenesisExpandedDb.getVariantCount()).toBe(initialCount + 1);

            const found = GenesisExpandedDb.findVariant('CUSTOM_VQ37_TEST');
            expect(found).toBeDefined();
            expect(found?.validationStatus).toBe('community_submitted_unverified');

            // Duplicate registration rejected
            const duplicateReg = GenesisExpandedDb.registerVariant(customVariant);
            expect(duplicateReg).toBe(false);
        });
    });

});
