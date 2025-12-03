
import React from 'react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface EdelbrockGaugeProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  size?: 'large' | 'normal';
}

const EdelbrockGauge: React.FC<EdelbrockGaugeProps> = ({ label, value, unit, min, max, size = 'normal' }) => {
  const animatedValue = useAnimatedValue(value);
  
  const isLarge = size === 'large';
  const ANGLE_MIN = -135;
  const ANGLE_MAX = 135;
  const range = max - min;
  const valueRatio = (Math.max(min, Math.min(animatedValue, max)) - min) / range;
  const angle = ANGLE_MIN + valueRatio * (ANGLE_MAX - ANGLE_MIN);

  const numTicks = isLarge ? 9 : 7;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-lg">
        <defs>
            <linearGradient id="brushedSteel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ddd" />
                <stop offset="20%" stopColor="#999" />
                <stop offset="50%" stopColor="#ccc" />
                <stop offset="80%" stopColor="#999" />
                <stop offset="100%" stopColor="#ddd" />
            </linearGradient>
            <radialGradient id="capGrad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#555" />
                <stop offset="100%" stopColor="#111" />
            </radialGradient>
        </defs>

        {/* Bezel and Face */}
        <circle cx="100" cy="100" r="100" fill="url(#brushedSteel)" stroke="#555" strokeWidth="1" />
        <circle cx="100" cy="100" r="92" fill="var(--theme-gauge-face)" stroke="#222" strokeWidth="2" />
        
        {/* Ticks and Labels */}
        {Array.from({ length: numTicks }).map((_, i) => {
            const tickValue = min + (range / (numTicks - 1)) * i;
            const tickRatio = (tickValue - min) / range;
            const tickAngle = ANGLE_MIN + tickRatio * (ANGLE_MAX - ANGLE_MIN);
            
            const tickLength = i % (isLarge ? 1 : 2) === 0 ? 10 : 5;
            const showLabel = i % (isLarge ? 1 : 2) === 0;

            return (
                <g key={i} transform={`rotate(${tickAngle} 100 100)`}>
                    <line x1="100" y1="12" x2="100" y2={12 + tickLength} stroke="var(--theme-gauge-text)" strokeWidth="2" />
                     {showLabel && <text
                        x="100"
                        y="35"
                        textAnchor="middle"
                        fill="var(--theme-gauge-text)"
                        fontSize={isLarge ? "14" : "12"}
                        transform="rotate(180 100 35)"
                        className="font-sans font-bold"
                     >
                        {isLarge ? i : tickValue.toFixed(0)}
                    </text>}
                </g>
            )
        })}
        
        <text x="100" y={isLarge ? "60" : "70"} textAnchor="middle" fill="var(--theme-text-secondary)" fontSize={isLarge ? "14" : "12"} className="font-sans font-bold uppercase">{label}</text>

        {/* Digital Readout */}
        <text x="100" y={isLarge ? "145" : "135"} textAnchor="middle" fill="var(--theme-gauge-text)" fontSize={isLarge ? "40" : "30"} className="font-display font-bold">
            {animatedValue.toFixed(0)}
        </text>
        <text x="100" y={isLarge ? "165" : "150"} textAnchor="middle" fill="var(--theme-text-secondary)" fontSize="12" className="font-sans uppercase">{unit}</text>

        {/* Needle */}
        <g transform={`rotate(${angle} 100 100)`} style={{ transition: 'transform 0.1s ease-out' }}>
            <path d="M 100 110 L 100 20" stroke="var(--theme-needle-color)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="8" fill="url(#capGrad)" stroke="#333" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
};

export default EdelbrockGauge;
