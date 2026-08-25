const fs = require('fs');
let content = fs.readFileSync('pages/dashboards/MotecCosworthDashboard.tsx', 'utf8');

// The file is huge, let's just make it a general edit to extract the ScatterPlot.
// I'll write a full replacement for the Motec component structure if possible.
