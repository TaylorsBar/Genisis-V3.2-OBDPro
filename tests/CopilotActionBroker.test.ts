import { describe, expect, it } from 'vitest';
import { brokerCopilotAction } from '../services/ai/CopilotActionBroker';

describe('CopilotActionBroker', () => {
    it.each([
        ['set_boost', 'BOOST_TARGET'],
        ['arm launch control', 'LAUNCH_CONTROL'],
        ['toggle anti-lag', 'ANTI_LAG'],
        ['set rev limit', 'REV_LIMIT'],
    ])('preserves %s as staged operator intent', (target, kind) => {
        const proposal = brokerCopilotAction(target, 7200, 1_000);
        expect(proposal.kind).toBe(kind);
        expect(proposal.authority).toBe('STAGE_ONLY');
        expect(proposal.status).toBe('PENDING_OPERATOR_REVIEW');
    });

    it('allows non-vehicle application actions', () => {
        expect(brokerCopilotAction('start_logging').authority).toBe('APP_ONLY');
        expect(brokerCopilotAction('connect_obd').authority).toBe('APP_ONLY');
    });

    it('blocks destructive diagnostics and unknown actions', () => {
        expect(brokerCopilotAction('clear_faults').authority).toBe('BLOCKED');
        expect(brokerCopilotAction('prime_fuel').authority).toBe('BLOCKED');
        expect(brokerCopilotAction('do_something_magic').authority).toBe('BLOCKED');
    });
});
