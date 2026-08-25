import React, { useState, useEffect, useContext, useRef } from 'react';
import { AppearanceContext } from '../contexts/AppearanceContext';
import { useVehicleStore } from '../stores/vehicleStore';

// --- HUD SUB-COMPONENTS (THEME FACES) ---

const RallyFace: React.FC<{ data: any, color: string }> = ({ data, color }) => (
    <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex items-baseline gap-4">
            <span className="text-[12rem] font-black italic tracking-tighter leading-none text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                {data.gear === 0 ? 'N' : data.gear}
            </span>
            <div className="flex flex-col">
                <span className="text-8xl font-mono font-bold leading-none" style={{ color }}>
                    {data.speed.toFixed(0)}
                </span>
                <span className="text-xl font-bold text-gray-500 uppercase tracking-widest mt-2">KM/H</span>
            </div>
        </div>
        
        {/* RPM Bar */}
        <div className="w-full max-w-3xl mt-8 flex items-center gap-4">
            <span className="text-2xl font-bold text-gray-500 w-16 text-right">RPM</span>
            <div className="flex-1 h-12 bg-gray-900 border-2 border-gray-700 skew-x-[-15deg] p-1">
                <div 
                    className="h-full bg-white transition-all duration-75"
                    style={{ width: `${Math.min(100, (data.rpm / 9000) * 100)}%` }}
                ></div>
            </div>
            <span className="text-4xl font-mono font-bold text-white w-24">{data.rpm.toFixed(0)}</span>
        </div>
    </div>
);

const ModernFace: React.FC<{ data: any, color: string }> = ({ data, color }) => (
    <div className="flex items-center justify-between w-full max-w-5xl px-10">
        {/* Left: Boost */}
        <div className="flex flex-col items-end border-r-4 pr-8 border-white/20">
            <span className="text-2xl font-display font-bold text-gray-500 uppercase tracking-widest">Boost</span>
            <span className="text-8xl font-display font-black text-white">{data.turboBoost.toFixed(1)}</span>
            <span className="text-xl text-gray-500">BAR</span>
        </div>

        {/* Center: Speed */}
        <div className="flex flex-col items-center">
            <span className="text-[14rem] font-display font-black leading-none tracking-tighter" style={{ color, textShadow: `0 0 40px ${color}` }}>
                {data.speed.toFixed(0)}
            </span>
            <div className="flex items-center gap-4 mt-2">
                <span className="text-2xl font-bold bg-white text-black px-4 py-1 rounded">
                    {data.gear === 0 ? 'N' : data.gear}
                </span>
                <span className="text-xl font-bold text-white uppercase tracking-[0.5em]">KM/H</span>
            </div>
        </div>

        {/* Right: RPM */}
        <div className="flex flex-col items-start border-l-4 pl-8 border-white/20">
            <span className="text-2xl font-display font-bold text-gray-500 uppercase tracking-widest">Rev</span>
            <span className="text-8xl font-display font-black text-white">{(data.rpm / 1000).toFixed(1)}</span>
            <span className="text-xl text-gray-500">x1000</span>
        </div>
    </div>
);

const HaltechFace: React.FC<{ data: any, color: string }> = ({ data, color }) => (
    <div className="grid grid-cols-2 gap-8 w-full max-w-4xl">
        <div className="flex flex-col items-start border-b-2 border-white/20 pb-4">
            <span className="text-xl font-mono text-gray-500 mb-2">RPM</span>
            <span className="text-9xl font-mono font-bold text-white leading-none">{data.rpm.toFixed(0)}</span>
        </div>
        <div className="flex flex-col items-end border-b-2 border-white/20 pb-4">
            <span className="text-xl font-mono text-gray-500 mb-2">SPEED</span>
            <span className="text-9xl font-mono font-bold leading-none" style={{ color }}>{data.speed.toFixed(0)}</span>
        </div>
        <div className="flex flex-col items-start pt-4">
            <span className="text-xl font-mono text-gray-500 mb-2">AFR</span>
            <span className="text-7xl font-mono font-bold text-white">{(data.o2SensorVoltage * 2 + 9).toFixed(1)}</span>
        </div>
        <div className="flex flex-col items-end pt-4">
            <span className="text-xl font-mono text-gray-500 mb-2">BOOST</span>
            <span className="text-7xl font-mono font-bold text-white">{data.turboBoost.toFixed(1)} <span className="text-2xl text-gray-500">PSI</span></span>
        </div>
    </div>
);

const MinimalistFace: React.FC<{ data: any, color: string }> = ({ data }) => (
    <div className="flex flex-col items-center">
        <div className="flex items-start gap-2">
            <span className="text-[16rem] font-sans font-thin text-white leading-none tracking-tighter">
                {data.speed.toFixed(0)}
            </span>
            <span className="text-2xl font-bold text-gray-500 mt-12">KMH</span>
        </div>
        {/* Simple RPM Line */}
        <div className="w-[600px] h-1 bg-gray-800 mt-4 overflow-hidden rounded-full">
            <div className="h-full bg-white" style={{ width: `${(data.rpm / 8500) * 100}%` }}></div>
        </div>
        <div className="flex justify-between w-[600px] mt-2 text-sm font-mono text-gray-500">
            <span>{data.gear === 0 ? 'N' : data.gear} GEAR</span>
            <span>{data.rpm.toFixed(0)} RPM</span>
        </div>
    </div>
);

