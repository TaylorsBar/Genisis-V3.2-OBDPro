import React, { useMemo, useState, useRef, useEffect, useId } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useLongPress } from '../../hooks/useLongPress';
import { useUIStore } from '../../stores/uiStore';
import { KarapiroLogo } from '../KarapiroLogo';

interface ApexiBoostGaugeProps {
    value: number; // In Bar
    dataKey?: string;
    warningAt?: number;
    size?: number | string;
    onWarningChange?: (val: number) => void;
    faceColor?: string;
    accentColor?: string;
}

const ApexiBoostGauge: React.FC<ApexiBoostGaugeProps> = React.memo(({ 
    value,
    dataKey,
    warningAt = 1.5, 
    size = '100%',
    faceColor = '#050505',
    accentColor = '#00F0FF'
}) => {
    // Unique ID for SVG definitions to prevent conflicts
    const rawUid = useId();
    const uid = rawUid.replace(/:/g, '');
    
    // Range: -1.0 to 2.5 Bar
    const min = -1.0;
    const max = 2.5;
    const startAngle = 135; 
    const endAngle = 405;   
    const angleRange = endAngle - startAngle;

    const [isDragging, setIsDragging] = useState(false);
    const [peakValue, setPeakValue] = useState(value || 0);
    const peakDecayTimer = useRef<any>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const showDataOverlay = useUIStore(state => state.showDataOverlay);
    const longPressEvents = useLongPress(() => {
        if (dataKey) showDataOverlay(dataKey, 'Boost Pressure');
    }, 600);

    // Fallback for unsafe value
    const safeValue = isNaN(value) ? 0 : value;

    // MOTORSPORT-GRADE KERNEL TUNING: 
    // High tension + Low friction = Stepper Motor Snap
    const animatedValue = useAnimatedValue(dataKey || safeValue, { 
        stiffness: 180, 
        damping: 22,
        mass: 0.7,
        useHermite: true
    });

    const [ceremonyStage, setCeremonyStage] = useState<'off' | 'needle-on' | 'sweeping' | 'backlight-on' | 'nominal'>('off');

    // Multi-phase stepper calibration timing sequences
    useEffect(() => {
        setCeremonyStage('off');

        const t1 = setTimeout(() => {
            setCeremonyStage('needle-on');
        }, 450);

        const t2 = setTimeout(() => {
            setCeremonyStage('sweeping');
            animatedValue.set(max);
        }, 900);

        const t3 = setTimeout(() => {
            animatedValue.set(min);
        }, 1800);

        const t4 = setTimeout(() => {
            setCeremonyStage('backlight-on');
        }, 2200);

        const t5 = setTimeout(() => {
            setCeremonyStage('nominal');
            animatedValue.set(safeValue);
        }, 3100);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
        };
    }, []);

    // Formatted text for digital display
    const digitalText = useTransform(animatedValue, (latest) => latest.toFixed(2));
    
    const valToAngle = (v: number) => {
        const r = Math.max(0, Math.min((v - min) / (max - min), 1));
        return startAngle + r * angleRange;
    };

    const needleRotate = useTransform(animatedValue, (v) => valToAngle(v));
    
    // PEAK HOLD LOGIC:
    useEffect(() => {
        if (ceremonyStage === 'nominal') {
            animatedValue.set(safeValue);
        }
    }, [safeValue, ceremonyStage]);

    useEffect(() => {
        if (safeValue > peakValue) {
            setPeakValue(safeValue);
            if (peakDecayTimer.current) clearTimeout(peakDecayTimer.current);
            peakDecayTimer.current = setTimeout(() => {
                setPeakValue(safeValue); // Reset peak to current
            }, 2500);
        }
    }, [safeValue, peakValue]);

    const peakAngle = valToAngle(peakValue);
    const warningAngle = warningAt !== undefined ? valToAngle(warningAt) : undefined;
    const isWarning = warningAt !== undefined && safeValue >= warningAt;

    const ticks = useMemo(() => {
        const els = [];
        const step = 0.1;
        const totalSteps = (max - min) / step;
        for (let i = 0; i <= totalSteps; i++) {
            const val = min + i * step;
            const tickAngle = startAngle + (i / totalSteps) * angleRange;
            const isMajor = Math.abs(val % 0.5) < 0.01 || Math.abs(val) < 0.01;
            const rOuter = 135;
            const rInner = isMajor ? 112 : 124;
            const rad = (tickAngle - 90) * Math.PI / 180;
            const x1 = 150 + rOuter * Math.cos(rad);
            const y1 = 150 + rOuter * Math.sin(rad);
            const x2 = 150 + rInner * Math.cos(rad);
            const y2 = 150 + rInner * Math.sin(rad);
            els.push(
                <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isWarning && val >= warningAt ? '#FF003C' : accentColor} strokeWidth={isMajor ? 3 : 1} opacity={isMajor ? 1 : 0.4} />
                    {isMajor && (
                        <text x={150 + (rInner - 22) * Math.cos(rad)} y={150 + (rInner - 22) * Math.sin(rad)} textAnchor="middle" dominantBaseline="middle" fill={accentColor} className="font-oswald font-black italic select-none" style={{ fontSize: '18px', fill: accentColor, textShadow: `0 0 8px ${accentColor}` }}>
                            {val.toFixed(val === 0 ? 0 : 1)}
                        </text>
                    )}
                </g>
            );
        }
        return els;
    }, [isWarning, warningAt, accentColor]);

    const defsId = {
        apexiFace: `apexiFace-${uid}`,
        neonBloom: `neonBloom-${uid}`,
        peakGlow: `peakGlow-${uid}`,
    };

    return (
        <div {...longPressEvents} className="relative flex items-center justify-center aspect-square group cursor-crosshair select-none active:scale-[0.98] transition-transform duration-100" style={{ width: size, height: size }}>
            <svg ref={svgRef} viewBox="0 0 300 300" className="w-full h-full">
                <defs>
                    <radialGradient id={defsId.apexiFace} cx="50%" cy="50%" r="50%">
                        <stop offset="70%" stopColor="#050505" />
                        <stop offset="95%" stopColor="#1a1a1a" />
                        <stop offset="100%" stopColor="#000000" />
                    </radialGradient>
                    <filter id={defsId.neonBloom} x="-300%" y="-100%" width="700%" height="300%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur1" />
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
                        <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur3" />
                        <feMerge>
                            <feMergeNode in="blur3" />
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    
                    <filter id={`needleShadowFilter-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                        <feOffset dx="2" dy="2" result="offsetblur" />
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.5" />
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode />
                        </feMerge>
                    </filter>

                    <filter id={defsId.peakGlow} x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" />
                    </filter>
                    
                    <linearGradient id={`needleGradient-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FF1E56" /> {/* Ultra-vibrant neon red-pink tip */}
                        <stop offset="50%" stopColor="#FF003C" /> {/* High-intensity hot red mid */}
                        <stop offset="100%" stopColor="#FF3300" /> {/* Saturated neon orange-red base */}
                    </linearGradient>
                </defs>

                {/* Housing */}
                <circle cx={150} cy={150} r={148} fill="#111" stroke="#333" strokeWidth="4" />
                <circle cx={150} cy={150} r={144} fill={faceColor} />
                
                {/* Carbon Fiber Texture Overlay */}
                <circle cx={150} cy={150} r={144} fill="url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" opacity="0.1" />

                {/* Smoked Blackout Face Container - Fades in during backlight phase */}
                <g style={{ 
                    opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.02, 
                    transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), filter 1s ease',
                    filter: ceremonyStage === 'backlight-on' ? `drop-shadow(0 0 8px ${accentColor}30)` : 'none'
                }}>
                    <circle cx={150} cy={150} r={90} fill="none" stroke={`${accentColor}0D`} strokeWidth="1" />
                    <circle cx={150} cy={150} r={130} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Data Elements */}
                    {ticks}
                    <text x={150} y={115} textAnchor="middle" fill={accentColor} className="font-oswald font-black text-2xl italic tracking-widest" style={{ textShadow: `0 0 8px ${accentColor}` }}>BOOST</text>
                    <text x={150} y={130} textAnchor="middle" fill={accentColor} className="font-oswald font-bold text-[8px] tracking-[0.3em] opacity-80" style={{ textShadow: `0 0 5px ${accentColor}` }}>x100kPa (BAR)</text>
                    <text x={150} y={195} textAnchor="middle" fill={accentColor} className="font-oswald font-black text-xl italic tracking-widest opacity-80" style={{ textShadow: `0 0 8px ${accentColor}` }}>A'PEXi</text>

                    {/* PEAK HOLD NEEDLE (Ghost) */}
                    <motion.g 
                        style={{ 
                            transformOrigin: '150px 150px',
                            transformBox: 'view-box',
                            rotate: peakAngle,
                            willChange: 'transform'
                        }} 
                        filter={`url(#${defsId.peakGlow})`}
                    >
                        <path d="M 150 150 L 148 150 L 150 35 L 152 150 Z" fill={accentColor} opacity="0.3" />
                    </motion.g>

                    {/* WARNING MARKER */}
                    {warningAngle !== undefined && (
                        <motion.g 
                            style={{ 
                                transformOrigin: '150px 150px',
                                transformBox: 'view-box',
                                rotate: warningAngle
                            }}
                        >
                            <path d="M 150 138 L 144 126 L 156 126 Z" fill={isWarning ? "#FF003C" : "#550000"} stroke="#000" strokeWidth="1" />
                        </motion.g>
                    )}

                    {/* BRANDING */}
                    <g transform="translate(85, 205) scale(0.4)">
                        <KarapiroLogo variant="icon-only" className="opacity-40" />
                    </g>
                </g>

                {/* LED STATUS INDICATORS */}
                <g transform="translate(235, 190)" style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1 : 0.05, transition: 'opacity 1s ease' }}>
                    <circle r="5" fill={isWarning ? "#FF003C" : "#200"} filter={isWarning ? `url(#${defsId.neonBloom})` : ""} />
                    <text x="12" y="4" fill="#555" className="font-display font-black text-[9px]">WARN</text>
                </g>
                <g transform="translate(235, 175)" style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1 : 0.05, transition: 'opacity 1s ease' }}>
                    <circle r="5" fill={safeValue >= 2.0 ? accentColor : "#022"} filter={safeValue >= 2.0 ? `url(#${defsId.neonBloom})` : ""} />
                    <text x="12" y="4" fill="#555" className="font-display font-black text-[9px]">PEAK</text>
                </g>

                {/* MAIN NEEDLE - Stepper stepper calibrated reactive */}
                <motion.g 
                    style={{ 
                        transformOrigin: '150px 150px',
                        transformBox: 'view-box',
                        rotate: needleRotate,
                        opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.01,
                        transition: 'opacity 1s ease',
                        willChange: 'transform, opacity'
                    }}
                >
                    {/* Needle Shadow */}
                    <path d="M 150 165 L 144 150 L 150 25 L 156 150 Z" fill="#000000" style={{ filter: 'blur(3px)', opacity: 0.4 }} transform="translate(2, 2)" />

                    {/* Needle Body */}
                    <motion.path 
                        d="M 150 165 L 144 150 L 150 25 L 156 150 Z" 
                        fill={`url(#needleGradient-${uid})`} 
                        style={{ filter: 'drop-shadow(0 0 3px #FF003C) drop-shadow(0 0 1px #FF1E56)' }}
                        className={isWarning ? "animate-pulse-danger" : ""}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    />
                    <path d="M 150 25 L 150 150" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
                    <circle cx={150} cy={150} r={14} fill="#111" stroke="#444" strokeWidth="2" />
                    <circle cx={150} cy={150} r={6} fill="#333" />
                </motion.g>

                {/* DIGITAL DISPLAY */}
                <g transform="translate(0, 0)" style={{ 
                    opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.0,
                    transition: 'opacity 0.8s ease'
                }}>
                    <rect x={110} y={245} width={80} height={28} rx={6} fill="#050505" stroke="#222" strokeWidth="1.5" />
                    <motion.text x={150} y={264} textAnchor="middle" fill={accentColor} className="font-mono font-black text-xl tabular-nums drop-shadow-[0_0_3px_rgba(0,240,255,0.25)]">
                        {digitalText}
                    </motion.text>
                </g>
            </svg>

            {isDragging && (
                <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none rounded-full">
                    <div className="bg-red-600 text-white font-black px-4 py-2 rounded-full text-xs tracking-widest animate-pulse border border-red-400 shadow-2xl">
                        SET WARNING: {warningAt.toFixed(1)} BAR
                    </div>
                </div>
            )}
        </div>
    );
});


export default ApexiBoostGauge;
