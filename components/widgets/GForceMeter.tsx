
import React, { useEffect, useRef } from 'react';
import { TireDynamicsModel, VehicleDynamics } from '../../services/ATEngine';

interface GForceMeterProps {
    x: number; // Lateral G
    y: number; // Longitudinal G
    speedKph?: number; // Needed for dynamic friction circle
    yawRate?: number; // Fused Yaw Rate
    size?: number;
    transparent?: boolean;
    canvasStyle?: React.CSSProperties;
}

const GForceMeter: React.FC<GForceMeterProps> = ({ x, y, speedKph = 0, yawRate, size = 200, transparent = false, canvasStyle }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const historyRef = useRef<{x: number, y: number, alpha: number}[]>([]);
    
    // Dynamic max G based on speed (aero)
    const MAX_G = Math.max(1.5, TireDynamicsModel.getDynamicFrictionLimit(speedKph));
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { desynchronized: true });
        if (!ctx) return;

        // Handle DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);

        const cx = size / 2;
        const cy = size / 2;
        const scale = (size / 2) / MAX_G; 

        // Add new point with full alpha
        if (Number.isFinite(x) && Number.isFinite(y)) {
            historyRef.current.push({ x, y, alpha: 1.0 });
        }

        // Fade history
        for (let i = historyRef.current.length - 1; i >= 0; i--) {
            historyRef.current[i].alpha -= 0.02; // Fade speed
            if (historyRef.current[i].alpha <= 0) {
                historyRef.current.splice(i, 1);
            }
        }

        // --- DRAW ---
        ctx.clearRect(0, 0, size, size);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        [0.5, 1.0, 1.5, 2.0].forEach(g => {
            if (g > MAX_G) return;
            ctx.beginPath();
            ctx.arc(cx, cy, g * scale, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Dynamic Friction Circle (Grip Limit)
        const dynamicLimit = TireDynamicsModel.getDynamicFrictionLimit(speedKph);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, dynamicLimit * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(size, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, size);
        ctx.stroke();

        // Draw Comet Trail
        if (historyRef.current.length > 1) {
            // Draw points as a fading line
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw segments individually to support alpha gradients
            for (let i = 0; i < historyRef.current.length - 1; i++) {
                const p1 = historyRef.current[i];
                const p2 = historyRef.current[i+1];
                
                ctx.beginPath();
                ctx.strokeStyle = `rgba(0, 240, 255, ${p1.alpha})`;
                ctx.lineWidth = 2 + (p1.alpha * 4); // Line gets thicker near head
                
                ctx.moveTo(cx + p1.x * scale, cy - p1.y * scale);
                ctx.lineTo(cx + p2.x * scale, cy - p2.y * scale);
                ctx.stroke();
            }
        }

        // Draw Current Head
        const dotX = cx + (x * scale);
        const dotY = cy - (y * scale);
        
        // Grip Utilization Color
        const gripUtil = VehicleDynamics.getGripUtilization(x, y, dynamicLimit);
        let dotColor = 'rgba(0, 255, 0, 1)'; // Green (Safe)
        let glowColor = 'rgba(0, 255, 0, 0.4)';
        
        if (gripUtil > 95) {
            dotColor = 'rgba(255, 0, 0, 1)'; // Red (Limit/Sliding)
            glowColor = 'rgba(255, 0, 0, 0.6)';
        } else if (gripUtil > 75) {
            dotColor = 'rgba(255, 165, 0, 1)'; // Orange (Approaching limit)
            glowColor = 'rgba(255, 165, 0, 0.5)';
        } else if (gripUtil > 50) {
            dotColor = 'rgba(255, 255, 0, 1)'; // Yellow (Working)
            glowColor = 'rgba(255, 255, 0, 0.4)';
        }

        // Glow
        if (Number.isFinite(dotX) && Number.isFinite(dotY)) {
            const grad = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 15);
            grad.addColorStop(0, dotColor);
            grad.addColorStop(0.5, glowColor);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 15, 0, Math.PI * 2);
            ctx.fill();
        }

        // Core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Digital Value
        const safeToFixed = (val: number | undefined, precision: number) => (val !== undefined && Number.isFinite(val) ? val.toFixed(precision) : '0.00');
        const safeToFixedInt = (val: number | undefined, precision: number) => (val !== undefined && Number.isFinite(val) ? val.toFixed(precision) : '0');

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Lat: ${safeToFixed(x, 2)}G`, size - 10, size/2 - 20);
        ctx.fillText(`Lon: ${safeToFixed(y, 2)}G`, size - 10, size/2 - 5);
        
        // Grip Util
        ctx.fillStyle = dotColor;
        ctx.fillText(`Grip: ${safeToFixedInt(gripUtil, 0)}%`, size - 10, size/2 + 10);
        
        if (yawRate !== undefined) {
            ctx.fillStyle = 'rgba(168, 85, 247, 1)'; // Purple
            ctx.fillText(`Yaw: ${safeToFixed(yawRate, 2)}`, size - 10, size/2 + 25);
        }
        
    }, [x, y, speedKph, yawRate, size]); // Re-render on data change

    return (
        <div className={`relative rounded-full ${transparent ? '' : 'bg-black border border-gray-800 shadow-inner'}`} style={{ width: size, height: size }}>
             <canvas ref={canvasRef} style={{ width: size, height: size, ...canvasStyle }} />
        </div>
    );
};

export default GForceMeter;
