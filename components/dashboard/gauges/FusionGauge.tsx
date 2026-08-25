import React, { useMemo, useEffect, useState } from 'react';
import { motion, useTransform, useMotionValue, useSpring } from 'motion/react';
import { useVehicleStore } from '../../../stores/vehicleStore';
import { KarapiroLogo } from '../../KarapiroLogo';
import { useAnimatedValue } from '../../../hooks/useAnimatedValue';

interface FusionGaugeProps {
    dataKeyMain: string;
    dataKeyDigital1?: string;
    dataKeyDigital2?: string;
    maxMain: number;
    redline?: number;
    shiftPoint?: number;
    size?: number | string;
    showDigital?: boolean;
    mainLabel: string;
    mainUnit: string;
    digital1Label?: string;
    digital2Label?: string;
    tickDivider?: number;
    numMajorTicks?: number;
    showShiftLight?: boolean;
    glowColor?: string;
    interactiveShiftLight?: boolean;
    labelSize?: string;
    svgStyle?: React.CSSProperties;
    innerCircleStyle?: React.CSSProperties;
    showBrandLogo?: 'karapiro' | 'none';
    largeCenterGear?: boolean;
    showProgressiveShiftLight?: boolean;
    speedBoxRectStyle?: React.CSSProperties;
    largeGearOuterRectStyle?: React.CSSProperties;
    mainLabelStyle?: React.CSSProperties;
    mainUnitStyle?: React.CSSProperties;
    gearTextStyle?: React.CSSProperties;
    speedBoxLabelStyle?: React.CSSProperties;
}

const FusionGaugeTick: React.FC<{
    val: number;
    isMajor: boolean;
    maxMain: number;
    redline: number;
    startAngle: number;
    angleRange: number;
    mainMotion: any;
    tickDivider: number;
}> = ({ val, isMajor, maxMain, redline, startAngle, angleRange, mainMotion, tickDivider }) => {
    const ratio = val / maxMain;
    const angle = startAngle + ratio * angleRange;
    const isRedline = val >= redline;
    const tickColor = isRedline ? "#ff3333" : "#ffffff";

    const proximityRange = maxMain * 0.15;
    const scale = useTransform(mainMotion, 
        [val - proximityRange, val, val + proximityRange], 
        [1, 1.15, 1]
    );
    const opacity = useTransform(mainMotion, 
        [val - proximityRange * 2, val, val + proximityRange * 2], 
        [0.3, 1, 0.3]
    );
    const textScale = useTransform(mainMotion, 
        [val - proximityRange, val, val + proximityRange], 
        [1, 1.2, 1]
    );

    if (isMajor) {
        const displayVal = Math.floor(val / tickDivider);
        let customFontSize: string | undefined = undefined;
        let customFontWeight: string | undefined = undefined;
        let customFontStyle: string | undefined = undefined;
        let customBorderStyle: string | undefined = undefined;
        let customBorderWidth: string | undefined = undefined;

        if (displayVal === 0) {
            customFontSize = "30px";
            customBorderStyle = "inset";
        } else if (displayVal === 1) {
            customFontSize = "25px";
        } else if (displayVal === 2) {
            customFontSize = "30px";
            customBorderStyle = "inset";
        } else if (displayVal === 3) {
            customFontSize = "25px";
            customBorderStyle = "inset";
            customBorderWidth = "5px";
        } else if (displayVal === 4) {
            customFontSize = "30px";
        } else if (displayVal === 5) {
            customFontSize = "25px";
        } else if (displayVal === 6) {
            customFontSize = "30px";
            customFontWeight = "bold";
            customFontStyle = "normal";
        } else if (val === 7000 || val === 8000) {
            customFontSize = "23px";
        }

        return (
            <g transform={`rotate(${angle})`}>
                <motion.g style={{ opacity }}>
                    <motion.rect 
                        x="-2" y="-135" width="4" height="15" 
                        fill={tickColor} 
                        style={{ scale, transformOrigin: '0px -127.5px' }}
                        filter={isRedline ? "url(#redGlow)" : "none"}
                    />
                    <motion.g style={{ scale: textScale, transformOrigin: '0px -105px' }}>
                        <text 
                            x="0" 
                            y="-105" 
                            textAnchor="middle" 
                            fill={tickColor}
                            className="font-display font-black text-xl italic"
                            transform={`rotate(${-angle} 0 -105)`}
                            style={{ 
                                textShadow: `0 0 8px ${isRedline ? 'rgba(255,51,51,0.8)' : 'rgba(255,255,255,0.5)'}`,
                                fontSize: customFontSize,
                                fontWeight: customFontWeight,
                                fontStyle: customFontStyle,
                                borderStyle: customBorderStyle as any,
                                borderWidth: customBorderWidth,
                            }}
                        >
                            {displayVal}
                        </text>
                    </motion.g>
                </motion.g>
            </g>
        );
    }

    return (
        <g transform={`rotate(${angle})`}>
            <motion.rect 
                x="-1" y="-135" width="2" height="8" 
                fill={isRedline ? "#ff3333" : "#888"} 
                style={{ scale, opacity, transformOrigin: '0px -131px' }}
            />
        </g>
    );
};

