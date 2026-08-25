import React, { useEffect, useRef, useMemo } from 'react';

interface GGTraceDiagramProps {
    gForceX: number;
    gForceY: number;
    history: Array<{ gForceX: number; gForceY: number }>;
}

export const GGTraceDiagram: React.FC<GGTraceDiagramProps> = ({ gForceX, gForceY, history }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate peaks dynamically from the history
    const peaks = useMemo(() => {
        let maxLat = 0;
        let minLat = 0;
        let maxLon = 0;
        let minLon = 0;

        history.forEach(pt => {
            const x = pt.gForceX || 0;
            const y = pt.gForceY || 0;
            if (x > maxLat) maxLat = x;
            if (x < minLat) minLat = x;
            if (y > maxLon) maxLon = y;
            if (y < minLon) minLon = y;
        });

        // Ensure we capture real-time values too
        if (gForceX > maxLat) maxLat = gForceX;
        if (gForceX < minLat) minLat = gForceX;
        if (gForceY > maxLon) maxLon = gForceY;
        if (gForceY < minLon) minLon = gForceY;

        return {
            left: Math.abs(minLat),
            right: maxLat,
            brake: Math.abs(minLon), // negative longitudinal G
            accel: maxLon // positive longitudinal G
        };
    }, [history, gForceX, gForceY]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const center = w / 2;
        const maxGScale = 2.0; // max scale 2G
        const pad = 12; // safety padding
        const scale = (center - pad) / maxGScale;

        // Clear canvas with a solid high-tech theme background
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, w, h);

        // Draw radial grid rings (friction boundaries)
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        const gMarkers = [0.5, 1.0, 1.5, 2.0];
        gMarkers.forEach((g) => {
            ctx.beginPath();
            ctx.arc(center, center, g * scale, 0, Math.PI * 2);
            ctx.stroke();

            // Circular division ticks or marker text
            ctx.fillStyle = '#444';
            ctx.font = '8px monospace';
            ctx.fillText(`${g}G`, center + g * scale - 14, center - 3);
        });

        // Draw axes crosshairs
        ctx.strokeStyle = '#181818';
        ctx.beginPath();
        ctx.moveTo(0, center);
        ctx.lineTo(w, center);
        ctx.moveTo(center, 0);
        ctx.lineTo(center, h);
        ctx.stroke();

        // Trace Trail (Connect last 40 history points as a continuous line ribbon)
        const trailCount = Math.min(history.length, 45);
        if (trailCount > 1) {
            ctx.lineWidth = 1.5;
            for (let i = history.length - trailCount; i < history.length - 1; i++) {
                const pt1 = history[i];
                const pt2 = history[i + 1];
                if (!pt1 || !pt2) continue;

                const ageIndex = i - (history.length - trailCount);
                const opacity = (ageIndex / trailCount) * 0.45; // newer points are brighter

                // Map coordinates: X is lateral, Y is longitudinal (racing standard: forward accel is positive Y, braking is negative Y)
                // Canvas Y is inverted (0 is top), so: canvasY = center - Y * scale
                const x1 = center + (pt1.gForceX || 0) * scale;
                const y1 = center - (pt1.gForceY || 0) * scale;
                const x2 = center + (pt2.gForceX || 0) * scale;
                const y2 = center - (pt2.gForceY || 0) * scale;

                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                grad.addColorStop(0, `rgba(0, 240, 255, ${opacity * 0.5})`);
                grad.addColorStop(1, `rgba(188, 19, 254, ${opacity})`);

                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                // Small scatter dots
                ctx.fillStyle = `rgba(0, 240, 255, ${opacity * 0.6})`;
                ctx.beginPath();
                ctx.arc(x2, y2, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Friction Envelope border connecting absolute bounds of points
        ctx.strokeStyle = 'rgba(211, 47, 47, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        // Draw standard rectangular envelope
        ctx.strokeRect(
            center - peaks.left * scale,
            center - peaks.accel * scale,
            (peaks.left + peaks.right) * scale,
            (peaks.accel + peaks.brake) * scale
        );
        ctx.setLineDash([]);

        // Current real-time G vector line
        const currentCanvasX = center + gForceX * scale;
        const currentCanvasY = center - gForceY * scale;

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(currentCanvasX, currentCanvasY);
        ctx.stroke();

        // Inner core of friction center
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(center, center, 3, 0, Math.PI * 2);
        ctx.fill();

        // Current dot glow circle
        const radGlow = ctx.createRadialGradient(
            currentCanvasX, currentCanvasY, 1,
            currentCanvasX, currentCanvasY, 8
        );
        radGlow.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
        radGlow.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = radGlow;
        ctx.beginPath();
        ctx.arc(currentCanvasX, currentCanvasY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Live dot
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(currentCanvasX, currentCanvasY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

    }, [gForceX, gForceY, history, peaks]);

    return (
        <div className="w-full flex flex-col md:flex-row gap-4 p-4 bg-[#0a0a0a]/70 rounded-2xl border border-white/5 shadow-2xl">
            {/* Left: Interactive Canvas */}
            <div className="flex-1 flex justify-center items-center relative bg-black rounded-xl p-2 border border-white/5">
                <canvas 
                    ref={canvasRef} 
                    width={220} 
                    height={220} 
                    className="border border-[#111] rounded-lg shadow-inner w-full max-w-[220px] aspect-square"
                />
            </div>

            {/* Right: Digital Accel Meters */}
            <div className="w-full md:w-36 flex flex-col justify-between py-1 shrink-0">
                <div className="space-y-3">
                    <div className="text-left border-b border-white/5 pb-2">
                        <span className="text-[8px] text-gray-500 font-bold uppercase block tracking-wider">Live Force</span>
                        <div className="flex justify-between font-mono mt-0.5">
                            <span className="text-xs text-brand-cyan">LAT: {gForceX.toFixed(2)}G</span>
                            <span className="text-xs text-brand-purple">LON: {gForceY.toFixed(2)}G</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                            <span className="text-[8px] text-gray-500 font-bold uppercase">Peak Left</span>
                            <span className="text-xs font-mono font-bold text-white">{peaks.left.toFixed(2)}G</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                            <span className="text-[8px] text-gray-500 font-bold uppercase">Peak Right</span>
                            <span className="text-xs font-mono font-bold text-white">{peaks.right.toFixed(2)}G</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                            <span className="text-[8px] text-gray-500 font-bold uppercase">Peak Brake</span>
                            <span className="text-xs font-mono font-bold text-yellow-500">{peaks.brake.toFixed(2)}G</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                            <span className="text-[8px] text-gray-500 font-bold uppercase">Peak Accel</span>
                            <span className="text-xs font-mono font-bold text-green-500">{peaks.accel.toFixed(2)}G</span>
                        </div>
                    </div>
                </div>

                <div className="text-[8px] font-mono text-gray-600 uppercase tracking-widest leading-normal pt-2 border-t border-white/5">
                    ATE_VECTOR_v2.0<br/>
                    LATERAL/LGT PLOT
                </div>
            </div>
        </div>
    );
};
