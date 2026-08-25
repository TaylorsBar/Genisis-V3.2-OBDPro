import React from 'react';
import { motion, useTransform, MotionValue } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface HaltechGaugeProps {
    value: number;
    min: number;
    max: number;
    redlineStart: number;
    label: string;
    unit?: string;
    size: 'large' | 'small';
    faceColor?: string;
    accentColor?: string;
}

const HaltechGauge: React.FC<HaltechGaugeProps> = React.memo(({ 
    value, 
    min, 
    max, 
    redlineStart, 
    label, 
    unit, 
    size,
    faceColor = '#000000',
    accentColor = '#00F0FF'
}) => {
    const safeValue = isNaN(value) ? 0 : value;
    
    const isLarge = size === 'large';
    const radius = isLarge ? 120 : 80;
    const center = radius;
    const strokeWidth = isLarge ? 8 : 5;
    const ANGLE_MIN = -150;
    const ANGLE_MAX = 150;
    const angleRange = ANGLE_MAX - ANGLE_MIN; // 300 degrees
    
    const valueToAngle = (val: number) => {
        const valueRatio = (Math.max(min, Math.min(val, max)) - min) / (max - min || 1);
        return ANGLE_MIN + valueRatio * angleRange;
    }

    // Elite Predictive Spring to estimate/smooth value
    const animatedValue = useAnimatedValue(safeValue, { stiffness: 180, damping: 22, mass: 0.7 });
    
    const needleRotate = useTransform(animatedValue, (val) => valueToAngle(val));
    const digitalText = useTransform(animatedValue, (val) => val.toFixed(unit === 'bar' ? 2 : 0));

    const redlineStartAngle = valueToAngle(redlineStart);

    const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;
        const start = {
            x: x + r * Math.cos(startRad),
            y: y + r * Math.sin(startRad)
        };
        const end = {
            x: x + r * Math.cos(endRad),
            y: y + r * Math.sin(endRad)
        };
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
    }

    const numTicks = isLarge ? 11 : 9;

    // Zero-Rerender SVG Progress calculation for the Digital Arch
    const radiusArc = radius * 0.85;
    const totalArcLength = (300 / 360) * 2 * Math.PI * radiusArc;

    const strokeDashoffset = useTransform(animatedValue, (val) => {
        const ratio = (Math.max(min, Math.min(val, max)) - min) / (max - min || 1);
        return totalArcLength * (1 - ratio);
    });

    const strokeColor = useTransform(animatedValue, (val) => {
        return val >= redlineStart ? '#ff003c' : accentColor;
    });

    const glowColor = useTransform(animatedValue, (val) => {
        return val >= redlineStart ? 'rgba(255, 0, 60, 0.5)' : 'rgba(0, 240, 255, 0.5)';
    });

    // Unique IDs to prevent conflicts across multiple gauge instances
    const uniqueId = React.useId().replace(/:/g, '');
    const bezelGradId = `haltech-bezel-grad-${uniqueId}`;
    const needleGlowId = `haltech-needle-glow-${uniqueId}`;
    const archGlowId = `haltech-arch-glow-${uniqueId}`;

    return (
        <div id={`haltech-gauge-${label.toLowerCase()}`} className="relative flex flex-col items-center justify-center select-none">
            <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
                <defs>
                    <radialGradient id={bezelGradId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stopColor="#888" />
                        <stop offset="95%" stopColor="#111" />
                        <stop offset="100%" stopColor="#444" />
                    </radialGradient>
                    <filter id={needleGlowId}>
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <filter id={archGlowId}>
                        <feGaussianBlur stdDeviation="3" result="glow"/>
                        <feMerge>
                            <feMergeNode in="glow"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                {/* Bezel and Face */}
                <circle cx={center} cy={center} r={radius} fill={`url(#${bezelGradId})`} />
                <circle cx={center} cy={center} r={radius * 0.95} fill="#1a1a1a" />
                <circle cx={center} cy={center} r={radius * 0.9} fill={faceColor} />
                
                {/* Ticks and Numbers */}
                {Array.from({ length: numTicks }).map((_, i) => {
                    const tickVal = min + i * ((max - min) / (numTicks - 1));
                    const angle = valueToAngle(tickVal);
                    const isRed = tickVal >= redlineStart;
                    return (
                        <g key={i} transform={`rotate(${angle} ${center} ${center})`}>
                            <line
                                x1={center} y1={radius * 0.15}
                                x2={center} y2={radius * 0.22}
                                stroke={isRed ? '#ff003c' : 'rgba(255,255,255,0.25)'}
                                strokeWidth={isLarge ? 2 : 1.5}
                            />
                            { (isLarge || i % 2 === 0) &&
                                <text
                                    x={center} y={radius * 0.32}
                                    textAnchor="middle"
                                    fill={isRed ? '#ff003c' : 'rgba(255,255,255,0.7)'}
                                    fontSize={isLarge ? "11" : "9"}
                                    transform={`rotate(180 ${center} ${radius*0.32})`}
                                    className="font-mono font-bold"
                                >
                                    {label === 'RPM' ? (tickVal / 1000).toFixed(0) : tickVal.toFixed(0)}
                                </text>
                            }
                        </g>
                    )
                })}
                
                {/* Static Background Track (for depth) */}
                <path
                    d={describeArc(center, center, radiusArc, ANGLE_MIN, ANGLE_MAX)}
                    fill="none"
                    stroke="#222"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    opacity="0.5"
                />

                {/* Static Orange/Redline Limit Track */}
                <path
                    d={describeArc(center, center, radiusArc, redlineStartAngle, ANGLE_MAX)}
                    fill="none"
                    stroke="#ff003c"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    opacity="0.3"
                />

                {/* --- THE DIGITAL PROGRESSIVE ARCH ANIMATION --- */}
                {/* Generates seamless sweeps with custom glow filters without triggering React re-renders */}
                <motion.path
                    d={describeArc(center, center, radiusArc, ANGLE_MIN, ANGLE_MAX)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    filter={`url(#${archGlowId})`}
                    style={{
                        strokeDasharray: totalArcLength,
                        strokeDashoffset: strokeDashoffset
                    }}
                />

                {/* Center Digital Displays */}
                <foreignObject x={center * 0.4} y={center * 1.15} width={center * 1.2} height={center * 0.65}>
                    <div className="flex flex-col items-center justify-center text-center text-white w-full h-full">
                         <motion.span className={`font-mono font-black tracking-tighter ${isLarge ? 'text-4xl' : 'text-2xl'}`}>{digitalText}</motion.span>
                         <span className={`font-mono text-[9px] font-bold uppercase tracking-wider ${isLarge ? 'text-[11px]' : 'text-[9px]'}`} style={{ color: accentColor }}>{unit || ' '}</span>
                    </div>
                </foreignObject>
                <text x={center} y={center * 0.8} textAnchor="middle" fill="white" className={`fill-white font-mono font-black tracking-widest ${isLarge ? 'text-sm' : 'text-xs'}`}>{label}</text>

                {/* Needle - Driven by Elite Predictive Spring */}
                <motion.g 
                    style={{ 
                        transformOrigin: `${center}px ${center}px`,
                        transformBox: 'view-box',
                        rotate: needleRotate,
                        willChange: 'transform'
                    }}
                >
                    <motion.path d={`M ${center} ${center + (isLarge ? 12 : 8)} L ${center} ${radius * 0.18}`} stroke={strokeColor} strokeWidth={isLarge ? 2.5 : 1.8} strokeLinecap="round" filter={`url(#${needleGlowId})`} />
                </motion.g>
                <circle cx={center} cy={center} r={isLarge ? 7 : 5.5} fill="#0d0d0d" stroke="#333" strokeWidth="1" />
            </svg>
        </div>
    );
});


export default HaltechGauge;
