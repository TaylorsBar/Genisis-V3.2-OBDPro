import React from 'react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface AutometerTachProps {
    rpm: number;
    speed: number;
    gear: number;
    maxRpm?: number;
    redline?: number;
    shiftPoint?: number;
    size?: number;
}

const AutometerTach: React.FC<AutometerTachProps> = React.memo(({ 
    rpm, 
    speed,
    gear,
    maxRpm = 10000, 
    redline = 8500, 
    shiftPoint = 7500,
    size = 400 
}) => {
    const rpmMotion = useAnimatedValue(rpm);
    const speedMotion = useAnimatedValue(speed);

    const needleRef = React.useRef<SVGGElement>(null);
    const needleShadowRef = React.useRef<SVGGElement>(null);
    const speedTextRef = React.useRef<SVGTextElement>(null);
    const shiftBulbRef = React.useRef<SVGCircleElement>(null);
    const shiftFlareRef = React.useRef<SVGGElement>(null);

    // Configuration
    const startAngle = -45; // 0 RPM
    const endAngle = 225;   // Max RPM
    const angleRange = endAngle - startAngle;
    
    const valueToAngle = (val: number) => {
        const ratio = Math.max(0, Math.min(val, maxRpm)) / maxRpm;
        return startAngle + ratio * angleRange;
    };

    React.useEffect(() => {
        const updateRpm = (v: number) => {
            const angle = valueToAngle(v);
            if (needleRef.current) {
                needleRef.current.setAttribute("transform", `rotate(${angle})`);
            }
            if (needleShadowRef.current) {
                needleShadowRef.current.setAttribute("transform", `rotate(${angle})`);
            }
            const isShiftLightOn = v >= shiftPoint;
            if (shiftBulbRef.current) {
                shiftBulbRef.current.setAttribute("fill", isShiftLightOn ? "#FFD700" : "#443300");
                if (isShiftLightOn) {
                    shiftBulbRef.current.setAttribute("filter", "url(#shiftGlow)");
                } else {
                    shiftBulbRef.current.removeAttribute("filter");
                }
            }
            if (shiftFlareRef.current) {
                shiftFlareRef.current.setAttribute("opacity", isShiftLightOn ? "0.8" : "0");
            }
        };

        updateRpm(rpmMotion.get());
        const unsubscribe = rpmMotion.on("change", updateRpm);
        return unsubscribe;
    }, [rpmMotion, shiftPoint, maxRpm, redline]);

    React.useEffect(() => {
        const updateSpeed = (v: number) => {
            if (speedTextRef.current) {
                speedTextRef.current.textContent = isNaN(v) ? '---' : v.toFixed(0);
            }
        };

        updateSpeed(speedMotion.get());
        const unsubscribe = speedMotion.on("change", updateSpeed);
        return unsubscribe;
    }, [speedMotion]);

    const initialNeedleAngle = valueToAngle(rpmMotion.get());
    const initialSpeedText = isNaN(speedMotion.get()) ? '---' : speedMotion.get().toFixed(0);
    const initialShiftOn = rpmMotion.get() >= shiftPoint;

    // Tick Generation (Memoized to prevent high-frequency DOM reconstruction)
    const ticks = React.useMemo(() => {
        const generatedTicks = [];
        const numMajorTicks = 11; // 0 to 10
        for (let i = 0; i < numMajorTicks; i++) {
            const tickVal = i * (maxRpm / (numMajorTicks - 1));
            const angle = valueToAngle(tickVal);
            const isRedline = tickVal >= redline;
            
            // Major Tick
            generatedTicks.push(
                <g key={`major-${i}`} transform={`rotate(${angle} 200 200)`}>
                    <rect x="196" y="40" width="8" height="25" fill={isRedline ? "#ff3333" : "white"} />
                    <text 
                        x="200" 
                        y="95" 
                        transform={`rotate(${-angle} 200 95)`} 
                        textAnchor="middle" 
                        fill={isRedline ? "#ff3333" : "white"}
                        className="font-display font-bold text-4xl"
                        style={{ fontStyle: 'italic' }}
                    >
                        {i}
                    </text>
                </g>
            );

            // Minor Ticks (4 between majors)
            if (i < numMajorTicks - 1) {
                for (let j = 1; j < 5; j++) {
                    const minorVal = tickVal + j * ((maxRpm / (numMajorTicks - 1)) / 5);
                    const minorAngle = valueToAngle(minorVal);
                    generatedTicks.push(
                        <rect 
                            key={`minor-${i}-${j}`} 
                            x="198" y="40" width="4" height="12" 
                            fill="white" 
                            transform={`rotate(${minorAngle} 200 200)`} 
                        />
                    );
                }
            }
        }
        return generatedTicks;
    }, [maxRpm, redline]);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg viewBox="0 0 500 400" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="bezelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#e0e0e0" />
                        <stop offset="30%" stopColor="#909090" />
                        <stop offset="50%" stopColor="#404040" />
                        <stop offset="70%" stopColor="#909090" />
                        <stop offset="100%" stopColor="#e0e0e0" />
                    </linearGradient>
                    <radialGradient id="faceGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="80%" stopColor="#111" />
                        <stop offset="100%" stopColor="#000" />
                    </radialGradient>
                    <linearGradient id="lcdGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0a0a0a" />
                        <stop offset="100%" stopColor="#1a1a1a" />
                    </linearGradient>
                    <filter id="shiftGlow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="15" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="glassGlare">
                        <feGaussianBlur stdDeviation="2" />
                    </filter>
                    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="4" dy="4" stdDeviation="4" floodColor="black" floodOpacity="0.5"/>
                    </filter>
                    <filter id="lcdGlow">
                        <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                {/* --- Shift Light Assembly (Attached to Right Side) --- */}
                <g transform="translate(380, 80) rotate(15)">
                     {/* Mounting Bracket */}
                    <path d="M -20 20 L -60 50 L -60 70 L -20 40 Z" fill="#333" stroke="#111" strokeWidth="2" />
                    
                    {/* Light Housing */}
                    <circle cx="0" cy="0" r="55" fill="#222" stroke="#111" strokeWidth="4" filter="url(#dropShadow)" />
                    <circle cx="0" cy="0" r="50" fill="#111" />
                    
                    {/* The Bulb/Lens */}
                    <circle 
                        ref={shiftBulbRef}
                        cx="0" cy="0" r="45" 
                        fill={initialShiftOn ? "#FFD700" : "#443300"} 
                        filter={initialShiftOn ? "url(#shiftGlow)" : ""}
                        className="transition-colors duration-75"
                    />
                    {/* Lens Detail */}
                    <circle cx="0" cy="0" r="45" fill="url(#glassGrad)" opacity="0.3" pointerEvents="none" />
                    
                    {/* Flare when on */}
                    <g ref={shiftFlareRef} opacity={initialShiftOn ? "0.8" : "0"}>
                        <line x1="-60" y1="0" x2="60" y2="0" stroke="white" strokeWidth="2" filter="url(#shiftGlow)" />
                        <line x1="0" y1="-60" x2="0" y2="60" stroke="white" strokeWidth="2" filter="url(#shiftGlow)" />
                    </g>
                </g>

                {/* --- Main Gauge Body --- */}
                <g transform="translate(200, 200)">
                    {/* Mounting Bracket / Shadow */}
                    <circle cx="0" cy="5" r="200" fill="black" opacity="0.5" filter="url(#dropShadow)" />

                    {/* Bezel */}
                    <circle cx="0" cy="0" r="200" fill="url(#bezelGrad)" stroke="#111" strokeWidth="1" />
                    <circle cx="0" cy="0" r="190" fill="#111" />
                    
                    {/* Face */}
                    <circle cx="0" cy="0" r="185" fill="url(#faceGrad)" />

                    {/* --- BRANDING --- */}
                    <g transform="translate(0, -90)">
                        <text x="0" y="-20" textAnchor="middle" fill="#ccc" fontFamily="Orbitron" fontSize="12" fontWeight="bold" letterSpacing="4">
                            KARAPIRO
                        </text>
                        <text x="0" y="25" textAnchor="middle" fill="white" stroke="#000" strokeWidth="0.5" fontFamily="Orbitron" fontSize="40" fontWeight="900" fontStyle="italic" letterSpacing="-1">
                            CARTEL
                        </text>
                        <text x="0" y="45" textAnchor="middle" fill="#777" fontFamily="monospace" fontSize="8" fontWeight="bold" letterSpacing="2">
                            STATE HIGHWAY SPEED SHOP
                        </text>
                    </g>
                    
                    {/* RPM Label */}
                    <text textAnchor="middle" y="60" fill="#ccc" className="font-display italic font-bold text-xl">RPM</text>
                    <text textAnchor="middle" y="75" fill="#888" className="font-sans text-xs font-bold">x1000</text>

                    {/* LCD Gear Display (Left) */}
                    <g transform="translate(-100, 40)">
                        <rect x="-35" y="-30" width="70" height="50" rx="3" fill="url(#lcdGrad)" stroke="#333" strokeWidth="2" filter="url(#dropShadow)" />
                        <text x="0" y="-15" textAnchor="middle" fill="#555" fontSize="10" fontFamily="sans-serif" fontWeight="bold">GEAR</text>
                        <text x="0" y="15" textAnchor="middle" fill="#fff" fontSize="30" fontFamily="Orbitron" fontWeight="bold" filter="url(#lcdGlow)">
                             {gear === 0 ? 'N' : gear}
                        </text>
                    </g>

                    {/* LCD Speed Display (Bottom) */}
                    <g transform="translate(0, 120)">
                         <rect x="-50" y="-20" width="100" height="50" rx="3" fill="url(#lcdGrad)" stroke="#333" strokeWidth="2" filter="url(#dropShadow)" />
                         <text ref={speedTextRef} x="0" y="10" textAnchor="middle" fill="#00F0FF" fontSize="30" fontFamily="Orbitron" fontWeight="bold" filter="url(#lcdGlow)">
                             {initialSpeedText}
                         </text>
                         <text x="0" y="23" textAnchor="middle" fill="#555" fontSize="8" fontFamily="sans-serif" fontWeight="bold" letterSpacing="1">KM/H</text>
                    </g>

                    {/* Ticks */}
                    <g transform="translate(-200, -200)">
                        {ticks}
                    </g>

                    {/* Needle Shadow - Simplified for performance */}
                    <g ref={needleShadowRef} transform={`rotate(${initialNeedleAngle})`} style={{ willChange: 'transform' }}>
                        <path d="M -5 0 L -2 -140 L 2 -140 L 5 0 Z" fill="black" opacity="0.3" transform="translate(4, 4)" />
                    </g>

                    {/* Needle */}
                    <g 
                        ref={needleRef}
                        transform={`rotate(${initialNeedleAngle})`} 
                        className="transition-transform duration-100 ease-linear"
                        style={{ willChange: 'transform' }}
                    >
                        <path d="M -6 20 L -2 -155 L 2 -155 L 6 20 Z" fill="#ff4400" stroke="#cc3300" strokeWidth="1" />
                        <circle cx="0" cy="0" r="8" fill="#cc3300" />
                    </g>

                    {/* Center Cap */}
                    <circle cx="0" cy="0" r="18" fill="url(#bezelGrad)" stroke="#333" strokeWidth="1" />
                    <circle cx="0" cy="0" r="8" fill="#111" opacity="0.5" />

                    {/* Glass Glare */}
                    <path d="M -160 -80 Q 0 -180 160 -80 Q 80 0 -160 -80 Z" fill="white" opacity="0.05" filter="url(#glassGlare)" pointerEvents="none" />
                </g>
            </svg>
        </div>
    );
});


export default AutometerTach;
