import React, { useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface DigitalTapeRpmProps {
    max: number;
    redline: number;
    className?: string;
}

const DigitalTapeRpm: React.FC<DigitalTapeRpmProps> = React.memo(({ max, redline, className }) => {
    // Direct DOM refs for 60fps bypass for the bar and text
    const barRef = useRef<SVGPolygonElement>(null);
    const peakRef = useRef<SVGLineElement>(null);
    const textRef = useRef<SVGTextElement>(null);
    const shiftFlashRef = useRef<SVGRectElement>(null);
    
    // Motion value for RPM to drive tick animations
    const rpmMotion = useMotionValue(0);
    const smoothRpm = useSpring(rpmMotion, { stiffness: 300, damping: 30, restDelta: 0.001 });

    // Mutable state for peak hold to avoid re-renders
    const peakState = useRef({ value: 0, timer: null as any });

    // High-Frequency Render Loop (Bypassing React Reconciliation for the bar)
    useEffect(() => {
        let rafId: number;
        const update = () => {
            const rpm = useVehicleStore.getState().latestData.rpm ?? 0;
            
            // Sync motion value
            rpmMotion.set(rpm);

            // Peak Hold Logic
            if (rpm > peakState.current.value) {
                peakState.current.value = rpm;
                if (peakState.current.timer) clearTimeout(peakState.current.timer);
                peakState.current.timer = setTimeout(() => {
                    peakState.current.value = 0;
                }, 1500);
            }

            const pct = Math.min(1, Math.max(0, rpm / max));
            const peakPct = Math.min(1, Math.max(0, peakState.current.value / max));
            
            if (barRef.current) {
                const width = pct * 1000;
                const skewX = 6; // subtle skew for retro speed shop racing vibe
                const p2 = Math.max(0, width);
                const p3 = Math.max(0, width - skewX);
                barRef.current.setAttribute('points', `0,0 ${p2},0 ${p3},56 0,56`);
                barRef.current.setAttribute('fill', rpm > redline ? '#FF003C' : 'var(--theme-color, #FCEE0A)');
            }

            if (shiftFlashRef.current) {
                shiftFlashRef.current.style.display = rpm > redline ? 'block' : 'none';
            }

            if (peakRef.current) {
                const peakX = peakPct * 1000;
                peakRef.current.setAttribute('x1', peakX.toFixed(1));
                peakRef.current.setAttribute('x2', peakX.toFixed(1));
            }
            
            if (textRef.current) {
                textRef.current.textContent = rpm.toFixed(0);
            }

            rafId = requestAnimationFrame(update);
        };
        
        rafId = requestAnimationFrame(update);
        return () => {
            cancelAnimationFrame(rafId);
            if (peakState.current.timer) clearTimeout(peakState.current.timer);
        };
    }, [max, redline, rpmMotion]);

    const redlinePct = (redline / max) * 100;

    // Ticks component to isolate motion logic
    const RpmTick = ({ index }: { index: number }) => {
        const tickRpm = index * 1000;
        const xPos = (tickRpm / max) * 1000;
        
        // Scale and Opacity based on proximity to current RPM
        const scale = useTransform(smoothRpm, (current) => {
            const diff = Math.abs(current - tickRpm);
            const threshold = 800;
            if (diff < threshold) {
                return 1 + (1 - diff / threshold) * 0.4;
            }
            return 1;
        });

        const opacity = useTransform(smoothRpm, (current) => {
            const diff = Math.abs(current - tickRpm);
            const threshold = 1200;
            if (diff < threshold) {
                return 0.4 + (1 - diff / threshold) * 0.6;
            }
            return 0.4;
        });

        const color = useTransform(smoothRpm, (current) => {
            if (tickRpm >= redline) return '#FF003C';
            const diff = Math.abs(current - tickRpm);
            if (diff < 300) return '#FFFFFF';
            return '#4B5563'; // gray-600
        });

        return (
            <motion.g style={{ opacity }} transform={`translate(${xPos}, 0)`}>
                <motion.text
                    style={{ fill: color, scale, transformOrigin: 'center' }}
                    y="18"
                    textAnchor="middle"
                    className="font-mono text-[10px] font-black select-none"
                >
                    {index}
                </motion.text>
                <motion.line
                    style={{ stroke: color }}
                    x1="0"
                    y1={tickRpm >= redline ? "44" : "48"}
                    x2="0"
                    y2="56"
                    strokeWidth="1.5"
                />
            </motion.g>
        );
    };

    return (
        <div className={`w-full h-14 bg-[#050505] relative select-none shadow-2xl z-40 ${className}`}>
            <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 1000 56" 
                preserveAspectRatio="none"
                className="absolute inset-0 z-0"
            >
                <defs>
                    <pattern id="barStripes" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="10" height="20" fill="rgba(0,0,0,0.1)" />
                    </pattern>
                    <linearGradient id="barGlow" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="rgba(0,0,0,0.3)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                    </linearGradient>
                    <filter id="peakGlow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Base background */}
                <rect width="1000" height="56" fill="#050505" />

                {/* Redline Static Background Marker */}
                <rect 
                    x={(redlinePct / 100) * 1000} 
                    y="0" 
                    width={(1 - redlinePct / 100) * 1000} 
                    height="56" 
                    fill="rgba(239, 68, 68, 0.08)" 
                />
                
                {/* Divider bar */}
                <line x1="0" y1="55" x2="1000" y2="55" stroke="#222" strokeWidth="2" />

                {/* Main Dynamic Bar */}
                <polygon 
                    ref={barRef}
                    points="0,0 0,0 0,56 0,56"
                    fill="var(--theme-color, #FCEE0A)"
                />

                {/* Overlay stripes on the active bar */}
                <rect width="1000" height="56" fill="url(#barStripes)" pointerEvents="none" />
                <rect width="1000" height="56" fill="url(#barGlow)" pointerEvents="none" />

                {/* Dynamic Shift Flash Overlay */}
                <rect 
                    ref={shiftFlashRef}
                    width="1000" 
                    height="56" 
                    fill="#ffffff" 
                    opacity="0.25" 
                    style={{ display: 'none' }}
                    className="animate-pulse"
                    pointerEvents="none"
                />

                {/* Dynamic Peak Hold Line */}
                <line 
                    ref={peakRef}
                    x1="0" 
                    y1="0" 
                    x2="0" 
                    y2="56" 
                    stroke="#ffffff" 
                    strokeWidth="3" 
                    opacity="0.5"
                    filter="url(#peakGlow)"
                />

                {/* SVG-based Ticks and Labels */}
                <g className="pointer-events-none">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <RpmTick key={i} index={i} />
                    ))}
                </g>

                {/* Large Digital Speed Readout right-aligned */}
                <g transform="translate(930, 28)" className="pointer-events-none">
                    <text 
                        ref={textRef}
                        x="-40"
                        y="8"
                        textAnchor="end"
                        className="font-display font-black text-4xl italic fill-white select-none"
                        style={{ 
                            textShadow: '0px 0px 10px rgba(255,255,255,0.3)',
                        }}
                    >
                        0
                    </text>
                    <text 
                        x="-30"
                        y="5"
                        textAnchor="start"
                        className="font-display font-black text-[10px] fill-gray-500 tracking-widest uppercase select-none"
                    >
                        RPM
                    </text>
                </g>

                <line x1="0" y1="55.5" x2="1000" y2="55.5" stroke="#222" strokeWidth="1" />
            </svg>

            {/* Scanline Effect (kept on top) */}
            <div className="absolute inset-0 pointer-events-none bg-scanline opacity-[0.03] z-50"></div>
        </div>
    );
});


export default DigitalTapeRpm;
