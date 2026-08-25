const fs = require('fs');
const path = require('path');

function replaceDestructuredUseStore(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Use regex to find `const { a, b, c } = useVehicleStore();`
    const regex = /const\s+\{\s*([^}]+)\s*\}\s*=\s*useVehicleStore\(\);/g;
    
    content = content.replace(regex, (match, varsGroup) => {
        const vars = varsGroup.split(',').map(v => v.trim()).filter(v => v.length > 0);
        let replacement = '';
        vars.forEach(v => {
             // Handle aliases like `state: aiState` or just `latestData`
             if (v.includes(':')) {
                 const parts = v.split(':');
                 const original = parts[0].trim();
                 const alias = parts[1].trim();
                 replacement += `const ${alias} = useVehicleStore(state => state.${original});\n    `;
             } else {
                 replacement += `const ${v} = useVehicleStore(state => state.${v});\n    `;
             }
        });
        return replacement.trim();
    });

    if (content !== fs.readFileSync(filePath, 'utf8')) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed:', filePath);
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
        replaceDestructuredUseStore(filePath);
    }
});
