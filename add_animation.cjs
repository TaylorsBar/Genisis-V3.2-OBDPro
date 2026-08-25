const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');
const animationConfig = `
            keyframes: {
              'pulse-danger': {
                '0%, 100%': { filter: 'drop-shadow(0 0 10px rgba(255, 0, 0, 0.8)) drop-shadow(0 0 20px rgba(255, 0, 0, 0.5))', stroke: '#ff0000', fill: '#ff0000' },
                '50%': { filter: 'drop-shadow(0 0 2px rgba(255, 0, 0, 0.5))', stroke: '#aa0000', fill: '#aa0000' }
              }
            },
            animation: {
              'pulse-danger': 'pulse-danger 0.2s ease-in-out infinite'
            },
`;

if (!content.includes('pulse-danger')) {
    content = content.replace(/extend:\s*\{/, "extend: {\n" + animationConfig);
    fs.writeFileSync('index.html', content);
    console.log("Animation added.");
} else {
    console.log("Animation already exists.");
}
