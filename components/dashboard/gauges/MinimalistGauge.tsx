
import React, { useMemo } from 'react';
import { motion, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../../hooks/useAnimatedValue';

interface MinimalistGaugeProps {
    value: number;
    min: number;
    max: number;
    unit: string;
    size: 'large' | 'medium' | 'small';
}

const sizeConfig = {
    large: { radius: 150, ticks: 9, stroke: 4 },
    medium: { radius: 120, ticks: 9, stroke: 3 },
    small: { radius: 50, ticks: 5, stroke: 2 },
};

const MinimalistGauge: React.FC<MinimalistGaugeProps> = ({ value, min, max, unit, size }) => {
    const config = sizeConfig[size];
    const radius = config.radius;
    const center = radius;

    const ANGLE_MIN = -135;
    const ANGLE_MAX = 135;
    const angleRange = ANGLE_MAX - ANGLE_MIN;
    
    // Physics
    const animatedValue = useAnimatedValue(value, { stiffness: 120, damping: 20, mass: 1 });
    
    const needleRotate = useTransform(animatedValue, (val) => {
        const ratio = (Math.max(min, Math.min(val, max)) - min) / (max - min);
        return ANGLE_MIN + ratio * angleRange;
    });

    const displayText = useTransform(animatedValue, (val) => {
        if (unit === 'x1000 RPM') {
            return (val / 1000).toFixed(1);
        }
        return val.toFixed(0);
    });

    // Static Ticks
    const ticks = useMemo(() => {
        return Array.from({ length: config.ticks }).map((_, i) => {
            const tickAngle = ANGLE_MIN + (i / (config.ticks - 1)) * angleRange;
            const isMajor = size !== 'small' || i === 0 || i === config.ticks - 1;
            return (
                <g key={i} transform={`rotate(${tickAngle} ${center} ${center})`}>
                    <line 
                        x1={center} y1={radius * 0.1} 
                        x2={center} y2={radius * (isMajor ? 0.2 : 0.15)}
                        stroke="var(--theme-accent-primary)" 
                        strokeWidth={config.stroke}
                        strokeLinecap="round"
                        filter="url(#minimalist-glow)"
                    />
                </g>
            );
        });
    }, [size, center, radius, config, angleRange, ANGLE_MIN]);

    return (
        <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
            <svg viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="w-full h-full">
                <defs>
                    <filter id="minimalist-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Bezel and Face */}
                <circle cx={center} cy={center} r={radius} fill="var(--theme-gauge-bezel)" />
                <circle cx={center} cy={center} r={radius * 0.95} fill="var(--theme-gauge-face)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                {ticks}
                
                 {/* Needle */}
                <motion.g 
                    style={{ 
                        transformOrigin: `${center}px ${center}px`,
                        transformBox: 'view-box',
                        rotate: needleRotate,
                        willChange: 'transform'
                    }}
                >
                    <path 
                        d={`M ${center} ${center + radius * 0.15} L ${center} ${radius * 0.1}`}
                        stroke="var(--theme-needle-color)" 
                        strokeWidth={config.stroke}
                        strokeLinecap="round" 
                        filter="url(#minimalist-glow)"
                    />
                </motion.g>
                <circle cx={center} cy={center} r={radius * 0.05} fill="#333" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                
                {size !== 'small' &&
                    <foreignObject x={0} y={0} width={radius*2} height={radius*2}>
                        <div className="flex flex-col items-center justify-center h-full w-full pointer-events-none">
                            <motion.div 
                                className={`font-display font-bold text-white ${size === 'large' ? 'text-8xl' : 'text-6xl'}`}
                            >
                                {displayText}
                            </motion.div>
                             <div className={`font-sans text-gray-400 ${size === 'large' ? 'text-lg' : 'text-base'}`}>
                                {unit}
                            </div>
                        </div>
                    </foreignObject>
                }
            </svg>
        </div>
    );
};

export default MinimalistGauge;
