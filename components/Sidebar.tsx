
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import GaugeIcon from './icons/GaugeIcon';
import ChatIcon from './icons/ChatIcon';
import WrenchIcon from './icons/WrenchIcon';
import TuningForkIcon from './icons/TuningForkIcon';
import EngineIcon from './icons/EngineIcon';
import ShieldIcon from './icons/ShieldIcon';
import ARIcon from './icons/ARIcon';
import HederaIcon from './icons/HederaIcon';
import StopwatchIcon from './icons/StopwatchIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import SoundWaveIcon from './icons/SoundWaveIcon';
import { useVehicleConnection } from '../hooks/useVehicleData';
import { ObdConnectionState } from '../types';
import { KarapiroLogo } from './KarapiroLogo';

const navItems = [
  { name: 'COCKPIT', href: '/', icon: GaugeIcon, category: 'drive' },
  { name: 'RACE PACK', href: '/race-pack', icon: StopwatchIcon, category: 'drive' },
  { name: 'DYNO LAB', href: '/tuning', icon: TuningForkIcon, category: 'engineer' },
  { name: 'DIAGNOSTICS', href: '/diagnostics', icon: ChatIcon, category: 'engineer' },
  { name: 'AI CORE', href: '/ai-engine', icon: EngineIcon, category: 'engineer' },
  { name: 'AR VISION', href: '/ar-assistant', icon: ARIcon, category: 'engineer' },
  { name: 'LOGBOOK', href: '/logbook', icon: WrenchIcon, category: 'manage' },
  { name: 'SECURITY', href: '/security', icon: ShieldIcon, category: 'manage' },
  { name: 'LEDGER', href: '/hedera', icon: HederaIcon, category: 'manage' },
  { name: 'CABIN', href: '/accessories', icon: SoundWaveIcon, category: 'config' },
  { name: 'SYSTEM', href: '/appearance', icon: PaintBrushIcon, category: 'config' },
];

const Sidebar: React.FC = () => {
  const { obdState, connectObd, disconnectObd } = useVehicleConnection();
  const [expanded, setExpanded] = useState(false);

  const handleConnectionClick = () => {
    if (obdState === ObdConnectionState.Disconnected || obdState === ObdConnectionState.Error) {
      connectObd();
    } else {
      disconnectObd();
    }
  };

  return (
    <div 
        className={`hidden md:flex flex-col h-full bg-[#050505]/95 backdrop-blur-xl border-r border-[#1F1F1F] z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? 'w-64 shadow-2xl shadow-black' : 'w-16'}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
    >
        {/* Brand Mark - Engineered Aesthetics */}
        <div className="h-20 flex items-center justify-center border-b border-[#1F1F1F] bg-gradient-to-b from-[#0f0f0f] to-[#050505] relative overflow-hidden group/logo">
            <div className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-2 absolute'}`}>
                <KarapiroLogo className="h-12 w-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" variant="full" />
            </div>
            <div className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? 'opacity-0 scale-110 -translate-y-2 absolute' : 'opacity-100 scale-100 translate-y-0'}`}>
                <KarapiroLogo className="h-8 w-auto text-brand-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.3)]" variant="icon-only" />
            </div>
            
            {/* Ambient Shine Top Border */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col gap-1 px-2">
            {navItems.map((item) => (
                <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => `
                        relative flex items-center h-11 px-3 mx-0 transition-all duration-200 group rounded-md overflow-hidden
                        ${isActive 
                            ? 'bg-[#111] text-brand-cyan shadow-inner-light' 
                            : 'text-gray-500 hover:text-gray-200 hover:bg-[#0a0a0a]'}
                    `}
                >
                    {({ isActive }) => (
                        <>
                            {/* Active Indicator Line */}
                            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-cyan rounded-r-full transition-all duration-300 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}></div>
                            
                            <item.icon className={`w-5 h-5 min-w-[20px] z-10 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'group-hover:scale-105'}`} />
                            
                            <span className={`ml-4 font-display text-[10px] font-bold tracking-[0.2em] whitespace-nowrap transition-all duration-300 z-10 ${expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                                {item.name}
                            </span>
                            
                            {/* Hover Glow */}
                            <div className={`absolute inset-0 bg-brand-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                        </>
                    )}
                </NavLink>
            ))}
        </div>

        {/* System Status Footer */}
        <div className="p-0 border-t border-[#1F1F1F] bg-[#020202]">
            <button
                onClick={handleConnectionClick}
                className="w-full flex flex-col h-16 relative overflow-hidden group"
            >
                {/* Background Pulse for Connection */}
                {obdState === ObdConnectionState.Connected && (
                    <div className="absolute inset-0 bg-green-500/5 animate-pulse"></div>
                )}

                <div className="flex items-center justify-center h-full w-full relative z-10">
                     <div className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${obdState === ObdConnectionState.Connected ? 'bg-green-500 border-green-400 shadow-[0_0_10px_#22c55e]' : 'bg-[#1a1a1a] border-[#333]'}`}></div>
                     
                     {expanded && (
                         <div className="ml-3 text-left animate-in slide-in-from-left duration-300 fade-in">
                             <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">OBD-II PORT</div>
                             <div className={`text-[10px] font-mono font-bold ${obdState === ObdConnectionState.Connected ? 'text-green-500' : 'text-gray-600'}`}>
                                 {obdState === ObdConnectionState.Connected ? 'LINK ESTABLISHED' : 'NO CARRIER'}
                             </div>
                         </div>
                     )}
                </div>
                
                {/* Progress Bar Style */}
                <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-brand-cyan to-blue-500 transition-all duration-500 ease-out ${obdState === ObdConnectionState.Connected ? 'w-full' : 'w-0'}`}></div>
            </button>
        </div>
    </div>
  );
};

export default Sidebar;
