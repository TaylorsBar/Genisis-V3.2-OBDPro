import React, { useMemo, useState, useRef, useEffect, useId } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { KarapiroLogo } from '../KarapiroLogo';
import { useVehicleStore } from '../../stores/vehicleStore';

export interface ApexiGaugeProps {
    value?: number;
    dataKey?: string;
    animateValue?: any;
    min: number;
    max: number;
    label: string;
    unit: string;
    warningAt?: number;
    majorStep: number;
    minorStep?: number;
    decimalPlaces?: number;
    size?: number | string;
    onWarningChange?: (val: number) => void;
    faceColor?: string;
    accentColor?: string;
    fusionType?: 'speed' | 'rpm' | 'none';
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function describeArcSegment(x: number, y: number, rIn: number, rOut: number, startAngle: number, endAngle: number) {
    const p1 = polarToCartesian(x, y, rOut, endAngle);
    const p2 = polarToCartesian(x, y, rOut, startAngle);
    const p3 = polarToCartesian(x, y, rIn, startAngle);
    const p4 = polarToCartesian(x, y, rIn, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
        "M", p1.x, p1.y,
        "A", rOut, rOut, 0, largeArcFlag, 0, p2.x, p2.y,
        "L", p3.x, p3.y,
        "A", rIn, rIn, 0, largeArcFlag, 1, p4.x, p4.y,
        "Z"
    ].join(" ");
}

const ShiftLightLed = React.memo(({ startAngle, endAngle, rIn, rOut, ledColor, threshold, animatedValue }: any) => {
    const isActive = useTransform(animatedValue, (v: any) => (Number(v) || 0) >= threshold ? 1 : 0);
    const ledOpacity = useTransform(isActive, (v) => v ? 1 : 0.05);

    const pathData = describeArcSegment(150, 150, rIn, rOut, startAngle, endAngle);

    return (
        <g>
            {/* Unlit State */}
            <path 
                d={pathData}
                fill="rgba(255, 255, 255, 0.05)"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth={0.5}
            />
            {/* Lit State */}
            <motion.path 
                d={pathData}
                fill={ledColor}
                style={{
                    opacity: ledOpacity,
                    filter: `drop-shadow(0 0 5px ${ledColor})`
                }}
            />
            {/* Intense core for Lit State */}
            <motion.path 
                d={pathData}
                fill="#FFFFFF"
                style={{
                    opacity: ledOpacity,
                    mixBlendMode: 'overlay'
                }}
            />
        </g>
    );
});

const ApexiGauge: React.FC<ApexiGaugeProps> = React.memo(({ 
    value = 0, 
    dataKey,
    min,
    max,
    label,
    unit,
    warningAt, 
    majorStep,
    minorStep,
    decimalPlaces = 1,
    size = '100%',
    faceColor = '#050505',
    accentColor = '#00F0FF',
    animateValue,
    fusionType,
    onWarningChange
}) => {
    const rawUid = useId();
    const uid = rawUid.replace(/:/g, '');
    const defsId = {
        apexiFace: `apexiFace-${uid}`,
        neonBloom: `neonBloom-${uid}`,
        peakGlow: `peakGlow-${uid}`,
        needleHoverBloom: `needleHoverBloom-${uid}`,
    };
    
    const startAngle = 225; 
    const endAngle = 495;   
    const angleRange = endAngle - startAngle;
 
    const [isDragging, setIsDragging] = useState(false);
    const [ceremonyStage, setCeremonyStage] = useState<'off' | 'needle-on' | 'sweeping' | 'backlight-on' | 'nominal'>('off');
    const svgRef = useRef<SVGSVGElement>(null);
 
    const internalAnimatedValue = useAnimatedValue(dataKey || value, { 
        stiffness: 180, 
        damping: 22,
        mass: 0.7,
        fusionType,
        useHermite: true
    });
    
    const animatedValue = animateValue || internalAnimatedValue;
    
    const peakValue = useMotionValue(value);
    const peakDecayTimer = useRef<any>(null);

    const gear = useVehicleStore((state) => state.latestData.gear);
    
    const arcLength = 2 * Math.PI * 136 * (270 / 360); // approx 640.88
    const strokeDashoffset = useTransform(animatedValue, (v: any) => {
        const val = typeof v === 'number' ? v : 0;
        const r = Math.max(0, Math.min((val - min) / (max - min), 1));
        return arcLength * (1 - r);
    });

    // Opening ceremony sequence
    useEffect(() => {
        setCeremonyStage('off');

        const t1 = setTimeout(() => {
            setCeremonyStage('needle-on');
        }, 450);

        const t2 = setTimeout(() => {
            setCeremonyStage('sweeping');
            if (!animateValue) {
                animatedValue.set(max);
            }
        }, 900);

        const t3 = setTimeout(() => {
            if (!animateValue) {
                animatedValue.set(min);
            }
        }, 1800);

        const t4 = setTimeout(() => {
            setCeremonyStage('backlight-on');
        }, 2200);

        const t5 = setTimeout(() => {
            setCeremonyStage('nominal');
            if (!animateValue) {
                animatedValue.set(value);
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

    // Sync state when nominal
    useEffect(() => {
        if (!dataKey && ceremonyStage === 'nominal' && !animateValue) {
            animatedValue.set(value);
        }
    }, [value, dataKey, ceremonyStage, animateValue]);

    const valToAngle = (v: number) => {
        const r = Math.max(0, Math.min((v - min) / (max - min), 1));
        return startAngle + r * angleRange;
    };

    const [isLimitHit, setIsLimitHit] = useState(false);
    const isLimitHitRef = useRef(false);

    useEffect(() => {
        const unsubscribe = animatedValue.on("change", (latest: any) => {
            const val = typeof latest === 'number' ? latest : 0;
            if (val > peakValue.get()) {
                peakValue.set(val);
                if (peakDecayTimer.current) clearTimeout(peakDecayTimer.current);
                peakDecayTimer.current = setTimeout(() => {
                    peakValue.set(animatedValue.get());
                }, 2500);
            }
            
            const effLimit = fusionType === 'rpm' ? useVehicleStore.getState().shiftLightRpm : warningAt;
            if (effLimit !== undefined) {
                if (val >= effLimit && !isLimitHitRef.current) {
                    isLimitHitRef.current = true;
                    setIsLimitHit(true);
                    onWarningChange?.(val);
                } else if (val < effLimit && isLimitHitRef.current) {
                    isLimitHitRef.current = false;
                    setIsLimitHit(false);
                }
            }
        });
        return () => unsubscribe();
    }, [animatedValue, min, max, startAngle, angleRange, fusionType, warningAt]);
    
    const digitalText = useTransform(animatedValue, (latest: any) => (Number(latest) || 0).toFixed(decimalPlaces));
    const peakAngleTransform = useTransform(peakValue, (v: any) => valToAngle(Number(v) || 0));
    const needleRotate = useTransform(animatedValue, (latest: any) => valToAngle(Number(latest) || 0));
    
    const warningAngle = warningAt !== undefined ? valToAngle(warningAt) : undefined;
    const isWarningColor = useTransform(animatedValue, (v: any) => (warningAt !== undefined && Number(v) >= warningAt) ? "#FF003C" : "#550000");
    const isWarningLed = useTransform(animatedValue, (v: any) => (warningAt !== undefined && Number(v) >= warningAt) ? "#FF003C" : "#200");
    const isWarningFilter = useTransform(animatedValue, (v: any) => (warningAt !== undefined && Number(v) >= warningAt) ? `url(#${defsId.neonBloom})` : "");
    
    const isPeakLed = useTransform(animatedValue, (v: any) => (Number(v) || 0) >= (warningAt || max * 0.9) ? accentColor : "#022");
    const isPeakFilter = useTransform(animatedValue, (v: any) => (Number(v) || 0) >= (warningAt || max * 0.9) ? `url(#${defsId.neonBloom})` : "");

    const shiftLightLeds = useMemo(() => {
        const numLeds = 15;
        const els = [];
        
        const totalAngle = 140; // Total sweep angle
        const startTotalAngle = -70; // 0 is top
        const anglePerLed = 7;
        const gapAngle = (totalAngle - (numLeds * anglePerLed)) / (numLeds - 1);

        const rIn = 142; // Outside the main track
        const rOut = 152; // 10px thick

        for (let i = 0; i < numLeds; i++) {
            let ledColor = '#00FF00'; // Green
            if (i >= 5) ledColor = '#FFFF00'; // Yellow
            if (i >= 10) ledColor = '#FF0000'; // Red
            if (i >= 13) ledColor = accentColor; // Accent color flash

            const threshold = min + (max - min) * (0.6 + (i / numLeds) * 0.38);
            
            const startAngle = startTotalAngle + i * (anglePerLed + gapAngle);
            const endAngle = startAngle + anglePerLed;

            els.push(
                <ShiftLightLed 
                    key={`shiftled-${i}`}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    rIn={rIn}
                    rOut={rOut}
                    ledColor={ledColor}
                    threshold={threshold}
                    animatedValue={animatedValue}
                />
            );
        }
        return { els, rIn, rOut, startTotalAngle, totalAngle };
    }, [min, max, animatedValue]);

    const ticks = useMemo(() => {
        const els = [];
        const step = minorStep || (majorStep / 5);
        const totalSteps = Math.round((max - min) / step);
        
        for (let i = 0; i <= totalSteps; i++) {
            const val = min + i * step;
            const tickAngle = startAngle + (i / totalSteps) * angleRange;
            
            const isMajor = Math.abs((val - min) % majorStep) < (step * 0.1) || Math.abs(val) < (step * 0.1);
            
            const rOuter = 136;
            const rInner = isMajor ? 122 : 128;
            const rad = (tickAngle - 90) * Math.PI / 180;
            const x1 = 150 + rOuter * Math.cos(rad);
            const y1 = 150 + rOuter * Math.sin(rad);
            const x2 = 150 + rInner * Math.cos(rad);
            const y2 = 150 + rInner * Math.sin(rad);
            
            const isTickWarning = warningAt !== undefined && val >= warningAt;

            els.push(
                <g key={i}>
                    {/* Tick line with neonBloom glow */}
                    <line 
                        x1={x1} y1={y1} x2={x2} y2={y2} 
                        stroke={isTickWarning ? '#FF003C' : accentColor} 
                        strokeWidth={isMajor ? 2.5 : 1} 
                        opacity={isMajor ? 1 : 0.6} 
                        filter={isMajor ? `url(#${defsId.neonBloom})` : undefined}
                    />
                    {isMajor && (
                        <text 
                            x={150 + 104 * Math.cos(rad)} 
                            y={150 + 104 * Math.sin(rad)} 
                            textAnchor="middle" 
                            dominantBaseline="middle" 
                            fill={accentColor} 
                            className="font-oswald font-black italic select-none"
                            style={{ 
                                fontSize: '13px', 
                                textShadow: `0 0 6px ${accentColor}`,
                                fill: accentColor
                            }}
                        >
                            {val.toFixed(decimalPlaces === 0 ? 0 : (majorStep % 1 !== 0 ? 1 : 0))}
                        </text>
                    )}
                </g>
            );
        }
        return els;
    }, [min, max, majorStep, minorStep, warningAt, decimalPlaces, accentColor]);

    return (
        <motion.div 
            className="relative flex items-center justify-center aspect-square group cursor-crosshair select-none" 
            style={{ width: size, height: size }}
            whileHover="hover"
        >
            <svg ref={svgRef} viewBox="-15 -15 330 330" className="w-full h-full" onMouseDown={() => setIsDragging(true)} onTouchStart={() => setIsDragging(true)}>
                <defs>
                    <radialGradient id={defsId.apexiFace} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#0a0a0a" />
                        <stop offset="85%" stopColor="#050505" />
                        <stop offset="100%" stopColor="#000000" />
                    </radialGradient>
                    
                    <linearGradient id={`glassReflection-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.08" />
                        <stop offset="40%" stopColor="white" stopOpacity="0" />
                        <stop offset="60%" stopColor="white" stopOpacity="0" />
                        <stop offset="100%" stopColor="white" stopOpacity="0.05" />
                    </linearGradient>

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
                    
                    <filter id={`innerShadow-${uid}`}>
                        <feOffset dx="0" dy="2" />
                        <feGaussianBlur stdDeviation="3" result="offset-blur" />
                        <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                        <feFlood floodColor="black" floodOpacity="0.8" result="color" />
                        <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                        <feComponentTransfer in="shadow" result="shadow">
                            <feFuncA type="linear" slope="0.5" />
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode in="SourceGraphic" />
                            <feMergeNode in="shadow" />
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

                    <radialGradient id={`hubGrad-${uid}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#444" />
                        <stop offset="80%" stopColor="#111" />
                        <stop offset="100%" stopColor="#000" />
                    </radialGradient>
                </defs>

                {/* Outer Bezel */}
                <circle cx={150} cy={150} r={149} fill="#1a1a1a" stroke="#333" strokeWidth="1" />
                <circle cx={150} cy={150} r={147} fill="none" stroke="#000" strokeWidth="2" />
                <circle cx={150} cy={150} r={146} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

                {/* Gauge Face */}
                <circle cx={150} cy={150} r={144} fill={faceColor} filter={`url(#innerShadow-${uid})`} />
                
                {/* Carbon Fiber Texture Overlay */}
                <circle cx={150} cy={150} r={144} fill="url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" opacity="0.07" />

                {/* Smoked Blackout Face Container - Fades in during backlight phase */}
                <g style={{ 
                    opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.02, 
                    transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), filter 1s ease',
                    filter: ceremonyStage === 'backlight-on' ? `drop-shadow(0 0 8px ${accentColor}30)` : 'none'
                }}>
                {/* Inner Rings */}
                <circle cx={150} cy={150} r={105} fill="none" stroke={`${accentColor}40`} strokeWidth="1" strokeDasharray="2 4" />
                <circle cx={150} cy={150} r={138} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                {/* Data Elements */}
                {ticks}

                {/* Progressive Shift Light Bar */}
                <g style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.05, transition: 'opacity 1.5s ease' }}>
                    {/* Glassmorphic Panel Background */}
                    <path 
                        d={describeArcSegment(150, 150, shiftLightLeds.rIn - 4, shiftLightLeds.rOut + 4, shiftLightLeds.startTotalAngle - 4, shiftLightLeds.startTotalAngle + shiftLightLeds.totalAngle + 4)}
                        fill="rgba(20, 20, 25, 0.4)" 
                        stroke="rgba(255, 255, 255, 0.15)" 
                        strokeWidth="1.5"
                    />
                    {/* Inner glowing accent */}
                    <path 
                        d={describeArcSegment(150, 150, shiftLightLeds.rIn - 2, shiftLightLeds.rOut + 2, shiftLightLeds.startTotalAngle - 2, shiftLightLeds.startTotalAngle + shiftLightLeds.totalAngle + 2)}
                        fill="none" 
                        stroke="rgba(255, 255, 255, 0.05)" 
                        strokeWidth="1"
                    />
                    {shiftLightLeds.els}
                </g>

                {/* Active Glowing RPM Arc/Sweep Track */}
                <g style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 0.9 : 0.05, transition: 'opacity 1s ease' }}>
                    {/* Background track */}
                    <path 
                        d="M 53.84 246.16 A 136 136 0 1 1 246.16 246.16" 
                        fill="none" 
                        stroke="rgba(255,255,255,0.05)" 
                        strokeWidth="4" 
                        strokeLinecap="round" 
                    />
                    {/* Glowing active track */}
                    <motion.path 
                        d="M 53.84 246.16 A 136 136 0 1 1 246.16 246.16" 
                        fill="none" 
                        stroke={accentColor} 
                        strokeWidth="4" 
                        strokeLinecap="round" 
                        strokeDasharray={`${arcLength} ${2 * Math.PI * 136}`}
                        strokeDashoffset={strokeDashoffset}
                        style={{ 
                            filter: `url(#${defsId.neonBloom})`
                        }}
                        opacity="0.7"
                    />
                    {/* Core bright line of the sweep */}
                    <motion.path 
                        d="M 53.84 246.16 A 136 136 0 1 1 246.16 246.16" 
                        fill="none" 
                        stroke="#FFFFFF" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeDasharray={`${arcLength} ${2 * Math.PI * 136}`}
                        strokeDashoffset={strokeDashoffset}
                        style={{
                            filter: `drop-shadow(0 0 2px #FFF)`
                        }}
                    />
                </g>

                {/* Central Labels - Upper Dial Area */}
                <g filter={`drop-shadow(0 0 4px ${accentColor}80)`} style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.02, transition: 'opacity 1s ease' }}>
                    <text x={150} y={96} textAnchor="middle" fill={accentColor} style={{ fontSize: '11px', fontStyle: 'italic', textShadow: `0 0 5px ${accentColor}` }} className="font-oswald font-black tracking-[0.25em] opacity-80 uppercase">A'PEXi</text>
                    <text x={150} y={112} textAnchor="middle" fill={accentColor} style={{ fontSize: '14px', fontStyle: 'italic', textShadow: `0 0 6px ${accentColor}` }} className="font-oswald font-black tracking-wider uppercase">{label}</text>
                    <text x={150} y={122} textAnchor="middle" fill={accentColor} style={{ fontSize: '7px', fontStyle: 'italic', textShadow: `0 0 4px ${accentColor}` }} className="font-oswald font-bold tracking-widest opacity-70 uppercase">{unit}</text>
                </g>

                {/* High-Fidelity Gear Indicator Panel */}
                <g className="pointer-events-none" transform="translate(150, 182)" style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.02, transition: 'opacity 1s ease' }}>
                    {/* Outer Frame Glass Box */}
                    <rect x={-22} y={-26} width={44} height={50} rx={6} fill="rgba(0, 0, 0, 0.88)" stroke={`${accentColor}60`} strokeWidth="1" filter={`drop-shadow(0 0 6px rgba(0,0,0,0.8))`}/>
                    
