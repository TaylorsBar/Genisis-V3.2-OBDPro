
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
        
        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        document.addEventListener('mozfullscreenchange', handleFsChange);
        document.addEventListener('MSFullscreenChange', handleFsChange);

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
        const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        const cancelFullScreen = doc.exitFullscreen || doc.webkitExitFullscreen;

        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
            requestFullScreen?.call(docEl);
        } else {
            cancelFullScreen?.call(doc);
        }
    };

    const timeString = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = time.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();

    const StatusIndicator: React.FC<{ label: string; active: boolean; color?: string }> = ({ label, active, color = 'bg-green-500' }) => (
        <div className="flex items-center gap-2 px-3 border-r border-[#1F1F1F] h-full">
            <span className={`text-[10px] font-mono font-bold tracking-widest ${active ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
            <div className={`w-1.5 h-1.5 rounded-sm ${active ? color : 'bg-[#222]'}`}></div>
        </div>
    );

    return (
        <div className="h-10 bg-[#080808] border-b border-[#1F1F1F] flex items-center justify-between z-50 select-none">
            {/* Left: System Stats */}
            <div className="flex h-full items-center">
                <div className="px-4 border-r border-[#1F1F1F] h-full flex items-center bg-[#020202]">
                    <span className="text-[10px] font-bold text-brand-cyan tracking-[0.2em]">KC//OS</span>
                </div>
                <StatusIndicator label="ECU" active={obdState === ObdConnectionState.Connected} />
                <StatusIndicator label="GPS" active={ekfStats.gpsActive} />
                <StatusIndicator label="VIS" active={ekfStats.visionConfidence > 0.3} color="bg-brand-cyan" />
                
                {/* AI Trigger */}
                <button 
                    onClick={() => setIsOpen(true)} 
                    className="flex items-center gap-2 px-4 h-full hover:bg-[#111] transition-colors border-r border-[#1F1F1F]"
                >
                    <span className={`text-[10px] font-mono font-bold ${aiState !== 'idle' ? 'text-brand-purple animate-pulse' : 'text-gray-500'}`}>
                        AI_CORE:{aiState.toUpperCase()}
                    </span>
                </button>
            </div>

            {/* Center: Clock */}
            <div className="hidden md:flex items-center gap-3">
                <span className="text-[10px] font-mono text-gray-500">{dateString}</span>
                <span className="text-sm font-mono font-bold text-white tracking-widest bg-[#111] px-2 py-0.5 rounded-sm border border-[#222]">{timeString}</span>
            </div>

            {/* Right: Tools */}
            <div className="flex h-full items-center">
                <div className="px-4 h-full flex items-center gap-2 border-l border-[#1F1F1F]">
                    <div className="text-[9px] text-gray-600 font-mono text-right leading-tight">
                        <div>MEM: 64TB</div>
                        <div>NET: SECURE</div>
                    </div>
                </div>
                <button 
                    onClick={toggleFullscreen}
                    className="w-10 h-full flex items-center justify-center hover:bg-[#111] border-l border-[#1F1F1F] text-gray-500 hover:text-white"
                >
                    <FullScreenIcon className="w-4 h-4" isFullscreen={isFullscreen} />
                </button>
            </div>
        </div>
    );
};

export default SystemStatusBar;
