const fs = require('fs');

function fixGauge(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the framer-motion inline animation for the needle body with a className and simple motion props
    const regex = /<motion\.path\s+d="([^"]+)"\s+fill=\{`url\([^)]+\)`\}\s+filter=\{`url\([^)]+\)`\}\s+animate=\{isLimitHit \? \{[^}]+\}\s*:\s*\{[^}]+\}\}\s+transition=\{isLimitHit \? \{[^}]+\}\s*:\s*\{[^}]+\}\}\s*\/>/m;
    
    if (content.match(regex)) {
        content = content.replace(regex, `<motion.path 
                        d="$1" 
                        fill={\`url(#needleGradient-\${uid})\`} 
                        filter={\`url(#\${defsId.neonBloom})\`}
                        className={isLimitHit ? "animate-pulse-danger" : ""}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    />`);
        fs.writeFileSync(filePath, content);
        console.log("Fixed", filePath);
    } else {
        console.log("No match found in", filePath);
    }
}

fixGauge('components/tachometers/ApexiGauge.tsx');
fixGauge('components/tachometers/ApexiBoostGauge.tsx');

