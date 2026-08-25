const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const fontLinks = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@400;500;700&family=Orbitron:wght@400;500;700;900&display=swap" rel="stylesheet">
`;

if (!html.includes('fonts.googleapis.com/css2?family=Inter')) {
    html = html.replace('</head>', fontLinks + '\n  </head>');
    fs.writeFileSync('index.html', html);
}
