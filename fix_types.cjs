const fs = require('fs');

// The issue is that I over-wrote `CopilotResponse` which was used for multiple purposes OR used with different properties in other functions.
// Let's restore the original `CopilotResponse` in types.ts exactly as it was but with the union type fixed.

let content = fs.readFileSync('types.ts', 'utf8');

content = content.replace(
    /export interface CopilotResponse \{\n\s*message: string;\n\s*suggestedAction\?: \{\n\s*intent: 'NAVIGATE' \| 'UI_CONTROL' \| 'TUNING_ACTION' \| 'SYSTEM_ACTION' \| 'ANALYSIS' \| 'GENERAL';\n\s*payload\?: any;\n\s*\};\n\}/g,
    `export interface CopilotResponse {
    speech: string;
    intent: 'NAVIGATE' | 'UI_CONTROL' | 'TUNING_ACTION' | 'SYSTEM_ACTION' | 'ANALYSIS' | 'GENERAL';
    actionPayload?: {
        target: string;
        value?: number | string;
        parameters?: any;
    };
}`
);

fs.writeFileSync('types.ts', content);

// And we must revert geminiService.ts where we manually altered the parser
let gemini = fs.readFileSync('services/geminiService.ts', 'utf8');
gemini = gemini.replace(
    /const parsed = JSON\.parse\(response\.text \|\| "\{\}"\);\n\s*return \{\n\s*message: parsed\.speech \|\| "Action complete\.",\n\s*suggestedAction: parsed\.intent !== 'GENERAL' \? \{ intent: parsed\.intent, payload: parsed\.actionPayload \} : undefined\n\s*\} as CopilotResponse;/g,
    `return JSON.parse(response.text || "{}");`
);
gemini = gemini.replace(
    /return \{ message: "System returned nothing\. Please retry\." \} as CopilotResponse;/g,
    `return { speech: "System returned nothing. Please retry.", intent: "GENERAL" };`
);
gemini = gemini.replace(
    /return \{ message: \`Error: \$\{e instanceof Error \? e\.message : "Unknown"\}\` \} as CopilotResponse;/g,
    `return { speech: \`Error: \$\{e instanceof Error ? e.message : 'Unknown'\}\`, intent: "GENERAL" };`
);
fs.writeFileSync('services/geminiService.ts', gemini);


// And finally we must fix GlobalAssistant.tsx to handle the fact that it is 'speech' and 'actionPayload'
let assistant = fs.readFileSync('components/GlobalAssistant.tsx', 'utf8');

// First replace the recent changes we made in GlobalAssistant where we tried to use response.message or response.suggestedAction
// Oh wait, in GlobalAssistant we did:
// if (response.suggestedAction) { await executeAction(response.suggestedAction.intent, response.suggestedAction.payload); }
assistant = assistant.replace(
    /if \(response\.suggestedAction\) \{\n\s*await executeAction\(response\.suggestedAction\.intent, response\.suggestedAction\.payload\);\n\s*\}/g,
    `if (response.intent && response.intent !== 'GENERAL' && response.actionPayload) {
                await executeAction(response.intent, response.actionPayload);
            }`
);

// We added: addMessage('model', typeof response === 'string' ? response : (response.message || response.text || 'Action complete.'));
assistant = assistant.replace(
    /addMessage\('model', typeof response === 'string' \? response : \(response\.message \|\| response\.text \|\| 'Action complete\.'\)\);/g,
    `addMessage('model', typeof response === 'string' ? response : (response.speech || 'Action complete.'));`
);

// We added: speak(typeof response === 'string' ? response : (response.message || 'Action complete.'), () => setState('idle'));
assistant = assistant.replace(
    /speak\(typeof response === 'string' \? response : \(response\.message \|\| 'Action complete\.'\), \(\) => setState\('idle'\)\);/g,
    `speak(typeof response === 'string' ? response : (response.speech || 'Action complete.'), () => setState('idle'));`
);

// We also added: speak(response.message, () => setState('idle')); (if it was already there)
assistant = assistant.replace(
    /speak\(response\.message, \(\) => setState\('idle'\)\);/g,
    `speak(typeof response === 'string' ? response : (response.speech || 'Action complete.'), () => setState('idle'));`
);

fs.writeFileSync('components/GlobalAssistant.tsx', assistant);

