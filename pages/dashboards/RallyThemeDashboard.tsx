
import React, { useContext } from 'react';
import { motion, AnimatePresence, useTransform, useMotionValue } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { AppearanceContext } from '../../contexts/AppearanceContext';
import { ConnectedRallyDataBlock, StageTimer } from '../../components/dashboard/DashboardWidgets';
import LiveAICoach from '../../components/widgets/LiveAICoach';

const ConnectedRallyGear: React.FC = () => {
    const gearMotion = useAnimatedValue("gear", { stiffness: 300, damping: 30 });
    const rpmMotion = useAnimatedValue("rpm", { stiffness: 180, damping: 22 });
    
    const [gear, setGear] = React.useState<string | number>('N');
    const [isRedline, setIsRedline] = React.useState(false);

    React.useEffect(() => {
        const unsubs = [
            gearMotion.on("change", (v) => {
                const display = v === 0 ? 'N' : Math.round(v);
                setGear(display);
            }),
            rpmMotion.on("change", (v) => {
                setIsRedline(v > 7000);
            })
        ];
        return () => unsubs.forEach(u => u());
    }, [gearMotion, rpmMotion]);

    return (
        <motion.div 
            animate={{ 
                borderColor: isRedline ? '#ef4444' : 'var(--theme-color)',
                scale: isRedline ? [1, 1.05, 1] : 1,
                boxShadow: isRedline ? '0 0 60px rgba(239, 68, 68, 0.4)' : '0 0 60px rgba(0,0,0,0.8)'
            }}
            transition={{ duration: 0.2, repeat: isRedline ? Infinity : 0 }}
            className="w-48 h-48 lg:w-64 lg:h-64 rounded-full border-8 bg-[#0a0a0a] flex items-center justify-center z-10 relative"
        >
            <div className="absolute inset-2 border border-dashed border-gray-600 rounded-full animate-[spin-slow_10s_linear_infinite] opacity-50"></div>
            
            <AnimatePresence mode="wait">
                <motion.span 
                    key={gear}
                    initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 1.5, rotate: 20 }}
                    className="text-[10rem] lg:text-[12rem] font-black text-white italic leading-none" 
                    style={{ textShadow: '5px 5px 0px #333' }}
                >
                    {gear}
                </motion.span>
            </AnimatePresence>
            
            <span className="absolute bottom-6 text-sm font-bold bg-white text-black px-2 uppercase tracking-widest">Gear</span>
        </motion.div>
    );
};

const ConnectedRallySpeed: React.FC = () => {
    const valMotion = useAnimatedValue("speed", { stiffness: 180, damping: 22 });
    const [isFast, setIsFast] = React.useState(false);

    React.useEffect(() => {
        return valMotion.on("change", (v) => {
            setIsFast(v > 100);
        });
    }, [valMotion]);

    const displayValue = useTransform(valMotion, (v: number) => v.toFixed(0));

    return (
        <motion.div 
            animate={{ scale: isFast ? 1.05 : 1 }}
            className="absolute -bottom-6 -right-10 lg:-right-20 bg-[var(--theme-color)] text-black px-6 py-2 transform skew-x-[-15deg] border-4 border-white shadow-xl z-20"
        >
            <div className="skew-x-[15deg] text-center">
                <motion.span className="text-5xl lg:text-7xl font-black block tracking-tighter leading-none">
                    {displayValue}
                </motion.span>
                <span className="text-xs font-bold uppercase tracking-[0.4em] block border-t-2 border-black mt-1 pt-1">KM/H</span>
            </div>
        </motion.div>
    );
};

const ConnectedRallyOverheat: React.FC = () => {
    const tempMotion = useAnimatedValue("engineTemp");
    const [isOverheat, setIsOverheat] = React.useState(false);

    React.useEffect(() => {
        return tempMotion.on("change", (v) => {
            setIsOverheat(v > 105);
        });
    }, [tempMotion]);

    return (
        <motion.span 
            animate={{ 
                backgroundColor: isOverheat ? '#dc2626' : '#1f2937',
                color: isOverheat ? '#ffffff' : '#9ca3af'
            }}
            className="px-2 py-0.5 text-[10px] font-bold uppercase skew-x-[-12deg]"
        >
            {isOverheat ? 'OVERHEAT' : 'TEMPS OK'}
        </motion.span>
    );
};

