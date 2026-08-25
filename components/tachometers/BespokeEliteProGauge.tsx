import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { ObdConnectionState } from '../../types';
import { RefreshCw, Zap, Flame, ShieldAlert, Droplet, Thermometer, Battery, Settings, Eye } from 'lucide-react';

export type GaugeThemeMode = 'cyber_grid' | 'gr_racing' | 'motorsport_white';
export type GaugeLogoBrand = 'cartelworx' | 'toyota_gr' | 'genesis_os';

export interface BespokeEliteProGaugeProps {
    rpm?: number;
    speed?: number;
    gear?: number;
    redline?: number;
    maxRpm?: number;
    theme?: GaugeThemeMode;
    brandLogo?: GaugeLogoBrand;
    size?: number | string;
    showControls?: boolean;
    onThemeChange?: (theme: GaugeThemeMode) => void;
    className?: string;
    style?: React.CSSProperties;
}

export const BespokeEliteProGauge: React.FC<BespokeEliteProGaugeProps> = React.memo(({
    rpm: propsRpm,
    speed: propsSpeed,
    gear: propsGear,
    redline: propRedline = 7000,
    maxRpm = 10000,
    theme: propTheme = 'cyber_grid',
    brandLogo: propBrand = 'cartelworx',
    size = '100%',
    showControls = true,
    onThemeChange,
    className = '',
    style
}) => {
    // Stores & state
    const storeRpm = useVehicleStore(state => state.latestData?.rpm);
    const storeSpeed = useVehicleStore(state => state.latestData?.speed);
    const storeGear = useVehicleStore(state => state.latestData?.gear);
    const storeOilTemp = useVehicleStore(state => state.latestData?.engineOilTemp || 92);
    const storeCoolantTemp = useVehicleStore(state => state.latestData?.engineTemp || 88);
    const storeBatteryV = useVehicleStore(state => state.latestData?.batteryVoltage || 14.1);
    const storeOilPressure = useVehicleStore(state => state.latestData?.oilPressure || 4.2);
    const storeShiftLightRpm = useVehicleStore(state => state.shiftLightRpm || propRedline);
    const setShiftLightRpm = useVehicleStore(state => state.setShiftLightRpm);
    const obdState = useVehicleStore(state => state.obdState);

    // Active theme & brand state
    const [currentTheme, setCurrentTheme] = useState<GaugeThemeMode>(propTheme);
    const [currentBrand, setCurrentBrand] = useState<GaugeLogoBrand>(propBrand);
    const [isTestMode, setIsTestMode] = useState(false);
    const [testRpm, setTestRpm] = useState(0);
    const [peakRpm, setPeakRpm] = useState(0);
    const [peakTimer, setPeakTimer] = useState<NodeJS.Timeout | null>(null);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);

    // Sync theme if prop changes
    useEffect(() => {
        if (propTheme) setCurrentTheme(propTheme);
    }, [propTheme]);

    useEffect(() => {
        if (propBrand) setCurrentBrand(propBrand);
    }, [propBrand]);

    // Effective telemetry values
    const effectiveRpm = isTestMode ? testRpm : (propsRpm ?? storeRpm ?? 0);
    const effectiveSpeed = propsSpeed ?? storeSpeed ?? 0;
    const effectiveGear = propsGear ?? storeGear ?? 4;

    // Track peak RPM hold
    useEffect(() => {
        if (effectiveRpm > peakRpm) {
            setPeakRpm(effectiveRpm);
            if (peakTimer) clearTimeout(peakTimer);
            const timer = setTimeout(() => {
                setPeakRpm(0);
            }, 2200);
            setPeakTimer(timer);
        }
    }, [effectiveRpm]);

    // Geometry Dimensions
    const cx = 220;
    const cy = 220;
    const rFace = 185;
    const rTicks = 160;
    const rText = 132;

    // Sweep Angles: 0 RPM at 135 deg (bottom left), 10,000 RPM at 405 deg (bottom right) -> 270 deg total
    const startAngle = 135;
    const endAngle = 405;
    const totalAngle = endAngle - startAngle;

    const rpmToAngle = useCallback((val: number) => {
        const clamped = Math.max(0, Math.min(maxRpm, val));
        return startAngle + (clamped / maxRpm) * totalAngle;
    }, [maxRpm, startAngle, totalAngle]);

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180.0);
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians)
        };
    };

    const describeArc = (x: number, y: number, radius: number, startA: number, endA: number) => {
        const start = polarToCartesian(x, y, radius, endA);
        const end = polarToCartesian(x, y, radius, startA);
        const largeArcFlag = endA - startA <= 180 ? '0' : '1';
        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(' ');
    };

    // Wedge Fan Arc Path (from 0 RPM to target RPM)
    const describeWedgeFan = (x: number, y: number, innerR: number, outerR: number, startA: number, endA: number) => {
        if (Math.abs(endA - startA) < 0.5) return '';
        const p1 = polarToCartesian(x, y, innerR, startA);
        const p2 = polarToCartesian(x, y, outerR, startA);
        const p3 = polarToCartesian(x, y, outerR, endA);
        const p4 = polarToCartesian(x, y, innerR, endA);
        const largeArc = endA - startA <= 180 ? '0' : '1';

        return [
            'M', p1.x, p1.y,
            'L', p2.x, p2.y,
            'A', outerR, outerR, 0, largeArc, 1, p3.x, p3.y,
            'L', p4.x, p4.y,
            'A', innerR, innerR, 0, largeArc, 0, p1.x, p1.y,
            'Z'
        ].join(' ');
    };

    // Current angles
    const currentAngle = rpmToAngle(effectiveRpm);
    const shiftAngle = rpmToAngle(storeShiftLightRpm);
    const peakAngle = rpmToAngle(peakRpm);

    // Shift Light LED calculations (10 LEDs along top right arc from 310deg to 395deg)
    const shiftLightRpmThreshold = storeShiftLightRpm;
    const rpmRatio = effectiveRpm / shiftLightRpmThreshold;
    const isShiftRedlineHit = effectiveRpm >= shiftLightRpmThreshold;

    const shiftLeds = useMemo(() => {
        const totalLeds = 10;
        const ledStartAngle = 315;
        const ledEndAngle = 395;
        const step = (ledEndAngle - ledStartAngle) / (totalLeds - 1);

        return Array.from({ length: totalLeds }).map((_, i) => {
            const angle = ledStartAngle + i * step;
            const pos = polarToCartesian(cx, cy, 172, angle);
            
            // LED state based on RPM ratio
            const fillRatio = (i + 1) / totalLeds;
            const isActive = rpmRatio >= (0.65 + fillRatio * 0.35);

            let activeColor = '#10B981'; // Green (1-4)
            if (i >= 4 && i < 7) activeColor = '#F59E0B'; // Amber (5-7)
            if (i >= 7) activeColor = '#EF4444'; // Red (8-10)

            return {
                id: i,
                x: pos.x,
                y: pos.y,
                angle,
                isActive,
                activeColor
            };
        });
    }, [cx, cy, rpmRatio]);

    // Hex bolts around the outer brushed metallic bezel (10 bolts)
    const bezelBolts = useMemo(() => {
        const count = 10;
        const boltRadius = 205;
        return Array.from({ length: count }).map((_, i) => {
            const angle = i * (360 / count) - 90;
            const pos = polarToCartesian(cx, cy, boltRadius, angle);
            return { id: i, x: pos.x, y: pos.y, angle };
        });
    }, [cx, cy]);

    // Tick marks generation (0 to 10 x1000)
    const ticks = useMemo(() => {
        const majorCount = 10; // 0 to 10
        const ticksList: Array<{
            val: number;
            angle: number;
            isMajor: boolean;
            isMedium: boolean;
            tickPos1: { x: number; y: number };
            tickPos2: { x: number; y: number };
            textPos: { x: number; y: number };
            isRedline: boolean;
        }> = [];

        const totalTicks = majorCount * 5; // 50 subdivisions
        for (let i = 0; i <= totalTicks; i++) {
            const val = (i / totalTicks) * maxRpm;
            const angle = startAngle + (i / totalTicks) * totalAngle;
            const isMajor = i % 5 === 0;
            const isMedium = i % 5 === 2.5;
            const isRedline = val >= storeShiftLightRpm;

            const tLen = isMajor ? 18 : isMedium ? 12 : 7;
            const innerR = rTicks - tLen;
            const outerR = rTicks;

            const tickPos1 = polarToCartesian(cx, cy, innerR, angle);
            const tickPos2 = polarToCartesian(cx, cy, outerR, angle);
            const textPos = polarToCartesian(cx, cy, rText, angle);

            ticksList.push({
                val: Math.round(val / 1000),
                angle,
                isMajor,
                isMedium,
                tickPos1,
                tickPos2,
                textPos,
                isRedline
            });
        }
        return ticksList;
    }, [maxRpm, startAngle, totalAngle, storeShiftLightRpm, rTicks, rText, cx, cy]);

    // Interactive Rev sweep test trigger
    const handleRevTest = () => {
        if (isTestMode) return;
        setIsTestMode(true);
        let cur = 800;
        let step = 180;
        let direction = 1;
        const interval = setInterval(() => {
            cur += step * direction;
            if (cur >= maxRpm * 0.98) {
                direction = -1;
                cur = maxRpm * 0.98;
            }
            if (cur <= 800 && direction === -1) {
                clearInterval(interval);
                setIsTestMode(false);
                setTestRpm(0);
            } else {
                setTestRpm(cur);
            }
        }, 30);
    };

    // Redline shift light adjust via touch or click on rim
    const svgRef = useRef<SVGSVGElement>(null);
    const handleRimClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 440;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 440;

        const dx = mouseX - cx;
        const dy = mouseY - cy;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
        if (angle < 100) angle += 360;

        if (angle >= startAngle && angle <= endAngle) {
            const ratio = (angle - startAngle) / totalAngle;
            const newRedline = Math.round((ratio * maxRpm) / 100) * 100;
            if (newRedline >= 3000 && newRedline <= maxRpm) {
                setShiftLightRpm(newRedline);
            }
        }
    };

    // Theme color palettes
    const themeStyles = useMemo(() => {
        switch (currentTheme) {
            case 'motorsport_white':
                return {
                    bgFill: '#F8FAFC',
                    gridStroke: 'rgba(0,0,0,0.06)',
                    dialBorder: '#E2E8F0',
                    majorTick: '#0F172A',
                    minorTick: '#64748B',
                    numColor: '#090D16',
                    redlineNumColor: '#DC2626',
                    redlineArc: '#EF4444',
                    centerReadout: '#0F172A',
                    centerUnit: '#64748B',
                    needleColor: '#EF4444',
                    wedgeGradient: 'url(#wedge-white-spec)',
                    lcdBg: '#1E293B',
                    lcdText: '#38BDF8',
                    logoMain: '#0F172A',
                    logoSub: '#64748B',
                    isDark: false
                };
            case 'gr_racing':
                return {
                    bgFill: '#06080D',
                    gridStroke: 'rgba(239, 68, 68, 0.08)',
                    dialBorder: '#1E293B',
                    majorTick: '#00F0FF',
                    minorTick: '#1E3A8A',
                    numColor: '#38BDF8',
                    redlineNumColor: '#EF4444',
                    redlineArc: '#DC2626',
                    centerReadout: '#FFFFFF',
                    centerUnit: '#94A3B8',
                    needleColor: '#00F0FF',
                    wedgeGradient: 'url(#wedge-gr-spec)',
                    lcdBg: '#090D16',
                    lcdText: '#C084FC',
                    logoMain: '#FFFFFF',
                    logoSub: '#EF4444',
                    isDark: true
                };
            case 'cyber_grid':
            default:
                return {
                    bgFill: '#030712',
                    gridStroke: 'rgba(0, 240, 255, 0.12)',
                    dialBorder: '#0F172A',
                    majorTick: '#00F0FF',
                    minorTick: '#0284C7',
                    numColor: '#00F0FF',
                    redlineNumColor: '#EC4899',
                    redlineArc: '#F43F5E',
                    centerReadout: '#FFFFFF',
                    centerUnit: '#00F0FF',
                    needleColor: '#00F0FF',
                    wedgeGradient: 'url(#wedge-cyber-neon)',
                    lcdBg: '#090D16',
                    lcdText: '#E879F9',
                    logoMain: '#00F0FF',
                    logoSub: '#38BDF8',
                    isDark: true
                };
        }
    }, [currentTheme]);

    return (
        <div className={`relative flex flex-col items-center justify-center select-none ${className}`} style={{ width: size, height: typeof size === 'number' ? size : '100%', ...style }}>
            {/* Top Bar Quick Controls */}
            {showControls && (
                <div className="absolute top-2 z-30 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-xl">
                    <button
                        onClick={() => {
                            const next: GaugeThemeMode = currentTheme === 'cyber_grid' ? 'gr_racing' : currentTheme === 'gr_racing' ? 'motorsport_white' : 'cyber_grid';
                            setCurrentTheme(next);
                            if (onThemeChange) onThemeChange(next);
                        }}
                        className="text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition-all"
                        title="Switch Gauge Visual Theme"
                    >
                        <Eye className="w-2.5 h-2.5 text-brand-cyan" />
                        <span className="uppercase">{currentTheme.replace('_', ' ')}</span>
                    </button>

                    <button
                        onClick={handleRevTest}
                        disabled={isTestMode}
                        className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1 transition-all ${isTestMode ? 'bg-amber-500/30 text-amber-300' : 'bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30'}`}
                        title="Trigger Engine Rev Sweep Test"
                    >
                        <Flame className="w-2.5 h-2.5" />
                        <span>{isTestMode ? 'TESTING...' : 'REV TEST'}</span>
                    </button>

                    <button
                        onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
                        title="Gauge Options"
                    >
                        <Settings className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Dropdown Options Drawer */}
            {showSettingsPanel && (
                <div className="absolute top-12 z-40 bg-[#0A0A0C] border border-white/20 p-3 rounded-xl shadow-2xl flex flex-col gap-2 w-64 text-xs font-mono text-gray-200">
                    <div className="flex justify-between items-center border-b border-white/10 pb-1 font-bold text-brand-cyan">
                        <span>GAUGE CONFIGURATION</span>
                        <button onClick={() => setShowSettingsPanel(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    
                    <div>
                        <span className="text-[10px] text-gray-400 uppercase">THEME SPECIFICATION:</span>
                        <div className="grid grid-cols-3 gap-1 mt-1">
                            <button
                                onClick={() => { setCurrentTheme('cyber_grid'); if (onThemeChange) onThemeChange('cyber_grid'); }}
                                className={`py-1 text-[9px] rounded font-bold uppercase border ${currentTheme === 'cyber_grid' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                CYBER
                            </button>
                            <button
                                onClick={() => { setCurrentTheme('gr_racing'); if (onThemeChange) onThemeChange('gr_racing'); }}
                                className={`py-1 text-[9px] rounded font-bold uppercase border ${currentTheme === 'gr_racing' ? 'bg-red-500/20 border-red-400 text-red-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                GR SPEC
                            </button>
                            <button
                                onClick={() => { setCurrentTheme('motorsport_white'); if (onThemeChange) onThemeChange('motorsport_white'); }}
                                className={`py-1 text-[9px] rounded font-bold uppercase border ${currentTheme === 'motorsport_white' ? 'bg-white/30 border-white text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                WHITE
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="text-[10px] text-gray-400 uppercase">BRAND LOGO:</span>
                        <div className="grid grid-cols-3 gap-1 mt-1">
                            <button
                                onClick={() => setCurrentBrand('cartelworx')}
                                className={`py-1 text-[9px] rounded font-bold uppercase border ${currentBrand === 'cartelworx' ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                CARTEL
                            </button>
                            <button
                                onClick={() => setCurrentBrand('toyota_gr')}
                                className={`py-1 text-[9px] rounded font-bold uppercase border ${currentBrand === 'toyota_gr' ? 'bg-red-500/20 border-red-400 text-red-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                TOYOTA GR
                            </button>
                            <button
                                onClick={() => setCurrentBrand('genesis_os')}
                                className={`py-1 text-[9px] rounded font-bold uppercase border ${currentBrand === 'genesis_os' ? 'bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                GENESIS
                            </button>
                        </div>
                    </div>

                    <div className="pt-1 border-t border-white/10 flex justify-between items-center text-[10px]">
                        <span className="text-gray-400">REDLINE SHIFT SET:</span>
                        <span className="font-bold text-amber-400">{storeShiftLightRpm} RPM</span>
                    </div>
                </div>
            )}

            {/* MAIN SVG GAUGE CANVAS */}
            <svg
                ref={svgRef}
                viewBox="0 0 440 440"
                className="w-full h-full max-w-[650px] aspect-square drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)] cursor-pointer"
                onClick={handleRimClick}
            >
                <defs>
                    {/* Metallic Outer Ring Gradient */}
                    <radialGradient id="bezel-metal-radial" cx="50%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#F8FAFC" />
                        <stop offset="25%" stopColor="#CBD5E1" />
                        <stop offset="50%" stopColor="#64748B" />
                        <stop offset="85%" stopColor="#1E293B" />
                        <stop offset="100%" stopColor="#0F172A" />
                    </radialGradient>

                    <linearGradient id="bezel-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#94A3B8" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
                    </linearGradient>

                    {/* Hex Bolt Gradients */}
                    <radialGradient id="bolt-grad" cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#E2E8F0" />
                        <stop offset="60%" stopColor="#475569" />
                        <stop offset="100%" stopColor="#0F172A" />
                    </radialGradient>

                    {/* Cyber Neon Fan Wedge Gradient */}
                    <linearGradient id="wedge-cyber-neon" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.85" />
                        <stop offset="50%" stopColor="#A855F7" stopOpacity="0.9" />
                        <stop offset="80%" stopColor="#EC4899" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity="1.0" />
                    </linearGradient>

                    {/* GR Spec Wedge Gradient */}
                    <linearGradient id="wedge-gr-spec" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
                        <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#DC2626" stopOpacity="0.95" />
                    </linearGradient>

                    {/* White Spec Wedge Gradient */}
                    <linearGradient id="wedge-white-spec" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0284C7" stopOpacity="0.3" />
                        <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity="0.8" />
                    </linearGradient>

                    {/* Glass Reflection Highlight Gradient */}
                    <linearGradient id="glass-shine" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
                        <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>

                    {/* Drop Shadows */}
                    <filter id="gauge-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000000" floodOpacity="0.8" />
                    </filter>

                    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* --- 1. OUTER HEAVY ALUMINUM BEZEL / CASING --- */}
                <g filter="url(#gauge-shadow)">
                    {/* Outer Bezel Base Circle */}
                    <circle cx={cx} cy={cy} r="218" fill="url(#bezel-metal-radial)" stroke="#334155" strokeWidth="2" />
                    <circle cx={cx} cy={cy} r="217" fill="none" stroke="url(#bezel-highlight)" strokeWidth="3" />
                    
                    {/* Flat-bottom bevel contour detailing */}
                    <path
                        d={`M 80,420 L 360,420 A 215,215 0 1,0 80,420 Z`}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="1.5"
                        opacity="0.6"
                    />

                    {/* Inner Metallic Bezel Step Ring */}
                    <circle cx={cx} cy={cy} r="192" fill="#020617" stroke="#475569" strokeWidth="4" />
                    <circle cx={cx} cy={cy} r="188" fill="none" stroke="#000000" strokeWidth="3" opacity="0.8" />
                </g>

                {/* --- 2. PERIMETER HEX BOLTS (10 SOCKET HEAD CAP SCREWS) --- */}
                {bezelBolts.map((bolt) => (
                    <g key={bolt.id} transform={`translate(${bolt.x}, ${bolt.y})`}>
                        {/* Outer bolt head */}
                        <circle cx="0" cy="0" r="7.5" fill="url(#bolt-grad)" stroke="#0F172A" strokeWidth="1" />
                        {/* Inner hex socket hole */}
                        <polygon
                            points="-3,-5 3,-5 6,0 3,5 -3,5 -6,0"
                            fill="#090D16"
                            stroke="#334155"
                            strokeWidth="0.8"
                        />
                    </g>
                ))}

                {/* --- 3. GAUGE DIAL FACE BACKGROUND --- */}
                <g id="dial-face">
                    <circle cx={cx} cy={cy} r={rFace} fill={themeStyles.bgFill} />

                    {/* Cyber Grid Pattern Overlay (if dark theme) */}
                    {themeStyles.isDark && (
                        <g opacity="0.6">
                            {/* Perspective Radial & Cross Grid Lines */}
                            <circle cx={cx} cy={cy} r="140" fill="none" stroke={themeStyles.gridStroke} strokeWidth="1" strokeDasharray="3 3" />
                            <circle cx={cx} cy={cy} r="100" fill="none" stroke={themeStyles.gridStroke} strokeWidth="1" strokeDasharray="2 2" />
                            <circle cx={cx} cy={cy} r="60" fill="none" stroke={themeStyles.gridStroke} strokeWidth="1" strokeDasharray="2 2" />
                            <line x1={cx - 160} y1={cy} x2={cx + 160} y2={cy} stroke={themeStyles.gridStroke} strokeWidth="1" />
                            <line x1={cx} y1={cy - 160} x2={cx} y2={cy + 160} stroke={themeStyles.gridStroke} strokeWidth="1" />
                            <line x1={cx - 110} y1={cy - 110} x2={cx + 110} y2={cy + 110} stroke={themeStyles.gridStroke} strokeWidth="0.8" />
                            <line x1={cx - 110} y1={cy + 110} x2={cx + 110} y2={cy - 110} stroke={themeStyles.gridStroke} strokeWidth="0.8" />
                        </g>
                    )}

                    {/* Redline Outer Sector Arc */}
                    <path
                        d={describeArc(cx, cy, rTicks + 6, shiftAngle, endAngle)}
                        fill="none"
                        stroke={themeStyles.redlineArc}
                        strokeWidth="8"
                        strokeLinecap="round"
                        opacity={themeStyles.isDark ? "0.9" : "0.85"}
                        filter={themeStyles.isDark ? "url(#neon-glow)" : undefined}
                    />

                    {/* Inner Track Arc Line */}
                    <path
                        d={describeArc(cx, cy, rTicks - 18, startAngle, endAngle)}
                        fill="none"
                        stroke={themeStyles.isDark ? "#1E293B" : "#CBD5E1"}
                        strokeWidth="2"
                    />
                </g>

                {/* --- 4. SWEEPING WEDGE GRADIENT FAN (CYBER / GR SPEC) --- */}
                {effectiveRpm > 100 && (
                    <g id="fan-wedge">
                        <path
                            d={describeWedgeFan(cx, cy, rTicks - 40, rTicks + 2, startAngle, currentAngle)}
                            fill={themeStyles.wedgeGradient}
                            filter={themeStyles.isDark ? "url(#neon-glow)" : undefined}
                            opacity="0.85"
                        />
                    </g>
                )}

                {/* --- 5. TICKS AND NUMERALS (0 TO 10 x1000) --- */}
                <g id="ticks-and-numbers">
                    {ticks.map((t, idx) => (
                        <g key={idx}>
                            <line
                                x1={t.tickPos1.x}
                                y1={t.tickPos1.y}
                                x2={t.tickPos2.x}
                                y2={t.tickPos2.y}
                                stroke={t.isRedline ? themeStyles.redlineNumColor : t.isMajor ? themeStyles.majorTick : themeStyles.minorTick}
                                strokeWidth={t.isMajor ? (t.isRedline ? "3.5" : "3") : "1.5"}
                                opacity={t.isMajor ? 1 : 0.65}
                            />

                            {/* Major Numerals (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10) */}
                            {t.isMajor && (
                                <text
                                    x={t.textPos.x}
                                    y={t.textPos.y + 6}
                                    textAnchor="middle"
                                    fill={t.isRedline ? themeStyles.redlineNumColor : themeStyles.numColor}
                                    className="font-display font-black tracking-tighter"
                                    fontSize={t.val >= 10 ? "20" : "22"}
                                    filter={themeStyles.isDark && t.isRedline ? "url(#neon-glow)" : undefined}
                                >
                                    {t.val}
                                </text>
                            )}
                        </g>
                    ))}
                </g>

                {/* --- 6. SHIFT LIGHT LED ARRAY (TOP RIGHT PERIMETER ARC) --- */}
                <g id="shift-lights">
                    <text
                        x="332"
                        y="82"
                        fill={isShiftRedlineHit ? "#EF4444" : themeStyles.isDark ? "#10B981" : "#059669"}
                        className="font-mono font-black tracking-widest text-[10px]"
                        filter={isShiftRedlineHit ? "url(#neon-glow)" : undefined}
                    >
                        SHIFT
                    </text>

                    {shiftLeds.map((led) => (
                        <circle
                            key={led.id}
                            cx={led.x}
                            cy={led.y}
                            r="5"
                            fill={led.isActive ? led.activeColor : themeStyles.isDark ? "#0F172A" : "#CBD5E1"}
                            stroke={led.isActive ? "#FFFFFF" : "#334155"}
                            strokeWidth="1"
                            filter={led.isActive ? "url(#neon-glow)" : undefined}
                        />
                    ))}

                    {/* Strobe Shift Light Alert Flash when hit */}
                    {isShiftRedlineHit && (
                        <circle
                            cx="370"
                            cy="90"
                            r="14"
                            fill="#EF4444"
                            className="animate-ping opacity-75"
                        />
                    )}
                </g>

                {/* --- 7. LOGO BRANDING & CENTER MESSAGES --- */}
                <g id="branding-logos" textAnchor="middle">
                    {currentBrand === 'cartelworx' && (
                        <g transform={`translate(${cx}, ${cy + 52})`}>
                            <text fill={themeStyles.logoMain} className="font-display font-black tracking-[0.25em] text-[15px] italic">
                                CARTELWORX
                            </text>
                            <text y="14" fill={themeStyles.logoSub} className="font-mono font-bold tracking-[0.3em] text-[8px] uppercase">
                                PERFORMANCE RACING
                            </text>
                        </g>
                    )}

                    {currentBrand === 'toyota_gr' && (
                        <g transform={`translate(${cx}, ${cy + 50})`}>
                            <text fill="#FFFFFF" className="font-display font-black tracking-widest text-[13px]">
                                TOYOTA <tspan fill="#EF4444">GR</tspan> DIVISION
                            </text>
                            <text y="14" fill="#94A3B8" className="font-mono font-bold tracking-[0.2em] text-[8px] uppercase">
                                GAZOO RACING PERFORMANCE
                            </text>
                        </g>
                    )}

                    {currentBrand === 'genesis_os' && (
                        <g transform={`translate(${cx}, ${cy + 52})`}>
                            <text fill="#A855F7" className="font-display font-black tracking-[0.2em] text-[14px]">
                                GENESIS OS
                            </text>
                            <text y="14" fill="#00F0FF" className="font-mono font-bold tracking-[0.25em] text-[8px] uppercase">
                                KINEMATIC FUSION V5.0
                            </text>
                        </g>
                    )}
                </g>

                {/* --- 8. CENTER DIGITAL RPM DISPLAY --- */}
                <g id="center-digital-readout" transform={`translate(${cx}, ${cy - 48})`} textAnchor="middle">
                    <text
                        fill={themeStyles.centerReadout}
                        className="font-display font-black tracking-tighter text-[42px] tabular-nums"
                        filter={themeStyles.isDark ? "url(#neon-glow)" : undefined}
                    >
                        {Math.round(effectiveRpm)}
                    </text>
                    <text y="22" fill={themeStyles.centerUnit} className="font-mono font-black tracking-[0.25em] text-[10px] uppercase">
                        RPM <tspan fontSize="8px">x1000</tspan>
                    </text>
                </g>

                {/* --- 9. WARNING INDICATOR LAMPS (OIL, TEMP, BATT) --- */}
                <g id="warning-indicators" transform={`translate(${cx}, ${cy + 8})`}>
                    {/* Oil Lamp */}
                    <g transform="translate(-65, 0)">
                        <Droplet
                            x="-8"
                            y="-8"
                            className={`w-4 h-4 ${storeOilPressure < 1.5 ? 'text-red-500 animate-bounce' : 'text-cyan-400 opacity-60'}`}
                        />
                    </g>
                    {/* Coolant Temp Lamp */}
                    <g transform="translate(35, 0)">
                        <Thermometer
                            x="-8"
                            y="-8"
                            className={`w-4 h-4 ${storeCoolantTemp > 105 ? 'text-red-500 animate-pulse' : 'text-cyan-400 opacity-60'}`}
                        />
                    </g>
                    {/* Battery Lamp */}
                    <g transform="translate(60, 0)">
                        <Battery
                            x="-8"
                            y="-8"
                            className={`w-4 h-4 ${storeBatteryV < 11.5 ? 'text-red-500 animate-pulse' : 'text-cyan-400 opacity-60'}`}
                        />
                    </g>
                </g>

                {/* --- 10. BOTTOM LCD GEAR & STATUS PANEL --- */}
                <g id="lcd-gear-window" transform={`translate(${cx - 60}, 338)`}>
                    {/* LCD Bezel Frame */}
                    <rect x="0" y="0" width="120" height="38" rx="6" fill={themeStyles.lcdBg} stroke="#334155" strokeWidth="2" />
                    <rect x="2" y="2" width="116" height="34" rx="4" fill="none" stroke="#0F172A" strokeWidth="1" />
                    
                    {/* Backlight Glow */}
                    <rect x="4" y="4" width="112" height="30" rx="3" fill={themeStyles.isDark ? "rgba(192, 132, 252, 0.08)" : "rgba(56, 189, 248, 0.1)"} />

                    {/* Gear Text */}
                    <text x="24" y="24" fill="#94A3B8" className="font-mono font-bold tracking-widest text-[11px]">
                        GEAR
                    </text>
                    <text
                        x="78"
                        y="27"
                        fill={themeStyles.lcdText}
                        className="font-display font-black text-[22px] tracking-tight"
                        filter="url(#neon-glow)"
                    >
                        {effectiveGear === 0 ? 'N' : effectiveGear === -1 ? 'R' : effectiveGear}
                    </text>
                </g>

                {/* --- 11. SWEEPING PHYSICAL NEEDLE & PEAK HOLD MARKER --- */}
                {/* Peak RPM Hold Marker Line */}
                {peakRpm > 0 && (
                    <line
                        x1={polarToCartesian(cx, cy, rTicks - 35, peakAngle).x}
                        y1={polarToCartesian(cx, cy, rTicks - 35, peakAngle).y}
                        x2={polarToCartesian(cx, cy, rTicks + 2, peakAngle).x}
                        y2={polarToCartesian(cx, cy, rTicks + 2, peakAngle).y}
                        stroke="#EC4899"
                        strokeWidth="3"
                        strokeDasharray="2 2"
                        opacity="0.8"
                    />
                )}

                {/* Main Physical Sweeping Needle */}
                <g id="sweeping-needle" transform={`rotate(${currentAngle - 90}, ${cx}, ${cy})`}>
                    {/* Shadow under needle */}
                    <path
                        d={`M ${cx - 5},${cy + 15} L ${cx + 5},${cy + 15} L ${cx + 1.5},${cy - rTicks + 8} L ${cx - 1.5},${cy - rTicks + 8} Z`}
                        fill="#000000"
                        opacity="0.5"
                        transform={`translate(3, 4)`}
                    />

                    {/* Needle Body */}
                    <path
                        d={`M ${cx - 4.5},${cy + 12} L ${cx + 4.5},${cy + 12} L ${cx + 1},${cy - rTicks + 5} L ${cx - 1},${cy - rTicks + 5} Z`}
                        fill={themeStyles.needleColor}
                        filter={themeStyles.isDark ? "url(#neon-glow)" : undefined}
                    />

                    {/* Inner Needle Stripe */}
                    <line
                        x1={cx}
                        y1={cy - 10}
                        x2={cx}
                        y2={cy - rTicks + 8}
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                        opacity="0.9"
                    />
                </g>

                {/* Needle Hub Center Boss Cap */}
                <g id="needle-hub">
                    <circle cx={cx} cy={cy} r="18" fill="#0F172A" stroke="#475569" strokeWidth="2" />
                    <circle cx={cx} cy={cy} r="12" fill="#020617" stroke="#1E293B" strokeWidth="1" />
                    <circle cx={cx} cy={cy} r="5" fill={themeStyles.needleColor} opacity="0.8" />
                </g>

                {/* --- 12. GLASS REFLECTION / GLOSS COVER OVERLAY --- */}
                <path
                    d={`M ${cx - rFace + 10},${cy - 20} A ${rFace - 10},${rFace - 10} 0 0,1 ${cx + rFace - 10},${cy - 20} Z`}
                    fill="url(#glass-shine)"
                    pointerEvents="none"
                />
            </svg>
        </div>
    );
});

export default BespokeEliteProGauge;
