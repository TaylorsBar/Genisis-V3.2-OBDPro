import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { motion } from 'motion/react';
import { AppearanceContext } from '../../contexts/AppearanceContext';

interface CircuitOverviewProps {
    className?: string;
    accentColor?: string;
}

export const CircuitOverview: React.FC<CircuitOverviewProps> = ({ className = "", accentColor = "#00FFFF" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const latestData = useVehicleStore(state => state.latestData);

    const [dimensions, setDimensions] = useState({ width: 300, height: 300 });
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Accumulate path to draw the full circuit
    const accumulatedPathRef = useRef<{ x: number, y: number, isBraking: boolean }[]>([]);
    const lastIntegrationRef = useRef<{ time: number, heading: number, x: number, y: number }>({ time: 0, heading: 0, x: 0, y: 0 });

    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setDimensions({ width, height });
            }
        });
        
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        
        return () => resizeObserver.disconnect();
    }, []);

    const mapData = useMemo(() => {
        const pt = latestData;
        if (!pt) return null;

        const path = accumulatedPathRef.current;
        const hasGPS = pt.latitude !== 0 && pt.longitude !== 0 && pt.latitude !== undefined;
        
        let newX = 0;
        let newY = 0;
        const isBraking = (pt.gForceY || 0) < -0.2;

        if (hasGPS) {
            newX = pt.longitude || 0;
            newY = pt.latitude || 0;
        } else {
            // Dead reckoning integration
            const dt = pt.time ? (pt.time - lastIntegrationRef.current.time) / 1000 : 0;
            if (dt > 0 && dt < 1) { // Normal time step
                const speedMs = (pt.speed || 0) * (1000/3600);
                let omega = 0;
                if (speedMs > 1) {
                    omega = ((pt.gForceX || 0) * 9.81) / speedMs;
                }
                
                let heading = lastIntegrationRef.current.heading + (omega * dt);
                const dist = speedMs * dt;
                
                newX = lastIntegrationRef.current.x + (dist * Math.cos(heading));
                newY = lastIntegrationRef.current.y + (dist * Math.sin(heading));
                
                lastIntegrationRef.current = { time: pt.time, heading, x: newX, y: newY };
            } else if (pt.time) {
                lastIntegrationRef.current.time = pt.time;
                newX = lastIntegrationRef.current.x;
                newY = lastIntegrationRef.current.y;
            }
        }

        // Only add if it's moved significantly to avoid array bloat
        const minDistance = hasGPS ? 0.00005 : 3.0; // GPS degrees or 3 meters
        const lastPt = path[path.length - 1];
        
        if (!lastPt || Math.hypot(newX - lastPt.x, newY - lastPt.y) > minDistance) {
            path.push({ x: newX, y: newY, isBraking });
            // Cap at 150 points for high-performance fluid game-HUD rendering
            if (path.length > 150) {
                path.shift();
            }
        }

        if (path.length === 0) return null;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        path.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        // Add padding
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        
        return {
            path,
            heading: lastIntegrationRef.current.heading,
            minX: minX - rangeX * 0.1,
            maxX: maxX + rangeX * 0.1,
            minY: minY - rangeY * 0.1,
            maxY: maxY + rangeY * 0.1,
            rangeX: rangeX * 1.2,
            rangeY: rangeY * 1.2
        };
    }, [latestData]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = dimensions;
        
        // Handle high DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gridSize = 20;
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const { path, heading, minX, minY, rangeX, rangeY } = mapData || { path: [], heading: 0, minX: 0, minY: 0, rangeX: 1, rangeY: 1 };

        if (!mapData || path.length < 2) return;

        // Calculate scaling to fit the path in the canvas
        const scaleX = width / rangeX;
        const scaleY = height / rangeY;
        const scale = Math.min(scaleX, scaleY);
        
        // Center offset
        const cx = (width - (rangeX * scale)) / 2;
        const cy = (height - (rangeY * scale)) / 2;

        const getCanvasCoord = (x: number, y: number) => {
            return {
                cx: cx + (x - minX) * scale,
                cy: cy + (y - minY) * scale // Removed Flip Y axis because rotation handles it better
            };
        };

        // Draw track layout with high-performance dual-pass glow (Need For Speed / Arcade style)
        const lastPoint = path[path.length - 1];
        const lastC = getCanvasCoord(lastPoint.x, lastPoint.y);

        ctx.save();
        // Circular clipping
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 4, 0, Math.PI * 2);
        ctx.clip();
        
        // Rotate around center of canvas to follow heading
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-heading);
        ctx.translate(-lastC.cx, -lastC.cy);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Pass 1: Wide, semi-transparent glow lines
        ctx.lineWidth = 12;
        for (let i = 1; i < path.length; i++) {
            const p1 = path[i-1];
            const p2 = path[i];
            const c1 = getCanvasCoord(p1.x, p1.y);
            const c2 = getCanvasCoord(p2.x, p2.y);
            
            ctx.beginPath();
            ctx.moveTo(c1.cx, c1.cy);
            ctx.lineTo(c2.cx, c2.cy);
            ctx.strokeStyle = p2.isBraking ? 'rgba(255, 0, 60, 0.25)' : `${accentColor}33`; // 20% opacity
            ctx.stroke();
        }

        // Pass 2: Sharp, high-contrast foreground lines
        ctx.lineWidth = 4;
        for (let i = 1; i < path.length; i++) {
            const p1 = path[i-1];
            const p2 = path[i];
            const c1 = getCanvasCoord(p1.x, p1.y);
            const c2 = getCanvasCoord(p2.x, p2.y);
            
            ctx.beginPath();
            ctx.moveTo(c1.cx, c1.cy);
            ctx.lineTo(c2.cx, c2.cy);
            ctx.strokeStyle = p2.isBraking ? '#FF003C' : accentColor;
            ctx.stroke();
        }
        ctx.restore();

        // Draw current position (fixed in center)
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        
        // Glow effect for current position
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 16, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, 0.2)`;
        ctx.fill();

        // Draw HUD border
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 4, 0, Math.PI * 2);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 4;
        ctx.stroke();

    }, [mapData, dimensions, accentColor]);

    return (
        <div ref={containerRef} className={`relative bg-black/60 rounded-full border-2 border-white/20 overflow-hidden flex flex-col ${className}`}>
            <div className="absolute top-1/4 left-0 w-full text-center z-10">
                <h3 className="text-white/40 text-[10px] font-display font-black tracking-widest uppercase">
                    Circuit
                </h3>
            </div>
            <div className="flex-1 w-full relative">
                <canvas 
                    ref={canvasRef}
                    style={{ width: '100%', height: '100%', display: 'block' }}
                />
            </div>
        </div>
    );
};
