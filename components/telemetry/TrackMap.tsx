import React, { useMemo, useRef, useEffect } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

interface TrackMapProps {
    data?: any;
    height?: number | string;
    width?: number | string;
    colorMetric?: string;
    className?: string;
}

export const TrackMap: React.FC<TrackMapProps> = ({
    height = '100%',
    width = '100%',
    colorMetric = 'gForceY',
    className = ''
}) => {
    const latestData = useVehicleStore(state => state.latestData);
    const runTime = useVehicleStore(state => state.latestData?.time || 0);

    // Track path geometry: Grand Circuit (smooth SVG path)
    const trackPathD = "M 150 350 C 100 350, 60 300, 60 220 C 60 140, 120 70, 220 70 C 320 70, 380 120, 420 180 C 460 240, 520 280, 580 280 C 660 280, 720 220, 720 160 C 720 100, 660 50, 560 50 C 460 50, 380 90, 300 90 C 220 90, 180 150, 180 220 C 180 290, 220 350, 150 350 Z";

    // Track SVG path calculation for car position along track
    const pathRef = useRef<SVGPathElement>(null);

    // Calculate car position along track based on elapsed run time or vehicle distance
    const trackProgress = useMemo(() => {
        // Continuous cycle 0 to 1 based on runtime
        const cycleLengthSeconds = 48; // ~48s simulated lap
        return (runTime % cycleLengthSeconds) / cycleLengthSeconds;
    }, [runTime]);

    // Position coordinates
    const carPos = useMemo(() => {
        if (!pathRef.current) return { x: 150, y: 350, angle: 0 };
        try {
            const totalLen = pathRef.current.getTotalLength();
            const currentLen = trackProgress * totalLen;
            const pt = pathRef.current.getPointAtLength(currentLen);
            const ptNext = pathRef.current.getPointAtLength((currentLen + 2) % totalLen);
            const angle = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x) * (180 / Math.PI);
            return { x: pt.x, y: pt.y, angle };
        } catch (e) {
            return { x: 150, y: 350, angle: 0 };
        }
    }, [trackProgress]);

    const speed = latestData?.speed || 0;
    const gForceY = latestData?.gForceY || 0;
    const gForceX = latestData?.gForceX || 0;

    return (
        <div className={`relative w-full h-full flex flex-col items-center justify-center bg-[#05070D] rounded-xl overflow-hidden border border-white/10 ${className}`} style={{ width, height }}>
            {/* Ambient background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.06)_0%,transparent_70%)] pointer-events-none"></div>

            {/* Grid background */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(90deg,rgba(0,240,255,0.15)_1px,transparent_1px),linear-gradient(rgba(0,240,255,0.15)_1px,transparent_1px)] bg-[length:30px_30px] pointer-events-none"></div>

            {/* Track Info Overlay Header */}
            <div className="absolute top-3 left-4 z-20 flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 bg-black/70 px-2.5 py-1 rounded border border-white/10 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-bold text-gray-200">KARAPIRO INTERNATIONAL RACEWAY</span>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-400">
                    <span>LENGTH: <strong className="text-white">3.84 KM</strong></span>
                    <span>SECTORS: <strong className="text-cyan-400">3</strong></span>
                    <span>RECORD: <strong className="text-purple-400">1:28.450</strong></span>
                </div>
            </div>

            {/* Live Telemetry Legend */}
            <div className="absolute bottom-3 right-4 z-20 flex items-center gap-3 bg-black/80 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono backdrop-blur-md">
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
                    <span className="text-gray-300">BRAKING / ACCEL</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                    <span className="text-gray-300">MAX CORNERING</span>
                </div>
                <div className="text-brand-cyan font-bold pl-2 border-l border-white/10">
                    LAT {gForceX.toFixed(2)}G | LONG {gForceY.toFixed(2)}G
                </div>
            </div>

            {/* SVG Track Canvas */}
            <svg viewBox="0 0 800 400" className="w-full h-full max-h-[90%] p-4 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                <defs>
                    {/* Track Glow Filter */}
                    <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Car Halo Glow */}
                    <filter id="car-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Gradient along path */}
                    <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00F0FF" />
                        <stop offset="40%" stopColor="#3B82F6" />
                        <stop offset="70%" stopColor="#A855F7" />
                        <stop offset="100%" stopColor="#EF4444" />
                    </linearGradient>
                </defs>

                {/* 1. Track Outer Outline Shadow */}
                <path
                    d={trackPathD}
                    fill="none"
                    stroke="#090D16"
                    strokeWidth="28"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* 2. Track Base Road Surface */}
                <path
                    d={trackPathD}
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* 3. Track Active Telemetry Heatline Path */}
                <path
                    ref={pathRef}
                    d={trackPathD}
                    fill="none"
                    stroke="url(#trackGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#track-glow)"
                    opacity="0.85"
                />

                {/* 4. Start/Finish Line Indicator */}
                <g transform="translate(150, 350)">
                    <line x1="-12" y1="-10" x2="-12" y2="10" stroke="#FFFFFF" strokeWidth="4" strokeDasharray="3 3" />
                    <text x="-16" y="22" fill="#FFFFFF" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                        FINISH
                    </text>
                </g>

                {/* 5. Sector Split Markers */}
                {/* Sector 1 */}
                <g transform="translate(420, 180)">
                    <circle cx="0" cy="0" r="4" fill="#00F0FF" />
                    <text x="8" y="3" fill="#00F0FF" fontSize="7" fontFamily="monospace" fontWeight="bold">S1</text>
                </g>
                {/* Sector 2 */}
                <g transform="translate(720, 160)">
                    <circle cx="0" cy="0" r="4" fill="#A855F7" />
                    <text x="8" y="3" fill="#A855F7" fontSize="7" fontFamily="monospace" fontWeight="bold">S2</text>
                </g>
                {/* Sector 3 */}
                <g transform="translate(300, 90)">
                    <circle cx="0" cy="0" r="4" fill="#EF4444" />
                    <text x="8" y="3" fill="#EF4444" fontSize="7" fontFamily="monospace" fontWeight="bold">S3</text>
                </g>

                {/* 6. Live Vehicle Location Pulse Marker */}
                <g transform={`translate(${carPos.x}, ${carPos.y})`}>
                    {/* Outer Pulsing Aura */}
                    <circle cx="0" cy="0" r="14" fill="#00F0FF" opacity="0.25" className="animate-ping" />
                    <circle cx="0" cy="0" r="9" fill="#00F0FF" opacity="0.5" filter="url(#car-glow)" />
                    {/* Vehicle Dot */}
                    <circle cx="0" cy="0" r="5" fill="#FFFFFF" stroke="#00F0FF" strokeWidth="2" />

                    {/* Vehicle Heading Arrow */}
                    <g transform={`rotate(${carPos.angle})`}>
                        <polygon points="6,0 12,-4 12,4" fill="#00F0FF" />
                    </g>

                    {/* Car Speed Callout Tag */}
                    <g transform="translate(12, -12)">
                        <rect x="0" y="0" width="48" height="16" rx="3" fill="rgba(9, 13, 22, 0.9)" stroke="#00F0FF" strokeWidth="1" />
                        <text x="24" y="11" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            {Math.round(speed)} kph
                        </text>
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default TrackMap;
