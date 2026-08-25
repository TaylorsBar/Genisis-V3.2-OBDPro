const fs = require('fs');
let content = fs.readFileSync('tests/firestore.rules.test.ts', 'utf8');
content = "import { serverTimestamp } from 'firebase/firestore';\n" + content;
content = content.replace(/createdAt: Date.now\(\)/g, "createdAt: serverTimestamp() as any");
content = content.replace(/startTime: Date.now\(\)/g, "startTime: serverTimestamp() as any");
fs.writeFileSync('tests/firestore.rules.test.ts', content);
