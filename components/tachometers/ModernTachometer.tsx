
import React from 'react';
import { motion, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface ModernTachometerProps {
    value: number;
    min: number;
    max: number;
    label: string;
    unit?: string;
    size: 'large' | 'small';
}

const ModernBackground = React.memo(({ radius, strokeWidth, size }: { radius: number, strokeWidth: number, size: 'large' | 'small' }) => {
    const center = radius;
    const ANGLE_MIN = 135;
    const ANGLE_MAX = 405;
    const angleRange = ANGLE_MAX - ANGLE_MIN;
    const isLarge = size === 'large';
    const actualRadius = radius - strokeWidth / 2 - 2;

    const endPoint = (a: number, r: number = actualRadius) => {
        const x = center + r * Math.cos(a * Math.PI / 180);
        const y = center + r * Math.sin(a * Math.PI / 180);
        return { x, y };
    };

    const arcPath = `M ${endPoint(ANGLE_MIN).x} ${endPoint(ANGLE_MIN).y} A ${actualRadius} ${actualRadius} 0 1 1 ${endPoint(ANGLE_MAX).x} ${endPoint(ANGLE_MAX).y}`;

    return (
        <>
            <defs>
                <filter id="glow-cyan-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="inner-shadow">
                   <feOffset dx="0" dy="0" />
                   <feGaussianBlur stdDeviation="3" result="offset-blur" />
                   <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                   <feFlood floodColor="black" floodOpacity="1" result="color" />
                   <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                   <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                </filter>
            </defs>

            {/* Background Track with Shadow */}
            <path d={arcPath} fill="none" stroke="rgba(20, 30, 40, 0.8)" strokeWidth={strokeWidth} strokeLinecap="round" filter="url(#inner-shadow)" />

            {/* Ticks */}
            {Array.from({ length: isLarge ? 9 : 7 }).map((_, i) => {
                const tickRatio = i / ( (isLarge ? 9 : 7) - 1);
                const tickAngle = ANGLE_MIN + tickRatio * angleRange;
                const start = endPoint(tickAngle, actualRadius - strokeWidth / 2);
                const end = endPoint(tickAngle, actualRadius - strokeWidth / 2 - (isLarge ? 18 : 12));
                return <line key={i} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="rgba(0, 255, 255, 0.3)" strokeWidth="3" />
            })}
        </>
    );
});

const ModernTachometer: React.FC<ModernTachometerProps> = React.memo(({ value, min, max, label, unit, size }) => {
    const isLarge = size === 'large';
    const radius = isLarge ? 150 : 100;
    const center = radius;
    const strokeWidth = isLarge ? 12 : 8;
    const ANGLE_MIN = 135;
    const ANGLE_MAX = 405;
    const angleRange = ANGLE_MAX - ANGLE_MIN;
    
    // Physics Spring
    const animatedValue = useAnimatedValue(value, { stiffness: 180, damping: 22, mass: 0.7 });
    
    const needleRotate = useTransform(animatedValue, (v) => {
        const valueRatio = (Math.max(min, Math.min(v, max)) - min) / (max - min);
        return ANGLE_MIN + valueRatio * angleRange;
    });

    const displayText = useTransform(animatedValue, (v) => v.toFixed(unit === 'x1000 RPM' ? 0 : 1));

    return (
        <motion.div 
            className="relative flex flex-col items-center justify-center group"
            whileHover="hover"
        >
            <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
                
                <ModernBackground radius={radius} strokeWidth={strokeWidth} size={size} />

                {/* Needle - Driven via Ref */}
                <motion.g 
                    style={{ 
                        transformOrigin: `${center}px ${center}px`,
                        transformBox: 'view-box',
                        rotate: needleRotate,
                        willChange: 'transform'
                    }}
                    variants={{
                        hover: { scale: 1.05, filter: 'drop-shadow(0 0 8px var(--theme-accent-primary))' }
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                    <path d={`M ${center} ${center - (isLarge ? 8 : 5)} L ${center + radius - strokeWidth - 10} ${center} L ${center} ${center + (isLarge ? 8 : 5)} Z`} fill="var(--theme-accent-primary)" filter="url(#glow-cyan-filter)" />
                </motion.g>
                <motion.circle 
                    cx={center} cy={center} r={isLarge ? 20 : 15} fill="#0d1018" stroke="#333" strokeWidth="2" 
                    variants={{ hover: { stroke: "var(--theme-accent-primary)" } }}
                />
                <circle cx={center} cy={center} r={isLarge ? 8 : 5} fill="var(--theme-accent-primary)" filter="url(#glow-cyan-filter)" />
            </svg>
            
            <div className="absolute text-center flex flex-col items-center justify-center pointer-events-none" style={{ top: '60%' }}>
                <motion.div 
                    className={`font-display font-bold text-[var(--theme-text-primary)] ${isLarge ? 'text-5xl' : 'text-3xl'}`} 
                    style={{ textShadow: '0 0 15px var(--theme-glow-color)' }}
                    variants={{ hover: { scale: 1.1 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                    {displayText}
                </motion.div>
                <div className={`font-sans text-[var(--theme-text-secondary)] uppercase tracking-widest ${isLarge ? 'text-sm' : 'text-xs'} mt-1`}>
                    {label} {unit && `(${unit})`}
                </div>
            </div>
        </motion.div>
    );
});

export default ModernTachometer;
