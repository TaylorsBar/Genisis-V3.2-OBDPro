const fs = require('fs');
let content = fs.readFileSync('pages/dashboards/CarbonPurpleDashboard.tsx', 'utf8');

content = content.replace(/const ConnectedAmbientGlow = memo\(\(\) => \{[\s\S]*?<ConnectedAmbientGlow \/>\s*\);\s*\}\);/, `const ConnectedAmbientGlow = memo(() => {
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
      className="absolute inset-0 pointer-events-none transition-colors duration-500 ease-out z-0"
      style={{
        background: \`radial-gradient(circle at 50% 50%, \${glowColor} 0%, transparent 80%)\`
      }}
    />
  );
});`);

fs.writeFileSync('pages/dashboards/CarbonPurpleDashboard.tsx', content);
