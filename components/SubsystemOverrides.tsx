
import React, { useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';

const SubsystemOverrides: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const subsystems = useVehicleStore(state => state.subsystems);
    const toggleAls = useVehicleStore(state => state.toggleAls);
    const toggleWmi = useVehicleStore(state => state.toggleWmi);
    const toggleAlp = useVehicleStore(state => state.toggleAlp);
    const panelRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);

    // Gesture handling
    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            touchStartX.current = e.touches[0].clientX;
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            if (touchStartX.current === null) return;
            const diff = touchStartX.current - e.touches[0].clientX;
            
            // Left swipe (pulling out from right)
            if (!isOpen && diff > 50 && touchStartX.current > window.innerWidth - 50) {
                setIsOpen(true);
                touchStartX.current = null;
            }
            // Right swipe (pushing back in)
            else if (isOpen && diff < -50) {
                setIsOpen(false);
                touchStartX.current = null;
            }
        };

        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchmove', handleTouchMove);
        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, [isOpen]);

    const OverrideButton: React.FC<{ 
        label: string; 
        status: string; 
        onClick: () => void; 
        color: string;
        isActive: boolean;
        warning?: boolean;
    }> = ({ label, status, onClick, color, isActive, warning }) => (
        <button 
            onClick={onClick}
            className={`
                relative w-full py-4 px-6 mb-4 rounded-lg border-2 skew-x-[-12deg] transition-all duration-150 active:scale-95 overflow-hidden group
                ${isActive ? `bg-${color}-900/20 border-${color}-500 shadow-[0_0_20px_rgba(var(--${color}-rgb),0.3)]` : 'bg-black/40 border-gray-800 text-gray-500'}
                ${warning ? 'animate-pulse border-red-500' : ''}
            `}
        >
            <div className="skew-x-[12deg] flex justify-between items-center relative z-10">
                <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">{label}</span>
                    <span className={`text-xl font-display font-black italic tracking-tighter ${isActive ? 'text-white' : 'text-gray-700'}`}>
                        {status}
                    </span>
                </div>
                <div className={`w-3 h-3 rounded-full ${isActive ? (warning ? 'bg-red-500' : `bg-${color}-500 shadow-[0_0_10px_currentColor]`) : 'bg-gray-800'}`}></div>
            </div>
            
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            
            {/* Active Glow */}
            {isActive && (
                <div className={`absolute inset-0 opacity-10 bg-${color}-500 animate-pulse`}></div>
            )}
        </button>
    );

    return (
        <>
            {/* Pull Tab Handle */}
            <div 
                className={`fixed right-0 top-1/2 -translate-y-1/2 z-[80] transition-transform duration-500 ${isOpen ? 'translate-x-full' : 'translate-x-0'}`}
                onClick={() => setIsOpen(true)}
            >
                <div className="relative group cursor-pointer">
                    {/* Active Pulse Ring */}
                    {!isOpen && <div className="absolute inset-0 bg-brand-cyan/20 rounded-l-xl animate-ping opacity-40"></div>}
                    
                    <div className="bg-brand-cyan/20 backdrop-blur-md border border-brand-cyan/40 border-r-0 rounded-l-xl p-3 hover:bg-brand-cyan/40 transition-colors shadow-glow-cyan relative z-10">
                        <svg className="w-6 h-6 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[85] transition-opacity duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Pullout Panel */}
            <div 
                ref={panelRef}
                className={`
                    fixed top-0 right-0 bottom-0 w-80 bg-[#050505]/95 backdrop-blur-2xl border-l border-white/10 z-[90] 
                    transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xl p-6 flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-display font-black text-white italic tracking-widest leading-none">OVERRIDE</h2>
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.3em]">Sub-System Management</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 space-y-2">
                    <OverrideButton 
                        label="Anti-Lag System" 
                        status={subsystems.als} 
                        onClick={toggleAls} 
                        color="red"
                        isActive={subsystems.als !== 'OFF'}
                    />
                    
                    <OverrideButton 
                        label="Water-Meth Injection" 
                        status={subsystems.wmi} 
                        onClick={toggleWmi} 
                        color="blue"
                        isActive={subsystems.wmi !== 'OFF'}
                        warning={subsystems.wmi === 'LOW'}
                    />

                    <OverrideButton 
                        label="Adaptive Limit Protocol" 
                        status={subsystems.alp === 'PROTECT' ? 'SAFETY ON' : 'OVERRIDE'} 
                        onClick={toggleAlp} 
                        color="purple"
                        isActive={subsystems.alp === 'OVERRIDE'}
                    />
                </div>

                {/* System Status Readout */}
                <div className="mt-auto bg-[#0a0a0a] border border-white/5 p-4 rounded-xl">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Live Safety Metrics</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-600 font-mono">EGT TEMP</span>
                            <span className="text-sm font-mono font-bold text-brand-red">842°C</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-600 font-mono">WMI FLOW</span>
                            <span className="text-sm font-mono font-bold text-brand-blue">{subsystems.wmi === 'SPRAYING' ? '350cc/m' : '0cc/m'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-600 font-mono">MAP PRESSURE</span>
                            <span className="text-sm font-mono font-bold text-brand-cyan">1.82 BAR</span>
                        </div>
                    </div>
                </div>

                {/* Footer Tip */}
                <p className="mt-6 text-[9px] text-gray-600 text-center uppercase tracking-widest font-mono italic">
                    Swipe right to collapse module
                </p>
            </div>
            
            {/* Inline styles for the dynamic RGB classes used in the component */}
            <style>{`
                :root {
                    --red-rgb: 239, 68, 68;
                    --blue-rgb: 59, 130, 246;
                    --purple-rgb: 188, 19, 254;
                }
                .bg-red-500 { background-color: rgb(var(--red-rgb)); }
                .border-red-500 { border-color: rgb(var(--red-rgb)); }
                .bg-blue-500 { background-color: rgb(var(--blue-rgb)); }
                .border-blue-500 { border-color: rgb(var(--blue-rgb)); }
                .bg-purple-500 { background-color: rgb(var(--purple-rgb)); }
                .border-purple-500 { border-color: rgb(var(--purple-rgb)); }
                .text-brand-red { color: #FF003C; }
                .text-brand-blue { color: #0099FF; }
            `}</style>
        </>
    );
};

export default SubsystemOverrides;
