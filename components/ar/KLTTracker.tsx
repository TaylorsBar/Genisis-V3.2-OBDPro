import React, { useEffect, useRef } from 'react';

interface KLTTrackerProps {
    isActive: boolean;
}

const MAX_FEATURES = 1024;

export const KLTTracker: React.FC<KLTTrackerProps> = ({ isActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return;

        let animationFrameId: number;
        let pxlX = 0, pxlY = 0;

        // Pre-allocate buffers for memory optimization
        const px = new Float32Array(MAX_FEATURES);
        const py = new Float32Array(MAX_FEATURES);
        const vx = new Float32Array(MAX_FEATURES);
        const vy = new Float32Array(MAX_FEATURES);
        const age = new Uint16Array(MAX_FEATURES);
        const status = new Uint8Array(MAX_FEATURES); // 1 = tracked, 0 = lost

        // Initialize features
        for(let i=0; i<MAX_FEATURES; i++) {
            px[i] = Math.random() * window.innerWidth;
            py[i] = Math.random() * window.innerHeight;
            // Simulated optical flow velocities
            vx[i] = (Math.random() - 0.5) * 2.0; 
            vy[i] = (Math.random() - 0.5) * 2.0;
            age[i] = Math.random() * 100;
            status[i] = 1;
        }

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        let timeOffset = 0;

        const renderKLT = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            timeOffset += 0.01;

            // Global motion estimation simulating ego-motion
            const globalFlowX = Math.sin(timeOffset) * 2;
            const globalFlowY = Math.cos(timeOffset * 0.8) * 2;

            ctx.lineWidth = 1;
            
            for (let i = 0; i < MAX_FEATURES; i++) {
                if (status[i]) {
                    // Update position
                    const oldX = px[i];
                    const oldY = py[i];

                    // KLT differential flow (simulated via global + local gradient)
                    px[i] += vx[i] + globalFlowX;
                    py[i] += vy[i] + globalFlowY;
                    age[i]++;

                    // Draw tracking vector (Optical flow line)
                    ctx.beginPath();
                    ctx.moveTo(oldX, oldY);
                    ctx.lineTo(px[i], py[i]);
                    // Coloring based on age and direction
                    ctx.strokeStyle = `rgba(0, 240, 255, ${Math.max(0.1, 1.0 - age[i]/200)})`;
                    ctx.stroke();

                    // Draw Shi-Tomasi Corner feature point
                    ctx.fillStyle = age[i] < 10 ? '#BC13FE' : '#00F0FF';
                    ctx.fillRect(px[i] - 1.5, py[i] - 1.5, 3, 3);
                    
                    // Out of bounds or lost feature re-initialization
                    if (px[i] < 0 || px[i] > canvas.width || py[i] < 0 || py[i] > canvas.height || age[i] > 150) {
                        px[i] = Math.random() * canvas.width;
                        py[i] = Math.random() * canvas.height;
                        age[i] = 0;
                    }
                }
            }

            // Draw Odometry Vectors
            ctx.beginPath();
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + globalFlowX * 30, cy + globalFlowY * 30);
            ctx.strokeStyle = '#FF003C';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // HUD Text
            ctx.fillStyle = '#FF003C';
            ctx.font = '10px monospace';
            ctx.fillText(`KLT ODEM: [${globalFlowX.toFixed(2)}, ${globalFlowY.toFixed(2)}] pts: ${MAX_FEATURES}`, cx + globalFlowX * 30 + 10, cy + globalFlowY * 30);

            animationFrameId = requestAnimationFrame(renderKLT);
        };

        renderKLT();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [isActive]);

    return (
        <canvas 
            ref={canvasRef} 
            className={`absolute inset-0 z-10 pointer-events-none mix-blend-screen transition-opacity duration-1000 ${isActive ? 'opacity-50' : 'opacity-0'}`}
        />
    );
};
