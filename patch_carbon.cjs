const fs = require('fs');
let content = fs.readFileSync('pages/dashboards/CarbonPurpleDashboard.tsx', 'utf8');

// Extract ConnectedAmbientGlow
const ambientGlowCode = `
const ConnectedAmbientGlow = memo(() => {
  const rpm = useVehicleStore((state) => state.latestData?.rpm || 0);
  const isRedline = rpm >= 6500;
  const isNearRedline = rpm >= 6000;
  const glowColor = isRedline
    ? "rgba(239, 68, 68, 0.35)"
    : isNearRedline
      ? "rgba(219, 39, 119, 0.2)"
      : "rgba(188, 19, 254, 0.08)";
      
  return (
    <div
      className="absolute inset-0 pointer-events-none transition-colors duration-500 ease-out"
      style={{
        background: \`radial-gradient(circle at 50% -20%, \${glowColor} 0%, transparent 70%)\`,
        zIndex: 0,
      }}
    />
  );
});
`;

content = content.replace(/const CarbonPurpleDashboard: React\.FC = \(\) => {/, ambientGlowCode + '\nconst CarbonPurpleDashboard: React.FC = () => {');

// Remove latestData and rpm calculation from the main component
content = content.replace(/const latestData = useVehicleStore\(\(state\) => state\.latestData\);\n\s*const rpm = latestData\?\.rpm \|\| 0;\n\s*const isRedline = rpm >= 6500;\n\s*const isNearRedline = rpm >= 6000;\n\s*\/\/ Dynamic tactical glowing ambient light based on engine speed\n\s*const glowColor = isRedline\n\s*\? "rgba\(239, 68, 68, 0\.35\)"\n\s*: isNearRedline\n\s*\? "rgba\(219, 39, 119, 0\.2\)"\n\s*: "rgba\(188, 19, 254, 0\.08\)";/g, '');

// Replace the div that uses glowColor
content = content.replace(/<div\n\s*className="absolute inset-0 pointer-events-none transition-colors duration-500 ease-out"\n\s*style={{\n\s*background: `radial-gradient\(circle at 50% -20%, \${glowColor} 0%, transparent 70%\)`,\n\s*zIndex: 0,\n\s*}}\n\s*\/>/g, '<ConnectedAmbientGlow />');

fs.writeFileSync('pages/dashboards/CarbonPurpleDashboard.tsx', content);
