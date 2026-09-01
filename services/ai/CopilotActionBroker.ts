export type CopilotActionKind =
    | 'START_LOGGING'
    | 'STOP_LOGGING'
    | 'CONNECT_OBD'
    | 'SCAN_DIAGNOSTICS'
    | 'CALIBRATE_SENSORS'
    | 'BOOST_TARGET'
    | 'LAUNCH_CONTROL'
    | 'ANTI_LAG'
    | 'REV_LIMIT'
    | 'DYNO_RUN'
    | 'CLEAR_DTCS'
    | 'ACTIVE_TEST'
    | 'UNKNOWN';

export type CopilotActionAuthority = 'APP_ONLY' | 'STAGE_ONLY' | 'BLOCKED';

export interface CopilotActionProposal {
    id: string;
    kind: CopilotActionKind;
    authority: CopilotActionAuthority;
    requestedValue?: unknown;
    requestedAtMs: number;
    status: 'ELIGIBLE' | 'PENDING_OPERATOR_REVIEW' | 'REJECTED';
    reason: string;
}

const APP_ONLY_ACTIONS = new Set<CopilotActionKind>([
    'START_LOGGING',
    'STOP_LOGGING',
    'CONNECT_OBD',
    'SCAN_DIAGNOSTICS',
    'CALIBRATE_SENSORS',
]);

const STAGE_ONLY_ACTIONS = new Set<CopilotActionKind>([
    'BOOST_TARGET',
    'LAUNCH_CONTROL',
    'ANTI_LAG',
    'REV_LIMIT',
    'DYNO_RUN',
]);

export function brokerCopilotAction(
    target: string,
    requestedValue?: unknown,
    nowMs = Date.now(),
): CopilotActionProposal {
    const kind = classifyTarget(target);
    if (APP_ONLY_ACTIONS.has(kind)) {
        return proposal(kind, 'APP_ONLY', 'ELIGIBLE', requestedValue, nowMs,
            'Eligible for an application-only action; no vehicle control command is produced.');
    }
    if (STAGE_ONLY_ACTIONS.has(kind)) {
        return proposal(kind, 'STAGE_ONLY', 'PENDING_OPERATOR_REVIEW', requestedValue, nowMs,
            'Captured as operator intent. Requires vehicle-profile validation, explicit arming and a separate authorized executor.');
    }
    if (kind === 'CLEAR_DTCS' || kind === 'ACTIVE_TEST') {
        return proposal(kind, 'BLOCKED', 'REJECTED', requestedValue, nowMs,
            'Blocked in the commercial read-only release.');
    }
    return proposal('UNKNOWN', 'BLOCKED', 'REJECTED', requestedValue, nowMs,
        'The requested action is not in the co-pilot allowlist.');
}

function classifyTarget(target: string): CopilotActionKind {
    const value = target.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (value.includes('start_log')) return 'START_LOGGING';
    if (value.includes('stop_log')) return 'STOP_LOGGING';
    if (value.includes('connect') && value.includes('obd')) return 'CONNECT_OBD';
    if (value.includes('diagnose') || value.includes('scan') || value.includes('fault_read')) return 'SCAN_DIAGNOSTICS';
    if (value.includes('calibrat') || value.includes('sensor')) return 'CALIBRATE_SENSORS';
    if (value.includes('boost') || value === 'tuning_action' || value === 'set_boost') return 'BOOST_TARGET';
    if (value.includes('launch')) return 'LAUNCH_CONTROL';
    if (value.includes('anti_lag') || value === 'als') return 'ANTI_LAG';
    if (value.includes('rev') || value.includes('limit')) return 'REV_LIMIT';
    if (value.includes('dyno') || value.includes('horsepower')) return 'DYNO_RUN';
    if (value.includes('clear') && (value.includes('fault') || value.includes('dtc'))) return 'CLEAR_DTCS';
    if (value.includes('prime') || value.includes('active_test') || value.includes('actuator')) return 'ACTIVE_TEST';
    return 'UNKNOWN';
}

function proposal(
    kind: CopilotActionKind,
    authority: CopilotActionAuthority,
    status: CopilotActionProposal['status'],
    requestedValue: unknown,
    requestedAtMs: number,
    reason: string,
): CopilotActionProposal {
    return {
        id: `copilot-${requestedAtMs}-${kind.toLowerCase()}`,
        kind,
        authority,
        requestedValue,
        requestedAtMs,
        status,
        reason,
    };
}
