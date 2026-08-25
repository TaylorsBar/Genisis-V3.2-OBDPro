const fs = require('fs');

let content = fs.readFileSync('pages/AIEngine.tsx', 'utf8');

if (!content.includes('HyperScoutService')) {
    content = "import { HyperScoutService } from '../services/HyperScoutService';\n" + content;
    
    // Replace dummy entropy generator with real logic
    const oldMemo = `    const entropyData = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 40; i++) {
            const addStr = \`0x\${(i * 1411 + 12000).toString(16).toUpperCase()}\`;
            // Intentionally place a spike in the middle of calibration tables
            const midRange = i >= 17 && i <= 26;
            const entropy = midRange ? (4.8 + Math.random() * 1.0) : (1.2 + Math.random() * 1.8);
            const varSq = midRange ? (550 + Math.random() * 800) : (40 + Math.random() * 180);
            arr.push({
                index: i,
                address: addStr,
                entropy: entropy,
                variance: varSq
            });
        }
        return arr;
    }, []);`;
    
    const newMemo = `    const entropyData = useMemo(() => {
        const arr = [];
        const hyperscout = HyperScoutService.getInstance();
        
        for (let i = 0; i < 40; i++) {
            const addStr = \`0x\${(i * 1411 + 12000).toString(16).toUpperCase()}\`;
            const midRange = i >= 17 && i <= 26;
            
            // Generate synthetic byte array representing ECU memory
            const mockData = new Uint8Array(256);
            for(let k=0; k<256; k++) {
                if (midRange) {
                    // Mid-entropy (Calibration map like)
                    mockData[k] = Math.floor(Math.random() * 100);
                } else if (i < 5) {
                    // Low entropy (Padding)
                    mockData[k] = 0xFF;
                } else {
                    // High entropy (Executable)
                    mockData[k] = Math.floor(Math.random() * 256);
                }
            }
            
            const entropy = hyperscout.calculateShannonEntropy(mockData);
            const varSq = hyperscout.calculateVariance(mockData);
            
            arr.push({
                index: i,
                address: addStr,
                entropy: entropy,
                variance: varSq
            });
        }
        return arr;
    }, []);`;

    content = content.replace(oldMemo, newMemo);
    fs.writeFileSync('pages/AIEngine.tsx', content);
    console.log("Updated AIEngine");
}
