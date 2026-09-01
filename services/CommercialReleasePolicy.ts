export const COMMERCIAL_CONTROL_AUTHORITY = 'READ_ONLY' as const;

export interface CommandPolicyDecision {
    allowed: boolean;
    normalizedCommand: string;
    reason: string;
}

const READ_ONLY_SERVICES = new Set([
    '01', // current powertrain data
    '02', // freeze-frame data
    '03', // stored DTCs
    '06', // monitor test results
    '07', // pending DTCs
    '09', // vehicle information
    '0A', // permanent DTCs
    '22', // UDS ReadDataByIdentifier
]);

/**
 * Client-side defence in depth for the commercial build. The authoritative
 * vehicle gateway must enforce the same or stricter policy independently.
 */
export function assessDiagnosticCommand(command: string): CommandPolicyDecision {
    const normalizedCommand = command.replace(/\s+/g, '').toUpperCase();
    if (!normalizedCommand) {
        return { allowed: false, normalizedCommand, reason: 'Empty diagnostic command.' };
    }
    if (/^AT[A-Z0-9]+$/.test(normalizedCommand)) {
        return { allowed: true, normalizedCommand, reason: 'ELM adapter configuration command.' };
    }
    if (!/^[0-9A-F]+$/.test(normalizedCommand) || normalizedCommand.length < 2) {
        return { allowed: false, normalizedCommand, reason: 'Malformed diagnostic command.' };
    }

    const service = normalizedCommand.slice(0, 2);
    if (READ_ONLY_SERVICES.has(service)) {
        return { allowed: true, normalizedCommand, reason: `Read-only service 0x${service}.` };
    }
    return {
        allowed: false,
        normalizedCommand,
        reason: `Service 0x${service} is outside the commercial read-only allowlist.`,
    };
}

export function commercialControlDenial(operation: string): string {
    return `${operation} is unavailable: this Genesis OS release has READ_ONLY vehicle authority.`;
}
