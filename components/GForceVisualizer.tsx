import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Target, Maximize2, Minimize2 } from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';

export const GForceVisualizer: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [peaks, setPeaks] = useState({ x: 0, y: 0, negX: 0, negY: 0 });
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { desynchronized: true });
        if (!ctx) return;

        const size = canvas.width;
        const center = size / 2;
        const scale = (size / 2) * 0.4; // 2G scale

        // Update peaks
        setPeaks(prev => ({
            x: Math.max(prev.x, latestData.gForceX),
            y: Math.max(prev.y, latestData.gForceY),
            negX: Math.min(prev.negX, latestData.gForceX),
            negY: Math.min(prev.negY, latestData.gForceY)
        }));

        // Clear and draw
        ctx.clearRect(0, 0, size, size);

        // Draw Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // Circles
        [0.5, 1.0, 1.5, 2.0].forEach(g => {
            ctx.beginPath();
            ctx.arc(center, center, g * scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = '8px Inter';
            ctx.fillText(`${g}G`, center + g * scale + 2, center - 2);
        });

        // Axes
        ctx.beginPath();
        ctx.moveTo(0, center); ctx.lineTo(size, center);
        ctx.moveTo(center, 0); ctx.lineTo(center, size);
        ctx.stroke();

        // Draw Peak Envelope (Subtle)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(
            center + peaks.negX * scale,
            center + peaks.negY * scale,
            (peaks.x - peaks.negX) * scale,
            (peaks.y - peaks.negY) * scale
        );
        ctx.setLineDash([]);

        // Draw Current Point
        const posX = center + latestData.gForceX * scale;
        const posY = center + latestData.gForceY * scale;

        // Glow
        const gradient = ctx.createRadialGradient(posX, posY, 0, posX, posY, 15);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(posX, posY, 15, 0, Math.PI * 2);
        ctx.fill();

        // Dot
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(posX, posY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

    }, [latestData.gForceX, latestData.gForceY]);

    return (
        <div className={`bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col transition-all duration-500 ${isExpanded ? 'h-[600px]' : 'h-[400px]'}`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">G-Force Analysis</h3>
                        <p className="text-xs text-white/40">Lateral & Longitudinal acceleration</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl transition-all"
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 relative">
                <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={400} 
                    className="max-w-full max-h-full"
                />
                
                {/* Real-time Values Overlay */}
                <div className="absolute top-8 left-8 space-y-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Lateral</span>
                        <span className="text-2xl font-mono font-bold text-white">{latestData.gForceX.toFixed(2)}G</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Longitudinal</span>
                        <span className="text-2xl font-mono font-bold text-white">{latestData.gForceY.toFixed(2)}G</span>
                    </div>
                </div>

                {/* Peak Stats Overlay */}
                <div className="absolute bottom-8 right-8 grid grid-cols-2 gap-x-8 gap-y-4 text-right">
                    <div>
                        <p className="text-[8px] text-white/40 uppercase font-bold">Peak Left</p>
                        <p className="text-sm font-mono text-white font-bold">{peaks.negX.toFixed(2)}G</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-white/40 uppercase font-bold">Peak Right</p>
                        <p className="text-sm font-mono text-white font-bold">{peaks.x.toFixed(2)}G</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-white/40 uppercase font-bold">Peak Brake</p>
                        <p className="text-sm font-mono text-white font-bold">{peaks.negY.toFixed(2)}G</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-white/40 uppercase font-bold">Peak Accel</p>
                        <p className="text-sm font-mono text-white font-bold">{peaks.y.toFixed(2)}G</p>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest">
                <div className="flex items-center gap-4">
                    <span>Sensor: 6-Axis IMU</span>
                    <span>Fusion: EKF Active</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>Sample Rate: 100Hz</span>
                    <span>Filter: Low-Pass 20Hz</span>
                </div>
            </div>
        </div>
    );
};
