
import React, { useMemo } from 'react';

interface HaltechTachometerProps {
  rpm: number;
  speed: number;
  gear: number;
  redline?: number;
  maxRpm?: number;
}

const HaltechTachometer: React.FC<HaltechTachometerProps> = ({ 
    rpm, 
    speed, 
    gear,
    redline = 7500,
    maxRpm = 9000 
}) => {
  // CONFIGURATION
  const radius = 160;
  const cx = 200;
  const cy = 200;
  const strokeWidth = 28;
  
  // Angle Geometry
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  
  // Calculate Ratios
  const rpmRatio = Math.min(1, Math.max(0, rpm / maxRpm));
  const currentAngle = startAngle + (rpmRatio * totalAngle);
  
  // Circle Geometry for DashArray Trick
  // We use a circle rotated to start at 'startAngle'.
  // SVG Circles start at 3 o'clock (0 deg).
  // We want to draw a segment of length 'totalAngle'.
  const circumference = 2 * Math.PI * radius;
  // The visible portion of the gauge (270 degrees usually)
  const visibleCircumference = circumference * (totalAngle / 360);
  
  // The strokeDashoffset determines how much is "hidden". 
  // We start fully hidden (offset = visibleCircumference) and reduce offset to show bar.
  const dashOffset = visibleCircumference * (1 - rpmRatio);
  const fullDashArray = `${visibleCircumference} ${circumference}`; // Visible part, then gap

  // Helper for Ticks (Static)
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  // Memoize static elements (Ticks, Backgrounds) so they don't recalc on render
  const staticElements = useMemo(() => {
      const tickElements = Array.from({length: 10}).map((_, i) => {
          const val = i * 1000;
          const angle = startAngle + (val / maxRpm) * totalAngle;
          const p1 = polarToCartesian(cx, cy, radius - strokeWidth/2 - 2, angle);
          const p2 = polarToCartesian(cx, cy, radius - strokeWidth/2 - 12, angle);
          const labelPos = polarToCartesian(cx, cy, radius - 55, angle);
          
          return (
              <g key={i}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="white" strokeWidth="3" />
                  {i !== 0 && (
                      <text 
                          x={labelPos.x} 
                          y={labelPos.y} 
                          textAnchor="middle" 
                          dominantBaseline="middle" 
                          fill="#eee" 
                          className="font-display font-bold text-lg"
                      >
                          {i}
                      </text>
                  )}
              </g>
          );
      });

      return (
          <>
             {/* Main Gauge Body Background */}
             <circle cx={cx} cy={cy} r={radius + 15} fill="url(#haltechBezel)" stroke="#000" strokeWidth="2" />
             <circle cx={cx} cy={cy} r={radius + 10} fill="#050505" />
             <circle cx={cx} cy={cy} r={radius + 10} filter="url(#noise)" />
             
             {/* Background Track */}
             <circle 
                cx={cx} cy={cy} r={radius} 
                fill="none" 
                stroke="#151515" 
                strokeWidth={strokeWidth}
                strokeDasharray={fullDashArray}
                transform={`rotate(${startAngle} ${cx} ${cy})`}
                strokeLinecap="butt"
             />
             
             {/* Ticks */}
             {tickElements}
             
             {/* Labels */}
             <text x={cx} y={cy - 55} textAnchor="middle" fill="#666" className="font-mono font-bold text-xs tracking-[0.3em]">GEAR</text>
             <text x={cx - 90} y={cy + 30} textAnchor="middle" fill="#888" className="font-mono text-[10px]">RPM</text>
          </>
      )
  }, [maxRpm, startAngle, totalAngle, radius, cx, cy, strokeWidth, fullDashArray]);

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
        <svg viewBox="0 0 400 400" className="w-full h-full filter drop-shadow-2xl" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="rpmGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--theme-dim)" />
                    <stop offset="60%" stopColor="var(--theme-color)" />
                    <stop offset="90%" stopColor="#FFFF00" />
                    <stop offset="100%" stopColor="#FF0000" />
                </linearGradient>
                <linearGradient id="haltechBezel" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#333" />
                    <stop offset="100%" stopColor="#111" />
                </linearGradient>
                <filter id="noise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
                    <feColorMatrix type="saturate" values="0"/>
                    <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
                </filter>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
            </defs>

            {staticElements}

            {/* --- Dynamic RPM Bar (CSS Animated) --- */}
            {/* We rotate the circle so its start point matches gauge start. We dash-array it to only show the segment. */}
            <circle 
                cx={cx} cy={cy} r={radius} 
                fill="none" 
                stroke="url(#rpmGradient)" 
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                strokeDasharray={fullDashArray}
                strokeDashoffset={dashOffset}
                transform={`rotate(${startAngle} ${cx} ${cy})`}
                filter="url(#glow)"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }} 
            />

            {/* --- Needle (CSS Animated) --- */}
            {/* The needle is a group rotated around center. We subtract 90 because 0deg is 3 o'clock, we want 12 o'clock relative? No, simpler to just match angles. */}
            <g 
                style={{ 
                    transformOrigin: `${cx}px ${cy}px`, 
                    transform: `rotate(${currentAngle + 90}deg)`,
                    transition: 'transform 0.1s linear' 
                }}
            >
                <rect 
                    x={cx - 2} 
                    y={cy - radius - strokeWidth/2 - 4} 
                    width={4} 
                    height={strokeWidth + 8} 
                    fill="white" 
                    filter="url(#glow)"
                />
            </g>

            {/* --- Central Data --- */}
            <text 
                x={cx} 
                y={cy + 10} 
                textAnchor="middle" 
                dominantBaseline="middle" 
                fill="white" 
                className="font-display font-black text-9xl tracking-tighter"
                style={{ textShadow: '0 0 20px var(--theme-glow)' }}
            >
                {gear === 0 ? 'N' : gear}
            </text>
            
            {/* Speed Box */}
            <g transform={`translate(${cx}, ${cy + 90})`}>
                <rect x="-60" y="-25" width="120" height="50" fill="#111" rx="4" stroke="#333" strokeWidth="1.5" />
                <text x="0" y="5" textAnchor="middle" fill="white" className="font-mono font-bold text-3xl">
                    {speed.toFixed(0)}
                </text>
                <text x="0" y="18" textAnchor="middle" fill="var(--theme-color)" className="font-bold text-[8px] uppercase tracking-widest">
                    KM/H
                </text>
            </g>

            <text x={cx - 90} y={cy + 45} textAnchor="middle" fill="white" className="font-mono font-bold text-xl">{rpm.toFixed(0)}</text>

            {/* Redline Flash Overlay */}
            <circle 
                cx={cx} cy={cy} r={radius + 20} 
                fill="rgba(255, 0, 0, 0.2)" 
                className="pointer-events-none"
                style={{ opacity: rpm >= redline ? 1 : 0, transition: 'opacity 0.1s' }}
            />

        </svg>
    </div>
  );
};

export default HaltechTachometer;
