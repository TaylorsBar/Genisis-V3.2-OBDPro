import React from 'react';
import { Flame, Gauge, Zap, Activity, Droplet, Shield, Disc } from 'lucide-react';

interface NismoDigitalClusterProps {
  rpm: number;                  // 0 to 8000
  speed: number;                // 0 to 200 MPH
  gear: number | string;        // 'P', 'R', 'N', 1-9
  boostPsi: number;            // -15 to +20 PSI
  engOilTempF: number;          // °F (e.g., 210)
  tmOilTempF: number;           // °F (e.g., 190)
  waterTempF: number;           // °F (e.g., 195)
  diffOilTempF: number;         // °F (e.g., 165)
  fuelLevelPercent: number;     // 0 to 100%
  rangeMiles: number;           // e.g. 420
  odometerMiles: number;        // e.g. 1969
  unitSystem?: 'imperial' | 'metric';
  driveMode?: 'STANDARD' | 'SPORT' | 'NISMO';
}

export const NismoDigitalCluster: React.FC<NismoDigitalClusterProps> = ({
  rpm = 3400,
  speed = 65,
  gear = 'D4',
  boostPsi = 14.2,
  engOilTempF = 210,
  tmOilTempF = 190,
  waterTempF = 195,
  diffOilTempF = 165,
  fuelLevelPercent = 75,
  rangeMiles = 420,
  odometerMiles = 1969,
  unitSystem = 'imperial',
  driveMode = 'NISMO'
}) => {
  const isMetric = unitSystem === 'metric';

  // Unit conversions
  const displaySpeed = isMetric ? Math.round(speed * 1.60934) : Math.round(speed);
  const speedUnit = isMetric ? 'km/h' : 'MPH';
  const altSpeed = isMetric ? `${Math.round(speed)} MPH` : `${Math.round(speed * 1.60934)} km/h`;

  const boostVal = isMetric ? boostPsi * 0.0689476 : boostPsi;
  const boostUnitStr = isMetric ? 'bar' : 'psi';

  const engOilVal = isMetric ? Math.round((engOilTempF - 32) * (5 / 9)) : Math.round(engOilTempF);
  const tmOilVal = isMetric ? Math.round((tmOilTempF - 32) * (5 / 9)) : Math.round(tmOilTempF);
  const waterTempVal = isMetric ? Math.round((waterTempF - 32) * (5 / 9)) : Math.round(waterTempF);
  const diffOilVal = isMetric ? Math.round((diffOilTempF - 32) * (5 / 9)) : Math.round(diffOilTempF);
  const tempUnitStr = isMetric ? '°C' : '°F';

  // Tachometer sweep angle calculation (0 to 8000 RPM)
  const clampedRpm = Math.max(0, Math.min(8000, rpm));
  const rpmRatio = clampedRpm / 8000;
  const tachNeedleAngle = -135 + rpmRatio * 270;

  // Progressive Shift Light array (16 LEDs for motorsport precision)
  const isRedline = clampedRpm >= 7200;
  const shiftProgress = Math.max(0, (clampedRpm - 2500) / 5000); // 2500 to 7500 RPM
  const activeLedsCount = Math.floor(shiftProgress * 16);

  // Theme accent laser colors
  const getLaserGlowColor = () => {
    switch (driveMode) {
      case 'NISMO':
        return 'from-red-600 via-red-500 to-red-600 shadow-[0_0_30px_rgba(239,68,68,0.9)]';
      case 'SPORT':
        return 'from-amber-500 via-red-500 to-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.8)]';
      default:
        return 'from-cyan-500 via-blue-500 to-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.7)]';
    }
  };

  return (
    <div className="relative w-full bg-[#040406] rounded-xl sm:rounded-3xl p-2 sm:p-4 border-0 sm:border border-gray-900 shadow-[0_0_40px_rgba(0,0,0,0.98)] overflow-hidden font-sans select-none">
      
      {/* Carbon Grain Texture & Curved Bezel Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/25 via-black to-black pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-25 pointer-events-none"></div>

      {/* ================= TOP MOTORSPORT PROGRESSIVE RPM SHIFT RIBBON ================= */}
      <div className="relative z-20 mb-4 bg-black/90 p-3 sm:p-4 rounded-2xl border border-gray-800/90 shadow-[0_0_25px_rgba(0,0,0,0.9)] flex flex-col gap-2">
        
        {/* Top Header Label */}
        <div className="flex justify-between items-center text-[10px] sm:text-xs font-mono font-bold text-gray-400 uppercase tracking-widest px-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_#dc2626]" />
            <span className="text-white font-display font-black">RPM PROGRESSIVE TACHOMETER</span>
          </div>
          <div className="flex items-center gap-2 text-red-500 font-black">
            <span>{Math.round(clampedRpm)}</span>
            <span className="text-[9px] text-gray-500 font-mono">RPM</span>
          </div>
        </div>

        {/* 16-Segment High-Density F1 Shift LED Array */}
        <div className="flex w-full gap-1 sm:gap-1.5 px-1 py-1">
          {Array.from({ length: 16 }).map((_, idx) => {
            const isActive = idx < activeLedsCount || isRedline;
            let ledColor = 'bg-gray-900 border-gray-800';

            if (isActive) {
              if (isRedline) {
                ledColor = 'bg-white border-red-500 animate-ping shadow-[0_0_15px_#ffffff]';
              } else if (idx < 6) {
                ledColor = 'bg-emerald-500 border-emerald-300 shadow-[0_0_12px_#10b981]';
              } else if (idx < 11) {
                ledColor = 'bg-amber-400 border-amber-200 shadow-[0_0_12px_#f59e0b]';
              } else {
                ledColor = 'bg-red-600 border-red-300 shadow-[0_0_15px_#ef4444]';
              }
            }

            return (
              <div
                key={`shift-block-${idx}`}
                className={`flex-1 h-3 sm:h-4.5 rounded-sm border transition-all duration-75 ${ledColor}`}
              />
            );
          })}
        </div>

        {/* Continuous Linear Progressive Arc Bar */}
        <div className="w-full h-3 sm:h-4 bg-gray-950 rounded-full border border-gray-800 p-0.5 overflow-hidden relative shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-75 ${
              isRedline
                ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-600 shadow-[0_0_20px_#ef4444] animate-pulse'
                : 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.7)]'
            }`}
            style={{ width: `${rpmRatio * 100}%` }}
          />

          {/* RPM Scale Mark Labels (0, 2, 4, 6, 7, 8) */}
          <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none text-[8px] sm:text-[9px] font-mono font-black text-white/90 drop-shadow">
            <span>0</span>
            <span>2k</span>
            <span>4k</span>
            <span>6k</span>
            <span className="text-red-400 font-extrabold">7k</span>
            <span className="text-red-500 font-extrabold">8k</span>
          </div>
        </div>
      </div>


      {/* ================= MAIN EDGE-TO-EDGE DISPLAY GRID ================= */}
      <div className="relative w-full grid grid-cols-12 items-center gap-4 sm:gap-6 z-10 pt-2">
        
        {/* ================= LEFT COLUMN: ENLARGED BOOST GAUGE & INDICATORS ================= */}
        <div className="col-span-12 xl:col-span-3 flex flex-col items-center justify-center relative order-2 xl:order-1 mt-8 xl:mt-0">
          
          {/* Boost Gauge Frame */}
          <div className="relative w-full max-w-[200px] sm:max-w-[240px] xl:max-w-[260px] aspect-square rounded-full border-2 border-gray-800/90 bg-black/80 backdrop-blur-xl p-3 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.9)]">
            
            {/* Outer Tick Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="86" fill="none" stroke="#1f2937" strokeWidth="4" />
              
              {/* Ticks from 0 to 30 PSI */}
              {[0, 5, 10, 15, 20, 25, 30].map((val) => {
                const norm = (val - 0) / (30 - 0);
                const angle = -135 + norm * 270;
                const rad = (angle * Math.PI) / 180;
                const x1 = 100 + 72 * Math.cos(rad);
                const y1 = 100 + 72 * Math.sin(rad);
                const x2 = 100 + 84 * Math.cos(rad);
                const y2 = 100 + 84 * Math.sin(rad);
                const tx = 100 + 58 * Math.cos(rad);
                const ty = 100 + 58 * Math.sin(rad);

                return (
                  <g key={`b-tick-${val}`}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={val > 15 ? '#ef4444' : '#d1d5db'} strokeWidth={val % 10 === 0 ? '3' : '1.5'} />
                    <text
                      x={tx}
                      y={ty}
                      fill={val > 15 ? '#ef4444' : '#ffffff'}
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(90 ${tx} ${ty})`}
                      fontFamily="monospace"
                    >
                      {isMetric ? (val * 0.0689476).toFixed(1) : val}
                    </text>
                  </g>
                );
              })}

              {/* Sweeping Boost Needle Vector */}
              {(() => {
                const norm = (Math.max(0, Math.min(30, boostPsi)) - 0) / 30;
                const angle = -135 + norm * 270;
                const rad = (angle * Math.PI) / 180;
                const bx = 100 + 78 * Math.cos(rad);
                const by = 100 + 78 * Math.sin(rad);
                return (
                  <g className="transition-all duration-100 ease-out">
                    <line x1="100" y1="100" x2={bx} y2={by} stroke="#ef4444" strokeWidth="4" strokeLinecap="round" className="drop-shadow-[0_0_10px_#ef4444]" />
                    <line x1="100" y1="100" x2={bx} y2={by} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="100" cy="100" r="8" fill="#09090b" stroke="#ef4444" strokeWidth="2" />
                    <circle cx="100" cy="100" r="3" fill="#ef4444" />
                  </g>
                );
              })()}
            </svg>

            {/* Central Boost Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xs font-display font-black text-gray-300 uppercase tracking-widest mb-1">
                TURBO BOOST
              </span>
              
              <div className="my-0.5 opacity-90 text-red-500">
                <Flame className="w-5 sm:w-6 h-5 sm:h-6 animate-pulse" />
              </div>

              <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">
                {boostVal.toFixed(1)}
              </div>
              
              <span className="text-[10px] font-mono text-red-500 font-extrabold uppercase tracking-widest mt-0.5">
                {boostUnitStr}
              </span>
            </div>
          </div>
        </div>


        {/* ================= CENTER COLUMN: ENLARGED TACHOMETER & SPEEDOMETER ================= */}
        <div className="col-span-12 xl:col-span-6 flex flex-col items-center justify-center relative order-1 xl:order-2">
          
          {/* Top Overlays: Current Gear & Speedometer */}
          <div className="w-full max-w-[320px] sm:max-w-[400px] flex justify-between items-end px-2 sm:px-6 mb-[-30px] z-20">
            
            {/* Gear Display */}
            <div className="flex flex-col items-start bg-black/60 px-3 py-1 rounded-xl border border-gray-800 backdrop-blur-md">
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">GEAR</span>
              <span className="text-4xl sm:text-6xl font-display font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]">
                {gear}
              </span>
            </div>

            {/* Speedometer Display */}
            <div className="flex flex-col items-end bg-black/60 px-4 py-1 rounded-xl border border-gray-800 backdrop-blur-md">
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">SPEED</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl sm:text-7xl font-display font-black text-white tracking-tighter drop-shadow-[0_0_25px_rgba(255,255,255,0.95)]">
                  {displaySpeed}
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-red-500 uppercase tracking-wider">
                  {speedUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Large Center Tachometer Dial */}
          <div className="relative w-full max-w-[280px] sm:max-w-[360px] md:max-w-[410px] aspect-square rounded-full border-4 border-red-900/70 bg-black/90 backdrop-blur-2xl p-4 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.4)]">
            
            {/* Inner Crimson Ring Accent */}
            <div className="absolute inset-2.5 rounded-full border-2 border-red-600/50 shadow-[inset_0_0_25px_rgba(239,68,68,0.5)] pointer-events-none"></div>

            {/* Tachometer SVG Face */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 300 300">
              
              <circle cx="150" cy="150" r="125" fill="none" stroke="#262626" strokeWidth="5" />
              
              {/* Redline Region (7000 to 8000 RPM) */}
              <circle
                cx="150"
                cy="150"
                r="125"
                fill="none"
                stroke="#dc2626"
                strokeWidth="12"
                strokeDasharray="59 500"
                strokeDashoffset="-380"
                className="opacity-95 drop-shadow-[0_0_12px_#dc2626]"
              />

              {/* Major RPM Ticks 0 through 8 */}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                const angle = -135 + (num / 8) * 270;
                const rad = (angle * Math.PI) / 180;
                const isRed = num >= 7;
                const x1 = 150 + 105 * Math.cos(rad);
                const y1 = 150 + 105 * Math.sin(rad);
                const x2 = 150 + 120 * Math.cos(rad);
                const y2 = 150 + 120 * Math.sin(rad);
                const tx = 150 + 86 * Math.cos(rad);
                const ty = 150 + 86 * Math.sin(rad);

                return (
                  <g key={`tach-num-${num}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isRed ? '#ef4444' : '#ffffff'}
                      strokeWidth={num % 1 === 0 ? '4' : '2'}
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill={isRed ? '#ef4444' : '#ffffff'}
                      fontSize="22"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(90 ${tx} ${ty})`}
                      fontFamily="sans-serif"
                    >
                      {num}
                    </text>
                  </g>
                );
              })}

              {/* Precision Sweeping Tachometer Needle Vector */}
              {(() => {
                const rad = ((-135 + (clampedRpm / 8000) * 270) * Math.PI) / 180;
                const nx = 150 + 115 * Math.cos(rad);
                const ny = 150 + 115 * Math.sin(rad);
                return (
                  <g className="transition-all duration-75 ease-out">
                    <line
                      x1="150"
                      y1="150"
                      x2={nx}
                      y2={ny}
                      stroke="#ef4444"
                      strokeWidth="6"
                      strokeLinecap="round"
                      className="drop-shadow-[0_0_15px_#ef4444]"
                    />
                    <line
                      x1="150"
                      y1="150"
                      x2={nx}
                      y2={ny}
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="150" cy="150" r="14" fill="#09090b" stroke="#dc2626" strokeWidth="2" />
                    <circle cx="150" cy="150" r="6" fill="#ef4444" />
                  </g>
                );
              })()}
            </svg>

            {/* Central Nismo / Z Brand Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              
              {/* "nismo" Logo */}
              <div className="text-xs sm:text-base font-display font-black tracking-widest text-white uppercase mt-[-50px]">
                nis<span className="text-red-600 font-extrabold">m</span>o
              </div>

              {/* Iconic Fairlady "Z" Badge Centerpiece */}
              <div className="my-2 relative flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full bg-red-600/25 blur-2xl"></div>
                <span className="text-5xl sm:text-6xl font-serif italic font-black text-transparent bg-clip-text bg-gradient-to-tr from-gray-200 via-white to-gray-400 drop-shadow-[0_0_20px_rgba(255,255,255,0.95)] transform -skew-x-12">
                  Z
                </span>
              </div>

              {/* Drive Mode Pill */}
              <div className="bg-black/90 border border-gray-700 px-3.5 py-0.5 rounded-md shadow-md mt-1">
                <span className="text-[10px] font-mono font-black text-gray-200 tracking-widest uppercase">
                  {driveMode}
                </span>
              </div>

              {/* RPM x1000 Label */}
              <span className="text-[9px] font-mono text-gray-400 font-extrabold uppercase mt-1">
                RPM x 1000
              </span>
            </div>
          </div>
        </div>


        {/* ================= RIGHT COLUMN: DUAL MULTI-TEMP DIALS ================= */}
        <div className="col-span-12 xl:col-span-3 flex flex-row xl:flex-col gap-4 items-center justify-center order-3 mt-4 xl:mt-0 flex-wrap">
          
          {/* DIAL 1: ENG OIL TEMP & TM OIL TEMP */}
          <div className="relative flex-1 min-w-[200px] xl:w-full max-w-[280px] h-28 sm:h-32 rounded-2xl border border-gray-800 bg-black/80 backdrop-blur-md p-3 flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-display font-black text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-1 text-center">
              ENGINE OIL TEMP
            </div>

            <div className="flex justify-around items-center my-1">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-amber-500" />
                <span className="text-lg font-display font-black text-white">
                  {engOilVal}<span className="text-xs text-gray-400 font-mono ml-0.5">{tempUnitStr}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Disc className="w-4 h-4 text-red-500" />
                <span className="text-lg font-display font-black text-white">
                  {tmOilVal}<span className="text-xs text-gray-400 font-mono ml-0.5">{tempUnitStr}</span>
                </span>
              </div>
            </div>

            <div className="text-[9px] font-mono text-gray-400 text-center uppercase tracking-wider font-bold">
              TRANSMISSION OIL
            </div>
          </div>

          {/* DIAL 2: WATER TEMP & DIFF OIL TEMP */}
          <div className="relative flex-1 min-w-[200px] xl:w-full max-w-[280px] h-28 sm:h-32 rounded-2xl border border-gray-800 bg-black/80 backdrop-blur-md p-3 flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-display font-black text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-1 text-center">
              COOLANT WATER TEMP
            </div>

            <div className="flex justify-around items-center my-1">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-lg font-display font-black text-white">
                  {waterTempVal}<span className="text-xs text-gray-400 font-mono ml-0.5">{tempUnitStr}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-lg font-display font-black text-white">
                  {diffOilVal}<span className="text-xs text-gray-400 font-mono ml-0.5">{tempUnitStr}</span>
                </span>
              </div>
            </div>

            <div className="text-[9px] font-mono text-gray-400 text-center uppercase tracking-wider font-bold">
              REAR DIFFERENTIAL OIL
            </div>
          </div>

        </div>
      </div>


      {/* ================= BOTTOM DASHBOARD FOOTER BAR ================= */}
      <div className="mt-6 pt-3 border-t border-gray-900 flex flex-wrap justify-between items-center text-xs font-mono text-gray-400 gap-2 z-20">
        
        {/* Left: Odometer */}
        <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-lg border border-gray-800">
          <span className="text-gray-400">ODO:</span>
          <span className="text-white font-bold">{odometerMiles.toLocaleString()}</span>
          <span>miles</span>
        </div>

        {/* Center: Fuel Level Bar */}
        <div className="flex items-center gap-3 bg-black/60 px-4 py-1.5 rounded-lg border border-gray-800">
          <span className="text-xs font-bold text-gray-400">E</span>
          <div className="w-28 sm:w-36 h-2.5 bg-gray-950 rounded-sm overflow-hidden flex p-0.5 gap-0.5 border border-gray-800">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`fuel-bar-${i}`}
                className={`flex-1 h-full rounded-xs transition-colors ${
                  i < (fuelLevelPercent / 10) ? (i < 2 ? 'bg-red-500' : 'bg-white') : 'bg-gray-800'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-gray-400">F</span>
          <span className="text-xs text-amber-500 font-bold ml-1">RANGE: {rangeMiles} mi</span>
        </div>

        {/* Right: Alternate Speed */}
        <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-lg border border-gray-800 font-bold text-gray-200">
          <span>ALT:</span>
          <span className="text-red-400">{altSpeed}</span>
        </div>
      </div>

    </div>
  );
};

export default NismoDigitalCluster;
