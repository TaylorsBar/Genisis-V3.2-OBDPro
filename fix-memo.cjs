const fs = require('fs');
const path = require('path');

const dir = 'components/tachometers';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Find the export default and the }; right before it
    const parts = content.split('export default ');
    if (parts.length === 2) {
        let beforeExport = parts[0];
        if (beforeExport.trim().endsWith('};')) {
            const lastIndex = beforeExport.lastIndexOf('};');
            beforeExport = beforeExport.substring(0, lastIndex) + '});\n' + beforeExport.substring(lastIndex + 2);
            content = beforeExport + 'export default ' + parts[1];
            fs.writeFileSync(fullPath, content);
            console.log('Fixed', file);
        }
    }
}
