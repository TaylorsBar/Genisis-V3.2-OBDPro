
import React, { useState } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';

interface IconProps {
  active?: boolean;
  className?: string;
}

const SeatbeltIcon: React.FC<IconProps> = ({ active, className }) => (
  <svg className={`w-6 h-6 p-0.5 rounded-full transition-all duration-300 ${active ? 'text-red-500 drop-shadow-[0_0_8px_#ef4444] bg-red-950/20 border border-red-500/20' : 'text-zinc-700 bg-transparent border border-transparent'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16,11.26V9a4,4,0,0,0-8,0v2.26L6.21,17.5A3,3,0,0,0,9,22h6a3,3,0,0,0,2.79-4.5ZM9.17,11.26a1,1,0,0,0,1,1h3.66a1,1,0,0,0,1-1V9a2,2,0,0,0-4,0Zm7,4.86L15.32,13H8.68L7.83,16.12A1,1,0,0,1,9,15h6a1,1,0,0,1,.17,1.12Z"/>
  </svg>
);

const HighBeamIcon: React.FC<IconProps> = ({ active, className }) => (
  <svg className={`w-6 h-6 p-0.5 rounded-full transition-all duration-300 ${active ? 'text-blue-400 drop-shadow-[0_0_8px_#60a5fa] bg-blue-950/20 border border-blue-500/20' : 'text-zinc-700 bg-transparent border border-transparent'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.5,16.5L2,12l3.5-4.5H12V6H4A2,2,0,0,0,2,8v8a2,2,0,0,0,2,2h8v-1.5H5.5M22,12l-3.5,4.5H12V18h8a2,2,0,0,0,2-2V8a2,2,0,0,0-2-2h-8v1.5h6.5M12,14h-1v-4h1V14z"/>
  </svg>
);

const BatteryIcon: React.FC<IconProps> = ({ active, className }) => (
  <svg className={`w-6 h-6 p-0.5 rounded-full transition-all duration-300 ${active ? 'text-red-500 drop-shadow-[0_0_8px_#ef4444] bg-red-950/20 border border-red-500/20 animate-pulse' : 'text-zinc-700 bg-transparent border border-transparent'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.67,4H15V2H9V4H7.33A1.33,1.33,0,0,0,6,5.33V20.67C6,21.4,6.6,22,7.33,22H16.67A1.33,1.33,0,0,0,18,20.67V5.33A1.33,1.33,0,0,0,16.67,4M15,18H9V16h6Zm0-4H9V12h6Zm0-4H9V8h6Z"/>
  </svg>
);

const OilIcon: React.FC<IconProps> = ({ active, className }) => (
  <svg className={`w-6 h-6 p-0.5 rounded-full transition-all duration-300 ${active ? 'text-amber-500 drop-shadow-[0_0_8px_#f59e0b] bg-amber-950/20 border border-amber-500/20 animate-pulse' : 'text-zinc-700 bg-transparent border border-transparent'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5,4h14a2,2,0,0,1,2,2v3.5a2.5,2.5,0,0,1-2.5,2.5H16v2.34c2,1.3,2.5,4.24,2.5,5.16a.5.5,0,0,1-.5.5H6a.5.5,0,0,1-.5-.5c0-.92.5-3.86,2.5-5.16V12H5.5A2.5,2.5,0,0,1,3,9.5V6A2,2,0,0,1,5,4m1.5,4h2A1.5,1.5,0,0,0,10,6.5,1.5,1.5,0,0,0,8.5,5h-2A1.5,1.5,0,0,0,5,6.5,1.5,1.5,0,0,0,6.5,8M21.5,12a.5.5,0,0,1,0,1h-1a.5.5,0,0,1,0-1Z"/>
  </svg>
);

const EngineIcon: React.FC<IconProps> = ({ active, className }) => (
  <svg className={`w-6 h-6 p-0.5 rounded-full transition-all duration-300 ${active ? 'text-amber-500 drop-shadow-[0_0_8px_#f59e0b] bg-amber-950/20 border border-amber-500/20 animate-pulse' : 'text-zinc-700 bg-transparent border border-transparent'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7,14v-2h2v2H7z m6,0v-2h2v2h-2z M5,10V8h2v2H5z m6,0V8h2v2h-2z M9,6V4h2v2H9z M3,22v-2h2v2H3z m16,0v-2h2v2H3z m16,0v-2h2v2h-2z M17,2H7v1.17c-1.16,1-2,2.42-2,4.83v2h2v-2c0-1.84,0.45-3.19,1-4v12H6v2h12v-2h-2V6c0.55,0.81,1,2.16,1,4v2h2v-2c0-2.41-0.84-3.83-2-4.83V2H17z"/>
  </svg>
);

const BrakeIcon: React.FC<IconProps> = ({ active, className }) => (
  <svg className={`w-6 h-6 p-0.5 rounded-full transition-all duration-300 ${active ? 'text-red-500 drop-shadow-[0_0_8px_#ef4444] bg-red-950/20 border border-red-500/20' : 'text-zinc-700 bg-transparent border border-transparent'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12,2A10,10,0,0,0,2,12a10,10,0,0,0,10,10,10,10,0,0,0,10-10A10,10,0,0,0,12,2M12,4a8,8,0,0,1,8,8,8,8,0,0,1-8,8,8,8,0,0,1-8-8,8,8,0,0,1,8-8M7,11h3v2H7v-2m5,0h5v2h-5v-2m-1-1a1,1,0,0,1,1,1,1,1,0,0,1-1,1,1,1,0,0,1-1-1,1,1,0,0,1,1-1z"/>
  </svg>
);

const IndicatorPanel: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const hasActiveFault = useVehicleStore(state => state.hasActiveFault);
    const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

    // Calculate dynamic parameters based on realistic warning signals with safe fallbacks
    const speed = latestData.speed || 0;
    const rpm = latestData.rpm || 0;
    const batteryVoltage = latestData.batteryVoltage || 0;
    const oilPressure = latestData.oilPressure || 0;
    const knockCount = latestData.knockCount || 0;
    const brakeTemp = latestData.brakeTemp || 0;

    const isSeatbeltActive = speed > 10; // flash warning if traveling over 10 KPH with unlatched seatbelt simulation
    const isHighBeamActive = speed > 85;  // Auto high-beam logic above 85 KPH limit
    const isBatteryDeficient = batteryVoltage > 0 && (batteryVoltage < 11.5 || batteryVoltage > 15.0);
    const isOilPressureLow = rpm > 600 && oilPressure < 1.4;
    const isEngineMalfunctioning = hasActiveFault || knockCount > 5;
    const isBrakeGlowActive = brakeTemp > 450;

    const items = [
        { id: 'seatbelt', label: 'Pilot Warning', desc: 'Belt restraint simulation trigger active.', active: isSeatbeltActive, icon: <SeatbeltIcon active={isSeatbeltActive} /> },
        { id: 'highbeam', label: 'Matrix High Beam', desc: 'Speed-based automatic high-flux LED active.', active: isHighBeamActive, icon: <HighBeamIcon active={isHighBeamActive} /> },
        { id: 'battery', label: 'Generator Level', desc: `Voltage: ${(latestData.batteryVoltage || 13.8).toFixed(1)}V (Safe is 11.5 - 15.0V)`, active: isBatteryDeficient, icon: <BatteryIcon active={isBatteryDeficient} /> },
        { id: 'brake', label: 'Thermal Brake Warning', desc: `Temp: ${(latestData.brakeTemp || 25).toFixed(0)}°C (Safe limit: 450°C)`, active: isBrakeGlowActive, icon: <BrakeIcon active={isBrakeGlowActive} /> },
        { id: 'engine', label: 'Neural ECU Status', desc: isEngineMalfunctioning ? 'Fault registered or excessive knock detected.' : 'Central diagnostic profile nominal.', active: isEngineMalfunctioning, icon: <EngineIcon active={isEngineMalfunctioning} /> },
        { id: 'oil', label: 'Sump Oil Pressure', desc: `Pressure: ${(latestData.oilPressure || 4.2).toFixed(1)} BAR (Limit: 1.4 BAR)`, active: isOilPressureLow, icon: <OilIcon active={isOilPressureLow} /> }
    ];

    return (
        <div className="relative flex flex-col items-center">
            {/* Display Cluster Indicator Panel Bezel bar */}
            <div className="flex items-center gap-3 bg-zinc-950/80 border border-white/5 backdrop-blur-md px-4 py-1.5 rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] relative z-30">
                {items.map(item => (
                    <div 
                        key={item.id}
                        onMouseEnter={() => setHoveredIcon(item.id)}
                        onMouseLeave={() => setHoveredIcon(null)}
                        className="relative cursor-help"
                    >
                        {item.icon}
                        
                        {/* Status Ring Anchor */}
                        {item.active && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                        )}
                    </div>
                ))}
            </div>

            {/* Float HUD Tooltip */}
            <AnimatePresence>
                {hoveredIcon && (
                    <motion.div 
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-10 z-50 bg-[#0c0c0c] border border-white/10 px-4 py-3 rounded-lg shadow-2xl max-w-[280px] text-center w-72 pointer-events-none"
                    >
                        {/* Glowing background accent bar */}
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-brand-cyan"></div>
                        
                        {(() => {
                            const cur = items.find(i => i.id === hoveredIcon);
                            if (!cur) return null;
                            return (
                                <div className="space-y-1 font-mono">
                                    <div className="text-[10px] font-black uppercase text-white tracking-widest flex items-center justify-center gap-1.5">
                                        <AlertCircle className={`w-3.5 h-3.5 ${cur.active ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} />
                                        {cur.label}
                                    </div>
                                    <p className="text-[9px] text-zinc-400 font-mono tracking-wide leading-relaxed">
                                        {cur.desc}
                                    </p>
                                    <div className={`text-[8px] font-black uppercase tracking-widest pt-1 border-t border-white/5 mt-2 ${cur.active ? 'text-red-500 font-bold' : 'text-emerald-400'}`}>
                                        Status: {cur.active ? 'Caution Triggered' : 'Nominal Core'}
                                    </div>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default IndicatorPanel;

