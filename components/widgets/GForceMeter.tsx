
import React, { useEffect, useRef } from 'react';

interface GForceMeterProps {
    x: number; // Lateral G (Left/Right)
    y: number; // Longitudinal G (Accel/Brake)
    size?: number;
    transparent?: boolean;
}

const GForceMeter: React.FC<GForceMeterProps> = ({ x, y, size = 200, transparent = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const historyRef = useRef<{x: number, y: number}[]>([]);
    
    // Limits
    const MAX_G = 1.5;
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const scale = (w / 2) / MAX_G; // Pixels per G

        // Update history
        // Only push valid finite numbers
        if (Number.isFinite(x) && Number.isFinite(y)) {
            historyRef.current.push({ x, y });
            if (historyRef.current.length > 40) historyRef.current.shift();
        }

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw Rings (0.5G, 1.0G, 1.5G)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        
        [0.5, 1.0, 1.5].forEach(g => {
            ctx.beginPath();
            ctx.arc(cx, cy, g * scale, 0, Math.PI * 2);
            ctx.stroke();
            
            // Labels
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '9px "JetBrains Mono"';
            ctx.textAlign = 'center';
            if (g < 1.5) ctx.fillText(`${g.toFixed(1)}G`, cx, cy - (g * scale) + 10);
        });

        // Draw Crosshair
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();

        // Draw Trail
        if (historyRef.current.length > 1) {
            ctx.beginPath();
            historyRef.current.forEach((pt, i) => {
                const px = cx + (pt.x * scale);
                const py = cy - (pt.y * scale); // Invert Y (Up is Accel, Down is Brake usually)
                
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(252, 238, 10, 0.4)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Draw Current Dot
        const dotX = cx + (x * scale);
        const dotY = cy - (y * scale); // Invert Y
        
        // Ensure coordinates are valid numbers before drawing gradient
        if (Number.isFinite(dotX) && Number.isFinite(dotY)) {
            try {
                // Outer Glow
                const gradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 20);
                gradient.addColorStop(0, 'rgba(252, 238, 10, 0.8)');
                gradient.addColorStop(0.4, 'rgba(252, 238, 10, 0.2)');
                gradient.addColorStop(1, 'rgba(252, 238, 10, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(dotX, dotY, 20, 0, Math.PI * 2);
                ctx.fill();

                // Solid Core
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
                ctx.fill();
            } catch (e) {
                // Suppress finite gradient errors
            }
        }

        // Text Values
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 12px "Orbitron"';
        ctx.textAlign = 'right';
        ctx.fillText(`${(Number.isFinite(x) ? x : 0).toFixed(2)}G`, w - 10, h / 2 - 5);
        ctx.textAlign = 'left';
        ctx.fillText(`${(Number.isFinite(y) ? y : 0).toFixed(2)}G`, 10, h / 2 - 5);

    }, [x, y, MAX_G, size]);

    return (
        <div className={`relative rounded-full flex items-center justify-center ${transparent ? '' : 'bg-black border border-gray-800 shadow-[inset_0_0_20px_rgba(0,0,0,1)]'}`} style={{ width: size, height: size }}>
             <canvas 
                ref={canvasRef} 
                width={size} 
                height={size} 
                className="w-full h-full rounded-full"
            />
        </div>
    );
};

export default GForceMeter;
