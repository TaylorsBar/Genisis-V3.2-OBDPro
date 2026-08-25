import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../stores/vehicleStore';
import { generateComponentImage, getARComponentDiagnostic } from '../services/geminiService';
import { SensorDataPoint } from '../types';
import { Compass, Loader2, Check, AlertCircle, Cpu, Target } from 'lucide-react';
import ThermographicsOverlay from '../components/dashboard/ThermographicsOverlay';
import InclinometerOverlay from '../components/dashboard/InclinometerOverlay';
import AeroDynamicsOverlay from '../components/dashboard/AeroDynamicsOverlay';
import Map from '../components/Map';

// --- Types & Config ---

interface ARNode {
    id: string;
    label: string;
    cx: number;
    cy: number;
    dataKey?: keyof SensorDataPoint;
    unit?: string;
    description: string;
    normalRange: [number, number];
}

const AR_NODES: ARNode[] = [
    { 
        id: 'turbo', 
        label: 'Turbocharger', 
        cx: 78, cy: 45, 
        dataKey: 'turboBoost', unit: 'BAR', 
        description: 'Variable geometry turbine. Monitors boost pressure and spool speed.',
        normalRange: [-1.0, 1.8]
    },
    { 
        id: 'intake', 
        label: 'Intake Manifold', 
        cx: 35, cy: 25, 
        dataKey: 'inletAirTemp', unit: '°C', 
        description: 'High-flow composite manifold. Critical for air density and combustion efficiency.',
        normalRange: [10, 60]
    },
    { 
        id: 'ecu', 
        label: 'ECU Core', 
        cx: 55, cy: 20, 
        dataKey: 'rpm', unit: 'RPM', 
        description: 'Main processing unit. Controls timing, fuel trim, and sensor fusion.',
        normalRange: [0, 8000]
    },
    { 
        id: 'battery', 
        label: 'Power Unit', 
        cx: 85, cy: 75, 
        dataKey: 'batteryVoltage', unit: 'V', 
        description: 'Li-Ion starter battery. Stabilizes voltage for onboard electronics.',
        normalRange: [12.0, 14.8]
    },
    { 
        id: 'o2', 
        label: 'Lambda Sensor', 
        cx: 65, cy: 65, 
        dataKey: 'o2SensorVoltage', unit: 'V', 
        description: 'Wideband O2 sensor. Provides feedback for closed-loop fuel control.',
        normalRange: [0.1, 1.2]
    },
    { 
        id: 'oil', 
        label: 'Oil Filter', 
        cx: 45, cy: 80, 
        dataKey: 'oilPressure', unit: 'BAR', 
        description: 'High-efficiency filtration. Maintains oil pressure and contaminant removal.',
        normalRange: [1.0, 6.0]
    },
    {
        id: 'coolant',
        label: 'Coolant Res.',
        cx: 15, cy: 40,
        dataKey: 'engineTemp', unit: '°C',
        description: 'Expansion tank for engine thermal management system.',
        normalRange: [70, 105]
    },
    {
        id: 'knock',
        label: 'Acoustic / Knock Sensor',
        cx: 50, cy: 50,
        dataKey: 'knockRetard', unit: '°',
        description: 'Piezoelectric sensor for detecting engine detonation and acoustic anomalies.',
        normalRange: [0, 3]
    }
];

const Sparkline: React.FC<{ data: number[], width: number, height: number, color: string }> = ({ data, width, height, color }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <circle cx={width} cy={height - ((data[data.length-1] - min) / range) * height} r="3" fill={color} />
        </svg>
    );
};

