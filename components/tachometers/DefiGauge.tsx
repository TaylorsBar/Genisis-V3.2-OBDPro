
import React, { useMemo, useEffect, useState } from 'react';
import { motion, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useUIStore } from '../../stores/uiStore';
import { useLongPress } from '../../hooks/useLongPress';

export interface DefiGaugeProps {
  value?: number;
  dataKey?: string;
  animateValue?: any;
  min: number;
  max: number;
  label: string;
  unit?: string;
  redline?: number;
  size?: number | string;
  needleColor?: string;
  accentColor?: string;
  showDigital?: boolean;
  majorStep?: number;
}

const DigitalReadout: React.FC<{ rpmMotion: any, label: string, unit?: string, needleColor: string, uid: string }> = ({ rpmMotion, label, unit, needleColor, uid }) => {
    const displayVal = useTransform(rpmMotion, (v: any) => {
        const val = typeof v === 'number' ? v : 0;
        return label === 'BOOST' || label === 'TURBO' || label === 'OIL P' || label === 'FUEL P' ? val.toFixed(1) : val.toFixed(unit === 'V' ? 1 : 0);
    });
    return (
        <motion.text 
            x="0" y="8" textAnchor="middle" fill="white" className="font-mono font-black tracking-tight" style={{ fontSize: '27px', filter: `drop-shadow(0 0 2px rgba(255,255,255,0.3))` }}
        >
            {displayVal}
        </motion.text>
    );
};

