
import React, { useState, useEffect } from 'react';
import { useVehicleConnection } from '../hooks/useVehicleData';
import { useAIStore } from '../stores/aiStore';
import { ObdConnectionState } from '../types';
import FullScreenIcon from './icons/FullScreenIcon';

const SystemStatusBar: React.FC = () => {
    const { obdState, ekfStats } = useVehicleConnection();
    const { state: aiState, setIsOpen } = useAIStore();
    const [time, setTime] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        
        const getIsFs = () => {
             const doc = document as any;
             return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
        }

        const handleFsChange = () => {
            setIsFullscreen(getIsFs());
        };
        
        // Standard
        document.addEventListener('fullscreenchange', handleFsChange);
        // Webkit (Chrome, Safari, Opera)
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        // Mozilla (Firefox)
        document.addEventListener('mozfullscreenchange', handleFsChange);
        // IE/Edge
        document.addEventListener('MSFullscreenChange', handleFsChange);

        // Initial check
        setIsFullscreen(getIsFs());

        return () => {
            clearInterval(timer);
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
            document.removeEventListener('mozfullscreenchange', handleFsChange);
            document.removeEventListener('MSFullscreenChange', handleFsChange);
        };
    }, []);

    const toggleFullscreen = () => {
        const doc = document as any;
        const docEl = document.documentElement as any;

        const requestFullScreen = docEl.requestFullscreen || 
                                  docEl.mozRequestFullScreen || 
                                  docEl.webkitRequestFullscreen || 
                                  docEl.webkitRequestFullScreen || 
                                  docEl.msRequestFullscreen;
        
        const cancelFullScreen = doc.exitFullscreen || 
                                 doc.mozCancelFullScreen || 
                                 doc.webkitExitFullscreen || 
                                 doc.msExitFullscreen;

        const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

        if (!isFs) {
            if (requestFullScreen) {
                // Using .call to ensure context is correct
                requestFullScreen.call(docEl).catch((err: any) => {
                    console.warn("Fullscreen request failed:", err);
                });
            } else {
                console.warn("Fullscreen API not supported on this device/browser.");
            }
        } else {
            if (cancelFullScreen) {
                cancelFullScreen.call(doc).catch((err: any) => {
                    console.warn("Fullscreen exit failed:", err);
                });
            }
        }
    };

    // Format time HH:MM:SS
    const timeString = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const dateString = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const getConnColor = () => {
        switch (obdState) {
            case ObdConnectionState.Connected: return 'bg-green-500 shadow-[0_0_8px_#22c55e]';
            case ObdConnectionState.Connecting:
            case ObdConnectionState.Initializing: return 'bg-brand-yellow animate-pulse';
            case ObdConnectionState.Error: return 'bg-red-500';
            default: return 'bg-gray-600';
        }
    };

    return (
        <div className="h-8 bg-[#050505] border-b border-[#1F1F1F] flex items-center justify-between px-4 z-50 select-none shadow-lg">
            {/* Left: System Identity */}
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-display font-bold text-gray-400 tracking-widest uppercase hover:text-brand-cyan transition-colors cursor-default">
                    GENESIS OS <span className="text-[9px] text-gray-600 ml-1">v3.2.1</span>
                </span>
                
                {/* AI Status */}
                <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-2 border-l border-[#1F1F1F] hover:bg-white/5 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${aiState === 'idle' ? 'bg-brand-cyan' : 'bg-brand-purple animate-pulse'}`}></div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">AI: {aiState.toUpperCase()}</span>
                </button>
            </div>

            {/* Center: Clock */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase hidden md:inline">{dateString}</span>
                <span className="text-xs font-mono font-bold text-white tracking-widest">{timeString}</span>
            </div>

            {/* Right: Hardware Status */}
            <div className="flex items-center gap-4">
                 {/* GPS Status */}
                <div className="flex items-center gap-1.5" title="GPS / GNSS Status">
                    <span className={`text-[9px] font-bold tracking-wider ${ekfStats.gpsActive ? 'text-gray-300' : 'text-gray-600'}`}>GPS</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${ekfStats.gpsActive ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-gray-700'}`}></div>
                </div>

                 {/* Vision Status */}
                <div className="flex items-center gap-1.5" title="Computer Vision Status">
                     <span className={`text-[9px] font-bold tracking-wider ${ekfStats.visionConfidence > 0.3 ? 'text-gray-300' : 'text-gray-600'}`}>VIS</span>
                     <div className={`w-1.5 h-1.5 rounded-full ${ekfStats.visionConfidence > 0.3 ? 'bg-brand-cyan shadow-[0_0_5px_#00F0FF]' : 'bg-gray-700'}`}></div>
                </div>

                {/* OBD/ECU Status */}
                <div className="flex items-center gap-1.5 border-l border-[#1F1F1F] pl-4" title="ECU Uplink Status">
                    <span className={`text-[9px] font-bold tracking-wider ${obdState === ObdConnectionState.Connected ? 'text-gray-300' : 'text-gray-600'}`}>ECU</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${getConnColor()}`}></div>
                </div>

                {/* Cloud Status */}
                <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                </div>

                {/* Fullscreen Toggle */}
                <button 
                    type="button"
                    onClick={toggleFullscreen}
                    className="ml-2 p-1 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-brand-cyan group"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    <FullScreenIcon className="w-4 h-4 transition-transform group-hover:scale-110" isFullscreen={isFullscreen} />
                </button>
            </div>
        </div>
    );
};

export default SystemStatusBar;