                    {/* GEAR Header Tag */}
                    <rect x={-22} y={-26} width={44} height={13} rx={5} fill={`${accentColor}20`} stroke={`${accentColor}40`} strokeWidth="0.5" />
                    <text x={0} y={-17} textAnchor="middle" fill={accentColor} className="font-mono font-bold text-[7px] tracking-widest uppercase">GEAR</text>
                    
                    {/* Prominent Gear Character */}
                    <text 
                        x={0} 
                        y={8} 
                        textAnchor="middle" 
                        fill="#FFFFFF" 
                        className="font-display font-black italic select-none"
                        style={{ fontSize: '22px', filter: `drop-shadow(0 0 5px ${accentColor})` }}
                    >
                        {gear === 0 || gear === undefined ? 'N' : gear}
                    </text>
                    
                    {/* Lower Status Accent Box / Shift Indicator */}
                    <rect x={-14} y={12} width={28} height={8} rx={2} fill="none" stroke={`${accentColor}60`} strokeWidth="0.8" />
                    <rect x={-12} y={13.5} width={24} height={5} rx={1} fill={gear === 0 || gear === undefined ? "#EAB308" : accentColor} opacity="0.85" />
                </g>

                {/* PEAK HOLD NEEDLE (Ghost) */}
                <motion.g 
                    style={{ 
                        transformOrigin: '150px 150px',
                        transformBox: 'view-box',
                        rotate: peakAngleTransform,
                        willChange: 'transform'
                    }} 
                    filter={`url(#${defsId.peakGlow})`}
                >
                    <path d="M 150 150 L 148 150 L 150 38 L 152 150 Z" fill={accentColor} opacity="0.25" />
                </motion.g>

