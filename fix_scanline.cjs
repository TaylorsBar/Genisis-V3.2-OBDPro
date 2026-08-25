const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');
content = content.replace('</head>', '<style>\n.scanline-overlay {\n  position: fixed;\n  inset: 0;\n  pointer-events: none;\n  z-index: 99999;\n  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));\n  background-size: 100% 4px, 3px 100%;\n  opacity: 0.1;\n}\n</style>\n</head>');

fs.writeFileSync('index.html', content);
