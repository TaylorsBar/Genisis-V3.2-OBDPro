const fs = require('fs');

const cssStyles = `<style id="focus-styles">
div#root:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(1) > div:nth-of-type(1) > h2:nth-of-type(1) { font-family: Orbitron !important; font-style: italic !important; font-weight: bold !important; text-decoration-line: none !important; border-style: outset !important; }
div#root:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(1) > div:nth-of-type(2) > button:nth-of-type(1) > span:nth-of-type(1) { text-decoration-line: underline !important; }
</style>`;

let content = fs.readFileSync('index.html', 'utf8');
if (content.includes('<style id="focus-styles">')) {
    content = content.replace(/<style id="focus-styles">[\s\S]*?<\/style>/, cssStyles);
} else {
    content = content.replace('</head>', cssStyles + '\n</head>');
}
fs.writeFileSync('index.html', content);
