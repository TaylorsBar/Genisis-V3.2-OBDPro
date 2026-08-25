
import React, { useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';

declare global {
    interface Window {
        Plotly: any;
    }
}

interface NeuralLearningMap3DProps {
    type?: 've' | 'ign' | 'lambda' | 'boost';
}

const NeuralLearningMap3D: React.FC<NeuralLearningMap3DProps> = ({ type = 've' }) => {
    const plotContainerRef = useRef<HTMLDivElement>(null);
    const learningMaps = useVehicleStore(state => state.learningMaps);
    const latestData = useVehicleStore(state => state.latestData);

    const rpmPoints = Array.from({length: 16}, (_, i) => i * 500); 
    const loadPoints = Array.from({length: 16}, (_, i) => i * 6.25); 
    
    const zValues = (learningMaps as any)[type] || learningMaps.ve;

    useEffect(() => {
        if (!window.Plotly || !plotContainerRef.current) return;

        const data = [{
            z: zValues,
            x: rpmPoints,
            y: loadPoints,
            type: 'surface',
            colorscale: type === 'ign' ? 'Hot' : (type === 'lambda' ? 'Viridis' : 'Electric'),
            showscale: true,
            colorbar: {
                thickness: 10,
                len: 0.5,
                tickfont: { color: '#666', size: 8 }
            },
            contours: {
                z: {
                    show: true,
                    usecolormap: true,
                    highlightcolor: "#fff",
                    project: { z: true }
                }
            }
        },
        {
            x: [latestData.rpm],
            y: [latestData.engineLoad],
            z: [0], // dynamic
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                size: 8,
                color: '#FF0055',
                symbol: 'circle',
                line: { color: 'white', width: 2 }
            },
            name: 'State'
        }];

        const layout = {
            autosize: true,
            margin: { l: 0, r: 0, b: 0, t: 0 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'Inter, sans-serif', color: '#666' },
            scene: {
                xaxis: { title: 'RPM', color: '#666', gridcolor: '#222' },
                yaxis: { title: 'LOAD %', color: '#666', gridcolor: '#222' },
                zaxis: { title: type.toUpperCase(), color: '#666', gridcolor: '#222' },
                camera: {
                    eye: { x: 1.5, y: 1.5, z: 1.2 }
                },
                aspectratio: { x: 1, y: 1, z: 0.7 }
            },
            showlegend: false
        };

        const config = { responsive: true, displayModeBar: false };

        window.Plotly.newPlot(plotContainerRef.current, data, layout, config);

        return () => {
             if (plotContainerRef.current) {
                 window.Plotly.purge(plotContainerRef.current);
             }
        }
    }, [type]); // Re-init only on type change (color scales, labels)

    // Smooth update for live point and surface updates
    useEffect(() => {
        if (!window.Plotly || !plotContainerRef.current) return;
        
        const rIdx = Math.min(15, Math.floor(latestData.rpm / 500));
        const lIdx = Math.min(15, Math.floor(latestData.engineLoad / 6.25));
        const liveZ = zValues[lIdx][rIdx] + 2;

        window.Plotly.animate(plotContainerRef.current, {
            data: [
                { z: zValues }, // Update surface if data changed
                { x: [latestData.rpm], y: [latestData.engineLoad], z: [liveZ] }
            ]
        }, {
            transition: { duration: 100, easing: 'cubic-in-out' },
            frame: { duration: 100, redraw: false }
        });
        
    }, [latestData.rpm, latestData.engineLoad, zValues]);

    return (
        <div className="relative w-full h-full min-h-[300px]">
            <div ref={plotContainerRef} className="w-full h-full" />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/10 text-[10px] text-white/60 uppercase tracking-widest pointer-events-none">
                Live 3D Optimized {type}
            </div>

            {/* Autonomous Neural RL Agent UI Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md p-4 rounded-xl border border-brand-purple/30 shadow-[0_0_20px_rgba(188,19,254,0.15)] flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-brand-purple/5 opacity-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(188,19,254,0.1)_2px,rgba(188,19,254,0.1)_4px)]"></div>
                    <div className="flex items-center gap-2 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shadow-[0_0_8px_#BC13FE]"></div>
                        <h3 className="text-[10px] font-black text-brand-purple uppercase tracking-[0.2em]">Autonomous RL Agent</h3>
                    </div>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest max-w-[200px] leading-relaxed relative z-10">
                        Reinforcement Learning continuously adapting {type.toUpperCase()} dynamically vs target parameters.
                    </p>
                </div>
                
                <div className="bg-black/80 backdrop-blur-md p-3 rounded-xl border border-white/10 flex flex-col gap-3 shadow-2xl">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Cell Confidence (μ)</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-gray-600 font-mono">NEW</span>
                                <div className="w-24 h-1.5 bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full opacity-80"></div>
                                <span className="text-[7px] text-emerald-500 font-mono">VERIFIED</span>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-white/10"></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">RL Exploration</span>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-white/20 border border-white/50 shadow-[0_0_5px_rgba(255,255,255,0.5)] animate-pulse"></div>
                                <span className="text-[9px] font-mono text-white tracking-widest">ACTIVE ZONE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NeuralLearningMap3D;
