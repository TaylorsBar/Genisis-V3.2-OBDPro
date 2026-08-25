
import React, { useContext, useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import GaugeIcon from './icons/GaugeIcon';
import StopwatchIcon from './icons/StopwatchIcon';
import EngineIcon from './icons/EngineIcon';
import ARIcon from './icons/ARIcon';
import ChatIcon from './icons/ChatIcon';
import TuningForkIcon from './icons/TuningForkIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import { AppearanceContext } from '../contexts/AppearanceContext';
import { useVehicleStore } from '../stores/vehicleStore';

export interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
}

const HudIcon = (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

export const DEFAULT_NAV_ITEMS: NavItem[] = [
    { name: 'Dash', href: '/', icon: GaugeIcon },
    { name: 'Race', href: '/race-pack', icon: StopwatchIcon },
    { name: 'HUD', href: '/hud', icon: HudIcon },
    { name: 'AI', href: '/ai-engine', icon: EngineIcon },
    { name: 'AR', href: '/ar-assistant', icon: ARIcon },
    { name: 'Diag', href: '/diagnostics', icon: ChatIcon },
    { name: 'Tune', href: '/tuning', icon: TuningForkIcon },
    { name: 'Sys', href: '/appearance', icon: PaintBrushIcon },
];

interface MobileNavBarProps {
    items?: NavItem[];
}

const MobileNavBar: React.FC<MobileNavBarProps> = ({ items = DEFAULT_NAV_ITEMS }) => {
    const { isImmersive } = useContext(AppearanceContext);
    const speed = useVehicleStore(state => state.latestData?.speed || 0);

    const [isVisible, setIsVisible] = useState(true);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleUserInteraction = () => {
            setIsVisible(true);
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            // Auto hide after 2.5s if moving > 5kph, or 4s if stationary
            const timeoutDelay = speed > 5 ? 2500 : 4000;
            hideTimeoutRef.current = setTimeout(() => {
                setIsVisible(false);
            }, timeoutDelay);
        };

        const events = ['touchstart', 'touchmove', 'mousedown', 'mousemove', 'click', 'scroll', 'keydown'];
        events.forEach(event => {
            window.addEventListener(event, handleUserInteraction, { passive: true });
        });

        // Trigger initial timer
        const initialDelay = speed > 5 ? 1500 : 4000;
        hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, initialDelay);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserInteraction);
            });
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, [speed]);

    if (isImmersive) return null;

    return (
        <nav 
            className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom,12px)] pt-2 transition-all duration-500 ease-out ${
                isVisible 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-24 opacity-0'
            }`}
        >
            <div 
                className="pointer-events-auto bg-surface-dark/90 backdrop-blur-3xl border border-white/10 rounded-full shadow-glass flex items-center gap-1.5 py-1.5 px-3 mx-2 w-fit max-w-[98vw] overflow-x-auto no-scrollbar relative"
                style={{
                    marginBottom: '12px',
                }}
            >
                {/* Subtle Glow Background */}
                <div className="absolute inset-0 bg-brand-cyan/5 rounded-full blur-xl pointer-events-none"></div>
                
                {items.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) => `
                            flex flex-col items-center justify-center relative min-w-[40px] h-10 rounded-full transition-all duration-300
                            ${isActive 
                                ? 'text-black bg-brand-cyan shadow-glow-cyan scale-110 z-10' 
                                : 'text-gray-500 hover:text-white hover:bg-white/5'}
                            active:scale-95 group
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={`w-[18px] h-[18px] transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                {isActive && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-black rounded-full"></div>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default MobileNavBar;