                {/* WARNING MARKER */}
                {warningAngle !== undefined && (
                    <g transform={`rotate(${warningAngle} 150 150)`}>
                        <motion.path d="M 150 142 L 142 128 L 158 128 Z" fill={isWarningColor} stroke="#000" strokeWidth="1.5" />
                    </g>
                )}

                {/* LED STATUS INDICATORS */}
                <g transform="translate(230, 200)" style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1 : 0.05, transition: 'opacity 1s ease' }}>
                    <motion.circle r="4" fill="#FF5500" filter={`drop-shadow(0 0 8px #FF5500)`} />
                    <text x="10" y="3.5" fill={accentColor} className="font-oswald font-black text-[9px] tracking-wider italic">PEAK</text>
                </g>
                <g transform="translate(230, 185)" style={{ opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1 : 0.05, transition: 'opacity 1s ease' }}>
                    <motion.circle r="4" fill={isPeakLed} filter={isPeakFilter} />
                    <text x="10" y="3.5" fill="#444" className="font-display font-black text-[8px] tracking-wider">PEAK</text>
                </g>

                {/* MAIN NEEDLE - Ignition sequence responsive */}
                <motion.g 
                    style={{ 
                        transformOrigin: '150px 150px',
                        transformBox: 'view-box',
                        rotate: needleRotate,
                        opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.01,
                        transition: 'opacity 1s ease',
                        willChange: 'transform, opacity'
                    }}
                    variants={{
                        hover: { scale: 1.02 }
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                    {/* Needle Shadow (Offset & Blurred) */}
                    <path d="M 150 170 L 147 150 L 149 20 L 151 20 L 153 150 Z" fill="#000000" style={{ filter: 'blur(3px)', opacity: 0.4 }} transform="translate(2, 2)" />

                    {/* Needle Body - Slimmer, sharper */}
                    <motion.path 
                        d="M 150 170 L 146 150 L 149 20 L 151 20 L 154 150 Z" 
                        fill={`url(#needleGradient-${uid})`} 
                        style={{ filter: 'drop-shadow(0 0 3px #FF003C) drop-shadow(0 0 1px #FF1E56)' }}
                        className={isLimitHit ? "animate-pulse-danger" : ""}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    />
                    
                    {/* Dark/Metal Core for depth */}
                    <path d="M 150 165 L 148 150 L 149.5 25 L 150.5 25 L 152 150 Z" fill="rgba(0,0,0,0.4)" />
                    
                    {/* Needle Center Highlight */}
                    <path d="M 150 22 L 150 160" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />
                    <path d="M 149.5 22 L 149.5 140" stroke="#FF5555" strokeWidth="0.5" opacity="0.6" />
                    
                    {/* Hub Outline & Base */}
                    <circle cx={150} cy={150} r={18} fill="#0d0d0d" stroke={`url(#glassReflection-${uid})`} strokeWidth="1" />
                    <circle cx={150} cy={150} r={16} fill={`url(#hubGrad-${uid})`} stroke="#2a2a2a" strokeWidth="1.5" />
                    <circle cx={150} cy={150} r={12} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                    <circle cx={150} cy={150} r={5} fill="#111" stroke="#333" strokeWidth="1" />
                    {/* Hub Spindle Detail */}
                    <circle cx={150} cy={150} r={2} fill="#000" />
                </motion.g>

                {/* DIGITAL DISPLAY */}
                <g transform="translate(150, 224)" style={{ 
                    opacity: (ceremonyStage === 'backlight-on' || ceremonyStage === 'nominal') ? 1.0 : 0.0,
                    transition: 'opacity 0.8s ease'
                }}>
                    {/* Glowing Backing / Glass filter for legibility */}
                    <rect x={-36} y={-11} width={72} height={22} rx={4} fill="#000" fillOpacity="0.85" stroke={`${accentColor}40`} strokeWidth="1" />
                    <rect x={-36} y={-11} width={72} height={22} rx={4} fill="none" stroke={accentColor} strokeWidth="0.5" filter={`url(#${defsId.neonBloom})`} opacity="0.3" />
                    <motion.text 
                        textAnchor="middle" 
                        y={5}
                        fill={accentColor} 
                        className="font-mono tabular-nums font-black"
                        style={{ fontSize: '17px', fontStyle: 'italic', letterSpacing: '0.02em', filter: `drop-shadow(0 0 3px ${accentColor}40)` }}
                    >
                        {digitalText}
                    </motion.text>
                </g>
                
                </g>
                
                {/* Glass Reflection Overlay */}
                <circle cx={150} cy={150} r={144} fill={`url(#glassReflection-${uid})`} pointerEvents="none" />
            </svg>

            {isDragging && warningAt !== undefined && (
                <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none rounded-full">
                    <div className="bg-red-600 text-white font-black px-4 py-2 rounded-full text-xs tracking-widest animate-pulse border border-red-400 shadow-2xl">
                        SET WARNING: {warningAt.toFixed(decimalPlaces)} {unit}
                    </div>
                </div>
            )}
        </motion.div>
    );
});


export default React.memo(ApexiGauge);
