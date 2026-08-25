
import React, { useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

interface LiveTelemetryGraphProps {
    height?: string;
}

const LiveTelemetryGraph: React.FC<LiveTelemetryGraphProps> = ({ height = "100%" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Config
    const HISTORY_LENGTH = 300; // Number of frames to keep
    const GRID_COLOR = '#222';
    
    // We use Refs for data storage to avoid React renders
    const historyRef = useRef<{rpm: Float32Array, boost: Float32Array, tps: Float32Array} | null>(null);
    const headRef = useRef(0);

    // Initialize Buffers
    useEffect(() => {
        historyRef.current = {
            rpm: new Float32Array(HISTORY_LENGTH),
            boost: new Float32Array(HISTORY_LENGTH),
            tps: new Float32Array(HISTORY_LENGTH)
        };
    }, []);

    // Animation Loop
    useEffect(() => {
        let animationFrameId: number;
        const loop = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { alpha: false, desynchronized: true });
            
            if (!canvas || !ctx || !historyRef.current) {
                animationFrameId = requestAnimationFrame(loop);
                return;
            }

            // 1. Fetch latest data DIRECTLY from store (bypass React props)
            // This is critical for 60fps zero-render performance.
            const state = useVehicleStore.getState();
            const d = state.latestData;

            // 2. Update Ring Buffer
            const head = headRef.current;
            historyRef.current.rpm[head] = d.rpm;
            historyRef.current.boost[head] = d.turboBoost;
            historyRef.current.tps[head] = d.engineLoad;
            
            // Advance Head
            headRef.current = (head + 1) % HISTORY_LENGTH;

            // 3. Render
            const w = canvas.width;
            const h = canvas.height;

            // Clear Background
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, w, h);

            // Draw Grid
            ctx.strokeStyle = GRID_COLOR;
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Horizontals
            for(let i=1; i<4; i++) {
                const y = (h / 4) * i;
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
            }
            // Verticals (moving grid effect)
            const offset = (head / HISTORY_LENGTH) * (w / 10); // Parallax grid
            for(let i=0; i<10; i++) {
                const x = (w/10) * i - offset;
                if(x > 0) {
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                }
            }
            ctx.stroke();

            // Draw Traces
            // Helper to draw a line from ring buffer
            const drawTrace = (data: Float32Array, color: string, min: number, max: number, fill?: string, glowColor?: string) => {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                
                if (glowColor) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = glowColor;
                } else {
                    ctx.shadowBlur = 0;
                }
                
                const range = max - min;
                let started = false;

                // We draw from oldest (head + 1) to newest (head)
                for (let i = 0; i < HISTORY_LENGTH; i++) {
                    const idx = (head + 1 + i) % HISTORY_LENGTH;
                    const val = data[idx];
                    
                    const x = (i / (HISTORY_LENGTH - 1)) * w;
                    // Clamp value for visual stability
                    const clampedVal = Math.max(min, Math.min(max, val));
                    const y = h - ((clampedVal - min) / range) * h; // Invert Y

                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                
                // Clear shadow before fill
                ctx.shadowBlur = 0;
                
                // Optional Fill (Area Chart)
                if (fill) {
                    // Create gradient fill vertically
                    const gradient = ctx.createLinearGradient(0, 0, 0, h);
                    gradient.addColorStop(0, fill);
                    gradient.addColorStop(1, 'transparent');

                    ctx.lineTo(w, h);
                    ctx.lineTo(0, h);
                    ctx.closePath();
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
            };

            // Order matters: TPS (back), Boost, RPM (front)
            drawTrace(historyRef.current.tps, '#444444', 0, 100); // TPS
            drawTrace(historyRef.current.boost, '#00F0FF', -1, 3, undefined, '#00F0FF'); // Boost
            drawTrace(historyRef.current.rpm, '#FCEE0A', 0, 9000, 'rgba(252, 238, 10, 0.4)', '#FCEE0A'); // RPM

            // Sweep Scanner Animation
            const scanPos = (performance.now() / 20) % w;
            ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
            ctx.fillRect(scanPos, 0, 2, h);
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00F0FF';
            ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
            ctx.fillRect(scanPos - 1, 0, 4, h);
            ctx.shadowBlur = 0;

            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Handle Resize
    useEffect(() => {
        const resize = () => {
            if (containerRef.current && canvasRef.current) {
                // Handle DPI scaling for sharp text/lines
                const dpr = window.devicePixelRatio || 1;
                const rect = containerRef.current.getBoundingClientRect();
                
                canvasRef.current.width = rect.width * dpr;
                canvasRef.current.height = rect.height * dpr;
                
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) ctx.scale(dpr, dpr);
                
                // CSS size
                canvasRef.current.style.width = `${rect.width}px`;
                canvasRef.current.style.height = `${rect.height}px`;
            }
        };
        
        window.addEventListener('resize', resize);
        resize();
        
        return () => window.removeEventListener('resize', resize);
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full relative border border-white/10 rounded-lg bg-black overflow-hidden" style={{ height }}>
            <canvas ref={canvasRef} className="w-full h-full block" />
            
            {/* Live Values Overlay (React rendered, lower frequency ok) */}
            <div className="absolute top-2 right-2 flex gap-4 pointer-events-none">
                <LegendItem label="RPM" color="#FCEE0A" />
                <LegendItem label="BOOST" color="#00F0FF" />
                <LegendItem label="TPS" color="#555" />
            </div>
        </div>
    );
};

const LegendItem = ({ label, color }: { label: string, color: string }) => (
    <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
        <span className="text-[10px] font-bold text-gray-400 font-mono">{label}</span>
    </div>
);

export default LiveTelemetryGraph;
