import React, { useState } from 'react';
import { Flame, Zap, Activity, Maximize2, Minimize2 } from 'lucide-react';

interface NismoTriplePodGaugesProps {
  boostPsi: number;      // e.g. -15 to +20 PSI
  turbineSpeedRpm: number; // e.g. 0 to 240 (in thousands RPM x10,000)
  voltmeter: number;     // e.g. 10.0 to 16.0 V
  unitSystem?: 'imperial' | 'metric';
  mode?: 'STANDARD' | 'SPORT' | 'NISMO';
}

export const NismoTriplePodGauges: React.FC<NismoTriplePodGaugesProps> = ({
  boostPsi = 12.5,
  turbineSpeedRpm = 145, // 145,000 RPM
  voltmeter = 14.2,
  unitSystem = 'imperial',
  mode = 'NISMO'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Unit conversion helper
  const isMetric = unitSystem === 'metric';
  const boostValue = isMetric ? boostPsi * 0.0689476 : boostPsi; // bar vs psi
  const boostUnit = isMetric ? 'bar' : 'psi';
  const boostMin = isMetric ? 0.0 : 0;
  const boostMax = isMetric ? 2.0 : 30;

  // Gauge angles calculation (-120deg to +120deg)
  const calcAngle = (val: number, min: number, max: number) => {
    const clamped = Math.max(min, Math.min(max, val));
    const percentage = (clamped - min) / (max - min);
    return -120 + percentage * 240;
  };

  const boostAngle = calcAngle(boostValue, boostMin, boostMax);
  const turbineAngle = calcAngle(turbineSpeedRpm, 0, 250); // 0 - 250k RPM
  const voltAngle = calcAngle(voltmeter, 8, 18);

  const getAccentGlow = () => {
    switch (mode) {
      case 'NISMO':
        return 'border-red-600/70 shadow-[0_0_35px_rgba(220,38,38,0.4)]';
      case 'SPORT':
        return 'border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.3)]';
      default:
        return 'border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.25)]';
    }
  };

  return (
    <div className={`relative w-full transition-all duration-500 ${isExpanded ? 'p-6 bg-black/95 rounded-3xl border-2 border-red-900/60 my-4 shadow-[0_0_50px_rgba(0,0,0,0.95)]' : ''}`}>
      
      {/* Top Header Label */}
      <div className="flex justify-between items-center mb-3 px-2 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_#dc2626]"></div>
          <span className="text-xs sm:text-sm font-display font-black tracking-[0.2em] text-white uppercase">
            FAIRLADY Z <span className="text-red-500 font-extrabold">TRIPLE POD BINNACLE</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] sm:text-xs font-mono text-gray-400 bg-red-950/80 border border-red-800/50 px-2.5 py-1 rounded-lg text-red-400 font-bold uppercase tracking-wider">
            VR30DDTT AUXILIARY GAUGES
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg bg-gray-900 border border-gray-800"
            title="Toggle Binnacle Focus"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 3D Angled Binnacle Housing */}
      <div className={`relative w-full bg-gradient-to-b from-[#141416] via-[#0b0b0c] to-[#040405] rounded-xl sm:rounded-3xl p-2 sm:p-4 border-t-2 border-x border-b border-gray-800/90 ${getAccentGlow()} backdrop-blur-2xl overflow-hidden shadow-2xl`}>
        
        {/* Leather Trim Stitching & Carbon Texture Details */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none"></div>

        {/* Triple Pod Cluster Grid - Enlarged Edge to Edge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12 relative z-10 items-center justify-items-center">
          
          {/* POD 1: BOOST GAUGE */}
          <div className="flex flex-col items-center w-full group">
            <div className="relative w-full max-w-[200px] sm:max-w-[240px] md:max-w-[260px] aspect-square rounded-full bg-gradient-to-b from-[#1c1c20] to-[#08080a] p-4 border-4 border-gray-800 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95),0_12px_30px_rgba(0,0,0,0.85)] flex items-center justify-center">
              
              <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
              <div className="absolute inset-1 rounded-full border border-red-950/50 pointer-events-none"></div>

              {/* Gauge Face SVG */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke="#1c1d22"
                  strokeWidth="10"
                  strokeDasharray="314 150"
                  strokeDashoffset="-68"
                />
                
                {/* Active Boost Arc */}
                <circle
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke={mode === 'NISMO' ? '#dc2626' : '#00f0ff'}
                  strokeWidth="8"
                  strokeDasharray="314 150"
                  strokeDashoffset={-68 + (314 * (1 - (boostAngle + 120) / 240))}
                  className="transition-all duration-300 drop-shadow-[0_0_10px_currentColor]"
                />

                {/* Major Tick Marks */}
                {[0, 5, 10, 15, 20, 25, 30].map((tick) => {
                  const angle = calcAngle(isMetric ? tick * 0.0689476 : tick, boostMin, boostMax);
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 100 + 62 * Math.cos(rad);
                  const y1 = 100 + 62 * Math.sin(rad);
                  const x2 = 100 + 73 * Math.cos(rad);
                  const y2 = 100 + 73 * Math.sin(rad);
                  const tx = 100 + 48 * Math.cos(rad);
                  const ty = 100 + 48 * Math.sin(rad);

                  return (
                    <g key={`boost-${tick}`}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tick > 12 ? '#dc2626' : '#ffffff'} strokeWidth={tick % 10 === 0 ? '3.5' : '1.5'} />
                      <text
                        x={tx}
                        y={ty}
                        fill={tick > 12 ? '#ef4444' : '#ffffff'}
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(90 ${tx} ${ty})`}
                        fontFamily="monospace"
                      >
                        {isMetric ? (tick * 0.0689476).toFixed(1) : tick}
                      </text>
                    </g>
                  );
                })}

                {/* Precision SVG Boost Needle */}
                {(() => {
                  const rad = (boostAngle * Math.PI) / 180;
                  const nx = 100 + 72 * Math.cos(rad);
                  const ny = 100 + 72 * Math.sin(rad);
                  return (
                    <g className="transition-all duration-100 ease-out">
                      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#ef4444" strokeWidth="4" strokeLinecap="round" className="drop-shadow-[0_0_10px_#ef4444]" />
                      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="100" cy="100" r="8" fill="#09090b" stroke="#ef4444" strokeWidth="2" />
                      <circle cx="100" cy="100" r="3" fill="#ef4444" />
                    </g>
                  );
                })()}
              </svg>

              {/* Central Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xs font-display font-black text-gray-300 uppercase tracking-widest mt-[-32px]">
                  BOOST
                </div>
                
                <div className="my-1 opacity-90 text-red-500">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>

                <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] mt-2">
                  {boostValue.toFixed(isMetric ? 2 : 1)}
                  <span className="text-xs text-red-500 font-mono ml-1 font-extrabold">{boostUnit}</span>
                </div>
              </div>
            </div>

            <span className="mt-4 text-xs font-mono font-bold text-gray-300 uppercase tracking-widest bg-black/80 px-4 py-1.5 rounded-full border border-gray-800 shadow">
              01 // TURBO CHARGE PRESSURE
            </span>
          </div>

          {/* POD 2: TURBINE SPEED GAUGE */}
          <div className="flex flex-col items-center w-full group">
            <div className="relative w-full max-w-[200px] sm:max-w-[240px] md:max-w-[260px] aspect-square rounded-full bg-gradient-to-b from-[#1c1c20] to-[#08080a] p-4 border-4 border-gray-800 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95),0_12px_30px_rgba(0,0,0,0.85)] flex items-center justify-center">
              
              <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
              <div className="absolute inset-1 rounded-full border border-amber-950/50 pointer-events-none"></div>

              {/* Gauge Face SVG */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke="#1c1d22"
                  strokeWidth="10"
                  strokeDasharray="314 150"
                  strokeDashoffset="-68"
                />
                
                {/* Turbine Speed Arc */}
                <circle
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  strokeDasharray="314 150"
                  strokeDashoffset={-68 + (314 * (1 - (turbineAngle + 120) / 240))}
                  className="transition-all duration-300 drop-shadow-[0_0_10px_#f59e0b]"
                />

                {/* Major Tick Marks */}
                {[0, 50, 100, 150, 200, 250].map((tick) => {
                  const angle = calcAngle(tick, 0, 250);
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 100 + 62 * Math.cos(rad);
                  const y1 = 100 + 62 * Math.sin(rad);
                  const x2 = 100 + 73 * Math.cos(rad);
                  const y2 = 100 + 73 * Math.sin(rad);
                  const tx = 100 + 48 * Math.cos(rad);
                  const ty = 100 + 48 * Math.sin(rad);

                  return (
                    <g key={`turb-${tick}`}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tick >= 200 ? '#ef4444' : '#f59e0b'} strokeWidth="2.5" />
                      <text
                        x={tx}
                        y={ty}
                        fill={tick >= 200 ? '#ef4444' : '#ffffff'}
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(90 ${tx} ${ty})`}
                        fontFamily="monospace"
                      >
                        {tick / 10}
                      </text>
                    </g>
                  );
                })}

                {/* Precision SVG Turbine Needle */}
                {(() => {
                  const rad = (turbineAngle * Math.PI) / 180;
                  const nx = 100 + 72 * Math.cos(rad);
                  const ny = 100 + 72 * Math.sin(rad);
                  return (
                    <g className="transition-all duration-100 ease-out">
                      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" className="drop-shadow-[0_0_10px_#f59e0b]" />
                      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="100" cy="100" r="8" fill="#09090b" stroke="#f59e0b" strokeWidth="2" />
                      <circle cx="100" cy="100" r="3" fill="#f59e0b" />
                    </g>
                  );
                })()}
              </svg>

              {/* Central Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xs font-display font-black text-gray-300 uppercase tracking-widest mt-[-32px]">
                  TURBINE SPEED
                </div>
                
                <div className="my-1 text-amber-500">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>

                <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] mt-2">
                  {Math.round(turbineSpeedRpm)}k
                  <span className="text-xs text-amber-400 font-mono ml-1 font-extrabold">RPM</span>
                </div>
                <span className="text-[9px] font-mono text-gray-400 font-bold">x10,000 RPM</span>
              </div>
            </div>

            <span className="mt-4 text-xs font-mono font-bold text-gray-300 uppercase tracking-widest bg-black/80 px-4 py-1.5 rounded-full border border-gray-800 shadow">
              02 // TURBOCHARGER REVOLUTIONS
            </span>
          </div>

          {/* POD 3: VOLTMETER GAUGE */}
          <div className="flex flex-col items-center w-full group">
            <div className="relative w-full max-w-[200px] sm:max-w-[240px] md:max-w-[260px] aspect-square rounded-full bg-gradient-to-b from-[#1c1c20] to-[#08080a] p-4 border-4 border-gray-800 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95),0_12px_30px_rgba(0,0,0,0.85)] flex items-center justify-center">
              
              <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
              <div className="absolute inset-1 rounded-full border border-cyan-950/50 pointer-events-none"></div>

              {/* Gauge Face SVG */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke="#1c1d22"
                  strokeWidth="10"
                  strokeDasharray="314 150"
                  strokeDashoffset="-68"
                />
                
                {/* Voltmeter Arc */}
                <circle
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="8"
                  strokeDasharray="314 150"
                  strokeDashoffset={-68 + (314 * (1 - (voltAngle + 120) / 240))}
                  className="transition-all duration-300 drop-shadow-[0_0_10px_#00f0ff]"
                />

                {/* Major Tick Marks */}
                {[8, 10, 12, 14, 16, 18].map((tick) => {
                  const angle = calcAngle(tick, 8, 18);
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 100 + 62 * Math.cos(rad);
                  const y1 = 100 + 62 * Math.sin(rad);
                  const x2 = 100 + 73 * Math.cos(rad);
                  const y2 = 100 + 73 * Math.sin(rad);
                  const tx = 100 + 48 * Math.cos(rad);
                  const ty = 100 + 48 * Math.sin(rad);

                  return (
                    <g key={`volt-${tick}`}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tick < 11 || tick > 15 ? '#ef4444' : '#00f0ff'} strokeWidth="2.5" />
                      <text
                        x={tx}
                        y={ty}
                        fill={tick < 11 || tick > 15 ? '#ef4444' : '#ffffff'}
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(90 ${tx} ${ty})`}
                        fontFamily="monospace"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {/* Precision SVG Voltmeter Needle */}
                {(() => {
                  const rad = (voltAngle * Math.PI) / 180;
                  const nx = 100 + 72 * Math.cos(rad);
                  const ny = 100 + 72 * Math.sin(rad);
                  return (
                    <g className="transition-all duration-100 ease-out">
                      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#00f0ff" strokeWidth="4" strokeLinecap="round" className="drop-shadow-[0_0_10px_#00f0ff]" />
                      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="100" cy="100" r="8" fill="#09090b" stroke="#00f0ff" strokeWidth="2" />
                      <circle cx="100" cy="100" r="3" fill="#00f0ff" />
                    </g>
                  );
                })()}
              </svg>

              {/* Central Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xs font-display font-black text-gray-300 uppercase tracking-widest mt-[-32px]">
                  VOLTMETER
                </div>
                
                <div className="my-1 text-cyan-400">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>

                <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight drop-shadow-[0_0_12px_rgba(0,240,255,0.8)] mt-2">
                  {voltmeter.toFixed(1)}
                  <span className="text-xs text-cyan-400 font-mono ml-1 font-extrabold">V</span>
                </div>
                <span className="text-[9px] font-mono text-gray-400 font-bold">DC VOLTAGE</span>
              </div>
            </div>

            <span className="mt-4 text-xs font-mono font-bold text-gray-300 uppercase tracking-widest bg-black/80 px-4 py-1.5 rounded-full border border-gray-800 shadow">
              03 // DC SYSTEM VOLTAGE
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default NismoTriplePodGauges;
