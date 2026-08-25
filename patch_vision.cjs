const fs = require('fs');

let content = fs.readFileSync('services/VisionGroundTruth.ts', 'utf8');

const ransacLogic = `
                // RANSAC Outlier Rejection for VO-FLOW
                let inlierDxSum = 0;
                let inlierDySum = 0;
                let inlierCount = 0;
                
                // Estimate motion model parameters (translation only for simplicity here)
                const numIterations = 50;
                const inlierThreshold = 2.0; // pixels
                let bestInliers = [];
                
                if (dxs.length > 3) {
                    for (let iter = 0; iter < numIterations; iter++) {
                        // Randomly sample 2 points to form a basic translation model
                        const idx1 = Math.floor(Math.random() * dxs.length);
                        const idx2 = Math.floor(Math.random() * dxs.length);
                        if (idx1 === idx2) continue;
                        
                        const modelDx = (dxs[idx1] + dxs[idx2]) / 2;
                        const modelDy = (dys[idx1] + dys[idx2]) / 2;
                        
                        let currentInliers = [];
                        for (let i = 0; i < dxs.length; i++) {
                            const errDx = dxs[i] - modelDx;
                            const errDy = dys[i] - modelDy;
                            const dist = Math.sqrt(errDx * errDx + errDy * errDy);
                            if (dist < inlierThreshold) {
                                currentInliers.push(i);
                            }
                        }
                        
                        if (currentInliers.length > bestInliers.length) {
                            bestInliers = currentInliers;
                        }
                    }
                }
                
                if (bestInliers.length > 0) {
                    bestInliers.forEach(i => {
                        inlierDxSum += dxs[i];
                        inlierDySum += dys[i];
                        inlierCount++;
                    });
                } else {
                    // Fallback to Median Absolute Deviation (MAD) if RANSAC fails or not enough points
                    const madDx = dxs.reduce((acc, val) => acc + Math.abs(val - medianDx), 0) / dxs.length;
                    const madDy = dys.reduce((acc, val) => acc + Math.abs(val - medianDy), 0) / dys.length;
                    
                    const thresholdDx = Math.max(madDx * 2.0, 1.0);
                    const thresholdDy = Math.max(madDy * 2.0, 1.0);

                    for (let i = 0; i < dxs.length; i++) {
                        if (Math.abs(dxs[i] - medianDx) <= thresholdDx && Math.abs(dys[i] - medianDy) <= thresholdDy) {
                            inlierDxSum += dxs[i];
                            inlierDySum += dys[i];
                            inlierCount++;
                        }
                    }
                }
`;

const oldLogicRegex = /                let inlierDxSum = 0;\s+let inlierDySum = 0;\s+let inlierCount = 0;\s+const madDx = [^]+?inlierCount\+\+;\s+\}\s+\}/m;

if (content.match(oldLogicRegex)) {
    content = content.replace(oldLogicRegex, ransacLogic.trim());
    fs.writeFileSync('services/VisionGroundTruth.ts', content);
    console.log("Updated VisionGroundTruth.ts with RANSAC");
} else {
    console.log("Could not find block to replace in VisionGroundTruth.ts");
}
