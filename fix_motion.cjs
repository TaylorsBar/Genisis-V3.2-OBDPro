const fs = require('fs');
const path = require('path');

function replaceMotionState(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern to look for:
    // const [displayVal, setDisplayVal] = useState...
    // useEffect(() => { return valMotion.on("change", (v) => { setDisplayVal(...) }) }, [...])
    // <span>{displayVal}</span>
    
    // Because it's hard to regex this perfectly, I'll just check if it's the exact same Component structure 
    if (content.includes('setDisplayVal(')) {
        content = content.replace(/const\s+\[displayVal,\s*setDisplayVal\]\s*=\s*useState<string\s*\|\s*number>\(0\);/g, 'const formattedMotion = useTransform(valMotion, format ? (v => format(v)) : (v => v.toFixed(1)));');
        
        // Remove useEffect
        content = content.replace(/useEffect\(\(\)\s*=>\s*\{\s*return\s*valMotion\.on\("change",\s*\([vV]\)\s*=>\s*\{\s*setDisplayVal\([^;]+\);\s*\}\);\s*\},\s*\[valMotion,\s*format\]\);/g, '');
        
        // Replace rendering
        content = content.replace(/<span\s+className=\{([^}]+)\}\s*>\s*\{displayVal\}\s*<\/span>/g, '<motion.span className={$1}>{formattedMotion as any}</motion.span>');
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed motion rendering:', filePath);
    }
}

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./components', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        replaceMotionState(filePath);
    }
});
walkDir('./pages', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        replaceMotionState(filePath);
    }
});
