import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { AppearanceContext } from '../../contexts/AppearanceContext';
import { CircuitOverview } from '../widgets/CircuitOverview';
import GForceMeter from '../widgets/GForceMeter';
import LiveAICoach from '../widgets/LiveAICoach';

interface BentoCarouselProps {
    className?: string;
    accentColor: string;
}

export const BentoCarousel: React.FC<BentoCarouselProps> = ({ className = "", accentColor }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const latestData = useVehicleStore(state => state.latestData);
    const mlInsights = useVehicleStore(state => state.mlInsights);

    // Chassis Telemetry Simulation or extraction from latestData
    const chassisTelemetry = useMemo(() => {
        const speed = latestData?.speed || 0;
        const latG = latestData?.gForceX || 0;
        const lonG = latestData?.gForceY || 0;
        const rpm = latestData?.rpm || 0;

        // Dynamic suspension deflection based on G-Forces (roll and pitch)
        const roll = latG * 15; // Degrees roll approximation
        const pitch = lonG * 10; // Degrees pitch approximation

        // Compression (0-100%) for 4 corners (Front Left, Front Right, Rear Left, Rear Right)
        const flSusp = Math.max(10, Math.min(90, 50 - pitch + roll));
        const frSusp = Math.max(10, Math.min(90, 50 - pitch - roll));
        const rlSusp = Math.max(10, Math.min(90, 50 + pitch + roll));
        const rrSusp = Math.max(10, Math.min(90, 50 + pitch - roll));

        // Dynamic tire temperatures based on load & speed
        const flTemp = Math.round(50 + Math.max(0, latG) * 40 + (speed / 10));
        const frTemp = Math.round(50 + Math.max(0, -latG) * 40 + (speed / 10));
        const rlTemp = Math.round(45 + Math.max(0, latG) * 30 + (speed / 12) + (rpm / 2000));
        const rrTemp = Math.round(45 + Math.max(0, -latG) * 30 + (speed / 12) + (rpm / 2000));

        // Slip ratio percentages
        const flSlip = Math.max(0, Math.min(100, Math.abs(latG) * 40 + (speed > 100 ? (speed - 100) * 0.2 : 0)));
        const frSlip = Math.max(0, Math.min(100, Math.abs(latG) * 40 + (speed > 100 ? (speed - 100) * 0.2 : 0)));
        const rlSlip = Math.max(0, Math.min(100, Math.abs(lonG) * 60 + (rpm > 6000 ? (rpm - 6000) * 0.01 : 0)));
        const rrSlip = Math.max(0, Math.min(100, Math.abs(lonG) * 60 + (rpm > 6000 ? (rpm - 6000) * 0.01 : 0)));

        return {
            fl: { temp: flTemp, susp: flSusp, slip: flSlip },
            fr: { temp: frTemp, susp: frSusp, slip: frSlip },
            rl: { temp: rlTemp, susp: rlSusp, slip: rlSlip },
            rr: { temp: rrTemp, susp: rrSusp, slip: rrSlip }
        };
    }, [latestData]);

    const slides = [
        {
            title: "AI CO-DRIVER",
            subtitle: "INTELLIGENT TELEMETRY ANALYST",
            content: (
                <div className="w-full h-full flex flex-col justify-between p-4 bg-black/90 rounded-2xl border border-white/5 shadow-inner">
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <LiveAICoach />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                        <div className="bg-white/[0.02] p-2 rounded-xl border border-white/5 flex flex-col">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">DRIVER EFFICIENCY</span>
                            <span className="text-xl font-mono font-black text-white mt-1 tabular-nums">
                                {(mlInsights?.driverScore || 84.5).toFixed(1)}<span className="text-xs text-gray-600">%</span>
                            </span>
                        </div>
                        <div className="bg-white/[0.02] p-2 rounded-xl border border-white/5 flex flex-col">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">SLIP PROBABILITY</span>
                            <span className="text-xl font-mono font-black mt-1 tabular-nums" style={{ color: (mlInsights?.slipProbability || 0) > 0.5 ? '#FF003C' : '#22c55e' }}>
                                {((mlInsights?.slipProbability || 0.12) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "MINI-MAP HUD",
            subtitle: "ROTATING TRACK TRACE",
            content: (
                <div className="w-full h-full flex items-center justify-center p-3 relative bg-black/90 rounded-2xl border border-white/5">
                    <CircuitOverview className="w-[180px] h-[180px] md:w-[220px] md:h-[220px]" accentColor={accentColor} />
                </div>
            )
        },
        {
            title: "G-FORCE ZONE",
            subtitle: "TRACTION CIRCLE ANALYZER",
            content: (
                <div className="w-full h-full flex items-center justify-center p-3 relative bg-black/90 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="absolute inset-0 bg-radial-gradient opacity-10 pointer-events-none"></div>
                    <GForceMeter 
                        x={latestData?.gForceX || 0} 
                        y={latestData?.gForceY || 0} 
                        speedKph={latestData?.speed || 0}
                        size={180}
                        transparent
                    />
                </div>
            )
        },
        {
            title: "CHASSIS DYNAMICS",
            subtitle: "ACTIVE SUSPENSION & TYRE MATRIX",
            content: (
                <div className="w-full h-full flex flex-col justify-between p-4 bg-black/90 rounded-2xl border border-white/5">
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        {/* Tyre Thermal / Contact Patch */}
                        <div className="flex flex-col justify-between bg-white/[0.02] p-3 rounded-xl border border-white/5">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider text-center mb-1">TYRE CORE TEMP / SLIP</span>
                            <div className="grid grid-cols-2 gap-2 h-full items-center justify-items-center">
                                {/* FL */}
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-10 rounded-sm border border-white/20 flex flex-col justify-between p-1 transition-colors duration-300"
                                         style={{ backgroundColor: chassisTelemetry.fl.temp > 85 ? 'rgba(255, 0, 60, 0.4)' : chassisTelemetry.fl.temp > 70 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(0, 240, 255, 0.15)' }}>
                                        <span className="text-[7px] text-white/50 font-mono">FL</span>
                                    </div>
                                    <span className="text-[9px] font-mono font-bold text-white mt-1">{chassisTelemetry.fl.temp}°C</span>
                                    <span className="text-[7px] font-mono text-gray-500">S: {chassisTelemetry.fl.slip.toFixed(0)}%</span>
                                </div>
                                {/* FR */}
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-10 rounded-sm border border-white/20 flex flex-col justify-between p-1 transition-colors duration-300"
                                         style={{ backgroundColor: chassisTelemetry.fr.temp > 85 ? 'rgba(255, 0, 60, 0.4)' : chassisTelemetry.fr.temp > 70 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(0, 240, 255, 0.15)' }}>
                                        <span className="text-[7px] text-white/50 font-mono">FR</span>
                                    </div>
                                    <span className="text-[9px] font-mono font-bold text-white mt-1">{chassisTelemetry.fr.temp}°C</span>
                                    <span className="text-[7px] font-mono text-gray-500">S: {chassisTelemetry.fr.slip.toFixed(0)}%</span>
                                </div>
                                {/* RL */}
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-10 rounded-sm border border-white/20 flex flex-col justify-between p-1 transition-colors duration-300"
                                         style={{ backgroundColor: chassisTelemetry.rl.temp > 85 ? 'rgba(255, 0, 60, 0.4)' : chassisTelemetry.rl.temp > 70 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(0, 240, 255, 0.15)' }}>
                                        <span className="text-[7px] text-white/50 font-mono">RL</span>
                                    </div>
                                    <span className="text-[9px] font-mono font-bold text-white mt-1">{chassisTelemetry.rl.temp}°C</span>
                                    <span className="text-[7px] font-mono text-gray-500">S: {chassisTelemetry.rl.slip.toFixed(0)}%</span>
                                </div>
                                {/* RR */}
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-10 rounded-sm border border-white/20 flex flex-col justify-between p-1 transition-colors duration-300"
                                         style={{ backgroundColor: chassisTelemetry.rr.temp > 85 ? 'rgba(255, 0, 60, 0.4)' : chassisTelemetry.rr.temp > 70 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(0, 240, 255, 0.15)' }}>
                                        <span className="text-[7px] text-white/50 font-mono">RR</span>
                                    </div>
                                    <span className="text-[9px] font-mono font-bold text-white mt-1">{chassisTelemetry.rr.temp}°C</span>
                                    <span className="text-[7px] font-mono text-gray-500">S: {chassisTelemetry.rr.slip.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Active Suspension Deflection */}
                        <div className="flex flex-col justify-between bg-white/[0.02] p-3 rounded-xl border border-white/5">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider text-center mb-1">ACTIVE SUSPENSION STROKE</span>
                            <div className="flex flex-col gap-2 h-full justify-center">
                                {[
                                    { label: "FL DAMPER", val: chassisTelemetry.fl.susp },
                                    { label: "FR DAMPER", val: chassisTelemetry.fr.susp },
                                    { label: "RL DAMPER", val: chassisTelemetry.rl.susp },
                                    { label: "RR DAMPER", val: chassisTelemetry.rr.susp }
                                ].map((susp, idx) => (
                                    <div key={idx} className="flex flex-col gap-0.5">
                                        <div className="flex justify-between items-center text-[7px] font-bold text-gray-400">
                                            <span>{susp.label}</span>
                                            <span>{susp.val.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="h-full rounded-full transition-all duration-100" 
                                                style={{ 
                                                    width: `${susp.val}%`, 
                                                    backgroundColor: susp.val > 75 ? '#FF003C' : accentColor,
                                                    boxShadow: `0 0 8px ${susp.val > 75 ? '#FF003C' : accentColor}`
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    const nextSlide = () => {
        setActiveIndex((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
    };

    return (
        <div className={`relative flex flex-col bg-black/85 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl ${className}`}>
            /* Top Header of Bento Box */
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent shrink-0">
                <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[9px] font-bold tracking-wider font-display text-gray-500 uppercase truncate">
                        {slides[activeIndex].subtitle}
                    </span>
                    <h3 className="text-white font-display font-black tracking-wider text-xs uppercase flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: accentColor }}></span>
                        <span className="truncate">{slides[activeIndex].title}</span>
                    </h3>
                </div>
                
                {/* Horizontal Indicators / Carousel controls */}
                <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveIndex(idx)}
                                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                style={{ 
                                    backgroundColor: activeIndex === idx ? accentColor : 'rgba(255, 255, 255, 0.1)',
                                    transform: activeIndex === idx ? 'scale(1.2)' : 'scale(1)'
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={prevSlide}
                            className="p-1 rounded bg-white/[0.03] hover:bg-white/10 text-white text-[9px] font-bold border border-white/5 font-mono"
                        >
                            &lt;
                        </button>
                        <button 
                            onClick={nextSlide}
                            className="p-1 rounded bg-white/[0.03] hover:bg-white/10 text-white text-[9px] font-bold border border-white/5 font-mono"
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>

            {/* Sliding Slide Content */}
            <div className="flex-1 w-full min-h-[220px] md:min-h-[260px] relative overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIndex}
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -50, opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute inset-0 w-full h-full p-2"
                    >
                        {slides[activeIndex].content}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
