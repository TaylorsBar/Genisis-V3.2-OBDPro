import React, { useState, useEffect, memo, useMemo } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

// Coordinates formatting helper for Genesis OS
const formatCoord = (val: number | undefined, isLat: boolean) => {
    if (val === undefined || val === 0) {
        return isLat ? `37°55'27.1"S` : `175°32'44.9"E`;
    }
    const absVal = Math.abs(val);
    const degrees = Math.floor(absVal);
    const minutesDecimal = (absVal - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
    const direction = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${seconds}"${direction}`;
};

const GenesisOSDashboard: React.FC = memo(() => {
    const navigate = useNavigate();
    const latestData = useVehicleStore(state => state.latestData);
    const dataSourceMode = useVehicleStore(state => state.dataSourceMode);
    const setDataSourceMode = useVehicleStore(state => state.setDataSourceMode);
    const isLogging = useVehicleStore(state => state.isLogging);
    const startLogging = useVehicleStore(state => state.startLogging);
    const stopLogging = useVehicleStore(state => state.stopLogging);
    const launchControl = useVehicleStore(state => state.launchControl);
    const setLaunchControl = useVehicleStore(state => state.setLaunchControl);
    const coPilotMessages = useVehicleStore(state => state.coPilot?.messages || []);

    // Extract telemetry variables
    const rpm = latestData?.rpm || 0;
    const speed = latestData?.speed || 0;
    const gear = latestData?.gear ?? 0;
    const turboBoost = latestData?.turboBoost || 0;
    const engineTemp = latestData?.engineTemp || 89;
    const oilPressure = latestData?.oilPressure || 2.0;
    const batteryVoltage = latestData?.batteryVoltage || 13.8;
    const distance = latestData?.distance || 1000;
    const lat = latestData?.latitude;
    const lng = latestData?.longitude;

    // Active status modes
    const isStandActive = dataSourceMode === 'sensors';
    const isRollActive = dataSourceMode === 'demo' || dataSourceMode === 'auto';
    const isDragActive = launchControl?.enabled || false;

    // AI Co-Pilot Messages
    const coPilotMessage = useMemo(() => {
        const aiMsgs = coPilotMessages.filter(m => m.role === 'ai');
        if (aiMsgs.length > 0) {
            return aiMsgs[aiMsgs.length - 1].text;
        }
        return "TELEMETRY STABLE. SPARK ADVANCE AUTO-OPTIMIZING.";
    }, [coPilotMessages]);

    // Format distance
    const formattedDistance = useMemo(() => {
        const rounded = Math.round(distance);
        return rounded.toString().padStart(6, '0');
    }, [distance]);

    // Safety Calculations
    const egt = useMemo(() => {
        return Math.round(380 + (rpm / 8000) * 320 + (latestData?.engineLoad || 0) * 1.2);
    }, [rpm, latestData?.engineLoad]);

    const map = useMemo(() => {
        return (turboBoost + 1.01).toFixed(2);
    }, [turboBoost]);

    const wmi = useMemo(() => {
        return turboBoost > 1.2 ? `${Math.round(180 + (turboBoost - 1.2) * 200)}cc` : '0cc';
    }, [turboBoost]);

    // Fuel Pressure simulation
    const fuelPressure = useMemo(() => {
        if (rpm < 100) return 0.0;
        return +(4.2 + Math.sin(Date.now() / 800) * 0.15).toFixed(2);
    }, [rpm]);

    const isFuelPressureLow = fuelPressure < 1.0;

    // Intake temperature simulation (ambient + boost heat soak)
    const intakeTemp = useMemo(() => {
        const base = latestData?.ambientTemp || 22;
        const heatSoak = (turboBoost > 0) ? (turboBoost * 7.5) : 0;
        return +(base + heatSoak + Math.sin(Date.now() / 1500) * 0.2).toFixed(1);
    }, [latestData?.ambientTemp, turboBoost]);

    // Navigation buttons mapping to real paths
    const navItems = [
        { label: 'Main Dash', path: '/' },
        { label: 'Race Pack', path: '/race-pack' },
        { label: 'HUD Overlay', path: '/hud' },
        { label: 'Override', path: '/recalibration' },
        { label: 'Tuning', path: '/tuning' }
    ];

    return (
        <div className="absolute inset-0 w-full h-full bg-[#111113] text-white p-2 sm:p-4 flex flex-col justify-between overflow-y-auto font-space-mono select-none">
            {/* Header Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 items-center border-2 border-white px-6 py-4 gap-4">
                <div className="font-oswald text-xl uppercase tracking-wider text-center md:text-left text-white">
                    Genesis OS // v1.0
                </div>
                <div className="text-[0.6rem] tracking-[0.25em] text-[#bc13fe] text-center uppercase font-bold">
                    PRECISION MOTORSPORT • CORE_SYSTEM_ACTIVE
                </div>
                <div className="flex justify-center md:justify-end gap-5 items-center">
                    <span className="text-[0.55rem] uppercase tracking-wider text-white/60 font-bold">PIT WALL:</span>
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#bc13fe] animate-pulse"></span>
                        CONNECTED
                    </span>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 flex-1 min-h-0">
                {/* AI / Co-Driver Cell */}
                <div className="border border-white/10 p-5 flex flex-col justify-between bg-white text-[#111113]">
                    <div>
                        <span className="text-[0.55rem] uppercase tracking-wider text-[#111113]/60 font-bold">Co-Driver Intelligence</span>
                        <div className="text-xs md:text-sm font-bold leading-relaxed mt-2 uppercase">
                            {coPilotMessage}
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#111113]/10 flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setDataSourceMode('sensors')}
                                className={`flex-1 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider border border-[#111113] transition-all duration-150 cursor-pointer ${
                                    isStandActive 
                                        ? 'bg-[#111113] text-white' 
                                        : 'bg-transparent text-[#111113] hover:bg-[#111113]/5'
                                }`}
                            >
                                STAND
                            </button>
                            <button 
                                onClick={() => setDataSourceMode('demo')}
                                className={`flex-1 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider border border-[#111113] transition-all duration-150 cursor-pointer ${
                                    isRollActive 
                                        ? 'bg-[#111113] text-white' 
                                        : 'bg-transparent text-[#111113] hover:bg-[#111113]/5'
                                }`}
                            >
                                ROLL
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    if (isLogging) stopLogging();
                                    else startLogging();
                                }}
                                className={`flex-1 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider border border-[#111113] transition-all duration-150 cursor-pointer ${
                                    isLogging 
                                        ? 'bg-[#ff003c] text-white border-[#ff003c] animate-pulse' 
                                        : 'bg-transparent text-[#111113] hover:bg-[#111113]/5'
                                }`}
                            >
                                LOGGER: {isLogging ? 'ON' : 'OFF'}
                            </button>
                            <button 
                                onClick={() => setLaunchControl({ enabled: !launchControl.enabled })}
                                className={`flex-1 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider border border-[#111113] transition-all duration-150 cursor-pointer ${
                                    isDragActive 
                                        ? 'bg-[#ff003c] text-white border-[#ff003c] animate-pulse' 
                                        : 'bg-transparent text-[#111113] hover:bg-[#111113]/5'
                                }`}
                            >
                                DRAG: {isDragActive ? 'READY' : 'OFF'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Hero Gear/Speed Cell (spans 2x2) */}
                <div className="sm:col-span-2 sm:row-span-2 border-2 border-white bg-gradient-to-b from-[#bc13fe]/5 to-transparent relative flex flex-col items-center justify-center min-h-[300px]">
                    <span className="absolute top-5 left-5 text-[0.55rem] uppercase tracking-widest text-[#bc13fe] font-bold">Manual Transmission</span>
                    <div className="font-oswald text-[12rem] sm:text-[14rem] md:text-[18rem] lg:text-[20rem] font-bold text-white leading-none">
                        {gear === 0 ? 'N' : gear === -1 ? 'R' : gear}
                    </div>
                    <div className="absolute bottom-5 right-5 text-right">
                        <span className="text-[0.55rem] uppercase tracking-widest text-[#bc13fe] font-bold">KPH</span>
                        <div className="font-oswald text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-none">
                            {Math.round(speed)}
                        </div>
                    </div>
                </div>

                {/* Turbo Pressure */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Turbo Pressure</span>
                    <div className="font-oswald text-4xl font-bold text-[#bc13fe] leading-none mt-2">
                        {Math.round((turboBoost || 0) * 100)} <span className="font-space-mono text-xs text-white/60 ml-1">kPa</span>
                    </div>
                </div>

                {/* Oil Pressure */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Oil Pressure</span>
                    <div className="font-oswald text-4xl font-bold text-white leading-none mt-2">
                        {oilPressure.toFixed(1)} <span className="font-space-mono text-xs text-white/60 ml-1">BAR</span>
                    </div>
                </div>

                {/* Water Temperature */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Water Temperature</span>
                    <div className="font-oswald text-4xl font-bold text-white leading-none mt-2">
                        {engineTemp.toFixed(1)} <span className="font-space-mono text-xs text-white/60 ml-1">°C</span>
                    </div>
                </div>

                {/* Battery Voltage */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Battery Voltage</span>
                    <div className="font-oswald text-4xl font-bold text-white leading-none mt-2">
                        {batteryVoltage.toFixed(1)} <span className="font-space-mono text-xs text-white/60 ml-1">V</span>
                    </div>
                </div>

                {/* Safety Metrics */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Safety Metrics</span>
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[0.6rem] text-white/50">EGT</span>
                            <span className={`text-xs font-bold ${egt > 780 ? 'text-[#ff003c]' : 'text-white'}`}>{egt}°C</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[0.6rem] text-white/50">MAP</span>
                            <span className="text-xs font-bold text-white">{map}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[0.6rem] text-white/50">WMI</span>
                            <span className="text-xs font-bold text-white">{wmi}</span>
                        </div>
                    </div>
                </div>

                {/* Fuel Pressure */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <div>
                        <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Fuel Pressure</span>
                        <div className="font-oswald text-3xl font-bold text-white leading-none mt-2">
                            {fuelPressure <= 0 ? '-0.0' : fuelPressure.toFixed(1)} <span className="font-space-mono text-[10px] text-white/60 ml-0.5">BAR</span>
                        </div>
                    </div>
                    {isFuelPressureLow ? (
                        <div className="border border-[#ff003c] text-[#ff003c] px-2 py-0.5 text-[0.55rem] font-bold tracking-widest text-center mt-2 animate-pulse bg-[#ff003c]/5">
                            LOW_PRESS_WARNING
                        </div>
                    ) : (
                        <div className="border border-[#00FA9A]/30 text-[#00FA9A] px-2 py-0.5 text-[0.55rem] font-bold tracking-widest text-center mt-2 bg-[#00FA9A]/5">
                            NORMAL
                        </div>
                    )}
                </div>

                {/* Intake Temp */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Intake Temp</span>
                    <div className="font-oswald text-3xl font-bold text-white leading-none mt-2">
                        {intakeTemp.toFixed(1)} <span className="font-space-mono text-xs text-white/60 ml-1">°C</span>
                    </div>
                </div>

                {/* Engine Load */}
                <div className="border border-white/10 p-5 flex flex-col justify-between min-h-[115px]">
                    <span className="text-[0.55rem] uppercase tracking-wider text-[#bc13fe] font-bold">Engine Load</span>
                    <div className="font-oswald text-3xl font-bold text-white leading-none mt-2">
                        {Math.round(latestData?.engineLoad || 0)} <span className="font-space-mono text-xs text-white/60 ml-1">%</span>
                    </div>
                </div>
            </div>

            {/* RPM Tape Bar */}
            <div className="h-10 border border-white mt-4 relative overflow-hidden bg-black/40">
                <motion.div 
                    className="h-full bg-[#bc13fe] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
                    style={{ width: `${Math.min(100, (rpm / 8000) * 100)}%` }}
                    animate={{ width: `${Math.min(100, (rpm / 8000) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                />
                <span className="absolute right-3.5 top-2.5 text-[0.55rem] uppercase tracking-widest text-white font-bold pointer-events-none">
                    RPM INDICATOR x1000 // {Math.round(rpm)}
                </span>
            </div>

            {/* Location / Telemetry Metadata Row */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-2 text-[0.55rem] uppercase tracking-widest text-white/40 font-bold px-1 gap-1">
                <span>LOC: {formatCoord(lat, true)} // {formatCoord(lng, false)}</span>
                <span>DIST: {formattedDistance} KM // GENESIS_OS_044</span>
            </div>

            {/* Navigation Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                {navItems.map((item) => {
                    const isActive = item.path === '/';
                    return (
                        <button
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className={`border p-3 text-center text-[0.65rem] uppercase tracking-wider font-bold transition-all duration-150 cursor-pointer ${
                                isActive 
                                    ? 'bg-[#bc13fe] border-[#bc13fe] text-[#111113]' 
                                    : 'border-white text-white hover:bg-white/5'
                            }`}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

export default GenesisOSDashboard;
