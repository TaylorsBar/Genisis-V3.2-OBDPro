const fs = require('fs');
let content = fs.readFileSync('components/GlobalAssistant.tsx', 'utf8');

// The Message type from aiStore has: { id: string, role: 'user'|'model'|'system', text: string, timestamp: number }
// The previous code in GlobalAssistant used: { role: 'user'|'assistant', content: string, timestamp: number, suggestedAction?: any }

// Let's rewrite handleSend in GlobalAssistant to use the correct store types.
content = content.replace(/addMessage\(\{ role: 'user', content: userMsg, timestamp: Date\.now\(\) \}\);/g, "addMessage('user', userMsg);");
content = content.replace(/addMessage\(\{\s*role: 'assistant',\s*content: response\.message,\s*timestamp: Date\.now\(\),\s*suggestedAction: response\.suggestedAction\s*\}\);/g, "addMessage('model', typeof response === 'string' ? response : (response.message || response.text || 'Action complete.'));");
content = content.replace(/addMessage\(\{ role: 'assistant', content: 'System malfunction. Unable to process command.', timestamp: Date\.now\(\) \}\);/g, "addMessage('model', 'System malfunction. Unable to process command.');");

content = content.replace(/addMessage\(\{ role: 'assistant', content: response\.message, timestamp: Date\.now\(\) \}\);/g, "addMessage('model', typeof response === 'string' ? response : response.message || response.text || 'Action complete.');");

content = content.replace(/const contextPayload = \{\n\s*telemetry: ctx\.latestData,\n\s*tuning: ctx\.tuning,\n\s*dtcs: ctx\.dtcs,\n\s*isLogging: ctx\.isLogging,\n\s*ekfStats: ctx\.ekfStats\n\s*\};/g, 
`const contextPayload = {
                telemetry: ctx.latestData,
                tuning: ctx.tuning,
                diagnostics: ctx.dtcs,
                currentRoute: window.location.pathname,
                isLogging: ctx.isLogging,
                ekfStats: ctx.ekfStats
            };`);

// And in the render loop:
content = content.replace(/msg\.content/g, "msg.text");

fs.writeFileSync('components/GlobalAssistant.tsx', content);
