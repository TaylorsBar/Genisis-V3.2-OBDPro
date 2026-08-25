
import React, { useRef, useEffect, useMemo } from 'react';
import { useSpringValue } from '../../../hooks/useSpringValue';

interface HaltechSideBarGaugeProps {
    label: string;
    value: number;
    min: number;
    max: number;
    unit: string;
    orientation: 'left' | 'right';
}

const NUM_SEGMENTS = 16;
const SEGMENT_HEIGHT = 10;
const GAP = 2;
const TOTAL_HEIGHT = NUM_SEGMENTS * (SEGMENT_HEIGHT + GAP);

const HaltechSideBarGauge: React.FC<HaltechSideBarGaugeProps> = ({ label, value, min, max, unit, orientation }) => {
    const animatedValueRef = useSpringValue(value);
    const fillRef = useRef<SVGRectElement>(null);
    const textRef = useRef<SVGTextElement>(null);
    const isLeft = orientation === 'left';

    // Static Mask Definition
    const maskId = useMemo(() => `mask-${label}-${orientation}`, [label, orientation]);
    const segments = useMemo(() => (
        <>
            {Array.from({ length: NUM_SEGMENTS }).map((_, i) => {
                const y = TOTAL_HEIGHT - ((i + 1) * (SEGMENT_HEIGHT + GAP));
                return (
                    <rect
                        key={i}
                        x="26"
                        y={y}
                        width="8"
                        height={SEGMENT_HEIGHT}
                        fill="white"
                    />
                )
            })}
        </>
    ), []);

    // Animation Loop
    useEffect(() => {
        let raf: number;
        const loop = () => {
            const val = animatedValueRef.current;
            const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
            
            // Update Fill Height
            if (fillRef.current) {
                const height = ratio * TOTAL_HEIGHT;
                // We grow from bottom. 
                // SVG coords: y=0 is top. Total H = ~192.
                // Bottom is y=192. Top of bar is 192 - height.
                // However, our segments logic places index 0 at bottom.
                // Let's just set y and height relative to the mask container.
                
                // Simplified: The mask determines visibility. We just need a rect behind it that moves up.
                // Or grows up.
                fillRef.current.setAttribute('y', (TOTAL_HEIGHT - height).toString());
                fillRef.current.setAttribute('height', height.toString());
            }

            // Update Text
            if (textRef.current) {
                textRef.current.textContent = val.toFixed(label === 'BOOST' ? 2 : 1);
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [min, max]);

    return (
        <div className="w-full max-w-[200px] aspect-[1/3] relative font-sans">
            <svg viewBox="0 0 100 300" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="bezel-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#555" />
                        <stop offset="50%" stopColor="#eee" />
                        <stop offset="100%" stopColor="#555" />
                    </linearGradient>
                    <mask id={maskId}>
                        {segments}
                    </mask>
                </defs>
                
                <g transform={`translate(0, 50) ${isLeft ? '' : 'translate(100, 0) scale(-1, 1)'}`}>
                    {/* Bezel */}
                    <path d="M 30 10 C 40 10, 50 20, 50 40 L 50 260 C 50 280, 40 290, 30 290" fill="none" stroke="url(#bezel-grad)" strokeWidth="3" />
                    <path d="M 50 40 L 20 40 C 5 40, 5 60, 20 60 L 50 60" fill="none" stroke="url(#bezel-grad)" strokeWidth="3" />
                    <path d="M 50 260 L 20 260 C 5 260, 5 240, 20 240 L 50 240" fill="none" stroke="url(#bezel-grad)" strokeWidth="3" />
                    
                    {/* Background track (Dark Segments) */}
                    <g mask={`url(#${maskId})`}>
                        <rect x="26" y="0" width="8" height={TOTAL_HEIGHT} fill="#333" />
                    </g>

                    {/* Active Fill (Light Segments via Mask) */}
                    <g mask={`url(#${maskId})`}>
                        <rect 
                            ref={fillRef}
                            x="26" 
                            y={TOTAL_HEIGHT} 
                            width="8" 
                            height="0" 
                            fill="white" 
                        />
                    </g>
                </g>

                {/* Labels (Not flipped) */}
                <g className="font-sans">
                    <text x={isLeft ? 60 : 40} y="30" textAnchor={isLeft ? "start" : "end"} fill="#aaa" fontSize="12" fontWeight="bold">{label}</text>
                    <text 
                        ref={textRef}
                        x={isLeft ? 60 : 40} y="50" 
                        textAnchor={isLeft ? "start" : "end"} 
                        fill="white" fontSize="20" fontWeight="bold"
                    >
                        0.0
                    </text>
                    <text x={isLeft ? 60 : 40} y="65" textAnchor={isLeft ? "start" : "end"} fill="#888" fontSize="10">{unit}</text>
                    
                    <text x={isLeft ? 60 : 40} y="280" textAnchor={isLeft ? "start" : "end"} fill="white" fontSize="10">{isLeft ? 'L' : 'R'}</text>
                </g>
            </svg>
        </div>
    );
};

export default HaltechSideBarGauge;
