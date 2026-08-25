import React, { useMemo, useRef, useEffect } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

interface HaltechTachometerProps {
  rpm?: number;
  speed?: number;
  gear?: number;
  redline?: number;
  maxRpm?: number;
  targetRpm?: number;
  style?: React.CSSProperties;
}

const HaltechTachometer: React.FC<HaltechTachometerProps> = React.memo(({ 
    rpm: propsRpm, 
    speed: propsSpeed, 
    gear: propsGear,
    redline: propRedline = 7500,
    maxRpm = 9000,
    style
}) => {
  const { setShiftLightRpm } = useVehicleStore();
  
  // CONFIGURATION
  const radius = 180;
  const cx = 200;
  const cy = 200;
  
  // Angle Geometry
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  
  // DOM Refs for 60fps bypass
  const svgRef = useRef<SVGSVGElement>(null);
  const needleGroupRef = useRef<SVGGElement>(null);
  const shiftLightRef = useRef<SVGCircleElement>(null);
  const speedTextRef = useRef<SVGTextElement>(null);
  const gearTextRef = useRef<SVGTextElement>(null);
  const isDragging = useRef(false);

  // Physics-based RPM state
  const state = useRef({
      rpm: propsRpm ?? 0,
      rpmVel: 0,
      speed: propsSpeed ?? 0,
      lastFrame: 0
  });

  const propsRef = useRef({ rpm: propsRpm, speed: propsSpeed, gear: propsGear });

  // Sync incoming props onto the Ref on every render, keeping the animation loop free from restarts
  useEffect(() => {
      propsRef.current = { rpm: propsRpm, speed: propsSpeed, gear: propsGear };
  });

  // Helper for Polar Coordinates
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  // ARC Generator
  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
      const start = polarToCartesian(x, y, radius, endAngle);
      const end = polarToCartesian(x, y, radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return [
          "M", start.x, start.y, 
          "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
      ].join(" ");
  }

  // --- INTERACTION LOGIC (Touch/Drag to set Redline) ---
  const handleInteraction = (clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    const dx = svgPt.x - cx;
    const dy = svgPt.y - cy;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    
    // Normalize angle to gauge space
    if (angle < 0) angle += 360;
    // Map to startAngle to endAngle range (135 to 405)
    if (angle < 100) angle += 360; 

    if (angle >= startAngle && angle <= endAngle) {
        const ratio = (angle - startAngle) / totalAngle;
        const newRedline = Math.round((ratio * maxRpm) / 100) * 100;
        setShiftLightRpm(newRedline);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleInteraction(e.clientX, e.clientY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        handleInteraction(clientX, clientY);
    };
    const handleUp = () => { isDragging.current = false; };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
    };
  }, [maxRpm]);

  // --- 60FPS ANIMATION LOOP ---
  useEffect(() => {
      let rafId: number;
      const tension = 300;
      const friction = 22;

      state.current.lastFrame = 0;

      const animate = (now: number) => {
          if (!state.current.lastFrame) state.current.lastFrame = now;
          const dt = Math.min((now - state.current.lastFrame) / 1000, 0.1);
          state.current.lastFrame = now;

          // Fetch dynamic data from store if not provided in props
          const store = useVehicleStore.getState();
          const targetRpm = propsRef.current.rpm ?? store.latestData.rpm ?? 0;
          const targetSpeed = propsRef.current.speed ?? store.latestData.speed ?? 0;
          const targetGear = propsRef.current.gear ?? store.latestData.gear ?? 0;

          // Stable Euler integration for needle spring response
          let remainingDt = dt;
          const stepSize = 0.002;
          while (remainingDt > 0) {
              const step = Math.min(remainingDt, stepSize);
              const displacement = state.current.rpm - targetRpm;
              const force = -tension * displacement - friction * state.current.rpmVel;
              state.current.rpmVel += force * step;
              state.current.rpm += state.current.rpmVel * step;
              remainingDt -= step;
          }

          // Inertial speed tracking
          state.current.speed += (targetSpeed - state.current.speed) * 8 * dt;

          const currentRpm = Math.max(0, Math.min(state.current.rpm, maxRpm));
          const rpmRatio = currentRpm / maxRpm;
          const angle = startAngle + (rpmRatio * totalAngle);
          
          if (needleGroupRef.current) {
              needleGroupRef.current.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
          }

          if (speedTextRef.current) {
              speedTextRef.current.textContent = state.current.speed.toFixed(0);
          }

          if (gearTextRef.current) {
              const displayGear = targetGear === 0 ? 'N' : targetGear.toString();
              if (gearTextRef.current.textContent !== displayGear) {
                  gearTextRef.current.textContent = displayGear;
              }
          }

          if (shiftLightRef.current) {
              const isShift = currentRpm >= propRedline;
              if (isShift) {
                  const flash = Math.floor(Date.now() / 50) % 2 === 0;
                  shiftLightRef.current.setAttribute('stroke', flash ? '#FF0000' : '#880000');
                  shiftLightRef.current.setAttribute('stroke-width', '10');
                  shiftLightRef.current.style.filter = "url(#dropShadow)";
              } else {
                  shiftLightRef.current.setAttribute('stroke', '#1a1a1a');
                  shiftLightRef.current.setAttribute('stroke-width', '6');
                  shiftLightRef.current.style.filter = "none";
              }
          }
          rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafId);
  }, [maxRpm, propRedline, totalAngle, startAngle]);

  // Memoize static elements
  const staticElements = useMemo(() => {
      const ticks = [];
      const redlineStartAngle = startAngle + (propRedline / maxRpm) * totalAngle;
      const redlineArc = describeArc(cx, cy, radius - 10, redlineStartAngle, endAngle);

      for (let i = 0; i <= maxRpm; i += 250) {
          const isMajor = i % 1000 === 0;
          const angle = startAngle + (i / maxRpm) * totalAngle;
          
          const innerR = radius - (isMajor ? 25 : 15);
          const outerR = radius - 5;
          const p1 = polarToCartesian(cx, cy, innerR, angle);
          const p2 = polarToCartesian(cx, cy, outerR, angle);
          
          ticks.push(
              <line 
                  key={`tick-${i}`} 
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
                  stroke="black" 
                  strokeWidth={isMajor ? 4 : 2} 
                  strokeLinecap="square"
              />
          );

          if (isMajor) {
              const labelR = radius - 45;
              const labelPos = polarToCartesian(cx, cy, labelR, angle);
              ticks.push(
                  <text 
                      key={`label-${i}`} 
                      x={labelPos.x} 
                      y={labelPos.y + (i > 3000 && i < 7000 ? 5 : 0)} 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fill="black" 
                      className="font-display font-black text-2xl"
                      style={{ fontStyle: 'italic' }}
                  >
                      {i / 1000}
                  </text>
              );
          }
      }

      return (
          <>
             <circle cx={cx} cy={cy} r={radius} fill="url(#yellowFace)" stroke="none" />
             <path d={redlineArc} fill="none" stroke="#FF0000" strokeWidth="20" opacity="0.8" strokeLinecap="butt" />
             <circle cx={cx} cy={cy} r={radius} fill="url(#innerShadow)" />
             {ticks}
             <g transform={`translate(${cx}, ${cy - 70})`}>
                 <text x="0" y="0" textAnchor="middle" fill="black" className="font-display font-black text-xl italic tracking-tighter" opacity="0.8">HALTECH</text>
                 <text x="0" y="12" textAnchor="middle" fill="black" className="font-mono text-[8px] font-bold tracking-[0.3em]" opacity="0.6">RACEPAK</text>
             </g>
             <text x={cx} y={cy + 45} textAnchor="middle" fill="black" className="font-sans font-bold text-[10px] uppercase tracking-widest opacity-60">x1000 RPM</text>
          </>
      )
  }, [maxRpm, propRedline, startAngle, totalAngle, radius, cx, cy]);

  return (
    <div style={style} className="relative w-full h-full flex items-center justify-center select-none">
        <svg 
            ref={svgRef}
            viewBox="0 0 400 400" 
            className="w-full h-full filter drop-shadow-2xl cursor-pointer" 
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
        >
            <defs>
                <radialGradient id="yellowFace" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                    <stop offset="0%" stopColor="#FFF59D" />
                    <stop offset="60%" stopColor="#F4E04D" />
                    <stop offset="100%" stopColor="#FBC02D" />
                </radialGradient>
                <linearGradient id="metalBezel" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#555" />
                    <stop offset="25%" stopColor="#222" />
                    <stop offset="50%" stopColor="#111" />
                    <stop offset="75%" stopColor="#222" />
                    <stop offset="100%" stopColor="#555" />
                </linearGradient>
                <radialGradient id="innerShadow" cx="50%" cy="50%" r="50%">
                    <stop offset="85%" stopColor="transparent" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
                </radialGradient>
                <linearGradient id="glassGlare" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                    <stop offset="35%" stopColor="white" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <filter id="dropShadow">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
                </filter>
            </defs>

            {/* Bezel & Shift Ring */}
            <circle cx={cx} cy={cy} r={radius + 15} fill="url(#metalBezel)" stroke="#000" strokeWidth="1" />
            <circle 
                ref={shiftLightRef}
                cx={cx} cy={cy} r={radius + 8} 
                fill="none" 
                stroke="#1a1a1a" 
                strokeWidth="6" 
            />

            {staticElements}

            {/* REFINED Speedo Box - Lifted & Resized */}
            <g transform={`translate(${cx}, ${cy + 85})`}>
                <path 
                    d="M -60 -30 Q -50 -30 -50 -30 L 50 -30 Q 60 -30 60 -20 L 50 15 Q 45 25 0 25 Q -45 25 -50 15 L -60 -20 Q -60 -30 -60 -30 Z" 
                    fill="#0f0f0f" stroke="#333" strokeWidth="2"
                />
                <text ref={speedTextRef} x="0" y="2" textAnchor="middle" fill="#00F0FF" className="font-display font-bold text-4xl tracking-tighter" style={{ textShadow: '0 0 10px rgba(0,240,255,0.5)' }}>
                    0
                </text>
                <text x="0" y="16" textAnchor="middle" fill="#555" className="font-bold text-[7px] uppercase tracking-[0.3em]">KM/H</text>
            </g>

            {/* MATCHING Gear Indicator Box */}
            <g transform={`translate(${cx + 80}, ${cy})`}>
                <path 
                    d="M -25 -30 L 25 -30 L 35 25 L -15 25 Z" 
                    fill="#1a1a1a" stroke="#333" strokeWidth="2"
                    className="drop-shadow-lg"
                />
                <text ref={gearTextRef} x="5" y="10" textAnchor="middle" dominantBaseline="middle" fill="white" className="font-display font-bold text-5xl italic" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
                    N
                </text>
                <text x="-5" y="-18" textAnchor="middle" fill="#666" className="font-sans text-[6px] font-bold uppercase tracking-widest">GEAR</text>
            </g>

            {/* Needle Group */}
            <g 
                ref={needleGroupRef}
                transform={`rotate(${startAngle} ${cx} ${cy})`}
                style={{ 
                    willChange: 'transform'
                }}
                filter="url(#dropShadow)"
            >
                <path d={`M ${cx-4} ${cy-30} L ${cx} ${cy-radius+15} L ${cx+4} ${cy-30} Z`} fill="#FF3300" stroke="#cc2200" strokeWidth="1" />
                <path d={`M ${cx-4} ${cy-30} L ${cx} ${cy+20} L ${cx+4} ${cy-30} Z`} fill="#cc2200" />
            </g>

            <circle cx={cx} cy={cy} r={12} fill="#111" stroke="#333" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={6} fill="#333" />

            {/* Glass Glare */}
            <path 
                d={`M ${cx - radius} ${cy - radius * 0.5} Q ${cx} ${cy - radius * 1.5} ${cx + radius} ${cy - radius * 0.5} L ${cx + radius} ${cy + radius} L ${cx - radius} ${cy + radius} Z`}
                fill="url(#glassGlare)" 
                style={{ mixBlendMode: 'overlay', pointerEvents: 'none' }}
                opacity="0.6"
            />
        </svg>
    </div>
  );
});

export default HaltechTachometer;
