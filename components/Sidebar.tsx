
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
        className={`hidden md:flex flex-col h-full bg-[#050505] border-r border-[#1F1F1F] z-50 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${expanded ? 'w-64' : 'w-16'}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
    >
        {/* Brand Mark */}
        <div className="h-16 flex items-center justify-center border-b border-[#1F1F1F] bg-[#020202] relative overflow-hidden">
            <div className={`transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                <KarapiroLogo className="h-10 w-auto" variant="monochrome" />
            </div>
            <div className={`absolute transition-opacity duration-300 ${expanded ? 'opacity-0' : 'opacity-100'}`}>
                <KarapiroLogo className="h-8 w-auto text-brand-cyan" variant="icon-only" />
            </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar flex flex-col gap-1">
            {navItems.map((item) => (
                <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => `
                        relative flex items-center h-10 px-4 mx-0 transition-all duration-100 group
                        ${isActive 
                            ? 'bg-[#1a1a1a] text-brand-cyan border-l-2 border-brand-cyan' 
                            : 'text-gray-500 hover:text-white hover:bg-[#111] border-l-2 border-transparent'}
                    `}
                >
                    <item.icon className="w-5 h-5 min-w-[20px]" />
                    <span className={`ml-4 font-mono text-[10px] font-bold tracking-widest whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        {item.name}
                    </span>
                    
                    {/* Hover Glow */}
                    <div className="absolute inset-0 bg-brand-cyan/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
                </NavLink>
            ))}
        </div>

        {/* System Status Footer */}
        <div className="p-0 border-t border-[#1F1F1F] bg-[#020202]">
            <button
                onClick={handleConnectionClick}
                className="w-full flex flex-col h-14 relative overflow-hidden group"
            >
                <div className="flex items-center justify-center h-full w-full relative z-10">
                     <div className={`w-3 h-3 rounded-sm border ${obdState === ObdConnectionState.Connected ? 'bg-green-600 border-green-400' : 'bg-[#222] border-[#444] animate-pulse'}`}></div>
                     {expanded && (
                         <div className="ml-3 text-left">
                             <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">OBD-II PORT</div>
                             <div className={`text-[9px] font-mono ${obdState === ObdConnectionState.Connected ? 'text-green-500' : 'text-red-500'}`}>
                                 {obdState === ObdConnectionState.Connected ? 'CONNECTED' : 'DISCONNECTED'}
                             </div>
                         </div>
                     )}
                </div>
                
                {/* Background Progress Bar Style */}
                <div className={`absolute bottom-0 left-0 h-0.5 bg-brand-cyan transition-all duration-500 ${obdState === ObdConnectionState.Connected ? 'w-full' : 'w-0'}`}></div>
            </button>
        </div>
    </div>
  );
};

export default Sidebar;
