
import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import ApexiGauge from '../../components/tachometers/ApexiGauge';
import DefiGauge from '../../components/tachometers/DefiGauge';
import { motion, useTransform, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { BentoCarousel } from '../../components/dashboard/BentoCarousel';
import { PitWallPanel } from '../../components/dashboard/PitWallPanel';
import { ConnectedFooterStat, ConnectedTraceGraph } from '../../components/dashboard/DashboardWidgets';
import { AppearanceContext, ColorPalette } from '../../contexts/AppearanceContext';

const ConnectedText: React.FC<{ value?: number, dataKey?: string, fixed?: number, className?: string, style?: React.CSSProperties, animateValue?: any, fusionType?: 'speed' | 'rpm' | 'none' }> = React.memo(({ value = 0, dataKey, fixed = 0, className, style, animateValue, fusionType }) => {
    const internalVal = useAnimatedValue(dataKey || value, { stiffness: 300, damping: 30, fusionType });
    const valMotion = animateValue || internalVal;

    useEffect(() => {
        if (!dataKey && !animateValue) valMotion.set(value);
    }, [value, dataKey, valMotion, animateValue]);

    const displayValue = useTransform(valMotion, (v: any) => {
        const num = typeof v === 'number' ? v : parseFloat(v as string);
        return isNaN(num) ? '0' : num.toFixed(fixed);
    });

    return <motion.span className={className} style={style}>{displayValue}</motion.span>;
});

const ConnectedGear: React.FC<{ gear?: string | number, dataKey?: string, className?: string, style?: React.CSSProperties }> = React.memo(({ gear, dataKey, className, style }) => {
    const gearMotion = useAnimatedValue(dataKey || (typeof gear === 'number' ? gear : 0), { stiffness: 400, damping: 30 });
    const [currentGear, setCurrentGear] = useState<string | number>(gear || 'N');

    useEffect(() => {
        return gearMotion.on("change", (v) => {
            const displayVal = v === 0 ? 'N' : Math.round(v);
            setCurrentGear(displayVal);
        });
    }, [gearMotion]);

    useEffect(() => {
        if (!dataKey && gear !== undefined) {
             gearMotion.set(typeof gear === 'number' ? gear : 0);
        }
    }, [gear, dataKey, gearMotion]);

    return (
        <div className="overflow-hidden h-[1.2em] flex items-center justify-center">
            <AnimatePresence mode="wait">
                <motion.span 
                    key={currentGear}
                    initial={{ y: 20, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -20, opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={className} 
                    style={style}
                >
                    {currentGear}
                </motion.span>
            </AnimatePresence>
        </div>
    );
});

const ConnectedShiftLights: React.FC<{ rpm?: number, dataKey?: string, shiftStart: number, shiftEnd: number, animateValue?: any }> = React.memo(({ rpm = 0, dataKey, shiftStart, shiftEnd, animateValue }) => {
    const internalVal = useAnimatedValue(dataKey || rpm, { stiffness: 300, damping: 30, mass: 0.5 });
    const rpmMotion = animateValue || internalVal;

    useEffect(() => {
        if (!dataKey && !animateValue) rpmMotion.set(rpm);
    }, [rpm, dataKey, rpmMotion, animateValue]);

    const segments = useMemo(() => Array.from({length: 16}).map((_, i) => ({
        id: i,
        baseColor: i < 8 ? '#22c55e' : i < 12 ? '#facc15' : '#ef4444'
    })), []);

    return (
        <div className="flex gap-1 h-2 md:h-4 w-full max-w-[400px] mb-2 justify-center px-4">
            {segments.map(({ id, baseColor }) => {
                const backgroundColor = useTransform(rpmMotion, (currentRpm: any) => {
                    const val = typeof currentRpm === 'number' ? currentRpm : 0;
                    const shiftPct = Math.max(0, Math.min(1, (val - shiftStart) / (shiftEnd - shiftStart)));
                    const activeSegments = Math.floor(shiftPct * 16);
                    const isRedline = val >= shiftEnd;
                    
                    if (isRedline) return '#ffffff';
                    if (id < activeSegments) return baseColor;
                    return 'rgba(255,255,255,0.05)';
                });

                const boxShadow = useTransform(rpmMotion, (currentRpm: any) => {
                    const val = typeof currentRpm === 'number' ? currentRpm : 0;
                    const shiftPct = Math.max(0, Math.min(1, (val - shiftStart) / (shiftEnd - shiftStart)));
                    const activeSegments = Math.floor(shiftPct * 16);
                    const isRedline = val >= shiftEnd;
                    
                    if (isRedline) return `0 0 15px #ffffff`;
                    if (id < activeSegments) return `0 0 12px ${baseColor}`;
                    return 'none';
                });

                const scale = useTransform(rpmMotion, (currentRpm: any) => {
                    return (currentRpm as number) >= shiftEnd ? 1.1 : 1;
                });

                return (
                    <motion.div 
                        key={id}
                        className="flex-1 rounded-sm transition-all duration-75 border border-white/5 skew-x-[-15deg]"
                        style={{ backgroundColor, boxShadow, scale }}
                    />
                );
            })}
        </div>
    );
});

const ApexiDashboard: React.FC = () => {
    const [isBooting, setIsBooting] = useState(true);
    const sweepMotion = useMotionValue(0);
    const sweepSpring = useSpring(sweepMotion, { stiffness: 60, damping: 15 });

    const { colorPalette, setColorPalette } = useContext(AppearanceContext);

    const [rpmWarning, setRpmWarning] = useState(() => Number(localStorage.getItem('pitwall-rpm-warn') || '7500'));
    const [turboWarning, setTurboWarning] = useState(() => Number(localStorage.getItem('pitwall-turbo-warn') || '1.5'));
    const [waterWarning, setWaterWarning] = useState(() => Number(localStorage.getItem('pitwall-water-warn') || '100'));
    const [oilWarning, setOilWarning] = useState(() => Number(localStorage.getItem('pitwall-oil-warn') || '1.5'));
    const [isPitWallOpen, setIsPitWallOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('pitwall-rpm-warn', rpmWarning.toString());
    }, [rpmWarning]);
    useEffect(() => {
        localStorage.setItem('pitwall-turbo-warn', turboWarning.toString());
    }, [turboWarning]);
    useEffect(() => {
        localStorage.setItem('pitwall-water-warn', waterWarning.toString());
    }, [waterWarning]);
    useEffect(() => {
        localStorage.setItem('pitwall-oil-warn', oilWarning.toString());
    }, [oilWarning]);

    // Color presets mapped to the global palette values
    const PALETTE_COLORS: Record<ColorPalette, string> = {
        'cyan': '#00F0FF',
        'red': '#FF003C',
        'green': '#33FF33',
        'purple': '#BC13FE',
        'amber': '#FCEE0A'
    };

    const accentColor = PALETTE_COLORS[colorPalette] || '#00F0FF';
    const faceColor = '#050505';

    const colorPresets = useMemo(() => [
        { name: 'Apexi Blue', face: '#050505', accent: '#00F0FF', palette: 'cyan' },
        { name: 'Nismo Red', face: '#050505', accent: '#FF003C', palette: 'red' },
        { name: 'Spoon Yellow', face: '#050505', accent: '#FCEE0A', palette: 'amber' },
        { name: 'HKS Purple', face: '#050505', accent: '#BC13FE', palette: 'purple' },
        { name: 'Matrix Green', face: '#050505', accent: '#33FF33', palette: 'green' },
    ], []);

    const activeTheme = useMemo(() => 
        colorPresets.find(p => p.palette === colorPalette) || colorPresets[0],
    [colorPalette, colorPresets]);

    const cycleColors = () => {
        const palettes: ColorPalette[] = ['cyan', 'red', 'green', 'purple', 'amber'];
        const currentIndex = palettes.indexOf(colorPalette);
        const nextPalette = palettes[(currentIndex + 1) % palettes.length];
        setColorPalette(nextPalette);
    };

    useEffect(() => {
        let frame: number;
        let start: number;
        const duration = 2000;
        
        const animate = (time: number) => {
            if (!start) start = time;
            const progress = (time - start) / duration;
            
            if (progress < 0.4) {
                sweepMotion.set(progress / 0.4); // Sweep up to 1.0 (40% of time)
            } else if (progress < 0.8) {
                sweepMotion.set(1 - ((progress - 0.4) / 0.4)); // Sweep back down (40% of time)
            } else if (progress < 1.0) {
                 sweepMotion.set(0); // Pause at zero (20% of time)
            } else {
                setIsBooting(false);
                return;
            }
            frame = requestAnimationFrame(animate);
        };
        
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [sweepMotion]);

    const shiftStart = 5000;
    const shiftEnd = 7200;

    // Derived MotionValues for booting sequence to avoid parent re-renders
    const bootRpm = useTransform(sweepSpring, [0, 1], [0, 9000]);
    const bootSpeed = useTransform(sweepSpring, [0, 1], [0, 280]);
    const bootBoost = useTransform(sweepSpring, [0, 1], [-1.0, 2.5]);
    const bootWater = useTransform(sweepSpring, [0, 1], [20, 120]);
    const bootOil = useTransform(sweepSpring, [0, 1], [0, 10]);
    const bootVolt = useTransform(sweepSpring, [0, 1], [8, 18]);

    return (
        <div className="w-full min-h-screen bg-[#020202] flex flex-col overflow-y-auto overflow-x-hidden relative select-none font-sans no-scrollbar">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,#000_100%)] pointer-events-none" style={{ background: `radial-gradient(circle_at_center, ${accentColor}10 0%, #000 100%)` }}></div>
            
            {/* Scanlines Effect - Hidden on mobile for performance */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50 shadow-[inset_0_0_100px_rgba(0,0,0,1)] hidden md:block" style={{ 
                backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                backgroundSize: '100% 4px'
            }}></div>

            {/* TOP BAR (Speed/Gear) */}
            <div className="w-full mx-auto flex justify-center items-center pt-4 md:pt-6 z-20 relative px-4 shrink-0">
                <div className="flex flex-col items-center gap-1 w-full">
                    <div className="flex items-center gap-2 md:gap-4 bg-black/95 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-[1rem] border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none opacity-20"></div>
                        <div className="flex flex-col items-center border-r border-white/10 pr-4 md:pr-6 min-w-[50px] md:min-w-[80px]">
                            {isBooting ? (
                                <span className="text-2xl md:text-3xl 2xl:text-[2.5rem] font-display font-black text-white italic leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">N</span>
                            ) : (
                                <ConnectedGear dataKey="gear" className="text-2xl md:text-3xl 2xl:text-[2.5rem] font-display font-black text-white italic leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
                            )}
                            <span className="text-[6px] md:text-[8px] 2xl:text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mt-0.5 opacity-90 font-technical">GEAR</span>
                        </div>
                        <div className="flex items-baseline gap-1 md:gap-2 min-w-[80px] md:min-w-[120px] justify-center">
                            <ConnectedText 
                                dataKey={isBooting ? undefined : "speed"} 
                                fusionType={isBooting ? undefined : "speed"}
                                animateValue={isBooting ? bootSpeed : undefined}
                                className="text-3xl md:text-4xl 2xl:text-[3rem] font-display font-black text-white tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] tabular-nums" 
                            />
                            <div className="flex flex-col items-start translate-y-[-2px] md:translate-y-[-4px]">
                                <span className="text-[6px] md:text-[8px] 2xl:text-[10px] font-black text-brand-red uppercase tracking-[0.3em] drop-shadow-[0_0_10px_rgba(255,0,60,0.6)] font-technical">KM/H</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-full max-w-[220px] md:max-w-[300px] 2xl:max-w-[400px] mt-1">
                        <ConnectedShiftLights 
                            dataKey={isBooting ? undefined : "rpm"} 
                            animateValue={isBooting ? bootRpm : undefined}
                            shiftStart={shiftStart} 
                            shiftEnd={shiftEnd} 
                        />
                    </div>
                </div>
            </div>

            {/* MAIN CLUSTER */}
            <div className="flex-1 w-full max-w-7xl 2xl:max-w-[100vw] mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 md:gap-8 lg:gap-12 2xl:gap-16 px-4 sm:px-8 py-2 md:py-8 lg:py-2 relative z-10 min-h-0">
                
                {/* Left Column (Swipeable Bento & Systems Overview) */}
                <div className="flex flex-col gap-4 w-full lg:w-80 shrink-0 order-2 lg:order-1 pt-4">
                    {/* Swipeable Bento Box Carousel */}
                    <div className="w-full">
                        <BentoCarousel accentColor={accentColor} />
                    </div>

                    {/* Systems Overview Card */}
                    <div className="bg-black/80 border border-white/5 rounded-2xl p-5 lg:p-6 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}A0, transparent)` }}></div>
                        <h2 className="text-white/50 text-xs font-black uppercase tracking-[0.3em] font-display mb-6 pb-2 border-b border-white/5">Systems Overview</h2>
                        
                        <div className="flex flex-col gap-4">
                            {[
                                { label: "OIL PRESSURE", dataKey: "oilPressure", unit: "BAR", val: bootOil, fusionType: "none", color: accentColor },
                                { label: "FUEL PRESSURE", dataKey: "fuelPressure", unit: "BAR", val: 3.5, fusionType: "none", color: accentColor },
                                { label: "WATER TEMP", dataKey: "engineTemp", unit: "°C", val: bootWater, fusionType: "none", color: accentColor },
                                { label: "INTAKE TEMP", dataKey: "inletAirTemp", unit: "°C", val: 25, fusionType: "none", color: accentColor },
                                { label: "BATTERY VOLTS", dataKey: "batteryVoltage", unit: "V", val: bootVolt, fusionType: "none", color: accentColor },
                                { label: "ENGINE LOAD", dataKey: "engineLoad", unit: "%", val: 15, fusionType: "none", color: "#facc15" },
                            ].map((stat, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] text-gray-500 font-bold tracking-wider">{stat.label}</span>
                                        <div className="flex items-baseline gap-1">
                                            <ConnectedText 
                                                dataKey={isBooting ? undefined : stat.dataKey}
                                                animateValue={isBooting && typeof stat.val !== 'number' ? stat.val : undefined}
                                                value={isBooting && typeof stat.val === 'number' ? stat.val : 0}
                                                className="text-lg font-mono text-white leading-none font-bold tabular-nums"
                                                fixed={1}
                                            />
                                            <span className="text-[9px] text-gray-600 font-bold">{stat.unit}</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 mx-auto rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-300" style={{ width: '75%', backgroundColor: stat.color, opacity: 0.8 }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center (RPM) - Priority 1 */}
                <div className="w-full max-w-[85vw] xs:max-w-[340px] sm:max-w-[450px] md:max-w-[550px] lg:max-w-[650px] 2xl:max-w-[800px] flex-grow aspect-square flex items-center justify-center order-1 lg:order-2 relative group p-2 min-h-[180px]">
                    <div className="absolute -inset-20 bg-brand-cyan opacity-[0.05] blur-[150px] rounded-full pointer-events-none" style={{ backgroundColor: accentColor }}></div>
                    
                    {/* Theme Selector UI & Pit Wall Trigger */}
                    <div className="absolute top-0 right-0 z-50 flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={cycleColors}
                            className="p-1.5 sm:p-3 bg-black/70 hover:bg-black/90 border border-white/10 rounded-full text-[6px] sm:text-xs font-black text-white uppercase tracking-widest transition-all backdrop-blur-md flex items-center gap-2 sm:gap-3 shadow-2xl"
                        >
                            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: accentColor }}></div>
                            <span className="hidden sm:inline">{activeTheme.name}</span>
                        </motion.button>
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsPitWallOpen(true)}
                            className="p-1.5 sm:p-3 bg-black/70 hover:bg-black/90 border border-[#FF003C]/30 hover:border-[#FF003C]/60 rounded-full text-[6px] sm:text-xs font-black text-white uppercase tracking-widest transition-all backdrop-blur-md flex items-center gap-2 sm:gap-3 shadow-2xl animate-pulse"
                        >
                            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#FF003C] shadow-[0_0_10px_#FF003C]"></div>
                            <span className="hidden sm:inline">PIT WALL</span>
                        </motion.button>
                    </div>

                    <div className="w-full h-full relative">
                        <ApexiGauge 
                            label="RPM"
                            unit="MIN-1 X1000"
                            value={isBooting ? 0 : undefined} 
                            dataKey={isBooting ? undefined : "rpm"}
                            fusionType={isBooting ? undefined : "rpm"}
                            animateValue={isBooting ? bootRpm : undefined}
                            min={0}
                            max={9000}
                            majorStep={1000}
                            minorStep={200}
                            warningAt={rpmWarning}
                            decimalPlaces={0}
                            size="100%"
                            faceColor={faceColor}
                            accentColor={accentColor}
                        />
                    </div>
                </div>

                {/* Right Column (Defi Setup) */}
                <div className="flex flex-row lg:flex-col gap-2 xs:gap-4 md:gap-8 lg:gap-8 w-full lg:w-48 xl:w-56 justify-center items-center order-3 lg:order-3 shrink-0 pt-0 lg:pt-8 flex-wrap lg:flex-nowrap">
                    <div className="w-[30vw] xs:w-32 sm:w-40 lg:w-48 xl:w-56 flex-shrink-0 aspect-square relative drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-transform hover:scale-105 duration-500">
                        <DefiGauge 
                            label="TURBO"
                            unit="x100kPa"
                            value={isBooting ? -1.0 : undefined} 
                            dataKey={isBooting ? undefined : "turboBoost"}
                            animateValue={isBooting ? bootBoost : undefined}
                            min={-1.0}
                            max={2.0}
                            majorStep={0.5}
                            redline={turboWarning}
                            accentColor={accentColor}
                        />
                    </div>
                    <div className="w-[30vw] xs:w-32 sm:w-40 lg:w-48 xl:w-56 flex-shrink-0 aspect-square relative drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-transform hover:scale-105 duration-500">
                        <DefiGauge 
                            label="WATER"
                            unit="°C"
                            value={isBooting ? 20 : undefined} 
                            dataKey={isBooting ? undefined : "engineTemp"}
                            animateValue={isBooting ? bootWater : undefined}
                            min={20}
                            max={120}
                            majorStep={20}
                            redline={waterWarning}
                            accentColor={accentColor}
                        />
                    </div>
                    <div className="w-[30vw] xs:w-32 sm:w-40 lg:w-48 xl:w-56 flex-shrink-0 aspect-square relative drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-transform hover:scale-105 duration-500">
                        <DefiGauge 
                            label="OIL P"
                            unit="BAR"
                            value={isBooting ? 0 : undefined} 
                            dataKey={isBooting ? undefined : "oilPressure"}
                            animateValue={isBooting ? bootOil : undefined}
                            min={0}
                            max={10}
                            majorStep={2}
                            redline={oilWarning}
                            accentColor={accentColor}
                        />
                    </div>
                </div>
            </div>

            {/* FOOTER STATS */}
            <div className="w-full max-w-7xl 2xl:max-w-[2400px] mx-auto min-h-fit md:min-h-[6rem] grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 px-4 sm:px-8 pb-8 lg:pb-12 z-10 relative shrink-0">
                {[
                    { label: "INTAKE TEMP", dataKey: "inletAirTemp", unit: "°C", bootVal: 25 },
                    { label: "FUEL PRESSURE", dataKey: "fuelPressure", unit: "BAR", bootVal: 3.5 },
                    { label: "BRAKE TEMP", dataKey: "brakeTemp", unit: "°C", bootVal: 30 },
                    { label: "ENGINE LOAD", dataKey: "engineLoad", unit: "%", bootVal: 15 },
                ].map((stat, i) => (
                    <div key={i} className="relative overflow-hidden group transition-all h-full py-4 md:py-6 2xl:py-8 bg-black/80 border border-white/5 rounded-xl md:rounded-2xl hover:border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center">
                        <div className="absolute top-0 left-0 w-full h-[3px] md:h-[4px]" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}A0, transparent)` }}></div>
                        <ConnectedFooterStat 
                            label={stat.label} 
                            dataKey={stat.dataKey} 
                            unit={stat.unit} 
                            bootVal={stat.bootVal} 
                            isBooting={isBooting} 
                            formatFn={v => v.toFixed(stat.dataKey === 'fuelPressure' ? 1 : 0)} 
                            colorFn={(v) => stat.label === 'BRAKE TEMP' && v > 600 ? 'text-[#FF003C] drop-shadow-[0_0_12px_rgba(255,0,60,0.8)] animate-pulse' : `text-white drop-shadow-[0_0_12px_${accentColor}80]`} 
                        />
                    </div>
                ))}
            </div>
            
            <div className="fixed inset-0 pointer-events-none z-[100] opacity-10 bg-[radial-gradient(circle_at_bottom,#00F0FF_0%,transparent_60%)]" style={{ background: `radial-gradient(circle_at_bottom, ${accentColor} 0%, transparent 60%)` }}></div>

            {/* Slide-out Pit Wall Panel Drawer */}
            <PitWallPanel 
                isOpen={isPitWallOpen}
                onClose={() => setIsPitWallOpen(false)}
                accentColor={accentColor}
                rpmWarning={rpmWarning}
                setRpmWarning={setRpmWarning}
                turboWarning={turboWarning}
                setTurboWarning={setTurboWarning}
                waterWarning={waterWarning}
                setWaterWarning={setWaterWarning}
                oilWarning={oilWarning}
                setOilWarning={setOilWarning}
            />
        </div>
    );
};

export default React.memo(ApexiDashboard);
