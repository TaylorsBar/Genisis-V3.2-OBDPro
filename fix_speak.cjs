const fs = require('fs');
let content = fs.readFileSync('types.ts', 'utf8');

content = content.replace(
    /export interface CopilotResponse \{\n\s*speech: string;\n\s*\/\/ Fix: Replaced comma with pipe to correctly define the union type for intent\n\s*intent: 'NAVIGATE' \| 'UI_CONTROL' \| 'TUNING_ACTION' \| 'SYSTEM_ACTION' \| 'ANALYSIS' \| 'GENERAL';\n\s*actionPayload\?: \{\n\s*target: string;\n\s*value\?: number \| string;\n\s*parameters\?: any;\n\s*\};\n\}/g,
    `export interface CopilotResponse {
    message: string;
    suggestedAction?: {
        intent: 'NAVIGATE' | 'UI_CONTROL' | 'TUNING_ACTION' | 'SYSTEM_ACTION' | 'ANALYSIS' | 'GENERAL';
        payload?: any;
    };
}`
);
fs.writeFileSync('types.ts', content);

let assistantContent = fs.readFileSync('components/GlobalAssistant.tsx', 'utf8');
assistantContent = assistantContent.replace(
    /speak\(response\.message, \(\) => setState\('idle'\)\);/g,
    `speak(typeof response === 'string' ? response : (response.message || 'Action complete.'), () => setState('idle'));`
);
fs.writeFileSync('components/GlobalAssistant.tsx', assistantContent);