// --- MAIN OPTICAL COMPONENT ---

const HeadUpDisplay: React.FC = () => {
    const shiftLightRpm = useVehicleStore(state => state.shiftLightRpm);
    const { theme, colorPalette } = useContext(AppearanceContext);
    
    // Optical State
    const [isMirrored, setIsMirrored] = useState(true); // Default to mirror for HUD
    const [isFlipped, setIsFlipped] = useState(false);
    const [keystone, setKeystone] = useState(0); // Perspective correction
    const [brightness, setBrightness] = useState(100);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<any>(null);

    const [latestData, setLatestData] = useState<any>({
        rpm: 0, speed: 0, gear: 0, turboBoost: 0, o2SensorVoltage: 0
    });
    
    useEffect(() => {
        let rafId: number;
        let frameCount = 0;
        const loop = () => {
            frameCount++;
            if (frameCount % 3 === 0) { // 20Hz update rate
                const state = useVehicleStore.getState();
                setLatestData(state.latestData);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    // Shift Logic
    const isShift = latestData.rpm >= shiftLightRpm;
    const accentColor = colorPalette === 'red' ? '#FF003C' : colorPalette === 'green' ? '#33FF33' : colorPalette === 'purple' ? '#BC13FE' : colorPalette === 'amber' ? '#FCEE0A' : '#00F0FF';

    // Auto-hide controls
    useEffect(() => {
        resetControlsTimeout();
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
    };

    const handleInteraction = () => {
        resetControlsTimeout();
    };

    // Render the correct face based on global theme
    const renderFace = () => {
        switch (theme) {
            case 'rally': return <RallyFace data={latestData} color={accentColor} />;
            case 'modern': return <ModernFace data={latestData} color={accentColor} />;
            case 'haltech': return <HaltechFace data={latestData} color={accentColor} />;
            case 'minimalist': return <MinimalistFace data={latestData} color={accentColor} />;
            default: return <RallyFace data={latestData} color={accentColor} />; // Fallback
        }
    };

    return (
        <div 
            className="w-full h-full bg-black relative overflow-hidden flex flex-col items-center justify-center select-none"
            onClick={handleInteraction}
            onTouchStart={handleInteraction}
        >
            {/* --- PROJECTION LAYER --- */}
            {/* This container applies the optical corrections */}
            <div 
                className="relative z-10 transition-all duration-300 ease-out"
                style={{
                    transform: `
                        scaleX(${isMirrored ? -1 : 1}) 
                        scaleY(${isFlipped ? -1 : 1}) 
                        perspective(800px) 
                        rotateX(${keystone}deg)
                    `,
                    opacity: brightness / 100,
                    filter: `brightness(${brightness}%) contrast(1.2)`
                }}
            >
                {/* Shift Flash Overlay (in projection space) */}
                {isShift && (
                    <div className="absolute -inset-20 bg-red-600 animate-pulse mix-blend-screen opacity-40 blur-xl rounded-full"></div>
                )}
                
                {renderFace()}
            </div>

            {/* --- OPTICS CONTROL PANEL (Not Projected) --- */}
            <div 
                className={`fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent transition-transform duration-500 z-50 ${showControls ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
            >
                <div className="max-w-2xl mx-auto flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-brand-cyan font-bold uppercase tracking-widest text-xs">HUD Optical Engine</h3>
                        <button className="text-gray-500 text-xs uppercase" onClick={() => setShowControls(false)}>Hide</button>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-4">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMirrored(!isMirrored); }}
                            className={`flex-1 py-3 rounded border font-bold text-xs uppercase tracking-widest ${isMirrored ? 'bg-brand-cyan text-black border-brand-cyan' : 'bg-white/5 border-white/20 text-gray-400'}`}
                        >
                            Mirror {isMirrored ? 'ON' : 'OFF'}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                            className={`flex-1 py-3 rounded border font-bold text-xs uppercase tracking-widest ${isFlipped ? 'bg-brand-cyan text-black border-brand-cyan' : 'bg-white/5 border-white/20 text-gray-400'}`}
                        >
                            Flip {isFlipped ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Sliders */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                <span>Keystone</span>
                                <span>{keystone}°</span>
                            </div>
                            <input 
                                type="range" min="-45" max="45" value={keystone}
                                onChange={(e) => setKeystone(Number(e.target.value))}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                <span>Brightness</span>
                                <span>{brightness}%</span>
                            </div>
                            <input 
                                type="range" min="10" max="100" value={brightness}
                                onChange={(e) => setBrightness(Number(e.target.value))}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                            />
                        </div>
                    </div>
                    
                    <p className="text-[9px] text-gray-600 text-center mt-2">
                        Tip: Place device on dashboard. Use Keystone to align projection with road horizon.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HeadUpDisplay;