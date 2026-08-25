const fs = require('fs');
let content = fs.readFileSync('tests/firestore.rules.test.ts', 'utf8');
content = content.replace("import { serverTimestamp } from 'firebase/firestore';\n", "");
content = content.replace(/createdAt: serverTimestamp\(\) as any/g, "createdAt: Date.now()");
content = content.replace(/startTime: serverTimestamp\(\) as any/g, "startTime: Date.now()");
fs.writeFileSync('tests/firestore.rules.test.ts', content);