const DefiGauge: React.FC<DefiGaugeProps> = React.memo(({
  value = 0,
  dataKey,
  min,
  max,
  label,
  unit,
  redline,
  size = "100%",
  needleColor = "#FF003C",
  accentColor = "#FFFFFF",
  showDigital = true,
  majorStep,
  animateValue
}) => {
  const rawUid = React.useId();
  const uid = rawUid.replace(/:/g, '');
  const cx = 200;
  const cy = 200;
  const radius = 180;
  
  const startAngle = -225;
  const endAngle = 45;
  const angleRange = endAngle - startAngle;

  const initialValue = typeof value === 'number' ? value : 0;
  const internalRpmMotion = useAnimatedValue(dataKey || initialValue, { stiffness: 180, damping: 22, mass: 0.7, useHermite: true });
  const rpmMotion = animateValue || internalRpmMotion;
  
  const showDataOverlay = useUIStore(state => state.showDataOverlay);
  const longPressEvents = useLongPress(() => {
    if (dataKey) showDataOverlay(dataKey, label);
  }, 600);

  // Elite 5-Phase Stepper Motor Ceremony State
  const [ceremonyStage, setCeremonyStage] = useState<'off' | 'needle-on' | 'sweeping' | 'backlight-on' | 'nominal'>('off');

  // Multi-phase stepper calibration timing sequences
  useEffect(() => {
    // Phase 1: Total Blackout - stealth face (off)
    setCeremonyStage('off');

    // Phase 2: Needle Ignition - Needle LED glows rich red in the dark face
    const t1 = setTimeout(() => {
        setCeremonyStage('needle-on');
    }, 450);

    // Phase 3: Stepper Motor Rapid Sweep (Only if parent is not already driving it)
    const t2 = setTimeout(() => {
        setCeremonyStage('sweeping');
        if (!animateValue) {
            rpmMotion.set(max);
        }
    }, 900);

    // Phase 4: Snap needle back down to 0/min (Only if parent is not driving it)
    const t3 = setTimeout(() => {
        if (!animateValue) {
            rpmMotion.set(min);
        }
    }, 1800);

    // Phase 5: Backlight Glow Ignition - Face illumination surges in
    const t4 = setTimeout(() => {
        setCeremonyStage('backlight-on');
    }, 2200);

    // Phase 6: Nominal Operation State - live data routing
    const t5 = setTimeout(() => {
        setCeremonyStage('nominal');
        if (!animateValue) {
            rpmMotion.set(initialValue);
        }
    }, 3100);

    return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
    };
  }, []);

  // Sync telematics once nominal
  useEffect(() => {
      if (!dataKey && ceremonyStage === 'nominal' && !animateValue) {
          rpmMotion.set(initialValue);
      }
  }, [initialValue, dataKey, ceremonyStage, animateValue]);

  function valueToAngle(v: number) {
    const ratio = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return startAngle + ratio * angleRange;
  }

  const needleRotate = useTransform(rpmMotion, (v: any) => valueToAngle(typeof v === 'number' ? v : 0));
  const isWarnMotion = useTransform(rpmMotion, (v: any) => redline ? (typeof v === 'number' ? v : 0) >= redline : false);

  const { tickLines, tickLabels } = useMemo(() => {
    const actualMajorStep = majorStep || (max - min) / 10;
    const actualMinorStep = actualMajorStep / 5;
    const rangeVal = max - min;
    const totalTicks = Math.floor(rangeVal / actualMinorStep);
    
    const lines: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];
    
    for (let i = 0; i <= totalTicks; i++) {
        const val = min + i * actualMinorStep;
        const isMajor = Math.abs(val % actualMajorStep) < actualMinorStep * 0.1 || val === min || val === max;
        
        const angle = valueToAngle(val);
        const rad = (angle - 90) * (Math.PI / 180);
        const isRed = redline && val >= redline;
        
        const rOuter = radius - 2;
        const rInner = isMajor ? radius - 18 : radius - 10;
        
        const x1 = cx + rOuter * Math.cos(rad);
        const y1 = cy + rOuter * Math.sin(rad);
        const x2 = cx + rInner * Math.cos(rad);
        const y2 = cy + rInner * Math.sin(rad);

        const tx = cx + (radius - 38) * Math.cos(rad);
        const ty = cy + (radius - 38) * Math.sin(rad);
        
        lines.push(
            <line 
                key={`line-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2} 
                stroke={isRed ? "#FF003C" : accentColor} 
                strokeWidth={isMajor ? "3" : "1.5"} 
                opacity={isMajor ? 1 : 0.6} 
            />
        );
        
        if (isMajor) {
            labels.push(
                <text 
                    key={`text-${i}`}
                    x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" 
                    fill={accentColor} 
                    className="select-none font-oswald font-black italic tracking-tighter" 
                    style={{ 
                        fontSize: '20px',
                        textShadow: `0 0 6px ${accentColor}`,
                        fontWeight: 900
                    }}
                >
                    {label === 'RPM' ? Math.floor(val / 1000) : (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1))}
                </text>
            );
        }
    }
    return { tickLines: lines, tickLabels: labels };
  }, [min, max, redline, majorStep, label, angleRange, startAngle]);

  return (
    <motion.div 
        {...longPressEvents}
        whileHover={{ scale: 1.01 }}
        className="relative flex items-center justify-center select-none aspect-square cursor-crosshair active:scale-[0.98]" style={{ width: size }}>
      <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl overflow-visible">
        <defs>
          <radialGradient id={`faceGrad-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="90%" stopColor="#050505" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          
          <linearGradient id={`bezelGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="50%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </linearGradient>

          <linearGradient id={`glassReflection-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.08" />
              <stop offset="40%" stopColor="white" stopOpacity="0" />
              <stop offset="60%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="0.05" />
          </linearGradient>

          <filter id={`ledGlow-${uid}`} x="0" y="0" width="400" height="400" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="1.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          
          <filter id={`needleGlow-${uid}`} x="0" y="0" width="400" height="400" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3.0" result="blur" />
              <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
              </feMerge>
          </filter>
          
          <radialGradient id={`hubGrad-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#444" />
              <stop offset="80%" stopColor="#111" />
              <stop offset="100%" stopColor="#000" />
          </radialGradient>
        </defs>

        {/* Outer Bezel */}
        <circle cx={cx} cy={cy} r={radius + 14} fill="#111" stroke="#333" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={radius + 12} fill={`url(#bezelGrad-${uid})`} stroke="#000" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={radius + 10} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

        {/* Face */}
        <circle cx={cx} cy={cy} r={radius} fill={`url(#faceGrad-${uid})`} stroke="#111" strokeWidth="2" />
        
        {/* Carbon Texture */}
        <circle cx={cx} cy={cy} r={radius} fill="url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" opacity="0.04" />

            {/* Smoked Blackout Face Container - Fades in during backlight phase */}
            <g style={{ 
                opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.02, 
                transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), filter 1s ease',
                filter: ceremonyStage === 'backlight-on' ? `drop-shadow(0 0 8px ${needleColor}30)` : 'none'
            }}>
                {/* Redline Arc */}
                {redline && (
                    <path 
                        d={`M ${cx + (radius-5) * Math.cos(((valueToAngle(redline))-90)*Math.PI/180)} ${cy + (radius-5) * Math.sin(((valueToAngle(redline))-90)*Math.PI/180)} A ${radius-5} ${radius-5} 0 0 1 ${cx + (radius-5) * Math.cos(((endAngle)-90)*Math.PI/180)} ${cy + (radius-5) * Math.sin(((endAngle)-90)*Math.PI/180)}`}
                        fill="none" stroke="#FF003C" strokeWidth="8" opacity="0.3"
                    />
                )}

                {/* Ticks & Numbers */}
                <g filter={`url(#ledGlow-${uid})`}>
                  {tickLines}
                </g>
                <g>
                  {tickLabels}
                </g>

                {/* Labels and Branding - Aggressive Style */}
                <g filter={`url(#ledGlow-${uid})`}>
                  <text x={cx} y={cy + 52} textAnchor="middle" fill={accentColor} className="font-oswald font-black text-lg italic tracking-widest uppercase opacity-95" style={{ textShadow: `0 0 8px ${accentColor}` }}>{label}</text>
                  <text x={cx} y={cy + 68} textAnchor="middle" fill={accentColor} className="font-oswald font-bold text-[8px] tracking-[0.2em] uppercase opacity-80" style={{ textShadow: `0 0 5px ${accentColor}` }}>STEPMASTER VS-2</text>
                  {unit && <text x={cx} y={cy + 82} textAnchor="middle" fill={accentColor} className="font-oswald text-[9px] font-bold uppercase tracking-[0.1em] opacity-90" style={{ textShadow: `0 0 5px ${accentColor}` }}>{unit}</text>}
                </g>

                {/* Defi Style Branding */}
                <text x={cx} y={cy - 72} textAnchor="middle" fill={accentColor} className="font-oswald font-black text-lg tracking-widest italic opacity-90" style={{ textShadow: `0 0 8px ${accentColor}` }}>Defi</text>
                <text x={cx} y={cy + 120} textAnchor="middle" fill={accentColor} className="font-oswald font-bold text-[8px] tracking-[0.4em] uppercase opacity-50">ADVANCE SYS BF</text>
            </g>

        {/* Needle - Stepper style rapid reaction */}
        <motion.g 
          style={{ 
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: 'view-box',
              rotate: needleRotate,
              opacity: ceremonyStage !== 'off' ? 1 : 0,
              transition: 'opacity 0.4s ease',
              willChange: 'transform, opacity'
          }}
        >
          {/* Needle Shadow */}
          <path d={`M ${cx - 3} ${cy + 25} L ${cx} ${cy - radius + 10} L ${cx + 3} ${cy + 25} Z`} fill="rgba(0,0,0,0.5)" transform="translate(4, 4)" style={{ filter: "blur(2px)" }} />
          
          {/* Needle Body */}
          <path d={`M ${cx - 4} ${cy + 30} L ${cx} ${cy - radius + 5} L ${cx + 4} ${cy + 30} Z`} fill={needleColor} style={{ filter: `drop-shadow(0 0 3px ${needleColor})` }} />
          <path d={`M ${cx} ${cy} L ${cx} ${cy - radius + 5}`} stroke="#FFFFFF" strokeWidth="1" opacity="0.8" style={{ filter: `drop-shadow(0 0 2px ${needleColor})` }} />
          <path d={`M ${cx - 2} ${cy + 20} L ${cx} ${cy - radius + 15} L ${cx + 2} ${cy + 20} Z`} fill="rgba(255,255,255,0.4)" />
          
          {/* Hub */}
          <circle cx={cx} cy={cy} r={20} fill="#0d0d0d" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={16} fill={`url(#hubGrad-${uid})`} stroke="#1a1a1a" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={6} fill="#000" stroke="#333" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={6} fill="#111" stroke="#444" strokeWidth="1" />
        </motion.g>
 
        {/* Peak/Warning LED */}
        <motion.circle 
            cx={cx + 65} cy={cy + 75} r={8} fill="#FF5500" 
            style={{ 
                opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1 : 0.05,
                filter: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? `drop-shadow(0 0 10px #FF5500)` : 'none',
                willChange: 'opacity, filter' 
            }}
        />
        <text x={cx + 65} y={cy + 60} fill={accentColor} className="font-oswald font-black text-[9px] tracking-widest italic opacity-80" style={{ textShadow: `0 0 5px ${accentColor}`, transition: 'opacity 1s ease' }}>PEAK</text>
 
        {/* Digital Display - Hidden completely when powered down */}
        {showDigital && (
            <g transform={`translate(${cx}, ${cy - 30})`} style={{ 
                opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.0,
                transition: 'opacity 0.8s ease'
            }}>
                <rect x="-39" y="-16.5" width="78" height="33" rx="4" fill="#000" fillOpacity="0.92" stroke="#FFFFFF" strokeWidth="0.8" style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' }} />
                <rect x="-39" y="-16.5" width="78" height="33" rx="4" fill="none" stroke="#FFFFFF" strokeWidth="0.5" filter={`url(#ledGlow-${uid})`} opacity="0.6" />
                <DigitalReadout rpmMotion={rpmMotion} label={label} unit={unit} needleColor={needleColor} uid={uid} />
            </g>
        )}
        
        {/* Glass Reflection Overlay (Remains visible as physical dial glare) */}
        <circle cx={cx} cy={cy} r={radius} fill={`url(#glassReflection-${uid})`} pointerEvents="none" />
      </svg>
    </motion.div>
  );
});


export default React.memo(DefiGauge);
