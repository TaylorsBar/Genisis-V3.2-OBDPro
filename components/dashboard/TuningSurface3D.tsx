
import React, { useEffect, useRef } from 'react';

interface TuningSurface3DProps {
    data: number[][]; // 16x16 data grid
    rpm: number;
    load: number;
    height?: string;
}

const TuningSurface3D: React.FC<TuningSurface3DProps> = ({ data: mapData, rpm, load, height = "100%" }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotInitialized = useRef(false);

    // Generate Axis Labels
    const size = 16;
    const x = Array.from({length: size}, (_, i) => i * (8000/(size-1))); // RPM 0-8000
    const y = Array.from({length: size}, (_, i) => i * (100/(size-1))); // Load 0-100

    // 1. Initialization
    useEffect(() => {
        if (!window.Plotly || !containerRef.current) return;

        const plotData = [
            {
                z: mapData,
                x: x,
                y: y,
                type: 'surface',
                colorscale: [
                    [0, '#050505'], 
                    [0.2, '#003366'], 
                    [0.5, '#BC13FE'], 
                    [0.8, '#FF003C'],
                    [1, '#FCEE0A']
                ],
                showscale: false,
                contours: {
                    z: { show: true, usecolormap: true, highlightcolor: "#00F0FF", project: { z: true }, width: 2 },
                    x: { show: true, color: 'rgba(255,255,255,0.05)', width: 1 },
                    y: { show: true, color: 'rgba(255,255,255,0.05)', width: 1 }
                },
                opacity: 0.9,
                lighting: {
                    ambient: 0.6,
                    diffuse: 0.8,
                    specular: 0.9,
                    roughness: 0.2,
                    fresnel: 0.5
                }
            },
            // Tracer Point (Trace 1)
            {
                x: [rpm],
                y: [load],
                z: [100], // Initial placeholder
                mode: 'markers',
                type: 'scatter3d',
                marker: {
                    size: 6,
                    color: '#00FF41',
                    symbol: 'circle',
                    line: { color: '#000', width: 1 },
                    opacity: 0.8
                },
                name: 'Live Point'
            }
        ];

        const layout = {
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 10, r: 10, b: 10, t: 10 },
            scene: {
                xaxis: { title: { text: 'RPM', font: { family: 'Orbitron', size: 10, color: '#888' } }, color: '#444', gridcolor: '#1a1a1a', backgroundcolor: 'rgba(0,0,0,0)', zerolinecolor: '#333' },
                yaxis: { title: { text: 'LOAD %', font: { family: 'Orbitron', size: 10, color: '#888' } }, color: '#444', gridcolor: '#1a1a1a', backgroundcolor: 'rgba(0,0,0,0)', zerolinecolor: '#333' },
                zaxis: { title: { text: 'VALUE', font: { family: 'Orbitron', size: 10, color: '#888' } }, color: '#444', gridcolor: '#1a1a1a', backgroundcolor: 'rgba(0,0,0,0)', zerolinecolor: '#333' },
                camera: {
                    eye: { x: 1.6, y: 1.4, z: 0.9 },
                    center: { x: 0, y: 0, z: -0.1 }
                },
            },
            showlegend: false,
            hovermode: 'closest'
        };

        const config = { responsive: true, displayModeBar: false };

        window.Plotly.newPlot(containerRef.current, plotData, layout, config).then(() => {
            plotInitialized.current = true;
        });

        return () => {
             if (containerRef.current) window.Plotly.purge(containerRef.current);
             plotInitialized.current = false;
        }
    }, []); 

    // 2. Handle Map Data Updates (AI changes, Manual Edits)
    // Uses 'restyle' to forcefully update the geometry of Trace 0
    useEffect(() => {
        if (!window.Plotly || !containerRef.current || !plotInitialized.current) return;
        
        window.Plotly.restyle(containerRef.current, { z: [mapData] }, [0]);
        
    }, [mapData]);

    // 3. Handle Live Tracer Updates (Throttled)
    // Uses 'animate' for smooth transition of Trace 1 without redrawing the whole surface mesh
    // We throttle this to ~15Hz to prevent Plotly from choking the main thread
    const lastUpdateRef = useRef(0);
    
    useEffect(() => {
        if (!window.Plotly || !containerRef.current || !plotInitialized.current) return;

        const now = performance.now();
        if (now - lastUpdateRef.current < 66) return; // ~15Hz throttle
        lastUpdateRef.current = now;

        // Bilinear Interpolation for Tracer Z-height
        const rpmNorm = Math.min(15, Math.max(0, rpm / (8000/15)));
        const loadNorm = Math.min(15, Math.max(0, load / (100/15)));
        
        const x0 = Math.floor(rpmNorm);
        const x1 = Math.min(15, x0 + 1);
        const y0 = Math.floor(loadNorm);
        const y1 = Math.min(15, y0 + 1);
        
        const wx = rpmNorm - x0;
        const wy = loadNorm - y0;
        
        // Safety check if mapData update is pending
        if (!mapData[y0] || !mapData[y1]) return;

        const z00 = mapData[y0][x0];
        const z10 = mapData[y0][x1];
        const z01 = mapData[y1][x0];
        const z11 = mapData[y1][x1];
        
        const zInterp = (1-wy)*((1-wx)*z00 + wx*z10) + wy*((1-wx)*z01 + wx*z11);
        const traceHeight = zInterp + 2; // Slight offset to float above surface

        window.Plotly.animate(containerRef.current, {
            data: [{ x: [rpm], y: [load], z: [traceHeight] }],
            traces: [1] // Only animate trace 1 (the tracer point)
        }, {
            transition: { duration: 0 },
            frame: { duration: 0, redraw: false }
        });
        
    }, [rpm, load, mapData]);

    // 4. Gamepad Camera Control
    useEffect(() => {
        if (!window.Plotly || !containerRef.current) return;

        const handleGamepadAxis = (e: CustomEvent) => {
            if (!plotInitialized.current || !containerRef.current) return;

            const { axis, value } = e.detail;
            
            // Get current camera
            const currentLayout = (containerRef.current as any).layout;
            if (!currentLayout || !currentLayout.scene || !currentLayout.scene.camera) return;

            const currentEye = currentLayout.scene.camera.eye;
            let newEye = { ...currentEye };

            // Right stick X (axis 2) rotates around Z
            if (axis === 2) {
                const angle = value * 0.1; // Rotation speed
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                newEye.x = currentEye.x * cosA - currentEye.y * sinA;
                newEye.y = currentEye.x * sinA + currentEye.y * cosA;
            }
            
            // Right stick Y (axis 3) changes elevation (Z)
            if (axis === 3) {
                newEye.z = Math.max(0.1, Math.min(2.5, currentEye.z + value * 0.1));
            }

            window.Plotly.relayout(containerRef.current, {
                'scene.camera.eye': newEye
            });
        };

        window.addEventListener('gamepad:axis', handleGamepadAxis as EventListener);
        return () => window.removeEventListener('gamepad:axis', handleGamepadAxis as EventListener);
    }, []);

    return (
        <div ref={containerRef} style={{ width: '100%', height: height }} className="rounded-lg overflow-hidden" />
    );
};

export default TuningSurface3D;
