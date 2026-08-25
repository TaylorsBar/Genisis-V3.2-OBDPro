import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export const DynoLab: React.FC = () => {
    const [isPulling, setIsPulling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [maxHp, setMaxHp] = useState(0);
    const [maxTorque, setMaxTorque] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pullTimer = useRef<any>(null);
    const dataPoints = useRef<{ rpm: number; hp: number; torque: number }[]>([]);

    useEffect(() => {
        drawChart();
    }, []);

    const drawChart = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        
        // Vertical grid lines (RPM 1000 - 8000)
        for (let i = 1; i <= 8; i++) {
            const x = (i / 8) * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();

            // Label
            ctx.fillStyle = '#52525b';
            ctx.font = '10px monospace';
            ctx.fillText(`${i}k`, x - 10, h - 8);
        }

        // Horizontal grid lines
        for (let j = 1; j <= 5; j++) {
            const y = (j / 6) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        if (dataPoints.current.length < 2) {
            // Draw placeholder curves
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, h * 0.85);
            ctx.quadraticCurveTo(w * 0.5, h * 0.2, w, h * 0.4);
            ctx.stroke();
            ctx.setLineDash([]);
            return;
        }

        // Helper to map RPM to X
        const getX = (rpm: number) => {
            return ((rpm - 1000) / 7000) * w;
        };

        // Helper to map HP/Torque to Y
        const getY = (val: number) => {
            const maxScale = 850; // max scale limit for graphing
            return h - (val / maxScale) * (h - 40) - 25;
        };

        // Draw HP Curve (Cyan)
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        dataPoints.current.forEach((pt, idx) => {
            const x = getX(pt.rpm);
            const y = getY(pt.hp);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw Torque Curve (Yellow)
        ctx.shadowColor = '#FCEE0A';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#FCEE0A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        dataPoints.current.forEach((pt, idx) => {
            const x = getX(pt.rpm);
            const y = getY(pt.torque);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.shadowBlur = 0; // reset
    };

    const startPull = () => {
        if (isPulling) return;
        setIsPulling(true);
        setProgress(0);
        setMaxHp(0);
        setMaxTorque(0);
        dataPoints.current = [];

        let currentRpm = 1000;
        pullTimer.current = setInterval(() => {
            currentRpm += 150;
            if (currentRpm >= 8000) {
                clearInterval(pullTimer.current);
                setIsPulling(false);
            }

            // Power/Torque physics simulation logic
            const hpFactor = Math.sin((currentRpm - 1000) / 5000) * 450 + (currentRpm * 0.04);
            const torqueFactor = Math.cos((currentRpm - 2000) / 4500) * 580 - (currentRpm * 0.015);
            
            const randHp = hpFactor + Math.random() * 8;
            const randTorque = torqueFactor + Math.random() * 8;

            const hp = Math.max(0, parseFloat(randHp.toFixed(0)));
            const torque = Math.max(0, parseFloat(randTorque.toFixed(0)));

            dataPoints.current.push({
                rpm: currentRpm,
                hp,
                torque
            });

            setMaxHp(prev => Math.max(prev, hp));
            setMaxTorque(prev => Math.max(prev, torque));
            setProgress(((currentRpm - 1000) / 7000) * 100);

            drawChart();
        }, 60);
    };

    const cancelPull = () => {
        if (pullTimer.current) clearInterval(pullTimer.current);
        setIsPulling(false);
        setProgress(0);
        dataPoints.current = [];
        setMaxHp(0);
        setMaxTorque(0);
        drawChart();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-1 max-w-7xl mx-auto w-full items-start">
            
            {/* DYNO PERFORMANCE METRICS */}
            <div className="lg:col-span-4 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between shadow-2xl min-h-[420px]">
                <div className="border-b border-zinc-800 pb-3">
                    <span className="text-[10px] font-technical font-black tracking-[0.25em] text-zinc-500 uppercase">VIRTUAL SIM LAB</span>
                    <h3 className="text-sm font-technical font-black text-brand-cyan tracking-widest uppercase italic mt-1">PEAK DYNO OUTPUT</h3>
                </div>

                <div className="flex-1 flex flex-col justify-center space-y-6 py-6">
                    {/* Peak Horsepower Block */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex justify-between items-center relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-cyan pointer-events-none"></div>
                        <div>
                            <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block">PEAK POWER</span>
                            <span className="text-base font-technical font-black text-white italic">HORSEPOWER</span>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-mono font-black text-brand-cyan tracking-tight italic">
                                {maxHp || '---'} <span className="text-xs text-zinc-600 font-sans leading-none uppercase">WHP</span>
                            </span>
                        </div>
                    </div>

                    {/* Peak Torque Block */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex justify-between items-center relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-yellow pointer-events-none"></div>
                        <div>
                            <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block">PEAK TORQUE</span>
                            <span className="text-base font-technical font-black text-white italic">CRANK FORCE</span>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-mono font-black text-brand-yellow tracking-tight italic">
                                {maxTorque || '---'} <span className="text-xs text-zinc-600 font-sans leading-none uppercase">NM</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {isPulling && (
                        <div className="h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-cyan shadow-[0_0_10px_#00F0FF]" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={startPull}
                            disabled={isPulling}
                            className={`flex-1 py-3 text-black font-technical font-black uppercase tracking-[0.2em] rounded-xl text-xs transition-all ${
                                isPulling 
                                    ? 'bg-zinc-800 text-zinc-600 border border-zinc-900 cursor-not-allowed' 
                                    : 'bg-brand-cyan hover:bg-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                            }`}
                        >
                            {isPulling ? 'SWEEPING RPM...' : 'RUN SIM PULL'}
                        </button>
                        {isPulling && (
                            <button
                                onClick={cancelPull}
                                className="px-4 py-3 bg-brand-red text-white hover:bg-red-600 font-technical font-black text-xs uppercase rounded-xl transition-all"
                            >
                                HALT
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* DYNO CANVAS PLOTTER */}
            <div className="lg:col-span-8 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col min-h-[420px]">
                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
                    <div>
                        <h3 className="text-sm font-technical font-black tracking-widest text-white italic uppercase">REAL-TIME GRAPH TRACE</h3>
                        <p className="text-[9px] font-mono text-zinc-500 tracking-wider">SWEEP COEF_A // HARMONIC CORRECTION FACTORS</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-brand-cyan"></div>
                            <span className="text-zinc-400">POWER (HP)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-brand-yellow"></div>
                            <span className="text-zinc-400">TORQUE (NM)</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full bg-zinc-950 border border-zinc-900 rounded-xl relative overflow-hidden p-2 min-h-[280px]">
                    <canvas 
                        ref={canvasRef} 
                        width={650} 
                        height={300} 
                        className="w-full h-full block"
                    />
                </div>
            </div>

        </div>
    );
};

export default DynoLab;