const FusionGauge: React.FC<FusionGaugeProps> = ({ 
    dataKeyMain,
    dataKeyDigital1,
    dataKeyDigital2,
    maxMain, 
    redline = maxMain, 
    shiftPoint = maxMain,
    size = '100%',
    showDigital = true,
    mainLabel,
    mainUnit,
    digital1Label,
    digital2Label,
    tickDivider = 1,
    numMajorTicks = 11,
    showShiftLight = false,
    glowColor = "#BC13FE",
    interactiveShiftLight = false,
    labelSize = "10px",
    svgStyle,
    innerCircleStyle,
    showBrandLogo = 'none',
    largeCenterGear = false,
    showProgressiveShiftLight = false,
    speedBoxRectStyle,
    largeGearOuterRectStyle,
    mainLabelStyle,
    mainUnitStyle,
    gearTextStyle,
    speedBoxLabelStyle
}) => {
    const startAngle = -140; 
    const endAngle = 140;   
    const angleRange = endAngle - startAngle;
    
    const parallaxX = useMotionValue(0);
    const parallaxY = useMotionValue(0);

    const svgRef = React.useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const globalShiftLightRpm = useVehicleStore(state => state.shiftLightRpm);
    const setGlobalShiftLightRpm = useVehicleStore(state => state.setShiftLightRpm);
    
    const effectiveShiftPoint = interactiveShiftLight ? globalShiftLightRpm : shiftPoint;
    const localShiftPoint = useMotionValue(effectiveShiftPoint);

    const mainMotion = useAnimatedValue(dataKeyMain, { useHermite: true });
    const digital1Motion = useAnimatedValue(dataKeyDigital1 || 0, { useHermite: true });
    const digital2Motion = useAnimatedValue(dataKeyDigital2 || 0, { useHermite: true });

    const tipX = useTransform(mainMotion, v => {
        const val = Math.max(0, Math.min(v as number, maxMain));
        const angle = startAngle + (val / maxMain) * angleRange;
        const rad = (angle - 90) * Math.PI / 180;
        return Math.cos(rad) * 131;
    });

    const tipY = useTransform(mainMotion, v => {
        const val = Math.max(0, Math.min(v as number, maxMain));
        const angle = startAngle + (val / maxMain) * angleRange;
        const rad = (angle - 90) * Math.PI / 180;
        return Math.sin(rad) * 131;
    });
    
    const pinger = useSpring(0, { stiffness: 100, damping: 10 });
    const shiftLightOpacity = useMotionValue(0);

    const segmentsDef = useMemo(() => [
        { start: -56, end: -47.5, threshold: 4000, color: '#10B981' }, // Green (left outer)
        { start: -46, end: -37.5, threshold: 4540, color: '#10B981' }, // Green
        { start: -36, end: -27.5, threshold: 5080, color: '#10B981' }, // Green
        { start: -26, end: -17.5, threshold: 5620, color: '#FBBF24' }, // Yellow
        { start: -16, end: -7.5,  threshold: 6160, color: '#FBBF24' }, // Yellow
        
        { start: 7.5,  end: 16,   threshold: 6160, color: '#FBBF24' }, // Yellow
        { start: 17.5, end: 26,   threshold: 5620, color: '#FBBF24' }, // Yellow
        { start: 27.5, end: 36,   threshold: 5080, color: '#10B981' }, // Green
        { start: 37.5, end: 46,   threshold: 4540, color: '#10B981' }, // Green
        { start: 47.5, end: 56,   threshold: 4000, color: '#10B981' }, // Green (right outer)
    ], []);

    const centerRedSegmentsDef = useMemo(() => [
        { start: -6,  end: -1.5,  threshold: 6400, color: '#ff1111' }, // Center Left
        { start: 1.5,   end: 6,   threshold: 6400, color: '#ff1111' }, // Center Right
    ], []);

    const segOpacities = segmentsDef.map(seg => {
        return useTransform([mainMotion, pinger], ([rpm, pingVal]) => {
            const currentRpm = rpm as number;
            const ping = pingVal as number;
            if (currentRpm >= effectiveShiftPoint) {
                return ping > 0.4 ? 1.0 : 0.15;
            }
            if (currentRpm >= seg.threshold) return 1.0;
            if (currentRpm >= seg.threshold - 150) {
                return 0.15 + 0.85 * ((currentRpm - (seg.threshold - 150)) / 150);
            }
            return 0.15;
        });
    });

    const centerRedOpacities = centerRedSegmentsDef.map(seg => {
        return useTransform([mainMotion, pinger], ([rpm, pingVal]) => {
            const currentRpm = rpm as number;
            const ping = pingVal as number;
            if (currentRpm >= effectiveShiftPoint) {
                return ping > 0.4 ? 1.0 : 0.15;
            }
            if (currentRpm >= seg.threshold) return 1.0;
            if (currentRpm >= seg.threshold - 150) {
                return 0.15 + 0.85 * ((currentRpm - (seg.threshold - 150)) / 150);
            }
            return 0.15;
        });
    });

    const getSegmentPath = (startAngleDeg: number, endAngleDeg: number, innerR: number, outerR: number) => {
        const sRad = (startAngleDeg - 90) * Math.PI / 180;
        const eRad = (endAngleDeg - 90) * Math.PI / 180;
        const x1_in = Math.cos(sRad) * innerR;
        const y1_in = Math.sin(sRad) * innerR;
        const x2_in = Math.cos(eRad) * innerR;
        const y2_in = Math.sin(eRad) * innerR;
        const x1_out = Math.cos(sRad) * outerR;
        const y1_out = Math.sin(sRad) * outerR;
        const x2_out = Math.cos(eRad) * outerR;
        const y2_out = Math.sin(eRad) * outerR;
        
        return `M ${x1_in} ${y1_in} A ${innerR} ${innerR} 0 0 1 ${x2_in} ${y2_in} L ${x2_out} ${y2_out} A ${outerR} ${outerR} 0 0 0 ${x1_out} ${y1_out} Z`;
    };

    useEffect(() => {
        if (!isDragging) {
            localShiftPoint.set(effectiveShiftPoint);
        }
    }, [effectiveShiftPoint, isDragging, localShiftPoint]);

    const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
        if (!interactiveShiftLight) return;
        e.stopPropagation();
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
        if (!isDragging || !svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        
        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle > 180) angle -= 360;
        
        if (angle > endAngle) angle = endAngle;
        if (angle < startAngle) angle = startAngle;
        
        const ratio = (angle - startAngle) / angleRange;
        let newVal = ratio * maxMain;
        newVal = Math.round(newVal / 100) * 100;
        
        localShiftPoint.set(newVal);
    };

    const handlePointerUp = (e: React.PointerEvent<SVGGElement>) => {
        if (!isDragging) return;
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
        setGlobalShiftLightRpm(localShiftPoint.get());
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const { innerWidth, innerHeight } = window;
            const centerX = innerWidth / 2;
            const centerY = innerHeight / 2;
            parallaxX.set((e.clientX - centerX) / centerX);
            parallaxY.set((e.clientY - centerY) / centerY);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [parallaxX, parallaxY]);

    const [peak, setPeak] = useState(0);
    const peakTimer = React.useRef<any>(null);

    // Constant pinger for shift light flash effect without React Re-renders
    useEffect(() => {
        let rafId: number;
        const pingLoop = (time: number) => {
            const phase = (time / 150) % 2; // 150ms cycle
            const val = phase > 1 ? 2 - phase : phase;
            pinger.set(0.2 + val * 0.4); // 0.2 to 0.6
            rafId = requestAnimationFrame(pingLoop);
        };
        rafId = requestAnimationFrame(pingLoop);
        return () => cancelAnimationFrame(rafId);
    }, [pinger]);

    const finalShiftLightOpacity = useTransform([shiftLightOpacity, pinger], ([s, p]) => (s as number) > 0 ? (p as number) : 0);
    
    useEffect(() => {
        let rafId: number;
        const loop = () => {
            const currentVal = mainMotion.get();
            if (currentVal > peak) {
                setPeak(currentVal);
                if (peakTimer.current) clearTimeout(peakTimer.current);
                peakTimer.current = setTimeout(() => setPeak(0), 1500);
            }

            if (showShiftLight) {
                const state = useVehicleStore.getState();
                const currentShift = interactiveShiftLight ? state.shiftLightRpm : shiftPoint;
                const isOn = currentVal >= currentShift;
                shiftLightOpacity.set(isOn ? 1 : 0);
            }
            
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [mainMotion, shiftPoint, showShiftLight, interactiveShiftLight, peak]);

    const displayDigital1 = useTransform(digital1Motion, v => v.toFixed(0));
    const displayDigital2 = useTransform(digital2Motion, v => {
        if (dataKeyDigital2 === 'gear') return v === 0 ? 'N' : v.toString();
        return v.toFixed(0);
    });

    const describeArc = (start: number, end: number, r: number) => {
        const sRad = (start - 90) * Math.PI / 180;
        const eRad = (end - 90) * Math.PI / 180;
        const x1 = Math.cos(sRad) * r;
        const y1 = Math.sin(sRad) * r;
        const x2 = Math.cos(eRad) * r;
        const y2 = Math.sin(eRad) * r;
        const largeArc = (end - start) <= 180 ? "0" : "1";
        if (Math.abs(end - start) < 0.01) return `M ${x1} ${y1}`;
        return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    const sweepPath = useTransform(mainMotion, v => {
        const val = Math.max(0, Math.min(v as number, maxMain));
        const angle = startAngle + (val / maxMain) * angleRange;
        return describeArc(startAngle, angle, 131);
    });

    const peakPath = React.useMemo(() => {
        if (peak <= 0) return "";
        const val = Math.max(0, Math.min(peak, maxMain));
        const angle = startAngle + (val / maxMain) * angleRange;
        return describeArc(angle - 1, angle + 1, 131);
    }, [peak, startAngle, maxMain, angleRange]);

    const ticks = useMemo(() => {
        const generatedTicks = [];
        for (let i = 0; i < numMajorTicks; i++) {
            const tickVal = i * (maxMain / (numMajorTicks - 1));
            generatedTicks.push(
                <FusionGaugeTick 
                    key={`major-${i}`} val={tickVal} isMajor={true} 
                    maxMain={maxMain} redline={redline} startAngle={startAngle} 
                    angleRange={angleRange} mainMotion={mainMotion} tickDivider={tickDivider}
                />
            );
            if (i < numMajorTicks - 1) {
                for (let j = 1; j < 5; j++) {
                    const minorVal = tickVal + j * ((maxMain / (numMajorTicks - 1)) / 5);
                    generatedTicks.push(
                        <FusionGaugeTick 
                            key={`minor-${i}-${j}`} val={minorVal} isMajor={false} 
                            maxMain={maxMain} redline={redline} startAngle={startAngle} 
                            angleRange={angleRange} mainMotion={mainMotion} tickDivider={tickDivider}
                        />
                    );
                }
            }
        }
        return generatedTicks;
    }, [maxMain, redline, startAngle, angleRange, mainMotion, numMajorTicks, tickDivider]);

    const faceX = useTransform(parallaxX, [-1, 1], [-3, 3]);
    const faceY = useTransform(parallaxY, [-1, 1], [-3, 3]);
    const glassX = useTransform(parallaxX, [-1, 1], [5, -5]);
    const glassY = useTransform(parallaxY, [-1, 1], [5, -5]);

    const redlineRatio = redline / maxMain;
    const redlineStartAngle = startAngle + redlineRatio * angleRange;
    const redlineStartRad = (redlineStartAngle - 90) * Math.PI / 180;
    const redlineEndRad = (endAngle - 90) * Math.PI / 180;
    const rArc = 140;
    const x1 = Math.cos(redlineStartRad) * rArc;
    const y1 = Math.sin(redlineStartRad) * rArc;
    const x2 = Math.cos(redlineEndRad) * rArc;
    const y2 = Math.sin(redlineEndRad) * rArc;
    const largeArcFlag = endAngle - redlineStartAngle <= 180 ? "0" : "1";
    const redlineArcPath = `M ${x1} ${y1} A ${rArc} ${rArc} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

    const shiftIndicatorAngle = useTransform(localShiftPoint, val => startAngle + (val / maxMain) * angleRange);

    return (
        <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }} role="img" aria-label={`Gauge for ${mainLabel}`}>
            <svg ref={svgRef} viewBox="-160 -160 320 320" className="w-full h-full overflow-visible drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]" style={svgStyle} aria-hidden="true">
                <defs>
                    <pattern id="carbonFiber" width="16" height="16" patternUnits="userSpaceOnUse">
                        <rect width="16" height="16" fill="#080808" />
                        <path d="M0 0 L8 8 M8 0 L16 8 M0 8 L8 16 M8 8 L16 16" stroke="#1a1a1a" strokeWidth="1" />
                        <path d="M4 4 L12 12 M12 4 L20 12 M -4 4 L4 12" stroke="#000" strokeWidth="2" opacity="0.5" />
                        <rect width="4" height="4" fill="#111" x="2" y="2" opacity="0.3" />
                        <rect width="4" height="4" fill="#000" x="10" y="10" opacity="0.3" />
                    </pattern>
                    
                    <linearGradient id="darkChromeBezel" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#222" />
                        <stop offset="20%" stopColor="#444" />
                        <stop offset="50%" stopColor="#0a0a0a" />
                        <stop offset="80%" stopColor="#333" />
                        <stop offset="100%" stopColor="#000" />
                    </linearGradient>

                    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={glowColor} stopOpacity="0.2" />
                        <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>

                    <linearGradient id="glassReflection" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                        <stop offset="30%" stopColor="rgba(255,255,255,0.02)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>

                    <filter id="redGlow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>

                    <filter id="themeGlow">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>

                    <filter id="dropShadow">
                        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.6"/>
                    </filter>

                    <pattern id="diagonalStripes" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(0,0,0,0.4)" strokeWidth="5" />
                    </pattern>
                </defs>

                {/* Bezel */}
                <circle cx="0" cy="0" r="155" fill="url(#darkChromeBezel)" stroke="#000" strokeWidth="2" filter="url(#dropShadow)" />
                <circle cx="0" cy="0" r="148" fill="#000" />
                <circle cx="0" cy="0" r="148" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                {/* Animated Face */}
                <motion.g style={{ x: faceX, y: faceY }}>
                    <circle cx="0" cy="0" r="148" fill="url(#carbonFiber)" />
                    <circle cx="0" cy="0" r="148" fill="url(#centerGlow)" />
                    
                    {/* Inner Shadow for Depth */}
                    <circle cx="0" cy="0" r="148" fill="transparent" stroke="rgba(0,0,0,0.4)" strokeWidth="4" style={innerCircleStyle} />
                    
                    {/* Concentric Calibration Guide & Ticks Ring */}
                    <circle cx="0" cy="0" r="138" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 4" />
                    
                    {/* Concentric Calibration Crosshair Grid */}
                    <g opacity="0.12" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75">
                        <line x1="-140" y1="0" x2="-120" y2="0" />
                        <line x1="120" y1="0" x2="140" y2="0" />
                        <line x1="0" y1="-140" x2="0" y2="-120" />
                        <line x1="-31" y1="120" x2="-21" y2="120" />
                        <line x1="21" y1="120" x2="31" y2="120" />
                    </g>
                    
                    {/* Brushed Hex Screws/Rivets on Face Cover for Industrial Motorsport Feel */}
                    <g opacity="0.8">
                        {/* Rivet Left */}
                        <circle cx="-138" cy="0" r="2.2" fill="url(#darkChromeBezel)" stroke="#020104" strokeWidth="0.5" />
                        <circle cx="-139.2" cy="-0.6" r="0.5" fill="#fff" opacity="0.45" />

                        {/* Rivet Right */}
                        <circle cx="138" cy="0" r="2.2" fill="url(#darkChromeBezel)" stroke="#020104" strokeWidth="0.5" />
                        <circle cx="136.8" cy="-0.6" r="0.5" fill="#fff" opacity="0.45" />

                        {/* Rivet Top */}
                        <circle cx="0" cy="-138" r="2.2" fill="url(#darkChromeBezel)" stroke="#020104" strokeWidth="0.5" />
                        <circle cx="-1.2" cy="-138.6" r="0.5" fill="#fff" opacity="0.45" />
                    </g>
                    
                    {redline < maxMain && (
                        <path 
                            d={redlineArcPath} 
                            fill="none" 
                            stroke="#ff3333" 
                            strokeWidth="4" 
                            strokeLinecap="round"
                            opacity="0.6"
                            filter="url(#redGlow)"
                        />
                    )}

                    {/* Ticks */}
                    <g>{ticks}</g>

                    {/* Sweep Arc (Replaces Physical Needle) */}
                    <g filter="url(#dropShadow)">
                        {/* Glow Base layer */}
                        <motion.path 
                            d={sweepPath} 
                            fill="none" 
                            stroke={glowColor}
                            strokeWidth="14" 
                            strokeLinecap="butt" 
                            filter="url(#themeGlow)"
                            opacity="0.8"
                        />
                        {/* Solid color layer */}
                        <motion.path 
                            d={sweepPath} 
                            fill="none" 
                            stroke={glowColor}
                            strokeWidth="12" 
                            strokeLinecap="butt" 
                        />
                        {/* Stripes overlay */}
                        <motion.path 
                            d={sweepPath} 
                            fill="none" 
                            stroke="url(#diagonalStripes)"
                            strokeWidth="12" 
                            strokeLinecap="butt" 
                        />
                        {/* Over-rev White Pulse */}
                        <motion.path 
                            d={sweepPath} 
                            fill="none" 
                            stroke="#fff"
                            strokeWidth="12" 
                            strokeLinecap="butt" 
                            style={{ opacity: shiftLightOpacity }}
                            className="mix-blend-overlay"
                        />
                        {/* Leading laser / spark tip pointer feedback for raw physics feel */}
                        <motion.circle 
                            cx={tipX} 
                            cy={tipY} 
                            r="5" 
                            fill="#ffffff" 
                            filter="url(#themeGlow)"
                        />
                        <motion.circle 
                            cx={tipX} 
                            cy={tipY} 
                            r="2.5" 
                            fill="#ffffff" 
                            stroke={glowColor}
                            strokeWidth="1"
                        />

                        {/* Peak Hold Indicator */}
                        {peak > 0 && (
                            <path 
                                d={peakPath} 
                                fill="none" 
                                stroke="#fff"
                                strokeWidth="20" 
                                strokeLinecap="round" 
                                filter="url(#themeGlow)"
                                opacity="0.9"
                            />
                        )}
                    </g>
                    
                    {/* Interactive Shift Light Dragger Indicator */}
                    {interactiveShiftLight && (
                        <motion.g 
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            style={{ 
                                cursor: 'grab',
                                rotate: shiftIndicatorAngle,
                                transformOrigin: '0px 0px'
                            }}
                            className={isDragging ? "cursor-grabbing" : "cursor-grab"}
                        >
                            <polygon 
                                points="-6,-140 0,-152 6,-140" 
                                fill={isDragging ? "#ffffff" : "#ffcc00"} 
                                filter="url(#themeGlow)"
                            />
                            <polygon 
                                points="-5,-140 0,-150 5,-140" 
                                fill={isDragging ? "#fff" : "#ff3333"} 
                            />
                        </motion.g>
                    )}

                    {/* Brand Logo inside Face with detailed metadata plate */}
                    {showBrandLogo === 'karapiro' && (
                        <g transform={`translate(0, ${largeCenterGear ? -38 : -32})`} className="pointer-events-none">
                            {/* Detailed mechanical backplate */}
                            <circle cx="0" cy="0" r="19" fill="url(#darkChromeBezel)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.75" />
                            <circle cx="0" cy="0" r="16.5" fill="#040306" stroke="rgba(188,19,254,0.3)" strokeWidth="0.5" />
                            <foreignObject x="-11" y="-11" width="22" height="22">
                                <KarapiroLogo variant="icon-only" className="w-full h-full text-[#BC13FE] filter drop-shadow-[0_0_5px_rgba(188,19,254,0.7)] animate-pulse" />
                            </foreignObject>
                            {/* Circular subtext path around metallic badge rim */}
                            <path id={`badgeTextPath-${dataKeyMain}`} d="M -16.5,7 A 16.5,16.5 0 0,1 16.5,7" fill="none" />
                            <text fontSize="4.2" fill="rgba(255,255,255,0.55)" className="font-mono tracking-widest uppercase font-black" textAnchor="middle">
                                <textPath href={`#badgeTextPath-${dataKeyMain}`} startOffset="50%">
                                    CARTEL-R
                                </textPath>
                            </text>
                        </g>
                    )}

                    {/* Dynamic Progressive Shift Light */}
                    {showProgressiveShiftLight && (
                        <g>
                            <path 
                                d={getSegmentPath(-58, 58, 120, 136)} 
                                fill="transparent" 
                                stroke="rgba(255,255,255,0.05)" 
                                strokeWidth="1" 
                            />
                            {segmentsDef.map((seg, idx) => (
                                <motion.path 
                                    key={`seg-${idx}`}
                                    d={getSegmentPath(seg.start, seg.end, 122, 134)}
                                    fill={seg.color}
                                    style={{ opacity: segOpacities[idx] }}
                                    filter="url(#themeGlow)"
                                />
                            ))}
                            {centerRedSegmentsDef.map((seg, idx) => (
                                <motion.path 
                                    key={`cen-seg-${idx}`}
                                    d={getSegmentPath(seg.start, seg.end, 122, 134)}
                                    fill={seg.color}
                                    style={{ opacity: centerRedOpacities[idx] }}
                                    filter="url(#themeGlow)"
                                />
                            ))}
                        </g>
                    )}

                    {/* Digital Displays */}
                    {showDigital && (
                        <>
                            {dataKeyDigital1 && (
                                <g transform="translate(0, 60)">
                                    <rect x="-45" y="-18" width="90" height="36" fill="#050505" stroke="#222" strokeWidth="1" rx="4" style={speedBoxRectStyle} />
                                    <motion.text x="0" y="9" textAnchor="middle" fill={glowColor} className="font-display font-black text-3xl italic" filter="url(#themeGlow)">
                                        {displayDigital1}
                                    </motion.text>
                                    <text x="0" y="26" textAnchor="middle" className="font-sans font-extrabold text-[8px] tracking-[0.15em] fill-gray-500 uppercase" style={speedBoxLabelStyle}>{digital1Label}</text>
                                </g>
                            )}

                            {dataKeyDigital2 && (
                                largeCenterGear ? (
                                    <g transform="translate(0, -5)">
                                        {/* Massive premium race gear box container */}
                                        <rect x="-40" y="-45" width="80" height="85" fill="#030303" stroke="#BC13FE" strokeWidth="2.5" rx="14" filter="url(#themeGlow)" className="opacity-95" />
                                        <rect x="-40" y="-45" width="80" height="85" fill="transparent" stroke="rgba(255,255,255,0.15)" strokeWidth="1" rx="14" style={largeGearOuterRectStyle} />
                                        <motion.text x="0" y="16" textAnchor="middle" fill="#ffffff" className="font-display font-black text-6xl italic" style={{ textShadow: '0 0 12px rgba(255,255,255,0.4)', ...gearTextStyle }}>
                                            {displayDigital2}
                                        </motion.text>
                                        <text x="0" y="32" textAnchor="middle" className="font-sans font-black text-[10px] tracking-[0.2em] fill-gray-400 uppercase">GEAR</text>
                                    </g>
                                ) : (
                                    <g transform="translate(0, -55)">
                                        <rect x="-30" y="-18" width="60" height="36" fill="#050505" stroke="#222" strokeWidth="1" rx="4" />
                                        <motion.text x="0" y="10" textAnchor="middle" fill="#fff" className="font-display font-black text-4xl italic">
                                            {displayDigital2}
                                        </motion.text>
                                        <text x="0" y="26" textAnchor="middle" className="font-sans font-extrabold text-[8px] tracking-[0.15em] fill-gray-500 uppercase">{digital2Label}</text>
                                    </g>
                                )
                            )}

                            {/* Labels inside the gauge face */}
                            <g transform={`translate(0, ${largeCenterGear ? -105 : -90})`}>
                                <text x="0" y="0" textAnchor="middle" fill="#888" className="font-sans font-black tracking-[0.2em] uppercase text-[10px]" style={{ fontSize: labelSize, ...mainLabelStyle }}>{mainLabel}</text>
                                <text x="0" y="15" textAnchor="middle" fill={glowColor} className="font-mono font-bold tracking-widest text-[10px]" style={mainUnitStyle}>{mainUnit}</text>
                            </g>
                        </>
                    )}

                    {/* Shift Light Alert Status Overhead */}
                    {showShiftLight && (
                        <g transform="translate(0, -120)">
                            <motion.circle 
                                r="6" 
                                fill="#ff3333" 
                                style={{ opacity: finalShiftLightOpacity }}
                                filter="url(#redGlow)"
                            />
                            <motion.circle 
                                r="4" 
                                fill="#fff" 
                                style={{ opacity: shiftLightOpacity }}
                            />
                        </g>
                    )}
                </motion.g>

                {/* Glass reflection layer */}
                <motion.circle cx="0" cy="0" r="148" fill="url(#glassReflection)" pointerEvents="none" style={{ x: glassX, y: glassY }} />
                
                {/* Gauge glass rim highlight */}
                <circle cx="0" cy="0" r="148" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" pointerEvents="none" />
            </svg>
        </div>
    );
};

export default FusionGauge;
