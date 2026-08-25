const fs = require('fs');
let content = fs.readFileSync('services/geminiService.ts', 'utf8');

// CopilotResponse is exported from types, but in the generated schema, the fields are `speech` and `intent`.
// We need to make sure we parse it correctly or change the return structure to match CopilotResponse type.
// We'll update the GlobalAssistant to handle `speech` and `intent` as the return format if that's what geminiService returns.
// Wait, looking at GlobalAssistant.tsx line 135+, it uses `response.message` and `response.suggestedAction.intent`.
// Let's modify geminiService to return `{ message: string, suggestedAction?: { intent: string, payload: any } }`

content = content.replace(
    /return JSON\.parse\(response\.text \|\| "\{\}"\);/g,
    `const parsed = JSON.parse(response.text || "{}");
            return {
                message: parsed.speech || "Action complete.",
                suggestedAction: parsed.intent !== 'GENERAL' ? { intent: parsed.intent, payload: parsed.actionPayload } : undefined
            } as CopilotResponse;`
);

content = content.replace(
    /return \{ speech: "System returned nothing\. Please retry\.", intent: "GENERAL" \};/g,
    'return { message: "System returned nothing. Please retry." } as CopilotResponse;'
);

content = content.replace(
    /return \{ speech: \`Error: \$\{e instanceof Error \? e\.message : 'Unknown'\}\`, intent: "GENERAL" \};/g,
    'return { message: `Error: ${e instanceof Error ? e.message : "Unknown"}` } as CopilotResponse;'
);

fs.writeFileSync('services/geminiService.ts', content);
