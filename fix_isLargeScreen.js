const fs = require('fs');

const files = [
  'pages/dashboards/CarbonPurpleDashboard.tsx',
  'pages/dashboards/ClassicThemeDashboard.tsx',
  'pages/dashboards/HaltechDashboard.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // We can just use a non-greedy regex matching the isLargeScreen pattern since the objects are simple:
  // e.g., style={isLargeScreen ? { ... } : undefined}
  // The 's' flag allows '.' to match newlines.
  
  content = content.replace(/style=\{isLargeScreen \? \{.*?\} : undefined\}/gs, '');
  content = content.replace(/style=\{isLargeScreen \? \{.*?\} : (\{.*?\})\}/gs, 'style={$1}');
  
  content = content.replace(/svgStyle=\{isLargeScreen \? \{.*?\} : undefined\}/gs, '');
  content = content.replace(/svgStyle=\{isLargeScreen \? \{.*?\} : (\{.*?\})\}/gs, 'svgStyle={$1}');
  
  content = content.replace(/bezel1Style=\{isLargeScreen \? \{.*?\} : undefined\}/gs, '');
  content = content.replace(/bezel1Style=\{isLargeScreen \? \{.*?\} : (\{.*?\})\}/gs, 'bezel1Style={$1}');

  content = content.replace(/containerStyle=\{isLargeScreen \? \{.*?\} : undefined\}/gs, '');
  content = content.replace(/canvasStyle=\{isLargeScreen \? \{.*?\} : undefined\}/gs, '');

  content = content.replace(/isLargeScreen=\{isLargeScreen\}/g, '');
  content = content.replace(/const isLargeScreen = useUIStore.+?;/g, '');

  content = content.replace(/style=\{isLargeScreen \? \(isRpmLimitHit \? \{.*?\} : \{.*?\}\) : undefined\}/gs, 'style={isRpmLimitHit ? { paddingTop: "0px", paddingLeft: "20px", paddingBottom: "0px", paddingRight: "0px" } : { width: "100%", height: "100%" }}');
  
  fs.writeFileSync(file, content, 'utf8');
}
console.log("Done");
