const fs = require('fs');
let content = fs.readFileSync('pages/AnimatedRoutes.tsx', 'utf8');

content = content.replace(
    /initial=\{\{ opacity: 0, y: 5 \}\}/g,
    "initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.98 }}"
);
content = content.replace(
    /animate=\{\{ opacity: 1, y: 0 \}\}/g,
    "animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}"
);
content = content.replace(
    /exit=\{\{ opacity: 0, y: -5 \}\}/g,
    "exit={{ opacity: 0, filter: 'blur(4px)', scale: 1.02 }}"
);
content = content.replace(
    /transition=\{\{ duration: 0.2, ease: 'easeOut' \}\}/g,
    "transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}"
);

fs.writeFileSync('pages/AnimatedRoutes.tsx', content);