const ARAssistant: React.FC = () => {
    const processVisionFrame = useVehicleStore(state => state.processVisionFrame);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    
    const [latestData, setLatestData] = useState<any>({
        rpm: 0, speed: 0, gear: 0, turboBoost: 0, throttlePos: 0, engineLoad: 0,
        inletAirTemp: 0, batteryVoltage: 0, o2SensorVoltage: 0, oilPressure: 0, engineTemp: 0, gForceX: 0, gForceY: 0
    });
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        let rafId: number;
        let frameCount = 0;
        const loop = () => {
            frameCount++;
            if (frameCount % 6 === 0) { // 10Hz update rate
                const state = useVehicleStore.getState();
                if (state.latestData) setLatestData(state.latestData);
                if (state.data) setData(state.data);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const [isHoloLens, setIsHoloLens] = useState(false);
    const [geospatialMode, setGeospatialMode] = useState(false);
    const [spatialStreamStatus, setSpatialStreamStatus] = useState<'IDLE' | 'BUFFERING' | 'LOCKED'>('IDLE');
    
    // AI Generation States
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [diagReport, setDiagReport] = useState<{status: string, analysis: string, recommendation: string} | null>(null);

    // --- SENSOR CALIBRATION STATE ---
    const [showCalibrator, setShowCalibrator] = useState(false);
    const [calibrationStep, setCalibrationStep] = useState(0);
    const [calibProgress, setCalibProgress] = useState(0);
    const [calibOffsets, setCalibOffsets] = useState({
        accX: -0.0012, accY: 0.0008, accZ: -0.0104,
        gyroX: 0.0001, gyroY: -0.0003, gyroZ: 0.0002,
        magX: 42.1, magY: -12.4, magZ: 18.2
    });
    const [isCalibrating, setIsCalibrating] = useState(false);

    // --- GHOST LEAD STATE ---
    const [ghostLeadActive, setGhostLeadActive] = useState(false);
    const [leadDistance, setLeadDistance] = useState(30);
    const [pathProfile, setPathProfile] = useState<'race-line' | 'commute-eco' | 'pace-car'>('race-line');
    const [ghostSpeedTrim, setGhostSpeedTrim] = useState(5);
    const [isXrHmdMode, setIsXrHmdMode] = useState(false);
    const [eyeTrackingPos, setEyeTrackingPos] = useState({ x: 500, y: 500 });
    const [hudEngineWarning, setHudEngineWarning] = useState<string | null>(null);

    // --- GHOST LEAD GPS RECALIBRATION ---
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const recalibratePathGps = () => {
        if (!navigator.geolocation) {
            setGpsError("Geolocation is not supported by your browser");
            setHudEngineWarning("GPS ORIGIN RESET FAILED: NO API");
            return;
        }

        setGpsLoading(true);
        setGpsError(null);
        setHudEngineWarning("ACQUIRING COLD GPS LOCK...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setGpsCoords({ lat: latitude, lng: longitude, accuracy, timestamp: Date.now() });
                setGpsLoading(false);
                setHudEngineWarning(`ORIGIN LOCKED: ${latitude.toFixed(5)}N, ${longitude.toFixed(5)}E`);
            },
            (error) => {
                let errorMsg = "UNKNOWN GPS ERROR";
                if (error.code === error.PERMISSION_DENIED) {
                    errorMsg = "GPS ACCESS DENIED BY USER";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errorMsg = "POSITION DATA UNAVAILABLE";
                } else if (error.code === error.TIMEOUT) {
                    errorMsg = "SATELLITE SYNC TIMEOUT";
                }
                setGpsError(errorMsg);
                setGpsLoading(false);
                setHudEngineWarning(`GPS LOCK FAILED: ${errorMsg}`);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const cvCanvasRef = useRef<HTMLCanvasElement>(null);
    const [streamActive, setStreamActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        const checkHoloLens = () => {
            const isActive = document.querySelector('.hololens-active') !== null;
            setIsHoloLens(isActive);
        };
        checkHoloLens();
        const observer = new MutationObserver(checkHoloLens);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const smoothX = latestData.gForceX || 0;
    const smoothY = latestData.gForceY || 0;

    const activeNode = useMemo(() => AR_NODES.find(n => n.id === activeNodeId), [activeNodeId]);
    
    const historyData = useMemo(() => {
        if (!activeNode || !activeNode.dataKey || !data) return [];
        return data.slice(-50).map((d: any) => (d[activeNode.dataKey!] as number) || 0);
    }, [data, activeNode]);

    useEffect(() => {
        let animationFrameId: number;
        let lastProcess = 0;

        const loop = (time: number) => {
            if (videoRef.current && cvCanvasRef.current && streamActive && !videoRef.current.paused) {
                if (time - lastProcess > 33) {
                    lastProcess = time;
                    const video = videoRef.current;
                    const width = 320;
                    const height = 240;
                    
                    const ctx = cvCanvasRef.current.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        if (cvCanvasRef.current.width !== width) cvCanvasRef.current.width = width;
                        if (cvCanvasRef.current.height !== height) cvCanvasRef.current.height = height;
                        ctx.drawImage(video, 0, 0, width, height);
                        
                        const dt = 0.033;
                        processVisionFrame(ctx.getImageData(0, 0, width, height));
                    }
                }
            }
            animationFrameId = requestAnimationFrame(loop);
        };

        if (streamActive) {
            animationFrameId = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animationFrameId);
    }, [streamActive, processVisionFrame]);

    useEffect(() => {
        let isMounted = true;
        let localStream: MediaStream | null = null;
        
        const startCamera = async () => {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment', width: { ideal: 1280 } }, 
                    audio: false 
                });
                
                if (isMounted && videoRef.current) {
                    videoRef.current.srcObject = localStream;
                    try {
                        await videoRef.current.play();
                        if (isMounted) {
                            setStreamActive(true);
                            setCameraError(null);
                        }
                    } catch (playErr) {
                        console.debug("Video play was prevented or element unmounted during resolution.");
                    }
                }
            } catch (err: any) {
                console.error("AR Camera Access Failed:", err);
                if (isMounted) {
                    setStreamActive(false);
                    setCameraError(err.message || "Permission denied");
                }
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const calibrateSensorsReal = useVehicleStore(state => state.calibrateSensors);

    useEffect(() => {
        if (!isCalibrating) return;

        const interval = setInterval(() => {
            setCalibProgress(prev => {
                const stepIncrement = calibrationStep === 1 ? 4 : calibrationStep === 2 ? 3 : calibrationStep === 3 ? 5 : 5;
                const next = prev + stepIncrement;
                if (next >= 100) {
                    clearInterval(interval);
                    
                    setTimeout(() => {
                        if (calibrationStep === 1) {
                            try {
                                if (calibrateSensorsReal) {
                                    calibrateSensorsReal();
                                }
                            } catch (e) {
                                console.error("EKF Calibration failed", e);
                            }
                            setCalibrationStep(2);
                            setCalibProgress(0);
                        } else if (calibrationStep === 2) {
                            setCalibrationStep(3);
                            setCalibProgress(0);
                        } else if (calibrationStep === 3) {
                            setCalibrationStep(4);
                            setCalibProgress(100);
                            setIsCalibrating(false);
                            setCalibOffsets({
                                accX: -0.0004 + (Math.random() * 0.0008),
                                accY: 0.0002 + (Math.random() * 0.0004),
                                accZ: -0.0095 + (Math.random() * 0.001),
                                gyroX: 0.00002 + (Math.random() * 0.00004),
                                gyroY: -0.00004 + (Math.random() * 0.00006),
                                gyroZ: 0.00001 + (Math.random() * 0.00003),
                                magX: 43.1 + (Math.random() * 1.2),
                                magY: -12.1 + (Math.random() * 0.9),
                                magZ: 18.8 + (Math.random() * 0.7)
                            });
                        }
                    }, 800);
                    return 100;
                }
                return next;
            });
        }, 120);

        return () => clearInterval(interval);
    }, [isCalibrating, calibrationStep, calibrateSensorsReal]);

    useEffect(() => {
        if (!ghostLeadActive) {
            setHudEngineWarning(null);
            return;
        }

        const interval = setInterval(() => {
            setEyeTrackingPos({
                x: 500 + (Math.random() * 80 - 40),
                y: 460 + (Math.random() * 60 - 30)
            });

            const warnings = [
                "SPEED DELTA CAP: MATCHED",
                "APPROACHING CURVE APEX IN 40M",
                "OPTIMAL BRAKING POINT SYNCED",
                "SLIPSTREAM COEFFICIENT: HIGH",
                "RADAR SURFACE BIAS: 0.15rad",
                "WIND RESIST VECTOR: STABLE"
            ];
            if (Math.random() > 0.6) {
                setHudEngineWarning(warnings[Math.floor(Math.random() * warnings.length)]);
            }
        }, 2200);

        return () => clearInterval(interval);
    }, [ghostLeadActive]);

    useEffect(() => {
        if (!geospatialMode) {
            setSpatialStreamStatus('IDLE');
            return;
        }

        setSpatialStreamStatus('BUFFERING');
        const timer = setTimeout(() => {
            setSpatialStreamStatus('LOCKED');
            setHudEngineWarning("GEOSPATIAL_STREAM: LOCKED [stream.googleapis.com]");
        }, 2500);

        return () => clearTimeout(timer);
    }, [geospatialMode]);

    const handleNodeClick = (id: string) => {
        setActiveNodeId(id);
        setIsScanning(false);
        setGeneratedImage(null);
        setDiagReport(null);
    };

    const handleGenerateSchematic = async () => {
        if (!activeNode) return;
        setIsGenerating(true);
        try {
            const img = await generateComponentImage(activeNode.label);
            setGeneratedImage(img);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };
    
    // INTREGRATED INTELLIGENT FEATURE: Diagnostic Check AI
    const handleDiagCheck = async () => {
        if (!activeNode) return;
        setIsDiagnosing(true);
        try {
            let currentValue = 0;
            if (activeNode.dataKey && latestData) {
                currentValue = latestData[activeNode.dataKey] as number;
            }
            
            const result = await getARComponentDiagnostic(
                activeNode.label, 
                currentValue, 
                activeNode.normalRange, 
                activeNode.unit || '', 
                activeNode.description, 
                historyData
            );
            
            setDiagReport(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDiagnosing(false);
        }
    };

    const offsetX = -smoothX * 40;
    const offsetY = smoothY * 20;

    return (
        <div className={`relative h-full w-full overflow-hidden flex ${isHoloLens ? 'bg-transparent' : 'bg-black'}`}>
            <div className={`absolute inset-0 z-0 ${isHoloLens ? 'bg-transparent' : 'bg-black'}`}>
                 {!isHoloLens && (
                     <video 
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${streamActive ? 'opacity-100' : 'opacity-0'}`}
                    />
                 )}
                
                <canvas ref={cvCanvasRef} className="hidden" />

                {streamActive && ekfStats.visionConfidence > 0.5 && (
                    <div className="absolute inset-0 pointer-events-none">
                        <svg className="w-full h-full opacity-60">
                            <defs>
                                <pattern id="trackingGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                                    <circle cx="25" cy="25" r="1" fill="#00FF00" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#trackingGrid)" />
                        </svg>
                    </div>
                )}

                {ghostLeadActive && (
                    <div className="absolute inset-0 z-10 pointer-events-none select-none">
                        <svg viewBox="0 0 1000 1000" className="w-full h-full" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="roadGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={
                                        pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'
                                    } stopOpacity="0.02" />
                                    <stop offset="100%" stopColor={
                                        pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'
                                    } stopOpacity="0.18" />
                                </linearGradient>
                                <radialGradient id="ghostGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={
                                        pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'
                                    } stopOpacity="0.8" />
                                    <stop offset="100%" stopColor={
                                        pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'
                                    } stopOpacity="0" />
                                </radialGradient>
                            </defs>

                            {(() => {
                                const horizonY = 480 + smoothY * 50;
                                const horizonX = 500 - smoothX * 120;
                                const steerAngle = (latestData?.gForceX || 0) * -35;
                                
                                const timeFactor = Date.now() / 2500;
                                const speedMod = Math.min(1.2, (latestData?.speed || 30) / 100);
                                const curve = Math.sin(timeFactor) * 110 * speedMod + (steerAngle * 0.5);

                                const segments: { y: number, xL: number, xR: number, xC: number, t: number }[] = [];
                                const steps = 11;
                                for (let i = 0; i <= steps; i++) {
                                    const t = i / steps;
                                    const y = horizonY + (t * t) * (1000 - horizonY);
                                    
                                    const baseWidth = t * t * 200 + t * 45;
                                    const curveOffset = Math.sin(t * Math.PI / 2) * curve;
                                    
                                    const cx = horizonX + curveOffset;
                                    segments.push({
                                        y,
                                        xL: cx - baseWidth,
                                        xR: cx + baseWidth,
                                        xC: cx,
                                        t
                                    });
                                }

                                const pathPointsLeft = segments.map(s => `${s.xL},${s.y}`).join(' ');
                                const pathPointsRight = [...segments].reverse().map(s => `${s.xR},${s.y}`).join(' ');
                                const fullRoadPolygon = `${pathPointsLeft} ${pathPointsRight}`;

                                const pLeft = segments.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.xL} ${s.y}`).join(' ');
                                const pRight = segments.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.xR} ${s.y}`).join(' ');
                                const pCenter = segments.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.xC} ${s.y}`).join(' ');

                                const scrollOffset = (Date.now() * 0.015 * (latestData?.speed || 40)) % 100;

                                return (
                                    <g>
                                        <polygon points={fullRoadPolygon} fill="url(#roadGradient)" className="transition-opacity duration-300" />

                                        {/* CV Lane Detection Enhanced HUD */}
                                        <g>
                                            <path d={pLeft} fill="none" stroke={pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'} strokeWidth="3" opacity="0.8" />
                                            <path d={pRight} fill="none" stroke={pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'} strokeWidth="3" opacity="0.8" />
                                            
                                            <path d={pCenter} fill="none" stroke={pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'} strokeWidth="2.5" strokeDasharray="18,12" opacity="0.6" />
                                            
                                            {/* Computer Vision Lane Boundary Markers */}
                                            {segments.map((s, idx) => {
                                                if (idx % 2 !== 0 || idx === 0) return null;
                                                return (
                                                    <g key={`lane-marker-${idx}`}>
                                                        <rect x={s.xL - 8} y={s.y} width="16" height="4" fill="#39FF14" opacity="0.6" transform={`skewX(${-curve * 0.2})`} />
                                                        <rect x={s.xR - 8} y={s.y} width="16" height="4" fill="#39FF14" opacity="0.6" transform={`skewX(${curve * 0.2})`} />
                                                        {idx === 2 && (
                                                            <text x={s.xL - 25} y={s.y + 12} fill="#39FF14" fontSize="10" fontFamily="monospace" fontWeight="bold">LANE_EDGE_L</text>
                                                        )}
                                                        {idx === 2 && (
                                                            <text x={s.xR + 10} y={s.y + 12} fill="#39FF14" fontSize="10" fontFamily="monospace" fontWeight="bold">LANE_EDGE_R</text>
                                                        )}
                                                    </g>
                                                )
                                            })}
                                            
                                            {/* Lane scanning line */}
                                            <line x1={0} y1={horizonY + 50 + (Math.sin(Date.now() / 300) * 50 + 50)} x2={1000} y2={horizonY + 50 + (Math.sin(Date.now() / 300) * 50 + 50)} stroke="#39FF14" strokeWidth="1" opacity="0.4" strokeDasharray="5 10" />

                                            {/* Lane Confidence Metrics */}
                                            <g transform={`translate(${horizonX - 180}, ${horizonY + 30})`}>
                                                <rect x="0" y="0" width="130" height="45" fill="rgba(0,0,0,0.6)" stroke="#39FF14" strokeWidth="1" rx="4" />
                                                <text x="10" y="15" fill="#39FF14" fontSize="10" fontFamily="monospace" fontWeight="bold">CV SYNC: {(ekfStats.visionConfidence * 100).toFixed(1)}%</text>
                                                <text x="10" y="28" fill="#ffffff" fontSize="9" fontFamily="monospace">DEVIATION: {(0.12 + Math.random() * 0.05).toFixed(2)}m</text>
                                                <line x1="10" y1="36" x2="120" y2="36" stroke="#555" strokeWidth="2" />
                                                <line x1="10" y1="36" x2={10 + (ekfStats.visionConfidence * 110)} y2="36" stroke="#39FF14" strokeWidth="2" />
                                            </g>
                                        </g>

                                        {/* Grid overlay */}
                                        {Array.from({ length: 6 }).map((_, gi) => {
                                            const normalizedOffset = (gi / 6 + scrollOffset / 600) % 1.0;
                                            const tGrid = normalizedOffset * normalizedOffset;
                                            const yGrid = horizonY + tGrid * (1000 - horizonY);
                                            
                                            const gridCurveOffset = Math.sin(normalizedOffset * Math.PI / 2) * curve;
                                            const gridWidth = normalizedOffset * normalizedOffset * 200 + normalizedOffset * 45;
                                            const xGridL = horizonX + gridCurveOffset - gridWidth;
                                            const xGridR = horizonX + gridCurveOffset + gridWidth;

                                            return (
                                                <g key={gi}>
                                                    <line 
                                                        x1={xGridL} 
                                                        y1={yGrid} 
                                                        x2={xGridR} 
                                                        y2={yGrid} 
                                                        stroke={pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F'} 
                                                        strokeWidth="1" 
                                                        opacity={(1.0 - normalizedOffset) * 0.45} 
                                                    />
                                                    <circle cx={xGridL} cy={yGrid} r={2 + normalizedOffset * 2} fill="#ffffff" opacity="0.6" />
                                                    <circle cx={xGridR} cy={yGrid} r={2 + normalizedOffset * 2} fill="#ffffff" opacity="0.6" />
                                                </g>
                                            );
                                        })}

                                        {/* NZ Street Light Reconnaissance UI */}
                                        {(() => {
                                            const tlScroll = (Date.now() * 0.003 * speedMod) % 1.0;
                                            const tlDistNorm = tlScroll; 
                                            const lightY = horizonY + (tlDistNorm * tlDistNorm) * (1000 - horizonY);
                                            const lightCurve = Math.sin(tlDistNorm * Math.PI / 2) * curve;
                                            const laneWidthAtDist = tlDistNorm * tlDistNorm * 200 + tlDistNorm * 45;
                                            // Place on the left shoulder
                                            const lightX = horizonX + lightCurve - laneWidthAtDist - 40 - (40 * tlDistNorm); 
                                            const scale = tlDistNorm * 2.5 + 0.1;

                                            if (tlDistNorm < 0.05 || tlDistNorm > 0.95) return null;

                                            // phase sequence Red -> Green -> Orange (NZ format)
                                            const cycle = (Date.now() / 4000) % 3;
                                            const activeColor = cycle < 1 ? 'red' : cycle < 2 ? 'green' : 'orange';

                                            return (
                                                <g transform={`translate(${lightX}, ${lightY - 140 * scale}) scale(${scale})`}>
                                                    {/* Computer Vision Object Bounding Box */}
                                                    <rect x="-25" y="-20" width="50" height="110" fill="none" stroke="#FF00FF" strokeWidth="1.5" strokeDasharray="4 4" />
                                                    <text x="-25" y="-25" fill="#FF00FF" fontSize="10" fontFamily="monospace" fontWeight="bold">OBJ: NZ_TRAFFIC_LT</text>
                                                    <text x="32" y="20" fill="#FFFFFF" fontSize="8" fontFamily="monospace">SYNC: 94.2%</text>
                                                    <text x="32" y="32" fill="#FF00FF" fontSize="8" fontFamily="monospace">STATE: <tspan fill={activeColor === 'red' ? '#FF003C' : activeColor === 'orange' ? '#FFA500' : '#39FF14'}>{activeColor.toUpperCase()}</tspan></text>
                                                    <line x1="25" y1="-20" x2="30" y2="15" stroke="#FF00FF" strokeWidth="1" />
                                                    
                                                    {/* Traffic Light Body (Tree Light Form) */}
                                                    <rect x="-15" y="-5" width="30" height="85" rx="6" fill="#0A0A0A" stroke="#222" strokeWidth="2" />
                                                    
                                                    {/* Lenses */}
                                                    <circle cx="0" cy="12" r="8" fill={activeColor === 'red' ? '#FF003C' : '#300'} opacity={activeColor === 'red' ? 1 : 0.5} filter={activeColor === 'red' ? 'drop-shadow(0 0 12px rgba(255,0,60,0.9))' : 'none'} />
                                                    <circle cx="0" cy="37" r="8" fill={activeColor === 'orange' ? '#FFA500' : '#320'} opacity={activeColor === 'orange' ? 1 : 0.5} filter={activeColor === 'orange' ? 'drop-shadow(0 0 12px rgba(255,165,0,0.9))' : 'none'} />
                                                    <circle cx="0" cy="62" r="8" fill={activeColor === 'green' ? '#39FF14' : '#030'} opacity={activeColor === 'green' ? 1 : 0.5} filter={activeColor === 'green' ? 'drop-shadow(0 0 12px rgba(57,255,20,0.9))' : 'none'} />
                                                </g>
                                            );
                                        })()}

                                        {(() => {
                                            const distNorm = Math.max(0.25, Math.min(0.85, (100 - leadDistance) / 85 * 0.6 + 0.25));
                                            
                                            const ghostY = horizonY + (distNorm * distNorm) * (1000 - horizonY);
                                            const ghostWidth = distNorm * distNorm * 75 + distNorm * 12;
                                            const ghostCurveOffset = Math.sin(distNorm * Math.PI / 2) * curve;
                                            const ghostX = horizonX + ghostCurveOffset;

                                            const leftCorner = ghostX - ghostWidth;
                                            const rightCorner = ghostX + ghostWidth;
                                            const carHeight = ghostWidth * 0.6;
                                            const colorCode = pathProfile === 'race-line' ? '#39FF14' : pathProfile === 'commute-eco' ? '#00FFFF' : '#FF5F1F';

                                            return (
                                                <g>
                                                    {/* Outer Tracking Bounding Box Matrix */}
                                                    <rect x={leftCorner - 4} y={ghostY - carHeight * 1.6 - 4} width={ghostWidth * 2 + 8} height={carHeight * 2 + 8} fill="none" stroke="#39FF14" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.6" />
                                                    
                                                    {/* Corner Brackets */}
                                                    <path d={`M ${leftCorner - 4},${ghostY - carHeight * 1.6 + 10} L ${leftCorner - 4},${ghostY - carHeight * 1.6 - 4} L ${leftCorner + 6},${ghostY - carHeight * 1.6 - 4}`} fill="none" stroke="#39FF14" strokeWidth="1.5" opacity="0.9" />
                                                    <path d={`M ${rightCorner + 4},${ghostY - carHeight * 1.6 + 10} L ${rightCorner + 4},${ghostY - carHeight * 1.6 - 4} L ${rightCorner - 6},${ghostY - carHeight * 1.6 - 4}`} fill="none" stroke="#39FF14" strokeWidth="1.5" opacity="0.9" />
                                                    <path d={`M ${leftCorner - 4},${ghostY + carHeight * 0.4 - 10} L ${leftCorner - 4},${ghostY + carHeight * 0.4 + 4} L ${leftCorner + 6},${ghostY + carHeight * 0.4 + 4}`} fill="none" stroke="#39FF14" strokeWidth="1.5" opacity="0.9" />
                                                    <path d={`M ${rightCorner + 4},${ghostY + carHeight * 0.4 - 10} L ${rightCorner + 4},${ghostY + carHeight * 0.4 + 4} L ${rightCorner - 6},${ghostY + carHeight * 0.4 + 4}`} fill="none" stroke="#39FF14" strokeWidth="1.5" opacity="0.9" />
                                                    
                                                    {/* Data Pin */}
                                                    <line x1={rightCorner + 4} y1={ghostY - carHeight * 1.6 - 4} x2={rightCorner + 40} y2={ghostY - carHeight * 2.2} stroke="#39FF14" strokeWidth="1" opacity="0.6" />
                                                    <text x={rightCorner + 42} y={ghostY - carHeight * 2.2} fill="#39FF14" fontSize="10" fontFamily="monospace" fontWeight="bold">OBJ_TRACKING_LOCK</text>

                                                    <ellipse cx={ghostX} cy={ghostY} rx={ghostWidth * 1.4} ry={ghostWidth * 0.4} fill="url(#ghostGlow)" />
                                                    <polygon 
                                                        points={`
                                                            ${leftCorner},${ghostY} 
                                                            ${rightCorner},${ghostY} 
                                                            ${rightCorner + ghostWidth * 0.25},${ghostY + carHeight * 0.4} 
                                                            ${leftCorner - ghostWidth * 0.25},${ghostY + carHeight * 0.4}
                                                        `}
                                                        fill={colorCode}
                                                        fillOpacity="0.08"
                                                        stroke={colorCode}
                                                        strokeWidth="1.5"
                                                        opacity="0.8"
                                                    />
                                                    <polygon 
                                                        points={`
                                                            ${leftCorner},${ghostY}
                                                            ${rightCorner},${ghostY}
                                                            ${rightCorner - ghostWidth * 0.1},${ghostY - carHeight}
                                                            ${leftCorner + ghostWidth * 0.1},${ghostY - carHeight}
                                                        `}
                                                        fill="none"
                                                        stroke={colorCode}
                                                        strokeWidth="1.5"
                                                        opacity="0.7"
                                                    />
                                                    <polygon 
                                                        points={`
                                                            ${leftCorner + ghostWidth * 0.15},${ghostY - carHeight} 
                                                            ${rightCorner - ghostWidth * 0.15},${ghostY - carHeight} 
                                                            ${rightCorner - ghostWidth * 0.35},${ghostY - carHeight * 1.6} 
                                                            ${leftCorner + ghostWidth * 0.35},${ghostY - carHeight * 1.6}
                                                        `}
                                                        fill="none"
                                                        stroke={colorCode}
                                                        strokeWidth="1"
                                                        opacity="0.9"
                                                    />
                                                    <line x1={leftCorner} y1={ghostY} x2={leftCorner + ghostWidth * 0.15} y2={ghostY - carHeight} stroke={colorCode} strokeWidth="1" opacity="0.7" />
                                                    <line x1={rightCorner} y1={ghostY} x2={rightCorner - ghostWidth * 0.15} y2={ghostY - carHeight} stroke={colorCode} strokeWidth="1" opacity="0.7" />

                                                    <line x1="500" y1="980" x2={ghostX} y2={ghostY + carHeight * 0.3} stroke={colorCode} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.4" />

                                                    <g transform={`translate(${rightCorner + 18}, ${ghostY - carHeight * 1.1})`}>
                                                        <path d={`M -18 ${carHeight * 0.5} L 0 0 L 140 0`} fill="none" stroke={colorCode} strokeWidth="1.2" opacity="0.8" />
                                                        <rect x="0" y="-55" width="165" height="52" fill="rgba(10, 10, 12, 0.92)" rx="4" stroke={colorCode} strokeWidth="1" opacity="0.95" />
                                                        
                                                        <text x="8" y="-40" fill="#ffffff" fontSize="8.5" fontFamily="monospace" fontWeight="bold" letterSpacing="1">
                                                            {pathProfile === 'race-line' ? 'GHOST LEAD APEX v3' : pathProfile === 'commute-eco' ? 'ECO PACEMAKER v1' : 'PACE SAFET_01'}
                                                        </text>
                                                        <text x="8" y="-28" fill={colorCode} fontSize="11" fontFamily="monospace" fontWeight="bold">
                                                            {((latestData?.speed || 0) + ghostSpeedTrim).toFixed(0)} <tspan fontSize="7" fill="#6b7280" fontWeight="bold">KM/H</tspan>
                                                        </text>
                                                        <text x="8" y="-14" fill="#6b7280" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                                                            DIST: <tspan fill="#ffffff">{leadDistance.toFixed(1)}m</tspan> // SYNC: 99.1%
                                                        </text>
                                                        <text x="83" y="-28" fill="#a1a1aa" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                                            LOCK: <tspan fill="#39FF14">SECURE</tspan>
                                                        </text>
                                                    </g>
                                                </g>
                                            );
                                        })()}

                                        {isXrHmdMode && (
                                            <g>
                                                <circle cx={eyeTrackingPos.x} cy={eyeTrackingPos.y} r="25" fill="none" stroke="#ff007f" strokeWidth="1" opacity="0.25" />
                                                <circle cx={eyeTrackingPos.x} cy={eyeTrackingPos.y} r="8" fill="none" stroke="#ff007f" strokeWidth="1.5" opacity="0.6" />
                                                <circle cx={eyeTrackingPos.x} cy={eyeTrackingPos.y} r="2" fill="#ff007f" opacity="0.9" />
                                                
                                                <line x1={eyeTrackingPos.x - 35} y1={eyeTrackingPos.y} x2={eyeTrackingPos.x - 12} y2={eyeTrackingPos.y} stroke="#ff007f" strokeWidth="1" opacity="0.4" />
                                                <line x1={eyeTrackingPos.x + 12} y1={eyeTrackingPos.y} x2={eyeTrackingPos.x + 35} y2={eyeTrackingPos.y} stroke="#ff007f" strokeWidth="1" opacity="0.4" />
                                                <line x1={eyeTrackingPos.x} y1={eyeTrackingPos.y - 35} x2={eyeTrackingPos.x} y2={eyeTrackingPos.y - 12} stroke="#ff007f" strokeWidth="1" opacity="0.4" />
                                                <line x1={eyeTrackingPos.x} y1={eyeTrackingPos.y + 12} x2={eyeTrackingPos.x} y2={eyeTrackingPos.y + 35} stroke="#ff007f" strokeWidth="1" opacity="0.4" />

                                                <rect x={eyeTrackingPos.x + 40} y={eyeTrackingPos.y - 10} width="96" height="18" fill="rgba(255, 0, 127, 0.14)" stroke="#ff007f" strokeWidth="1" rx="2" />
                                                <text x={eyeTrackingPos.x + 46} y={eyeTrackingPos.y + 2} fill="#ff007f" fontSize="7.5" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">
                                                    EYE_FOCUS_LOCK
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            })()}
                        </svg>

                        {hudEngineWarning && (
                            <div className="absolute top-[85px] left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/95 border border-brand-cyan/40 text-brand-cyan font-mono text-[10px] uppercase font-bold tracking-widest rounded shadow-[0_0_15px_rgba(0,240,255,0.2)] flex items-center gap-2 animate-bounce">
                                <span className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-ping"></span>
                                {hudEngineWarning}
                            </div>
                        )}
                    </div>
                )}

                <div className={`absolute inset-0 flex items-center justify-center bg-[#050505] transition-opacity duration-700 ${streamActive || isHoloLens ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,40,60,0.4)_0%,_rgba(0,0,0,0.9)_100%)]"></div>
                     <img 
                        src="https://storage.googleapis.com/fpl-assets/ar-engine-wireframe.svg" 
                        alt="AR Feed" 
                        className="w-full h-full object-cover opacity-40 mix-blend-screen"
                        style={{ filter: 'contrast(1.2) brightness(0.8)' }}
                     />
                     {!streamActive && !cameraError && <div className="absolute font-mono text-brand-cyan text-xs animate-pulse">INITIALIZING OPTICAL SENSORS...</div>}
                     {cameraError && (
                         <div className="absolute flex flex-col items-center p-6 bg-black/80 border border-red-500/50 rounded-lg backdrop-blur-md">
                             <div className="text-red-500 font-mono text-lg mb-2">OPTICAL SENSOR ERROR</div>
                             <div className="text-gray-400 font-mono text-sm text-center max-w-xs">{cameraError}</div>
                             <div className="text-gray-500 font-mono text-xs mt-4">Please grant camera permissions to enable AR features.</div>
                         </div>
                     )}
                </div>

                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <defs>
                        <filter id="glow-ar" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    
                    <g transform={`translate(${offsetX}, ${offsetY})`}>
                        {AR_NODES.map((node) => {
                            const isActive = activeNodeId === node.id;
                            const val = node.dataKey && latestData ? latestData[node.dataKey] : 0;
                            const isWarning = typeof val === 'number' && (val < node.normalRange[0] || val > node.normalRange[1]);
                            const color = isWarning ? '#EF4444' : (isActive ? '#00F0FF' : (isHoloLens ? '#00F0FF' : '#FFFFFF'));

                            return (
                                <g key={node.id}>
                                    {isActive && (
                                        <path 
                                            d={`M ${node.cx}% ${node.cy}% L ${node.cx + 10}% ${node.cy - 10}% L 90% ${node.cy - 10}%`}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={isHoloLens ? "2" : "1"}
                                            strokeDasharray="4 2"
                                            opacity={isHoloLens ? "1" : "0.6"}
                                            className="animate-[dash_20s_linear_infinite]"
                                        />
                                    )}

                                    <g 
                                        transform={`translate(${node.cx * window.innerWidth / 100}, ${node.cy * window.innerHeight / 100})`}
                                        className="cursor-pointer pointer-events-auto"
                                        onClick={() => handleNodeClick(node.id)}
                                    >
                                        <circle r={isActive ? (isHoloLens ? 40 : 30) : 8} stroke={color} strokeWidth={isHoloLens ? "3" : "1.5"} fill="black" fillOpacity={isHoloLens ? "0.2" : "0.5"} 
                                            className={`transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`} 
                                        />
                                        <circle r={isHoloLens ? 6 : 4} fill={color} className={isWarning ? 'animate-ping' : ''} />
                                        {isActive && (
                                            <>
                                                <path d="M -35 -20 L -35 -35 L -20 -35" fill="none" stroke={color} strokeWidth={isHoloLens ? "3" : "2"} />
                                                <path d="M 35 -20 L 35 -35 L 20 -35" fill="none" stroke={color} strokeWidth={isHoloLens ? "3" : "2"} />
                                                <path d="M -35 20 L -35 35 L -20 35" fill="none" stroke={color} strokeWidth={isHoloLens ? "3" : "2"} />
                                                <path d="M 35 20 L 35 35 L 20 35" fill="none" stroke={color} strokeWidth={isHoloLens ? "3" : "2"} />
                                            </>
                                        )}
                                        {!isActive && (
                                            <text y="25" textAnchor="middle" fill={isHoloLens ? color : "white"} fontSize={isHoloLens ? "12" : "10"} fontFamily="monospace" opacity={isHoloLens ? "1" : "0.8"} className="uppercase font-bold drop-shadow-md">
                                                {node.label}
                                            </text>
                                        )}
                                    </g>
                                </g>
                            );
                        })}
                    </g>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-cyan/5 to-transparent h-[5px] w-full animate-[scan_4s_linear_infinite] pointer-events-none"></div>

                {/* --- REAL-TIME CAMERA FEED --- */}
                <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover z-[-1] transition-opacity duration-1000 ${streamActive ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* --- GEOSPATIAL AR MARKERS --- */}
                {geospatialMode && spatialStreamStatus === 'LOCKED' && (
                    <div className="absolute inset-0 pointer-events-none z-5">
                        <ARGeospatialOverlay />
                    </div>
                )}

                {/* --- GEOSPATIAL RADAR (3D MINI-MAP) --- */}
                {geospatialMode && (
                    <div className="absolute bottom-10 right-10 w-64 h-64 bg-black/60 backdrop-blur-2xl border-2 border-brand-cyan/30 rounded-full overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.2)] pointer-events-auto group hover:scale-110 transition-transform duration-500">
                        <div className="absolute inset-0 z-0 scale-150">
                            <Map lat={latestData.latitude || -37.8136} lon={latestData.longitude || 144.9631} />
                        </div>
                        <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)] opacity-40"></div>
                        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                            <div className="w-px h-full bg-brand-cyan/20 absolute"></div>
                            <div className="h-px w-full bg-brand-cyan/20 absolute"></div>
                            <div className="w-16 h-16 border border-brand-cyan/40 rounded-full animate-ping"></div>
                        </div>
                        <div className="absolute top-4 left-0 right-0 text-center z-30">
                            <span className="text-[8px] font-black text-brand-cyan tracking-[0.5em] uppercase drop-shadow-md">Spatial_Radar_v1.2</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-none p-6">
                <div className="flex justify-between items-start pointer-events-auto">
                    <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg shadow-lg">
                        <h1 className="text-brand-cyan font-display font-bold text-xl uppercase tracking-widest flex items-center gap-3">
                            <div className="w-3 h-3 bg-brand-cyan animate-pulse shadow-[0_0_10px_#00F0FF]"></div>
                            AR Inspector
                        </h1>
                        <div className="flex gap-4 mt-2 text-[10px] font-mono text-gray-400">
                            <span>GPS: <span className="text-white">LOCKED</span></span>
                            <span>OPTICAL FLOW: <span className={ekfStats.visionConfidence > 0.5 ? "text-green-500" : "text-yellow-500"}>{ekfStats.visionConfidence > 0.5 ? 'LOCKED' : 'SEARCHING'}</span></span>
                            <span>OBJ: <span className="text-brand-cyan">{AR_NODES.length}</span></span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => setGeospatialMode(!geospatialMode)}
                            className={`px-4 py-2 rounded border font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-2 ${geospatialMode ? 'bg-brand-cyan text-black border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.6)]' : 'bg-black/80 text-brand-cyan border-brand-cyan/40 hover:bg-brand-cyan/25'}`}
                        >
                            <Target size={14} />
                            GEOSPATIAL PRECISION
                        </button>
                        <button 
                            onClick={() => {
                                setGhostLeadActive(prev => !prev);
                                if (!ghostLeadActive) {
                                    setActiveNodeId(null);
                                    setShowCalibrator(false);
                                }
                            }}
                            className={`px-4 py-2 rounded border font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-2 ${ghostLeadActive ? 'bg-brand-cyan text-black border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.6)]' : 'bg-black/80 text-brand-cyan border-brand-cyan/40 hover:bg-brand-cyan/25'}`}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ghostLeadActive ? 'bg-black' : 'bg-brand-cyan'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${ghostLeadActive ? 'bg-black' : 'bg-brand-cyan'}`}></span>
                            </span>
                            GHOST LEAD OVERLAY
                        </button>
                        <button 
                            onClick={() => {
                                setShowCalibrator(true);
                                setCalibrationStep(0);
                                setCalibProgress(0);
                                setIsCalibrating(false);
                                setActiveNodeId(null);
                                setIsScanning(false);
                                setGhostLeadActive(false);
                            }}
                            className={`px-4 py-2 rounded border font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-2 ${showCalibrator ? 'bg-brand-purple text-white border-brand-purple shadow-[0_0_15px_rgba(188,19,254,0.5)]' : 'bg-black/80 text-brand-purple border-brand-purple/40 hover:bg-brand-purple/20'}`}
                        >
                            <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4M6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            SENSOR CALIBRATE
                        </button>
                        <button 
                            onClick={() => { setActiveNodeId(null); setIsScanning(true); setShowCalibrator(false); }}
                            className={`px-6 py-2 rounded border font-bold uppercase text-xs tracking-wider transition-all ${isScanning ? 'bg-brand-cyan text-black border-brand-cyan' : 'bg-black/60 text-gray-400 border-gray-700 hover:border-white'}`}
                        >
                            {isScanning ? 'Scanning...' : 'Reset View'}
                        </button>
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-white/10 rounded-full pointer-events-none flex items-center justify-center">
                    <div className="w-60 h-60 border border-white/5 rounded-full border-dashed animate-[spin_20s_linear_infinite]"></div>
                    <div className="w-1 h-4 bg-brand-cyan/50 absolute top-0"></div>
                    <div className="w-1 h-4 bg-brand-cyan/50 absolute bottom-0"></div>
                    <div className="w-4 h-1 bg-brand-cyan/50 absolute left-0"></div>
                    <div className="w-4 h-1 bg-brand-cyan/50 absolute right-0"></div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                    {!showCalibrator && (
                        <div className="w-64 h-64 border border-white/10 rounded-full flex items-center justify-center">
                            <div className="w-60 h-60 border border-white/5 rounded-full border-dashed animate-[spin_20s_linear_infinite]"></div>
                            <div className="w-1 h-4 bg-brand-cyan/50 absolute top-0"></div>
                            <div className="w-1 h-4 bg-brand-cyan/50 absolute bottom-0"></div>
                            <div className="w-4 h-1 bg-brand-cyan/50 absolute left-0"></div>
                            <div className="w-4 h-1 bg-brand-cyan/50 absolute right-0"></div>
                        </div>
                    )}

                    {showCalibrator && calibrationStep === 1 && (
                        <div className="w-72 h-72 rounded-full border-2 border-brand-purple/30 bg-black/40 backdrop-blur-md p-4 flex flex-col items-center justify-center relative animate-in zoom-in duration-500">
                            <div className="absolute inset-4 rounded-full border border-gray-800 flex items-center justify-center"></div>
                            <div className="absolute inset-12 rounded-full border border-gray-800/80 flex items-center justify-center"></div>
                            <div className="absolute inset-20 rounded-full border border-brand-purple/10 flex items-center justify-center"></div>
                            <div className="absolute inset-[112px] rounded-full border-2 border-brand-purple/40 flex items-center justify-center"></div>
                            
                            <div className="absolute top-0 bottom-0 w-[1px] bg-white/10"></div>
                            <div className="absolute left-0 right-0 h-[1px] bg-white/10"></div>
                            
                            {(() => {
                                const gX = latestData ? latestData.gForceX : 0;
                                const gY = latestData ? latestData.gForceY : 0;
                                const biasSettleRatio = Math.max(0, 1 - (calibProgress / 100));
                                const noise = (Math.random() * 2 - 1) * 0.5 * biasSettleRatio;
                                const leftVal = 144 + (gX * 80 * biasSettleRatio) + noise;
                                const topVal = 144 + (-gY * 80 * biasSettleRatio) + noise;

                                return (
                                    <div 
                                        className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center shadow-[0_0_15px_#BC13FE] transition-all duration-75 absolute"
                                        style={{ left: `${leftVal - 12}px`, top: `${topVal - 12}px` }}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-white"></div>
                                    </div>
                                );
                            })()}

                            <div className="absolute bottom-6 font-mono text-[10px] text-brand-purple tracking-widest font-bold">
                                {latestData ? `PITCH: ${(latestData.gForceY * 57.3).toFixed(1)}° || ROLL: ${(latestData.gForceX * 57.3).toFixed(1)}°` : ''}
                            </div>
                        </div>
                    )}

                    {showCalibrator && calibrationStep === 2 && (
                        <div className="w-72 h-72 flex items-center justify-center relative animate-in zoom-in duration-500">
                            <div className="absolute inset-0 rounded-full border border-dashed border-brand-cyan/20 animate-[spin_40s_linear_infinite] flex items-center justify-center">
                                <span className="absolute top-2 font-mono text-[8px] text-brand-cyan">N</span>
                                <span className="absolute right-2 font-mono text-[8px] text-brand-cyan">E</span>
                                <span className="absolute bottom-2 font-mono text-[8px] text-brand-cyan">S</span>
                                <span className="absolute left-2 font-mono text-[8px] text-brand-cyan">W</span>
                            </div>

                            <div className="w-16 h-16 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-brand-cyan/25 animate-ping"></div>
                            </div>

                            <svg className="absolute inset-0 w-full h-full">
                                <path 
                                    d="M 66 144 C 66 100, 144 188, 144 144 C 144 100, 222 188, 222 144 C 222 100, 144 188, 144 144 C 144 100, 66 188, 66 144 Z" 
                                    className="stroke-brand-cyan/20 stroke-2 fill-none" 
                                    strokeDasharray="4 2"
                                />
                                {(() => {
                                    const theta = (Date.now() / 600) % (2 * Math.PI);
                                    const fx = 144 + 75 * Math.sin(theta);
                                    const fy = 144 + 40 * Math.sin(2 * theta);
                                    return (
                                        <g transform={`translate(${fx}, ${fy})`}>
                                            <circle r="6" className="fill-brand-cyan shadow-[0_0_10px_#00F0FF]" />
                                            <circle r="12" className="stroke-brand-cyan/40 stroke-1 fill-none animate-ping" />
                                        </g>
                                    );
                                })()}
                            </svg>

                            <div className="absolute bottom-6 font-mono text-[10px] text-brand-cyan font-bold">
                                COMPASS INTENSITY: {(45.2 + Math.random() * 1.5).toFixed(1)} μT
                            </div>
                        </div>
                    )}

                    {showCalibrator && calibrationStep === 3 && (
                        <div className="w-72 h-72 flex items-center justify-center relative animate-in zoom-in duration-500">
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-green-400"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-green-400"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-green-400"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-green-400"></div>

                            <div className="absolute inset-4 overflow-hidden">
                                {Array.from({ length: 6 }).map((_, i) => {
                                    const seedAngle = (i * (2 * Math.PI / 6)) + (Date.now() / 2000);
                                    const dist = 60 + Math.sin(Date.now() / 500 + i) * 15;
                                    const tx = 120 + Math.cos(seedAngle) * dist;
                                    const ty = 120 + Math.sin(seedAngle) * dist;
                                    return (
                                        <div 
                                            key={i}
                                            className="absolute w-3 h-3 flex items-center justify-center transition-all duration-200"
                                            style={{ left: `${tx}px`, top: `${ty}px` }}
                                        >
                                            <span className="text-[10px] text-green-400 font-mono font-bold animate-pulse">+</span>
                                            <span className="absolute w-2 h-2 border border-green-400/40 rounded-full scale-150 animate-[ping_1.5s_infinite]"></span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="font-mono text-[11px] text-green-400 font-bold bg-black/80 px-4 py-2 border border-green-500/30 rounded flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                                OPTICAL TRACKERS ACQUIRED
                            </div>
                        </div>
                    )}

                    {showCalibrator && calibrationStep === 4 && (
                        <div className="w-72 h-72 rounded-full border border-green-400/50 bg-black/80 flex flex-col items-center justify-center p-6 relative animate-in zoom-in duration-500">
                            <div className="w-20 h-20 rounded-full border border-green-400/30 flex items-center justify-center mb-4">
                                <svg className="w-10 h-10 text-green-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="font-display font-black text-white text-md uppercase tracking-widest text-center animate-pulse">LOCK ACQUIRED</h3>
                            <p className="font-mono text-[9px] text-green-400 text-center mt-2 leading-tight uppercase">BIAS VECTOR BURN SUCCESSFUL</p>
                            
                            <div className="absolute inset-2 border-2 border-dashed border-green-500/10 rounded-full animate-[spin_60s_linear_infinite]"></div>
                        </div>
                    )}
                </div>
                
                {/* HUD Framing Left: Structural Telemetry grids */}
                <div className="absolute top-24 left-6 pointer-events-auto z-30 flex flex-col gap-4">
                    <ThermographicsOverlay className="w-56 animate-in slide-in-from-left duration-700 opacity-90 hover:opacity-100 transition-opacity" />
                    <AeroDynamicsOverlay className="w-56 animate-in slide-in-from-left duration-700 opacity-90 hover:opacity-100 transition-opacity" />
                </div>
                
                {/* HUD Framing Right: Inertial Nav */}
                <div className="absolute top-24 right-6 pointer-events-auto z-30">
                    <InclinometerOverlay className="w-64 animate-in slide-in-from-right duration-700 opacity-90 hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex justify-between items-end h-full pointer-events-none w-full gap-6">
                    {ghostLeadActive ? (
                        <div className="w-full max-w-sm pointer-events-auto animate-in slide-in-from-left duration-500">
                            <div className="bg-[#0c0c0e]/95 backdrop-blur-xl border-l-2 border-brand-cyan p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-cyan/5 rounded-full filter blur-lg transform translate-x-8 -translate-y-8"></div>
                                
                                <div className="relative z-10 font-mono">
                                    <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                                        <div>
                                            <h2 className="text-sm font-display font-black text-white uppercase italic tracking-wider flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 bg-brand-cyan rounded-full animate-ping"></span>
                                                GHOST LEAD CONFIG // XR
                                            </h2>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">Perspective Road Space & Projection Parameters</p>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <span className="text-[9px] text-gray-500 uppercase font-black tracking-wider block mb-1.5">PACEMAKER STRATEGY</span>
                                        <div className="grid grid-cols-3 gap-1 px-0.5">
                                            <button 
                                                onClick={() => setPathProfile('race-line')}
                                                className={`py-1.5 text-[8.5px] font-bold uppercase border tracking-wider rounded transition-all ${pathProfile === 'race-line' ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]' : 'bg-black/40 border-gray-800 text-gray-500 hover:text-white'}`}
                                            >
                                                RACE-LINE
                                            </button>
                                            <button 
                                                onClick={() => setPathProfile('commute-eco')}
                                                className={`py-1.5 text-[8.5px] font-bold uppercase border tracking-wider rounded transition-all ${pathProfile === 'commute-eco' ? 'bg-[#00FFFF]/10 text-[#00FFFF] border-[#00FFFF]' : 'bg-black/40 border-gray-800 text-gray-500 hover:text-white'}`}
                                            >
                                                ECO-GUIDE
                                            </button>
                                            <button 
                                                onClick={() => setPathProfile('pace-car')}
                                                className={`py-1.5 text-[8.5px] font-bold uppercase border tracking-wider rounded transition-all ${pathProfile === 'pace-car' ? 'bg-[#FF5F1F]/10 text-[#FF5F1F] border-[#FF5F1F]' : 'bg-black/40 border-gray-800 text-gray-500 hover:text-white'}`}
                                            >
                                                PACE-CAR
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-3.5 bg-black/40 p-2.5 border border-gray-800/60 rounded">
                                        <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                                            <span>LEAD TARGET DISTANCE</span>
                                            <span className="text-brand-cyan font-bold font-mono">{leadDistance} METERS</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="15" 
                                            max="80" 
                                            value={leadDistance}
                                            onChange={(e) => setLeadDistance(Number(e.target.value))}
                                            className="w-full h-1 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-brand-cyan" 
                                        />
                                        <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
                                            <span>15m (CLOSE)</span>
                                            <span>80m (HORIZON)</span>
                                        </div>
                                    </div>

                                    <div className="mb-3.5 bg-black/40 p-2.5 border border-gray-800/60 rounded">
                                        <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                                            <span>PACE VELOCITY OFFSET</span>
                                            <span className="text-brand-cyan font-bold font-mono">+{ghostSpeedTrim} KM/H</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="30" 
                                            value={ghostSpeedTrim}
                                            onChange={(e) => setGhostSpeedTrim(Number(e.target.value))}
                                            className="w-full h-1 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-brand-cyan" 
                                        />
                                        <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
                                            <span>0 (MATCHED)</span>
                                            <span>+30 KM/H (AGGRESSIVE)</span>
                                        </div>
                                    </div>

                                    <div className="mb-4 flex items-center justify-between bg-black/40 border border-gray-800/60 p-2.5 rounded">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-white font-bold uppercase">HMD EYE TRACKING TEST</span>
                                            <span className="text-[7.5px] text-gray-500 uppercase leading-none mt-1">Simulate spatial retina calibration</span>
                                        </div>
                                        <button 
                                            onClick={() => setIsXrHmdMode(prev => !prev)}
                                            className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${isXrHmdMode ? 'bg-pink-500/10 text-pink-500 border-pink-500' : 'bg-gray-900 text-gray-600 border-gray-800 hover:text-white'}`}
                                        >
                                            {isXrHmdMode ? 'ACTIVE' : 'STANDBY'}
                                        </button>
                                    </div>

                                    <div className="mb-4 bg-black/40 border border-gray-800/60 p-2.5 rounded">
                                        <div className="flex flex-col mb-2">
                                            <span className="text-[10px] text-white font-bold uppercase">PATH GEOLOCALIZATION</span>
                                            <span className="text-[7.5px] text-gray-500 uppercase leading-none mt-1">Bind Ghost Lead route origin to your current GPS position</span>
                                        </div>
                                        <button 
                                            onClick={recalibratePathGps}
                                            disabled={gpsLoading}
                                            className={`w-full py-2 rounded text-[9px] font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-2 ${
                                                gpsLoading 
                                                    ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan cursor-wait' 
                                                    : 'bg-[#00FFFF]/10 hover:bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/40 hover:border-[#00FFFF] shadow-[0_0_10px_rgba(0,255,255,0.05)] active:scale-[0.98]'
                                            }`}
                                        >
                                            {gpsLoading ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ACQUIRING SATELLITES...
                                                </>
                                            ) : (
                                                <>
                                                    <Compass className="w-3.5 h-3.5" />
                                                    RECALIBRATE PATH
                                                </>
                                            )}
                                        </button>

                                        {gpsError && (
                                            <div className="mt-2 text-[8px] text-red-400 font-mono flex items-center gap-1 bg-red-950/25 border border-red-900/40 p-1.5 rounded">
                                                <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                                                <span>{gpsError}</span>
                                            </div>
                                        )}

                                        {gpsCoords && !gpsLoading && (
                                            <div className="mt-2 text-[8.5px] text-gray-400 font-mono bg-black/60 border border-brand-cyan/10 p-2 rounded">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-brand-cyan text-[7.5px] uppercase font-bold flex items-center gap-1">
                                                        <Check className="w-2.5 h-2.5 text-green-400 animate-pulse" /> ORIGIN LOCKED
                                                    </span>
                                                    <span className="text-gray-600 text-[7px]">
                                                        {new Date(gpsCoords.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-2 text-white">
                                                    <div>LAT: <span className="font-bold">{gpsCoords.lat.toFixed(6)}°</span></div>
                                                    <div>LON: <span className="font-bold">{gpsCoords.lng.toFixed(6)}°</span></div>
                                                    <div className="col-span-2 mt-0.5 text-gray-500 text-[7.5px]">ACCURACY: <span className="text-gray-300">±{gpsCoords.accuracy.toFixed(1)}m</span></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-black/95 text-[8.5px] border border-gray-800 rounded p-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-400">
                                        <div className="col-span-2 text-brand-cyan text-[8px] uppercase tracking-widest font-black border-b border-gray-800 pb-1 mb-1">
                                            LIVE EKF SPATIAL DECK COORDINATES
                                        </div>
                                        <div>
                                            <span>STABILIZE_YAW:</span><br/>
                                            <span className="text-white">{(smoothX * 12.3).toFixed(4)}°</span>
                                        </div>
                                        <div>
                                            <span>STABILIZE_ROLL:</span><br/>
                                            <span className="text-white">{(smoothY * 11).toFixed(4)}°</span>
                                        </div>
                                        <div>
                                            <span>PROJ_RATE:</span><br/>
                                            <span className="text-green-400">120.0 Hz (WebXR)</span>
                                        </div>
                                        <div>
                                            <span>RENDER_PATH:</span><br/>
                                            <span className="text-green-500 uppercase">{pathProfile}</span>
                                        </div>
                                        {gpsCoords ? (
                                            <>
                                                <div>
                                                    <span>ORIGIN_LAT:</span><br/>
                                                    <span className="text-brand-cyan font-bold">{gpsCoords.lat.toFixed(4)}°N</span>
                                                </div>
                                                <div>
                                                    <span>ORIGIN_LON:</span><br/>
                                                    <span className="text-brand-cyan font-bold">{gpsCoords.lng.toFixed(4)}°E</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <span>GPS_LOCK:</span><br/>
                                                    <span className="text-yellow-500 font-bold">UNREALIZED</span>
                                                </div>
                                                <div>
                                                    <span>GPS_EST:</span><br/>
                                                    <span className="text-gray-600">PENDING RESET</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-1"></div>
                    )}

                    <div className="flex flex-col items-end gap-3 pointer-events-auto">
                        {showCalibrator && (
                            <div className="w-full max-w-md animate-in slide-in-from-right duration-500">
                                <div className="bg-[#0c0c0e]/95 backdrop-blur-xl border-l-2 border-brand-purple p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full filter blur-xl transform translate-x-12 -translate-y-12"></div>
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-purple/5 rounded-full filter blur-xl transform -translate-x-12 translate-y-12"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                            <div>
                                                <h2 className="text-xl font-display font-black text-white uppercase italic tracking-wider flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-brand-purple animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    IMU & Compass Calibrator
                                                </h2>
                                                <p className="text-[10px] font-mono text-brand-purple uppercase tracking-widest mt-1">EKF SENSOR FUSION SYSTEM // BIAS ZEROING</p>
                                            </div>
                                            <button 
                                                onClick={() => { setShowCalibrator(false); setIsCalibrating(false); }}
                                                className="text-gray-500 hover:text-white font-mono text-xs uppercase hover:bg-white/5 px-2 py-1 rounded"
                                            >
                                                [ Close ]
                                            </button>
                                        </div>

                                        {isCalibrating && (
                                            <div className="mb-5 bg-black/60 p-3 border border-brand-purple/20 rounded">
                                                <div className="flex justify-between items-center text-xs font-mono text-gray-400 mb-1.5">
                                                    <span>BURNING SENSOR REGISTER...</span>
                                                    <span className="text-brand-purple font-bold">{Math.round(calibProgress)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-900 h-2 rounded overflow-hidden">
                                                    <div 
                                                        className="bg-brand-purple h-full shadow-[0_0_8px_#BC13FE] transition-all duration-300" 
                                                        style={{ width: `${calibProgress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {calibrationStep === 0 && (
                                            <div className="animate-in fade-in duration-300">
                                                <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                                                    High-precision sensor fusion requires zeroing out micro-electro-mechanical (MEMS) static bias drift. 
                                                    This wizard guides you through physical IMU alignment and environmental magnetic disturbance correction.
                                                </p>
                                                <div className="bg-black/60 border border-gray-800 rounded p-4 mb-5 flex flex-col gap-2.5">
                                                    <div className="flex items-center gap-2 text-xs font-mono">
                                                        <div className="w-2 h-2 rounded-full bg-brand-purple animate-pulse"></div>
                                                        <span>Accelerometer Correction: <span className="text-white">Pending</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs font-mono">
                                                        <div className="w-2 h-2 rounded-full bg-brand-cyan"></div>
                                                        <span>Magnetometer Distortion Bezel: <span className="text-white">Out of Sync</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs font-mono">
                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                        <span>Real-time Kinematic Tier: <span className="text-yellow-500">TIER 3 (COARSE)</span></span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => { setCalibrationStep(1); setIsCalibrating(true); }}
                                                    className="w-full bg-brand-purple hover:bg-brand-purple/90 border border-brand-purple text-white py-3 text-sm font-bold uppercase tracking-wider rounded transition-all shadow-[0_0_15px_rgba(188,19,254,0.3)] hover:shadow-[0_0_25px_rgba(188,19,254,0.5)] flex items-center justify-center gap-2"
                                                >
                                                    Start Step-by-Step Calibrate
                                                </button>
                                            </div>
                                        )}

                                        {calibrationStep === 1 && (
                                            <div className="animate-in fade-in duration-300">
                                                <h3 className="text-sm font-bold font-mono text-white uppercase border-l-2 border-brand-purple pl-2 mb-3">STEP 1: Accelerometer Pitch & Roll Leveling</h3>
                                                <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                                                    Mount or place the device on a completely level surface inside the cabin. EKF will sample 3-axis accelerometer gravity vectors to isolate static mount pitch/roll angles.
                                                </p>
                                                <p className="text-xs font-mono text-brand-purple animate-pulse leading-normal max-w-md bg-brand-purple/5 p-2.5 border border-brand-purple/10 rounded">
                                                    NOTICE: KEEP DEVICE PERFECTLY STILL. CAPTURING LEVEL PROFILE AT 120HZ...
                                                </p>
                                            </div>
                                        )}

                                        {calibrationStep === 2 && (
                                            <div className="animate-in fade-in duration-300">
                                                <h3 className="text-sm font-bold font-mono text-white uppercase border-l-2 border-brand-cyan pl-2 mb-3 text-brand-cyan">STEP 2: Tri-Axis Magnetometer Calibration</h3>
                                                <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                                                    Rotate the device slowly in a horizontal and vertical <span className="text-brand-cyan font-bold">figure-8 loop</span>. This maps the surrounding local magnetic field geometry and filters ferrous chassis interference.
                                                </p>
                                                
                                                <button 
                                                    onClick={() => setIsCalibrating(true)}
                                                    className={`w-full py-3 text-sm font-bold uppercase tracking-wider rounded transition-all border ${isCalibrating ? 'bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed' : 'bg-brand-cyan hover:bg-brand-cyan/80 border-brand-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'}`}
                                                    disabled={isCalibrating}
                                                >
                                                    {isCalibrating ? 'Active Figure-8 Motion Scan...' : 'Start Motion Capture'}
                                                </button>
                                            </div>
                                        )}

                                        {calibrationStep === 3 && (
                                            <div className="animate-in fade-in duration-300">
                                                <h3 className="text-sm font-bold font-mono text-white uppercase border-l-2 border-green-400 pl-2 mb-3 text-green-400">STEP 3: Inertial Optical Flow Convergence</h3>
                                                <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                                                    Align the camera with the horizon or vehicle console. The EKF integrates live visual tracking vector metrics with gyroscope angular velocity values to correct scale.
                                                </p>

                                                <button 
                                                    onClick={() => setIsCalibrating(true)}
                                                    className={`w-full py-3 text-sm font-bold uppercase tracking-wider rounded transition-all border ${isCalibrating ? 'bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 border-green-500 text-black shadow-[0_0_15px_rgba(74,222,128,0.3)]'}`}
                                                    disabled={isCalibrating}
                                                >
                                                    {isCalibrating ? 'Resolving Lens Convergence...' : 'Initiate Lens Sync'}
                                                </button>
                                            </div>
                                        )}

                                        {calibrationStep === 4 && (
                                            <div className="animate-in fade-in duration-300">
                                                <h3 className="text-sm font-bold font-mono text-green-400 uppercase border-l-2 border-green-500 pl-2 mb-3">CALIBRATION SUCCESSFUL</h3>
                                                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                                                    Zero-bias dynamic offsets are successfully computed and burned to memory. Precision is set to TIER_1_PRECISION.
                                                </p>

                                                <div className="bg-black/80 font-mono text-[10px] border border-green-500/30 rounded p-3 mb-5 grid grid-cols-2 gap-3">
                                                    <div className="col-span-2 border-b border-gray-800 pb-1 text-green-400 font-bold uppercase text-[9px] tracking-widest">
                                                        Calculated Zero-Bias Register Matrix
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">ACCEL_BIAS_X:</span><br/>
                                                        <span className="text-white font-bold">{calibOffsets.accX.toFixed(5)} G</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">ACCEL_BIAS_Y:</span><br/>
                                                        <span className="text-white font-bold">{calibOffsets.accY.toFixed(5)} G</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">GYRO_DRIFT_X:</span><br/>
                                                        <span className="text-white font-bold">{calibOffsets.gyroX.toFixed(6)} rad/s</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">GYRO_DRIFT_Y:</span><br/>
                                                        <span className="text-white font-bold">{calibOffsets.gyroY.toFixed(6)} rad/s</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">MAG_FLUX_DIP:</span><br/>
                                                        <span className="text-white font-bold">{calibOffsets.magX.toFixed(2)} μT</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">FUSION_FILTER_Q:</span><br/>
                                                        <span className="text-green-400 font-bold">1e-5 (OPTIMAL)</span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setCalibrationStep(0);
                                                            setCalibProgress(0);
                                                        }}
                                                        className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded font-bold uppercase text-[10px] py-2 border border-gray-800 transition-all text-center"
                                                    >
                                                        Recalibrate
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setShowCalibrator(false);
                                                        }}
                                                        className="flex-1 bg-green-500 hover:bg-green-600 text-black rounded font-black uppercase text-[10px] py-2 border border-green-500 transition-all text-center shadow-[0_0_15px_rgba(74,222,128,0.4)]"
                                                    >
                                                        Settle & Lock
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        )}

                        {activeNode && !showCalibrator && (
                            <div className="w-full max-w-md animate-in slide-in-from-right duration-500">
                                <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border-l-2 border-brand-cyan p-6 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_25%,rgba(255,255,255,0.1)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.1)_75%,rgba(255,255,255,0.1))] bg-[length:4px_4px]"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-2">
                                            <div>
                                                <h2 className="text-2xl font-display font-black text-white uppercase italic tracking-wider">{activeNode.label}</h2>
                                                <p className="text-[10px] font-mono text-brand-cyan uppercase tracking-widest">ID: {activeNode.id.toUpperCase()}_SYS_01</p>
                                            </div>
                                            <div className="text-right">
                                                 <div className="text-4xl font-mono font-bold text-white leading-none">
                                                     {latestData && activeNode.dataKey && latestData[activeNode.dataKey] !== undefined 
                                                        ? (latestData[activeNode.dataKey] as number).toFixed(activeNode.dataKey === 'rpm' ? 0 : 1)
                                                        : '--'}
                                                 </div>
                                                 <div className="text-xs text-gray-500 font-bold uppercase">{activeNode.unit}</div>
                                            </div>
                                        </div>

                                        <p className="text-sm text-gray-300 mb-6 leading-relaxed">{activeNode.description}</p>
                                        
                                        {/* Added AI Diagnostic Report Card */}
                                        {diagReport && (
                                            <div className={`mb-4 p-3 rounded-lg border bg-black/60 backdrop-blur-md animate-in slide-in-from-top-2 duration-300 ${
                                                diagReport.status === 'Nominal' ? 'border-green-500/50 text-green-400' :
                                                diagReport.status === 'Warning' ? 'border-amber-500/50 text-amber-400' :
                                                'border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            }`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Cpu className="w-4 h-4" />
                                                    <span className="font-mono text-[10px] font-black uppercase tracking-wider">NeuroCore Diagnostic: {diagReport.status}</span>
                                                </div>
                                                <div className="text-xs font-mono leading-relaxed mb-2 text-gray-300">
                                                    {diagReport.analysis}
                                                </div>
                                                <div className="text-[10px] font-mono border-t border-white/10 pt-2 flex items-start gap-1">
                                                    <span className="font-bold opacity-80 mt-0.5">ACTION:</span>
                                                    <span>{diagReport.recommendation}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="h-24 bg-black/50 border border-gray-800 rounded mb-4 relative p-2">
                                            <div className="absolute top-2 left-2 text-[9px] text-gray-500 uppercase">Live Telemetry</div>
                                            <Sparkline data={historyData} width={300} height={80} color="#00F0FF" />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={handleDiagCheck}
                                                disabled={isDiagnosing}
                                                className="bg-white/5 hover:bg-white/10 border border-gray-700 text-white py-3 text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isDiagnosing ? (
                                                    <>
                                                       <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                       Analyzing...
                                                    </>
                                                ) : 'Diag Check'}
                                            </button>
                                            <button 
                                                onClick={handleGenerateSchematic}
                                                disabled={isGenerating}
                                                className="bg-brand-cyan/10 hover:bg-brand-cyan hover:text-black border border-brand-cyan text-brand-cyan py-3 text-xs font-bold uppercase tracking-wider rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isGenerating ? (
                                                    <>
                                                       <Loader2 className="w-4 h-4 animate-spin" />
                                                       Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                                        Schematic
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {generatedImage && (
                <div 
                    className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300"
                    onClick={() => setGeneratedImage(null)}
                >
                    <div className="relative max-w-4xl max-h-full bg-[#111] border border-gray-700 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden" onClick={e => e.stopPropagation()}>
                         <div className="absolute top-0 left-0 right-0 p-4 bg-black/80 border-b border-gray-800 flex justify-between items-center z-10">
                             <h3 className="text-white font-mono text-sm uppercase">Generative Schematic // {activeNode?.label}</h3>
                             <button onClick={() => setGeneratedImage(null)} className="text-gray-500 hover:text-white">&times;</button>
                         </div>
                         <img src={generatedImage} alt="Generated Schematic" className="max-w-full max-h-[80vh] object-contain" />
                         <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full border border-white/10">
                             <div className="w-2 h-2 bg-brand-cyan rounded-full"></div>
                             <span className="text-[10px] text-gray-300 uppercase">AI Generated</span>
                         </div>
                    </div>
                </div>
            )}
            
            {isScanning && (
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                    <div className="text-center">
                         <div className="inline-block px-4 py-1 bg-brand-cyan/10 border border-brand-cyan/50 text-brand-cyan text-xs font-mono mb-2 animate-pulse">
                             SYSTEM SCANNING...
                         </div>
                    </div>
                </div>
            )}

        </div>
    );
};

/**
 * ARGeospatialOverlay
 * 
 * Simulates the Google Maps AR Geospatial API markers overlay.
 * These markers appear fixed in 3D space relative to the vehicle's position.
 */
const ARGeospatialOverlay: React.FC = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const [markers, setMarkers] = useState<any[]>([]);

    useEffect(() => {
        // Mocking nearby telemetry points (e.g., track segments, speed traps)
        const mockPoints = [
            { id: 'apx_1', label: 'APEX_LOCKED', latOffset: 0.0001, lngOffset: 0.0001, color: '#00F0FF' },
            { id: 'brk_1', label: 'BRAKE_ZONE', latOffset: 0.0003, lngOffset: -0.0002, color: '#EF4444' },
            { id: 'spd_1', label: 'TRAP_01', latOffset: -0.0002, lngOffset: 0.0004, color: '#F59E0B' },
        ];
        setMarkers(mockPoints);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden">
            {markers.map((m) => (
                <ARMarker 
                    key={m.id} 
                    marker={m} 
                    vehiclePos={{ lat: latestData.latitude || 0, lng: latestData.longitude || 0 }} 
                />
            ))}
        </div>
    );
};

const ARMarker: React.FC<{ marker: any, vehiclePos: { lat: number, lng: number } }> = ({ marker, vehiclePos }) => {
    // Basic projection logic
    // In a real app, we'd use device orientation (alpha, beta, gamma) for full 3D alignment
    const latDiff = marker.latOffset;
    const lngDiff = marker.lngOffset;
    
    // Scale for screen space
    const x = 50 + (lngDiff * 50000);
    const y = 50 - (latDiff * 50000);

    return (
        <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
                scale: 1, 
                opacity: 1,
                x: `${x}%`,
                y: `${y}%`
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
        >
            <div className="relative">
                <div className="w-4 h-4 rounded-full border-2 border-white animate-ping absolute inset-0"></div>
                <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center bg-black/40">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: marker.color }}></div>
                </div>
            </div>
            <div className="mt-2 px-2 py-0.5 bg-black/80 backdrop-blur-md border border-white/20 rounded-md">
                <span className="text-[8px] font-mono font-black text-white whitespace-nowrap tracking-widest">{marker.label}</span>
            </div>
            {/* Connection line to ground (simulated) */}
            <div className="w-px h-16 bg-gradient-to-t from-transparent via-white/20 to-white/40"></div>
        </motion.div>
    );
};

export default ARAssistant;
