import React, { useContext } from 'react';
import { useVehicleConnection } from '../hooks/useVehicleData';
import { useAIStore } from '../stores/aiStore';
import { useDiagnosticStore } from '../stores/diagnosticStore';
import { useUIStore } from '../stores/uiStore';
import { useLongPress } from '../hooks/useLongPress';
import { ObdConnectionState } from '../types';
import FullScreenIcon from './icons/FullScreenIcon';
import { AppearanceContext } from '../contexts/AppearanceContext';
import { Terminal, Menu, X, Activity } from 'lucide-react';
import { KarapiroLogo } from './KarapiroLogo';
import DigitalTapeRpm from './tachometers/DigitalTapeRpm';
import { motion, AnimatePresence } from 'motion/react';

const SystemStatusBar: React.FC = () => {
    const { obdState, connectObd, disconnectObd } = useVehicleConnection();
    const { state: aiState, setIsOpen } = useAIStore();
    const { toggleConsole } = useDiagnosticStore();
    const { setHpTunersVisible } = useUIStore();
    const { isImmersive, setIsImmersive, setIsSideMenuOpen } = useContext(AppearanceContext);

    const toggleImmersive = () => {
        const nextState = !isImmersive;
        setIsImmersive(nextState);
        
        if (nextState) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error attempting to enable fullscreen: ${err.message}`);
                });
            }
        } else {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const handleObdToggle = () => {
        if (obdState === ObdConnectionState.Disconnected || obdState === ObdConnectionState.Error) {
            connectObd();
        } else {
            disconnectObd();
        }
    };

    const obdLongPress = useLongPress(() => {
        setHpTunersVisible(true);
    }, 600);

    return (
        <div className="relative z-[60] shrink-0 overflow-hidden">
            <AnimatePresence mode="wait">
                {isImmersive ? (
                    <motion.div 
                        key="immersive"
                        initial={{ y: -60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                        className="relative w-full bg-black"
                    >
                        <DigitalTapeRpm 
                            max={9000} 
                            redline={7500} 
                            className="border-none"
                        />
                        <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleImmersive}
                            className="absolute top-1 right-1 p-1.5 bg-black/60 backdrop-blur-xl text-white/50 rounded-full hover:text-white z-[60] border border-white/10"
                        >
                            <X className="w-5 h-5" />
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="standard"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col bg-surface-dark border-b border-white/5 shadow-md select-none" 
                        style={{ paddingTop: 'env(safe-area-inset-top)' }}
                    >
                        <div className="h-14 flex items-center justify-between px-3 md:px-5">
                            {/* Left: Menu & Logo */}
                            <div className="flex h-full items-center gap-4">
                                <motion.button 
                                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsSideMenuOpen(true)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0 shadow-sm"
                                    aria-label="Open Menu"
                                >
                                    <Menu className="w-5 h-5" />
                                </motion.button>
                                <motion.div 
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    className="h-6 flex items-center justify-center cursor-pointer"
                                >
                                    <KarapiroLogo 
                                        variant="monochrome" 
                                        className="h-5 w-auto text-white opacity-95 transition-opacity hover:opacity-100" 
                                    />
                                </motion.div>
                            </div>

                            {/* Right: Tools & Immersive Toggle */}
                            <div className="flex h-full items-center gap-2">
                                {/* System Status Display */}
                                <div className="hidden lg:flex flex-col items-end justify-center mr-4 pr-4 border-r border-white/10 h-8">
                                    <span className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-widest">Genesis Core V5</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-glow-cyan animate-pulse"></div>
                                        <span className="text-[8px] font-mono text-brand-cyan uppercase tracking-widest font-black opacity-80">Synced</span>
                                    </div>
                                </div>
                                
                                {/* OBD Connection Status */}
                                <motion.button 
                                    {...obdLongPress}
                                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleObdToggle}
                                    className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-white/[0.02] border border-white/10 transition-all group cursor-pointer shadow-sm hover:border-brand-cyan/30 hover:bg-brand-cyan/5"
                                    title={obdState === ObdConnectionState.Connected ? "Disconnect ECU" : "Connect OBD-II"}
                                >
                                    <Activity className={`w-4 h-4 ${obdState === ObdConnectionState.Connected ? 'text-brand-cyan' : 'text-zinc-500'}`} />
                                    <span className={`text-[10px] font-display font-medium tracking-[0.2em] hidden sm:block ${obdState === ObdConnectionState.Connected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                                        {(obdState === ObdConnectionState.Connecting || obdState === ObdConnectionState.HardwareHandshake) ? 'LINKING' : 'TELEMETRY'}
                                    </span>
                                </motion.button>

                                {/* AI Trigger */}
                                <motion.button 
                                    whileHover={{ backgroundColor: 'rgba(138,43,226,0.1)', borderColor: 'rgba(138,43,226,0.3)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setIsOpen(true)}
                                    className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-brand-purple/5 border border-brand-purple/10 transition-all shadow-sm"
                                    title="AI Assistant"
                                >
                                    <span className={`text-[10px] font-display font-medium tracking-[0.2em] ${aiState !== 'idle' ? 'text-brand-purple animate-pulse' : 'text-brand-purple/80'}`}>
                                        NEURAL
                                    </span>
                                    {aiState !== 'idle' && (
                                        <motion.div 
                                            animate={{ height: [6, 14, 6] }}
                                            transition={{ repeat: Infinity, duration: 0.6 }}
                                            className="w-1 bg-brand-purple rounded-full shadow-glow-purple"
                                        />
                                    )}
                                </motion.button>

                                {/* Console */}
                                <motion.button 
                                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={toggleConsole}
                                    className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors bg-white/[0.02] border border-white/5 ml-1"
                                    title="System Engineer Console"
                                >
                                    <Terminal className="w-[18px] h-[18px]" />
                                </motion.button>

                                {/* Immersive Toggle */}
                                <motion.button 
                                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={toggleImmersive}
                                    className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors bg-white/[0.02] border border-white/5 ml-1"
                                    title="Toggle Immersive Mode"
                                >
                                    <FullScreenIcon className="w-[18px] h-[18px]" isFullscreen={isImmersive} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SystemStatusBar;
