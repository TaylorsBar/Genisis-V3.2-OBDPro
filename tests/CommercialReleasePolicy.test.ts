import { describe, expect, it } from 'vitest';
import {
    COMMERCIAL_CONTROL_AUTHORITY,
    assessDiagnosticCommand,
} from '../services/CommercialReleasePolicy';

describe('CommercialReleasePolicy', () => {
    it('ships with read-only authority', () => {
        expect(COMMERCIAL_CONTROL_AUTHORITY).toBe('READ_ONLY');
    });

    it.each(['01 0C', '03', '09 02', '22 F1 90', 'AT DP', 'AT SH 7E0'])(
        'allows read-only diagnostic command %s',
        (command) => expect(assessDiagnosticCommand(command).allowed).toBe(true),
    );

    it.each(['04', '10 03', '11 01', '14 FF FF FF', '27 01', '2E F1 90 00', '2F F1 01', '31 01 FF 00', '34 00', '36 01', '37', '3D 34']) (
        'blocks control/write service %s',
        (command) => expect(assessDiagnosticCommand(command).allowed).toBe(false),
    );

    it('fails closed on malformed or unknown input', () => {
        expect(assessDiagnosticCommand('').allowed).toBe(false);
        expect(assessDiagnosticCommand('launch now').allowed).toBe(false);
        expect(assessDiagnosticCommand('99 00').allowed).toBe(false);
    });
});
