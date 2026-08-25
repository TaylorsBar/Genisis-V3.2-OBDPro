import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';

interface PitWallPanelProps {
    isOpen: boolean;
    onClose: () => void;
    accentColor: string;
    
    // Warning thresholds
    rpmWarning: number;
    setRpmWarning: (val: number) => void;
    turboWarning: number;
    setTurboWarning: (val: number) => void;
    waterWarning: number;
    setWaterWarning: (val: number) => void;
    oilWarning: number;
    setOilWarning: (val: number) => void;
}

interface LapRecord {
    lapNum: number;
    lapTime: number; // in ms
    s1: number;
    s2: number;
    s3: number;
    isBest: boolean;
}

export const PitWallPanel: React.FC<PitWallPanelProps> = ({
    isOpen,
    onClose,
    accentColor,
    rpmWarning,
    setRpmWarning,
    turboWarning,
    setTurboWarning,
    waterWarning,
    setWaterWarning,
    oilWarning,
    setOilWarning
}) => {
    // Data Logging State
    const [isLogging, setIsLogging] = useState(false);
    const [logDuration, setLogDuration] = useState(0); // seconds
    const [recordedFrames, setRecordedFrames] = useState(0);
    const [peakSpeed, setPeakSpeed] = useState(0);
    const [peakRpm, setPeakRpm] = useState(0);
    const [peakBoost, setPeakBoost] = useState(0);
    const logDataPointsRef = useRef<any[]>([]);

    const latestData = useVehicleStore(state => state.latestData);

    // Lap Timing State
    const [isTiming, setIsTiming] = useState(false);
    const [lapTime, setLapTime] = useState(0); // ms
    const [laps, setLaps] = useState<LapRecord[]>([]);
    const [currentSector, setCurrentSector] = useState<1 | 2 | 3>(1);
    const [sectorTimes, setSectorTimes] = useState<{ s1: number; s2: number; s3: number }>({ s1: 0, s2: 0, s3: 0 });

    const lapIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const sectorTimerRef = useRef<number>(0);

    // Track Peak Telemetry during Logging
    useEffect(() => {
        if (isLogging && latestData) {
            setRecordedFrames(prev => prev + 1);
            if ((latestData.speed || 0) > peakSpeed) setPeakSpeed(latestData.speed || 0);
            if ((latestData.rpm || 0) > peakRpm) setPeakRpm(latestData.rpm || 0);
            if ((latestData.turboBoost || 0) > peakBoost) setPeakBoost(latestData.turboBoost || 0);
            
            // Log full telemetry frame
            logDataPointsRef.current.push({
                timestamp: Date.now(),
                speed: latestData.speed,
                rpm: latestData.rpm,
                gear: latestData.gear,
                turboBoost: latestData.turboBoost,
                oilPressure: latestData.oilPressure,
                engineTemp: latestData.engineTemp,
                fuelPressure: latestData.fuelPressure,
                gForceX: latestData.gForceX,
                gForceY: latestData.gForceY
            });
        }
    }, [latestData, isLogging]);

    // Logging duration timer
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLogging) {
            timer = setInterval(() => {
                setLogDuration(prev => prev + 1);
            }, 1000);
        } else {
            setLogDuration(0);
        }
        return () => clearInterval(timer);
    }, [isLogging]);

    // Lap timing engine
    useEffect(() => {
        if (isTiming) {
            const start = Date.now();
            lapIntervalRef.current = setInterval(() => {
                const diff = Date.now() - start;
                setLapTime(diff);
                
                // Simulate sector triggers every ~15 seconds for realistic race feel
                const sec = Math.floor(diff / 15000) + 1;
                if (sec === 2 && currentSector === 1) {
                    setCurrentSector(2);
                    setSectorTimes(prev => ({ ...prev, s1: 15000 + Math.random() * 800 }));
                } else if (sec === 3 && currentSector === 2) {
                    setCurrentSector(3);
                    setSectorTimes(prev => ({ ...prev, s2: 14500 + Math.random() * 600 }));
                }
            }, 33);
        } else {
            if (lapIntervalRef.current) clearInterval(lapIntervalRef.current);
            setLapTime(0);
            setCurrentSector(1);
            setSectorTimes({ s1: 0, s2: 0, s3: 0 });
        }
        return () => {
            if (lapIntervalRef.current) clearInterval(lapIntervalRef.current);
        };
    }, [isTiming, currentSector]);

    const triggerManualLap = () => {
        const finalS3 = lapTime - sectorTimes.s1 - sectorTimes.s2;
        const newLapRecord: LapRecord = {
            lapNum: laps.length + 1,
            lapTime: lapTime,
            s1: sectorTimes.s1 || (lapTime * 0.33),
            s2: sectorTimes.s2 || (lapTime * 0.33),
            s3: Math.max(100, finalS3),
            isBest: false
        };

        // Determine if this is the new personal best
        const currentBest = laps.find(l => l.isBest);
        let updatedLaps = [...laps];
        if (!currentBest || newLapRecord.lapTime < currentBest.lapTime) {
            updatedLaps = updatedLaps.map(l => ({ ...l, isBest: false }));
            newLapRecord.isBest = true;
        }

        setLaps([newLapRecord, ...updatedLaps].slice(0, 10)); // Keep last 10 laps
        
        // Reset lap timer
        setLapTime(0);
        setCurrentSector(1);
        setSectorTimes({ s1: 0, s2: 0, s3: 0 });
        
        // Re-initiate timing sequence
        if (lapIntervalRef.current) clearInterval(lapIntervalRef.current);
        const start = Date.now();
        lapIntervalRef.current = setInterval(() => {
            setLapTime(Date.now() - start);
        }, 33);
    };

    const formatMs = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milis = Math.floor((ms % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milis.toString().padStart(2, '0')}`;
    };

    const handleDownloadCSV = () => {
        if (logDataPointsRef.current.length === 0) return;
        const headers = ["Timestamp", "Speed_KPH", "RPM", "Gear", "Turbo_kPa", "Oil_BAR", "Water_C", "Fuel_BAR", "Lat_G", "Lon_G"];
        const rows = logDataPointsRef.current.map(p => [
            p.timestamp,
            p.speed,
            p.rpm,
            p.gear,
            p.turboBoost,
            p.oilPressure,
            p.engineTemp,
            p.fuelPressure,
            p.gForceX,
            p.gForceY
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `telemetry_log_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop Overlay */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 z-[80] backdrop-blur-sm"
                    />

                    {/* Sliding Drawer */}
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        className="fixed top-0 right-0 h-full w-[350px] md:w-[420px] bg-black/95 border-l border-white/10 z-[90] shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col justify-between overflow-y-auto no-scrollbar font-sans select-none"
                    >
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/[0.02] to-transparent flex justify-between items-center shrink-0">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black tracking-[0.4em] font-display text-gray-500 uppercase">TELEMETRY DEPLOYMENT</span>
                                <h2 className="text-xl font-display font-black tracking-widest text-white uppercase mt-1 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF003C] shadow-[0_0_10px_#FF003C] animate-pulse"></span>
                                    PIT WALL CONFIG
                                </h2>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs transition-all"
                            >
                                CLOSE [ESC]
                            </button>
                        </div>

                        {/* Drawer Scrollable Body */}
                        <div className="flex-1 p-6 flex flex-col gap-8">
                            
                            {/* SECTION 1: WARNING THRESHOLDS */}
                            <div className="flex flex-col gap-4">
                                <h3 className="text-[10px] font-black tracking-widest text-white/50 uppercase border-b border-white/5 pb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
                                    ALARM THRESHOLDS (LOCAL PERSIST)
                                </h3>

                                {/* RPM Threshold */}
                                <div className="flex flex-col gap-1 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400">RPM LIMIT ALARM</span>
                                        <span className="text-sm font-mono font-black text-white">{rpmWarning} <span className="text-[10px] text-gray-500">RPM</span></span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="4000" 
                                        max="9000" 
                                        step="100" 
                                        value={rpmWarning}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setRpmWarning(val);
                                        }}
                                        className="w-full accent-[#FF003C] bg-white/10 h-1.5 rounded-full cursor-pointer mt-2"
                                    />
                                </div>

                                {/* Turbo Boost Threshold */}
                                <div className="flex flex-col gap-1 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400">TURBO LIMIT PRESSURE</span>
                                        <span className="text-sm font-mono font-black text-white">{turboWarning.toFixed(2)} <span className="text-[10px] text-gray-500">x100kPa</span></span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0.5" 
                                        max="2.0" 
                                        step="0.05" 
                                        value={turboWarning}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setTurboWarning(val);
                                        }}
                                        className="w-full bg-white/10 h-1.5 rounded-full cursor-pointer mt-2"
                                        style={{ accentColor }}
                                    />
                                </div>

                                {/* Water Temp Threshold */}
                                <div className="flex flex-col gap-1 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400">WATER TEMP WARN</span>
                                        <span className="text-sm font-mono font-black text-white">{waterWarning} <span className="text-[10px] text-gray-500">°C</span></span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="70" 
                                        max="120" 
                                        step="1" 
                                        value={waterWarning}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setWaterWarning(val);
                                        }}
                                        className="w-full accent-amber-500 bg-white/10 h-1.5 rounded-full cursor-pointer mt-2"
                                    />
                                </div>

                                {/* Oil Pressure Threshold */}
                                <div className="flex flex-col gap-1 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400">MIN OIL PRESSURE LIMIT</span>
                                        <span className="text-sm font-mono font-black text-white">{oilWarning.toFixed(1)} <span className="text-[10px] text-gray-500">BAR</span></span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0.5" 
                                        max="4.0" 
                                        step="0.1" 
                                        value={oilWarning}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setOilWarning(val);
                                        }}
                                        className="w-full bg-white/10 h-1.5 rounded-full cursor-pointer mt-2"
                                        style={{ accentColor }}
                                    />
                                </div>
                            </div>

                            {/* SECTION 2: DATA LOGGER */}
                            <div className="flex flex-col gap-4">
                                <h3 className="text-[10px] font-black tracking-widest text-white/50 uppercase border-b border-white/5 pb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                    DATA LOGGING & TELEMETRY RECORDER
                                </h3>
                                
                                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">RECORDER STATUS</span>
                                            <span className="text-xs font-black font-mono text-white flex items-center gap-1.5 mt-1">
                                                {isLogging ? (
                                                    <>
                                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                        REC ACTIVE
                                                    </>
                                                ) : (
                                                    "IDLE"
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-mono font-black text-white">{recordedFrames}</span>
                                            <span className="text-[8px] text-gray-600 font-bold">FRAMES</span>
                                        </div>
                                    </div>

                                    {/* Duration / Logging Progress */}
                                    <div className="grid grid-cols-2 gap-3 bg-black/60 p-3 rounded-lg border border-white/5 text-center">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">DURATION</span>
                                            <span className="text-sm font-mono font-black text-white mt-0.5">
                                                {Math.floor(logDuration / 60).toString().padStart(2, '0')}:{(logDuration % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">PEAK RPM</span>
                                            <span className="text-sm font-mono font-black text-red-500 mt-0.5">{peakRpm.toFixed(0)}</span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                if (isLogging) {
                                                    setIsLogging(false);
                                                } else {
                                                    logDataPointsRef.current = [];
                                                    setRecordedFrames(0);
                                                    setPeakSpeed(0);
                                                    setPeakRpm(0);
                                                    setPeakBoost(0);
                                                    setIsLogging(true);
                                                }
                                            }}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                                isLogging 
                                                    ? 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20' 
                                                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                            }`}
                                        >
                                            {isLogging ? "STOP LOGGING" : "START LOGGING"}
                                        </button>
                                        <button 
                                            disabled={logDataPointsRef.current.length === 0}
                                            onClick={handleDownloadCSV}
                                            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                                logDataPointsRef.current.length > 0
                                                    ? 'bg-[#22c55e]/10 border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/20 cursor-pointer'
                                                    : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                                            }`}
                                        >
                                            EXPORT CSV
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: LAP TIMER */}
                            <div className="flex flex-col gap-4 pb-4">
                                <h3 className="text-[10px] font-black tracking-widest text-white/50 uppercase border-b border-white/5 pb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    HIGH-PRECISION RACE LAP TIMER
                                </h3>
                                
                                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">CURRENT LAP</span>
                                        <span className="text-2xl font-mono font-black text-white tabular-nums">
                                            {formatMs(lapTime)}
                                        </span>
                                    </div>

                                    {/* Sector breakdown */}
                                    <div className="grid grid-cols-3 gap-2 text-center bg-black/60 p-2.5 rounded-lg border border-white/5">
                                        <div className="flex flex-col border-r border-white/5">
                                            <span className="text-[7px] text-gray-500 font-bold uppercase">SECTOR 1</span>
                                            <span className="text-[11px] font-mono font-black text-white mt-0.5">
                                                {sectorTimes.s1 > 0 ? (sectorTimes.s1 / 1000).toFixed(3) : "—"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col border-r border-white/5">
                                            <span className="text-[7px] text-gray-500 font-bold uppercase">SECTOR 2</span>
                                            <span className="text-[11px] font-mono font-black text-white mt-0.5">
                                                {sectorTimes.s2 > 0 ? (sectorTimes.s2 / 1000).toFixed(3) : "—"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[7px] text-gray-500 font-bold uppercase">SECTOR 3</span>
                                            <span className="text-[11px] font-mono font-black text-white mt-0.5">
                                                {lapTime - sectorTimes.s1 - sectorTimes.s2 > 0 && sectorTimes.s2 > 0
                                                    ? ((lapTime - sectorTimes.s1 - sectorTimes.s2) / 1000).toFixed(3)
                                                    : "—"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Timer controllers */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setIsTiming(!isTiming)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                                isTiming 
                                                    ? 'bg-amber-500/10 border-amber-500 text-amber-500 hover:bg-amber-500/20' 
                                                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                            }`}
                                        >
                                            {isTiming ? "PAUSE TIMING" : "START TIMING"}
                                        </button>
                                        <button 
                                            disabled={!isTiming}
                                            onClick={triggerManualLap}
                                            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                                isTiming
                                                    ? 'bg-green-500/10 border-green-500 text-green-500 hover:bg-green-500/20 cursor-pointer'
                                                    : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                                            }`}
                                        >
                                            SPLIT LAP
                                        </button>
                                    </div>

                                    {/* Historic lap table */}
                                    {laps.length > 0 && (
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">SESSION TIMELINE (LATEST 10)</span>
                                            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto no-scrollbar">
                                                {laps.map((lap, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className={`flex justify-between items-center text-[10px] font-mono p-2 rounded border transition-colors ${
                                                            lap.isBest 
                                                                ? 'bg-purple-900/20 border-purple-500/50 text-purple-400 font-bold' 
                                                                : 'bg-white/[0.01] border-white/5 text-white'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-500">LAP {lap.lapNum}</span>
                                                            {lap.isBest && <span className="text-[7px] px-1 rounded bg-purple-500/30 text-purple-400 font-bold">BEST</span>}
                                                        </div>
                                                        <span>{formatMs(lap.lapTime)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Pit Wall Status Footer */}
                        <div className="p-6 border-t border-white/10 bg-black shrink-0 text-center text-[9px] text-gray-600 font-mono tracking-widest uppercase">
                            CARTEL WORX ELITE RACING METADATA
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
