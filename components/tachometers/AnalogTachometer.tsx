import React from 'react';
import { motion, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface AnalogTachometerProps {
  rpm: number;
  speed: number;
  gear: number;
}

const RPM_MAX = 10000;
const REDLINE_START = 8000;

const AnalogTachometer: React.FC<AnalogTachometerProps> = React.memo(({ rpm, speed, gear }) => {
  // Use Elite Predictive Spring for buttery smooth motion
  const rpmMotion = useAnimatedValue(rpm, { stiffness: 180, damping: 22, mass: 0.7 });
  const speedMotion = useAnimatedValue(speed, { stiffness: 180, damping: 22, mass: 0.7 });
  
  const rpmToAngle = (r: number) => {
    const minAngle = -150;
    const maxAngle = 150;
    const ratio = Math.max(0, Math.min(r, RPM_MAX)) / RPM_MAX;
    return minAngle + ratio * (maxAngle - minAngle);
  };

  const needleRotate = useTransform(rpmMotion, (r) => rpmToAngle(r));
  
  const redlineOpacity = useTransform(rpmMotion, (r) => 
    Math.max(0, (r - (REDLINE_START - 1000)) / (RPM_MAX - (REDLINE_START - 1000)))
  );

  return (
    <motion.div 
      className="relative w-full h-full max-w-[400px] aspect-square"
      whileHover="hover"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        <defs>
          <radialGradient id="metal-grad" cx="50%" cy="50%" r="60%" fx="30%" fy="30%">
            <stop offset="0%" style={{ stopColor: '#d0d0d0' }} />
            <stop offset="100%" style={{ stopColor: '#707070' }} />
          </radialGradient>
          <filter id="glow-red">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
           <filter id="needle-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#000000" floodOpacity="0.5"/>
          </filter>
          <filter id="needle-hover-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Bezel & Face */}
        <circle cx="100" cy="100" r="100" fill="var(--theme-gauge-bezel)" />
        <circle cx="100" cy="100" r="95" fill="var(--theme-gauge-face)" stroke="#000" strokeWidth="2" />
        
        {/* Ticks & Numbers */}
        {Array.from({ length: 11 }).map((_, i) => {
            const r = i * 1000;
            const angle = rpmToAngle(r);
            const isRed = r >= REDLINE_START;
            const isMajorTick = i % 2 === 0;
            
            // Proximity scaling for numbers
            const scale = useTransform(rpmMotion, (current) => {
                const diff = Math.abs(current - r);
                const threshold = 1000;
                if (diff < threshold) {
                    return 1 + (1 - diff / threshold) * 0.4;
                }
                return 1;
            });

            const opacity = useTransform(rpmMotion, (current) => {
                const diff = Math.abs(current - r);
                const threshold = 1500;
                if (diff < threshold) {
                    return 0.5 + (1 - diff / threshold) * 0.5;
                }
                return 0.5;
            });

            return (
                <g key={`tick-${i}`} transform={`rotate(${angle} 100 100)`}>
                    <motion.line 
                        x1="100" y1="10" x2="100" y2={isMajorTick ? "22" : "16"} 
                        stroke={isRed ? 'var(--theme-accent-red)' : 'var(--theme-text-secondary)'} 
                        strokeWidth="2"
                        style={{ scaleY: scale }}
                    />
                     {isMajorTick && (
                        <motion.text
                            x="100"
                            y="32"
                            textAnchor="middle"
                            fill={isRed ? 'var(--theme-accent-red)' : 'var(--theme-text-secondary)'}
                            fontSize="10"
                            transform="rotate(180 100 32)"
                            className="font-sans font-bold select-none"
                            style={{ scale, opacity }}
                        >
                            {i}
                        </motion.text>
                     )}
                </g>
            )
        })}

        {/* Redline Glow Path */}
        <motion.path 
            d="M 39.3 154.6 A 85 85 0 0 1 160.7 154.6"
            fill="none"
            stroke="var(--theme-accent-red)"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#glow-red)"
            style={{ opacity: redlineOpacity }}
        />
        
        {/* Digital Readouts */}
        <foreignObject x="60" y="70" width="80" height="60">
            <div className="flex flex-col items-center justify-center text-center">
                <span className="font-sans text-[8px] uppercase tracking-widest text-gray-400">Speed</span>
                <motion.span className="font-display font-black text-4xl text-white -my-1">
                    {useTransform(speedMotion, v => v.toFixed(0))}
                </motion.span>
                <span className="font-sans text-[8px] uppercase tracking-widest text-gray-400">km/h</span>
            </div>
        </foreignObject>

        <foreignObject x="110" y="90" width="40" height="40">
            <div className="flex flex-col items-center justify-center text-center">
                 <span className="font-sans text-[8px] uppercase tracking-widest text-gray-400">Gear</span>
                 <motion.span 
                    key={gear}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-display font-black text-4xl text-brand-cyan -my-1"
                 >
                    {gear}
                 </motion.span>
            </div>
        </foreignObject>

        {/* Needle - Driven by Elite Predictive Spring */}
        <motion.g 
            style={{ 
                transformOrigin: '100px 100px',
                transformBox: 'view-box',
                rotate: needleRotate,
                willChange: 'transform'
            }}
            variants={{
                hover: { scale: 1.05, filter: 'url(#needle-hover-glow)' }
            }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            filter="url(#needle-shadow)"
        >
          <path d="M 100 100 L 100 10" stroke="var(--theme-needle-color)" strokeWidth="2" strokeLinecap="round" filter="url(#glow-red)" />
          <path d="M 100 115 L 100 100" stroke="var(--theme-needle-color)" strokeWidth="4" strokeLinecap="round" />
        </motion.g>

        {/* Center Cap */}
        <motion.circle 
            cx="100" cy="100" r="5" fill="#111" stroke="var(--theme-gauge-bezel)" strokeWidth="1" 
            variants={{ hover: { r: 6, fill: "var(--theme-needle-color)" } }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
        />
      </svg>
    </motion.div>
  );
});


export default AnalogTachometer;
