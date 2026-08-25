const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./components', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        if (content.includes('const { latestData } = useVehicleStore();')) {
            content = content.replace(/const \{ latestData \} = useVehicleStore\(\);/g, 'const latestData = useVehicleStore(state => state.latestData);');
            modified = true;
        }

        if (content.includes('const { data } = useVehicleStore();')) {
            content = content.replace(/const \{ data \} = useVehicleStore\(\);/g, 'const data = useVehicleStore(state => state.data);');
            modified = true;
        }
        
        if (content.includes('const { data, latestData } = useVehicleStore();')) {
            content = content.replace(/const \{ data, latestData \} = useVehicleStore\(\);/g, 'const data = useVehicleStore(state => state.data);\n    const latestData = useVehicleStore(state => state.latestData);');
            modified = true;
        }
        
        if (content.includes('const { latestData, ekfStats } = useVehicleStore();')) {
            content = content.replace(/const \{ latestData, ekfStats \} = useVehicleStore\(\);/g, 'const latestData = useVehicleStore(state => state.latestData);\n    const ekfStats = useVehicleStore(state => state.ekfStats);');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed:', filePath);
        }
    }
});