const ConnectedRallyGForce: React.FC = () => {
    const gMotion = useAnimatedValue("gForceY");
    const [accel, setAccel] = React.useState(false);
    const [brake, setBrake] = React.useState(false);

    React.useEffect(() => {
        return gMotion.on("change", (v) => {
            setAccel(v > 0.5);
            setBrake(v < -0.5);
        });
    }, [gMotion]);

    return (
        <div className="flex gap-4">
            <div className="flex items-center gap-2">
                <motion.div 
                    animate={{ backgroundColor: accel ? '#22c55e' : '#4b5563' }}
                    className="w-2 h-2 rounded-full"
                ></motion.div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ACCEL</span>
            </div>
            <div className="flex items-center gap-2">
                <motion.div 
                    animate={{ backgroundColor: brake ? '#ef4444' : '#4b5563' }}
                    className="w-2 h-2 rounded-full"
                ></motion.div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">BRAKE</span>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD ---

const RallyThemeDashboard: React.FC = () => {
    const { isImmersive } = useContext(AppearanceContext);
    
    // Vibration Physics with Motion
    const xShake = useMotionValue(0);
    const yShake = useMotionValue(0);

    React.useEffect(() => {
        // Shaking disabled for precision as requested
        xShake.set(0);
        yShake.set(0);
    }, [xShake, yShake]);

    return (
        <div className="flex flex-col h-full w-full bg-[#111] text-white overflow-hidden relative font-sans selection:bg-yellow-500">
            
            {/* CSS Var Override for Rally Theme */}
            <style>{`
                :root { --theme-color: #FCEE0A; } 
                @font-face { font-family: 'RallyFont'; src: local('Impact'), local('Arial Black'); }
            `}</style>

            {/* Dirt/Grunge Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none z-50 mix-blend-overlay" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
            }}></div>

            {/* Main Content with Vibration Effect */}
            <motion.div 
                style={{ x: xShake, y: yShake }}
                className={`flex-1 p-4 lg:p-6 grid grid-cols-12 gap-4 lg:gap-6 z-10 overflow-y-auto lg:overflow-hidden relative ${isImmersive ? 'pt-8' : ''}`}
            >
                
                {/* Left Column: Engine Health */}
                <div className="col-span-12 lg:col-span-3 flex flex-row lg:flex-col gap-3 order-2 lg:order-1">
                    <div className="flex-1"><ConnectedRallyDataBlock label="Boost" dataKey="turboBoost" unit="BAR" fixed={2} /></div>
                    <div className="flex-1"><ConnectedRallyDataBlock label="Oil Press" dataKey="oilPressure" unit="BAR" alertThreshold={1.0} alertCondition="less" /></div>
                    <div className="flex-1"><ConnectedRallyDataBlock label="Coolant" dataKey="engineTemp" unit="°C" alertThreshold={105} alertCondition="greater" fixed={0} /></div>
                    <div className="flex-1 lg:hidden xl:block"><ConnectedRallyDataBlock label="Brake Temp" dataKey="brakeTemp" unit="°C" alertThreshold={600} alertCondition="greater" fixed={0} /></div>
                </div>

                {/* Center Column: Driver Focus */}
                <div className="col-span-12 lg:col-span-6 flex flex-col items-center justify-start lg:justify-center relative order-1 lg:order-2 min-h-[300px]">
                    
                    {/* Stage Timer (Top Center) */}
                    <div className="mb-8 w-full max-w-sm">
                        <ConnectedRallyTimer />
                    </div>

                    {/* Gear & Speed Cluster */}
                    <div className="relative flex items-center justify-center">
                        {/* Gear Circle */}
                        <ConnectedRallyGear />

                        {/* Speed Plate (Behind) */}
                        <ConnectedRallySpeed />
                    </div>
                </div>

                {/* Right Column: Performance & Environment */}
                <div className="col-span-12 lg:col-span-3 flex flex-row lg:flex-col gap-3 order-3">
                    <div className="flex-1">
                        <ConnectedRallyDelta />
                    </div>
                    <div className="flex-1"><ConnectedRallyDataBlock label="Lambda" dataKey="o2SensorVoltage" unit="AFR" fixed={2} /></div>
                    <div className="flex-1"><ConnectedRallyDataBlock label="Intake" dataKey="inletAirTemp" unit="°C" fixed={0} /></div>
                    <div className="flex-1 lg:hidden xl:block"><ConnectedRallyDataBlock label="Fuel" dataKey="fuelLevel" unit="%" fixed={0} /></div>
                    
                    <div className="mt-auto hidden lg:block">
                        <LiveAICoach />
                    </div>
                </div>
            </motion.div>

            {/* Bottom Status Strip (Co-Driver Info) */}
            <div className="h-10 bg-[#080808] border-t border-[#333] flex items-center justify-between px-4 lg:px-8 z-20 shrink-0">
                 <ConnectedRallyGForce />

                 <div className="flex gap-1">
                     <span className="bg-white text-black px-2 py-0.5 text-[10px] font-bold uppercase skew-x-[-12deg]">ALS: ON</span>
                     <span className="bg-[var(--theme-color)] text-black px-2 py-0.5 text-[10px] font-bold uppercase skew-x-[-12deg]">MAP: STAGE 3</span>
                     <ConnectedRallyOverheat />
                 </div>
            </div>
        </div>
    );
};

const ConnectedRallyTimer: React.FC = () => {
    const [time, setTime] = React.useState(0);
    
    React.useEffect(() => {
        let rafId: number;
        const loop = () => {
            const state = useVehicleStore.getState();
            setTime(state.raceSession.elapsedTime || 0);
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    return <StageTimer time={time} />;
};

const ConnectedRallyDelta: React.FC = () => {
    const [delta, setDelta] = React.useState(0);
    
    React.useEffect(() => {
        let rafId: number;
        const loop = () => {
            const state = useVehicleStore.getState();
            setDelta(state.raceSession.currentDelta || 0);
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    const isPositive = delta > 0;

    return (
        <div className="relative p-3 border-b-4 border-r-4 transition-all duration-100 group overflow-hidden bg-[#151515] border-[#333] hover:bg-[#222] skew-x-[-12deg] shadow-lg flex flex-col justify-between h-24">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50"></div>
            <div className="skew-x-[12deg] flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Delta</span>
                <span className="text-[10px] font-bold text-gray-700">-</span>
            </div>
            <div className="skew-x-[12deg] flex items-baseline gap-1 mt-auto">
                <span className={`text-4xl lg:text-5xl font-black font-mono tracking-tighter leading-none shadow-black drop-shadow-md ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
                    {isPositive ? '+' : ''}{delta.toFixed(2)}
                </span>
                <span className="text-xs font-bold opacity-60 font-sans uppercase text-white">SEC</span>
            </div>
        </div>
    );
};

export default RallyThemeDashboard;
