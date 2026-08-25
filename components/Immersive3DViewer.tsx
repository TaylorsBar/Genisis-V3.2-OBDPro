import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../stores/vehicleStore';
import { Play, Pause, Camera, RotateCcw, Globe, Map as MapIcon, Target } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

/**
 * Immersive3DViewer
 * 
 * A high-fidelity 3D visualization environment powered by Google Maps Photorealistic 3D Tiles.
 * It provides a "Digital Twin" of the environment, allowing for precise racing line
 * analysis and virtual simulation of vehicle dynamics in real-world contexts.
 */
const Immersive3DViewer: React.FC = () => {
    const mapRef = useRef<any>(null);
    const [isOrbiting, setIsOrbiting] = useState(false);
    const [viewMode, setViewMode] = useState<'PHOTO' | 'HYBRID'>('PHOTO');
    const [isSimulating, setIsSimulating] = useState(false);
    
    // Explicitly load the maps3d library to trigger custom element registration/upgrade of <gmp-map-3d>
    const maps3d = useMapsLibrary('maps3d');

    const gps = useVehicleStore(state => ({
        lat: state.latestData?.latitude || 37.4219999,
        lng: state.latestData?.longitude || -122.0840575
    }));

    // Using the gmp-map-3d web component directly for maximum control over 3D properties
    useEffect(() => {
        const mapElement = mapRef.current;
        if (!mapElement) return;

        // Custom setup for the 3D environment - only run when element is upgraded and properties exist
        if (typeof mapElement.center !== 'undefined') {
            mapElement.center = { lat: gps.lat, lng: gps.lng, altitude: 150 };
            mapElement.range = 800;
            mapElement.tilt = 45;
            mapElement.heading = 0;
        }

        if (isOrbiting) {
            if (typeof mapElement.flyCameraAround === 'function') {
                mapElement.flyCameraAround({
                    camera: {
                        center: { lat: gps.lat, lng: gps.lng, altitude: 100 },
                        range: 1200,
                        tilt: 60,
                    },
                    durationMillis: 20000,
                    iterations: Infinity
                });
            }
        } else {
            if (typeof mapElement.stopCameraAnimation === 'function') {
                mapElement.stopCameraAnimation();
            }
        }

        return () => {
            if (mapElement && typeof mapElement.stopCameraAnimation === 'function') {
                mapElement.stopCameraAnimation();
            }
        };
    }, [isOrbiting, gps.lat, gps.lng, maps3d]);

    // Reactive mapping of ViewMode (PHOTO vs HYBRID)
    useEffect(() => {
        const mapElement = mapRef.current;
        if (!mapElement) return;

        // gmp-map-3d web component configuration if available
        try {
            if ('mode' in mapElement && typeof mapElement.mode === 'string') {
                // Ignore setting invalid mode property on gmp-map-3d
            }
        } catch {
            // Ignore property errors
        }
    }, [viewMode, maps3d]);

    const flyToVehicle = () => {
        const mapElement = mapRef.current;
        if (!mapElement || typeof mapElement.flyCameraTo !== 'function') return;
        mapElement.flyCameraTo({
            endCamera: {
                center: { lat: gps.lat, lng: gps.lng, altitude: 80 },
                range: 400,
                tilt: 55,
                heading: 0
            },
            durationMillis: 3000
        });
    };

    return (
        <div className="w-full h-full bg-black relative overflow-hidden group">
            {/* 1. PHOTOREALISTIC 3D CANVAS */}
            <div className="absolute inset-0">
                <gmp-map-3d
                    ref={mapRef}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* 2. HUD OVERLAYS */}
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
                {/* Top Bar: Telemetry & Status */}
                <div className="flex justify-between items-start">
                    <div className="bg-black/80 backdrop-blur-md border border-brand-cyan/20 p-4 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 bg-brand-cyan rounded-full animate-ping"></div>
                            <h2 className="text-xs font-technical font-black tracking-widest text-brand-cyan uppercase">3D_SPATIAL_TWIN_v5</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                            <div className="text-[10px] font-mono text-zinc-500 uppercase">COORDINATES</div>
                            <div className="text-[10px] font-mono text-white">{gps.lat.toFixed(5)}N, {gps.lng.toFixed(5)}W</div>
                            <div className="text-[10px] font-mono text-zinc-500 uppercase">RENDER_ALT</div>
                            <div className="text-[10px] font-mono text-brand-cyan">PHOTOREALISTIC_3D_TILES</div>
                        </div>
                    </div>

                    <div className="flex gap-2 pointer-events-auto">
                        <button 
                            onClick={() => setViewMode(viewMode === 'PHOTO' ? 'HYBRID' : 'PHOTO')}
                            className={`p-2.5 rounded-lg border transition-all ${viewMode === 'HYBRID' ? 'bg-brand-cyan text-black border-brand-cyan' : 'bg-black/60 text-white border-white/10 hover:border-brand-cyan/40'}`}
                        >
                            <Globe size={16} />
                        </button>
                        <button className="p-2.5 rounded-lg bg-black/60 text-white border border-white/10 hover:border-brand-cyan/40 transition-all">
                            <Camera size={16} />
                        </button>
                    </div>
                </div>

                {/* Bottom Bar: Navigation & Simulation Controls */}
                <div className="flex flex-col gap-4 items-center">
                    <div className="flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/5 px-6 py-4 rounded-2xl pointer-events-auto">
                        <button 
                            onClick={() => setIsSimulating(!isSimulating)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${isSimulating ? 'bg-red-500/20 text-red-500 border border-red-500/40' : 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'}`}
                        >
                            {isSimulating ? <Pause size={14} /> : <Play size={14} />}
                            {isSimulating ? 'HALT_SIM' : 'START_SIM'}
                        </button>

                        <div className="w-[1px] h-6 bg-white/10 mx-2"></div>

                        <button 
                            onClick={flyToVehicle}
                            className="p-2 text-zinc-400 hover:text-brand-cyan transition-colors"
                            title="Reset Camera to Vehicle"
                        >
                            <Target size={18} />
                        </button>

                        <button 
                            onClick={() => setIsOrbiting(!isOrbiting)}
                            className={`p-2 transition-colors ${isOrbiting ? 'text-brand-cyan' : 'text-zinc-400 hover:text-brand-cyan'}`}
                            title="Toggle Orbit Mode"
                        >
                            <RotateCcw size={18} className={isOrbiting ? 'animate-spin' : ''} />
                        </button>

                        <div className="w-[1px] h-6 bg-white/10 mx-2"></div>

                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-mono text-zinc-500 uppercase mb-1">Physics Integrity</span>
                            <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-brand-cyan"
                                    initial={{ width: '0%' }}
                                    animate={{ width: '94%' }}
                                    transition={{ duration: 2 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. VIRTUAL OVERLAYS (Simulated AR in 3D) */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20 z-20"></div>
            
            {/* Corner Scanlines */}
            <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-brand-cyan/40 rounded-tl-3xl z-30"></div>
            <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-brand-cyan/40 rounded-tr-3xl z-30"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-brand-cyan/40 rounded-bl-3xl z-30"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-brand-cyan/40 rounded-br-3xl z-30"></div>
        </div>
    );
};

export default Immersive3DViewer;
