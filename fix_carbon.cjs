const fs = require('fs');
let content = fs.readFileSync('pages/dashboards/CarbonPurpleDashboard.tsx', 'utf8');

// The original CarbonPurpleDashboard had latestData inside it.
content = content.replace(/const CarbonPurpleDashboard: React\.FC = \(\) => {/, `const CarbonPurpleDashboard: React.FC = () => {
  const latestData = useVehicleStore((state) => state.latestData);
  const rpm = latestData?.rpm || 0;
  const isRedline = rpm >= 6500;
  const isNearRedline = rpm >= 6000;
  const glowColor = isRedline
    ? "rgba(239, 68, 68, 0.35)"
    : isNearRedline
      ? "rgba(219, 39, 119, 0.2)"
      : "rgba(188, 19, 254, 0.08)";
`);

fs.writeFileSync('pages/dashboards/CarbonPurpleDashboard.tsx', content);
