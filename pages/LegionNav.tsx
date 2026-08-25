import React, { useState, useEffect, useRef, useContext } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { AppearanceContext } from '../contexts/AppearanceContext';
import { getMapsGroundingResponse, MapsGroundingResult } from '../services/geminiService';
import Map from '../components/Map';
import { 
    Compass, Zap, MapPin, Award, Phone, Send, Info, 
    Navigation, RefreshCw, Layers, Sparkles, Volume2, VolumeX 
} from 'lucide-react';

interface RoutePoint {
    lat: number;
    lng: number;
    speedFactor: number; // 0.2 for tight corners, 1.0 for straights
    driftFactor: number; // 0.0 to 1.0 likelihood of sliding here
}

interface RacingRoute {
    id: string;
    name: string;
    distanceKm: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';
    bestTime: string;
    points: RoutePoint[];
    description: string;
}

interface LegionDistrict {
    id: string;
    name: string;
    controller: string;
    color: string; // e.g., 'cyan', 'purple', 'red'
    accentHex: string;
    routes: RacingRoute[];
}

// 5 Iconic Districts centered around Lake Karapiro (-37.8931, 175.5458)
const LEGION_DISTRICTS: LegionDistrict[] = [
    {
        id: 'city_center',
        name: 'DOWNTOWN NEON STRIP',
        controller: 'RACHEL_T',
        color: 'cyan',
        accentHex: '#00F0FF',
        routes: [
            {
                id: 'chinatown_drift',
                name: 'Chinatown Drift Loop',
                distanceKm: '4.2',
                difficulty: 'MEDIUM',
                bestTime: '01:42.50',
                description: 'Tight, technical corners wrapped in neon-lit alleys. Exceptional drift scoring area.',
                points: [
                    { lat: -37.8931, lng: 175.5458, speedFactor: 1.0, driftFactor: 0.1 },
                    { lat: -37.8901, lng: 175.5480, speedFactor: 0.4, driftFactor: 0.8 },
                    { lat: -37.8875, lng: 175.5460, speedFactor: 0.6, driftFactor: 0.5 },
                    { lat: -37.8890, lng: 175.5410, speedFactor: 0.3, driftFactor: 0.9 },
                    { lat: -37.8920, lng: 175.5425, speedFactor: 0.8, driftFactor: 0.2 },
                    { lat: -37.8931, lng: 175.5458, speedFactor: 1.0, driftFactor: 0.1 },
                ]
            },
            {
                id: 'metro_sprint',
                name: 'Metropolitan Sprint',
                distanceKm: '6.5',
                difficulty: 'EASY',
                bestTime: '02:12.10',
                description: 'Wide street lanes and massive straights crossing the commercial bridge.',
                points: [
                    { lat: -37.8931, lng: 175.5458, speedFactor: 1.0, driftFactor: 0.0 },
                    { lat: -37.8980, lng: 175.5520, speedFactor: 1.0, driftFactor: 0.1 },
                    { lat: -37.9040, lng: 175.5580, speedFactor: 0.9, driftFactor: 0.2 },
                    { lat: -37.9010, lng: 175.5610, speedFactor: 0.5, driftFactor: 0.6 },
                    { lat: -37.8940, lng: 175.5530, speedFactor: 1.0, driftFactor: 0.0 },
                    { lat: -37.8931, lng: 175.5458, speedFactor: 1.0, driftFactor: 0.0 },
                ]
            }
        ]
    },
    {
        id: 'beacon_hill',
        name: 'BEACON HILL ACCENTS',
        controller: 'CALEB_R',
        color: 'red',
        accentHex: '#FF003C',
        routes: [
            {
                id: 'hill_climb',
                name: 'Beacon Observatory Climb',
                distanceKm: '7.1',
                difficulty: 'HARD',
                bestTime: '02:54.80',
                description: 'High-elevation twisty climb with hairpin switches and zero room for error.',
                points: [
                    { lat: -37.8931, lng: 175.5458, speedFactor: 0.8, driftFactor: 0.2 },
                    { lat: -37.8950, lng: 175.5380, speedFactor: 0.5, driftFactor: 0.7 },
                    { lat: -37.8985, lng: 175.5310, speedFactor: 0.3, driftFactor: 0.9 },
                    { lat: -37.9010, lng: 175.5260, speedFactor: 0.4, driftFactor: 0.8 },
                    { lat: -37.8960, lng: 175.5320, speedFactor: 0.6, driftFactor: 0.6 },
                    { lat: -37.8931, lng: 175.5458, speedFactor: 0.8, driftFactor: 0.2 },
                ]
            }
        ]
    },
    {
        id: 'jackson_heights',
        name: 'JACKSON HEIGHTS RIDGE',
        controller: 'NIKKI_M',
        color: 'purple',
        accentHex: '#BC13FE',
        routes: [
            {
                id: 'peak_drift',
                name: 'Waikato Peak Drift Stage',
                distanceKm: '8.0',
                difficulty: 'EXTREME',
                bestTime: '03:15.20',
                description: 'Continuous winding sweeps. Lock your differential and slide to survive.',
                points: [
                    { lat: -37.8931, lng: 175.5458, speedFactor: 0.6, driftFactor: 0.5 },
                    { lat: -37.8890, lng: 175.5550, speedFactor: 0.4, driftFactor: 0.9 },
                    { lat: -37.8830, lng: 175.5620, speedFactor: 0.3, driftFactor: 1.0 },
                    { lat: -37.8780, lng: 175.5580, speedFactor: 0.5, driftFactor: 0.8 },
                    { lat: -37.8850, lng: 175.5490, speedFactor: 0.4, driftFactor: 0.9 },
                    { lat: -37.8931, lng: 175.5458, speedFactor: 0.6, driftFactor: 0.5 },
                ]
            }
        ]
    },
    {
        id: 'coal_harbor',
        name: 'COAL HARBOR INDUSTRIAL',
        controller: 'HECTOR_G',
        color: 'amber',
        accentHex: '#FCEE0A',
        routes: [
            {
                id: 'dockside_sprint',
                name: 'Dockside Terminal Run',
                distanceKm: '3.8',
                difficulty: 'MEDIUM',
                bestTime: '01:28.40',
                description: '90-degree warehouse sweeps, shipping container barricades, and wet asphalt.',
                points: [
                    { lat: -37.8931, lng: 175.5458, speedFactor: 1.0, driftFactor: 0.1 },
                    { lat: -37.8910, lng: 175.5410, speedFactor: 0.4, driftFactor: 0.7 },
                    { lat: -37.8860, lng: 175.5420, speedFactor: 1.0, driftFactor: 0.2 },
                    { lat: -37.8850, lng: 175.5480, speedFactor: 0.5, driftFactor: 0.8 },
                    { lat: -37.8900, lng: 175.5510, speedFactor: 0.9, driftFactor: 0.3 },
                    { lat: -37.8931, lng: 175.5458, speedFactor: 1.0, driftFactor: 0.1 },
                ]
            }
        ]
    }
];

const RachelSmsDatabase = [
    "Yo, Rachel here. Word is the industrial sector has some active street sweeps tonight, watch your boost map!",
    "Nice ride! That calibration is screaming. Try running the Peak Drift Stage up in Jackson Heights next.",
    "Hey! If you activate N2O purge on the straights, make sure your throttle angle is fully pinned to maximize velocity.",
    "Caleb's gang was spotted around Beacon Hill. Run a clean diagnostic check before heading up the mountain."
];

const LegionNav: React.FC = () => {
    const { colorPalette } = useContext(AppearanceContext);
    const setVehicleConfig = useVehicleStore(state => state.setVehicleConfig);
    
    // UI state
    const [selectedDistrict, setSelectedDistrict] = useState<LegionDistrict>(LEGION_DISTRICTS[0]);
    const [selectedRoute, setSelectedRoute] = useState<RacingRoute>(LEGION_DISTRICTS[0].routes[0]);
    const [viewMode, setViewMode] = useState<'VECTOR' | 'SATELLITE'>('VECTOR');
    
    // Simulation / Playback State
    const [isRunning, setIsRunning] = useState(false);
    const [currentPointIdx, setCurrentPointIdx] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);
    const [carPos, setCarPos] = useState({ lat: -37.8931, lng: 175.5458 });
    const [bearing, setBearing] = useState(0);
    
    // Gaming HUD indicators
    const [n2oReserve, setN2oReserve] = useState(100); // 0-100%
    const [isN2oPurging, setIsN2oPurging] = useState(false);
    const [n2oActive, setN2oActive] = useState(false);
    const [driftScore, setDriftScore] = useState(0);
    const [driftMultiplier, setDriftMultiplier] = useState(1.0);
    const [driftDisplay, setDriftDisplay] = useState<{ text: string, active: boolean }>({ text: '', active: false });
    const [lapSeconds, setLapSeconds] = useState(0);
    const [soundEnabled, setSoundEnabled] = useState(false);
    
    // Rachel SMS / Pocket PC
    const [smsList, setSmsList] = useState<string[]>([]);
    const [currentSms, setCurrentSms] = useState<string>("Rachel: Look at that minimap. Pick a route, dial your ECU, and let's see some hot laps around the lake!");
    const [smsTimer, setSmsTimer] = useState<any>(null);
    
    // AI route analyst
    const [advisorQuery, setAdvisorQuery] = useState('');
    const [aiReport, setAiReport] = useState<MapsGroundingResult | null>(null);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    
    // Refs for animating path trace
    const animationFrameId = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const engineOscillatorRef = useRef<OscillatorNode | null>(null);
    const engineGainRef = useRef<GainNode | null>(null);
    
    // 1. Initial State Sync & SMS loop
    useEffect(() => {
        // Hydrate initial SMS and schedule updates
        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * RachelSmsDatabase.length);
            setCurrentSms(`SMS RECEIVE // RACHEL_T: ${RachelSmsDatabase[randomIndex]}`);
            
            // Beep sound
            if (soundEnabled && audioContextRef.current) {
                playSynthBeep(880, 0.05);
            }
        }, 30000);
        
        return () => {
            clearInterval(interval);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            stopEngineSound();
        };
    }, [soundEnabled]);

    // Track state of N2O and adjust vehicle configuration dynamically
    useEffect(() => {
        if (n2oActive) {
            setVehicleConfig({ fuelType: 'Nitrous + 93' });
        } else {
            setVehicleConfig({ fuelType: 'Pump 93' });
        }
    }, [n2oActive]);

    // Handle Route change
    const selectRoute = (route: RacingRoute) => {
        setSelectedRoute(route);
        setCarPos({ lat: route.points[0].lat, lng: route.points[0].lng });
        setCurrentPointIdx(0);
        setProgressPercent(0);
        setIsRunning(false);
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        stopEngineSound();
    };

    // Synthesizer Audio Engine (Bespoke NFSU2 style sci-fi synth pulses)
    const playSynthBeep = (freq: number, duration: number) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn("Audio Context init blocked or failed: ", e);
        }
    };

    const startEngineSound = () => {
        if (!soundEnabled) return;
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            // Setup persistent engine oscillator
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, ctx.currentTime);
            
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();

            engineOscillatorRef.current = osc;
            engineGainRef.current = gain;
        } catch (e) {
            console.warn(e);
        }
    };

    const updateEngineSound = (rpm: number) => {
        if (!soundEnabled || !engineOscillatorRef.current) return;
        try {
            // Map RPM (1000 - 9000) to Audio Frequency (60 - 450 Hz)
            const mappedFreq = 40 + (rpm / 9000) * 380;
            engineOscillatorRef.current.frequency.setValueAtTime(mappedFreq, audioContextRef.current!.currentTime);
        } catch (e) {}
    };

    const stopEngineSound = () => {
        try {
            if (engineOscillatorRef.current) {
                engineOscillatorRef.current.stop();
                engineOscillatorRef.current.disconnect();
                engineOscillatorRef.current = null;
            }
        } catch (e) {}
    };

    const handlePurgeN2O = () => {
        if (n2oReserve <= 10) {
            playSynthBeep(220, 0.3); // Low warning
            return;
        }
        
        setIsN2oPurging(true);
        playSynthBeep(1200, 0.4); // Purge spray sound
        
        // Subtract N2O
        setN2oReserve(prev => Math.max(0, prev - 15));
        
        // Display notification
        setDriftDisplay({ text: 'N2O PURGE ACTIVATED // SOLENOIDS VENTED', active: true });
        setTimeout(() => {
            setIsN2oPurging(false);
            setDriftDisplay(prev => ({ ...prev, active: false }));
        }, 1200);
    };

    // Calculate Bearing between two points
    const calculateBearing = (start: {lat: number, lng: number}, end: {lat: number, lng: number}) => {
        const lat1 = start.lat * Math.PI / 180;
        const lat2 = end.lat * Math.PI / 180;
        const dLng = (end.lng - start.lng) * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    };

    // Trigger AI report
    const triggerAiRouteAnalysis = async () => {
        setIsAiAnalyzing(true);
        try {
            const query = advisorQuery.trim() || `Give a detailed, highly technical racing strategy for the Waikato route called "${selectedRoute.name}" in "${selectedDistrict.name}". Detail corner entries, traction control overrides, and optimal shift points.`;
            const result = await getMapsGroundingResponse(query, selectedRoute.points[0]);
            setAiReport(result);
        } catch (err) {
            console.error(err);
        } finally {
            setIsAiAnalyzing(false);
        }
    };

    // Real-time trace playback
    const toggleRouteTrace = () => {
        if (isRunning) {
            setIsRunning(false);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            stopEngineSound();
        } else {
            setIsRunning(true);
            startEngineSound();
            runSimulationLoop(currentPointIdx, 0);
        }
    };

    const runSimulationLoop = (ptIdx: number, subStep: number) => {
        const points = selectedRoute.points;
        const currentPt = points[ptIdx];
        const nextPt = points[(ptIdx + 1) % points.length];
        
        // Linear interpolation
        const steps = 60; // 60 frames per point pair
        const t = subStep / steps;
        
        const lat = currentPt.lat + (nextPt.lat - currentPt.lat) * t;
        const lng = currentPt.lng + (nextPt.lng - currentPt.lng) * t;
        
        const calculatedBearing = calculateBearing(currentPt, nextPt);
        setCarPos({ lat, lng });
        setBearing(calculatedBearing);
        
        // Calculate G-Forces and speed based on point speed factor & active Nitrous
        const baseSpeed = 80 + (currentPt.speedFactor * 100); 
        const n2oMultiplier = n2oActive ? 1.5 : 1.0;
        const actualSpeed = Math.min(260, baseSpeed * n2oMultiplier * (1 + (Math.sin(Date.now() / 200) * 0.03)));
        const simulatedRpm = Math.min(8500, (actualSpeed / 260) * 7000 + 1500 + (Math.sin(Date.now() / 100) * 100));
        const currentGear = actualSpeed < 40 ? 1 : actualSpeed < 80 ? 2 : actualSpeed < 120 ? 3 : actualSpeed < 160 ? 4 : actualSpeed < 200 ? 5 : 6;
        
        const simulatedBoost = currentPt.speedFactor > 0.6 ? 1.2 * n2oMultiplier : 0.4;
        const simulatedO2 = 0.8 + (Math.sin(Date.now() / 300) * 0.1);
        
        const simulatedGForceX = (nextPt.lng - currentPt.lng) * 500 * (n2oActive ? 1.4 : 1.0);
        const simulatedGForceY = (nextPt.lat - currentPt.lat) * 500 * (n2oActive ? 1.4 : 1.0);
        
        // Drift Physics Accumulator
        if (currentPt.driftFactor > 0.5) {
            const addedDrift = Math.floor(currentPt.driftFactor * 45 * driftMultiplier);
            setDriftScore(prev => prev + addedDrift);
            setDriftMultiplier(prev => Math.min(5.0, Number((prev + 0.05).toFixed(2))));
            setDriftDisplay({
                text: `DRIFT STATE ACTIVE // MULTIPLIER x${driftMultiplier.toFixed(1)}`,
                active: true
            });
            if (soundEnabled && Math.random() < 0.15) {
                playSynthBeep(600, 0.1); // screech sound
            }
        } else {
            // Cool down drift overlay slowly
            if (driftMultiplier > 1.0) {
                setDriftMultiplier(prev => Math.max(1.0, Number((prev - 0.02).toFixed(2))));
            }
        }

        // Update main store to let other dashboard gauges literally mirror the route data in real-time
        useVehicleStore.setState(state => ({
            latestData: {
                ...state.latestData,
                latitude: lat,
                longitude: lng,
                speed: actualSpeed,
                rpm: simulatedRpm,
                gear: currentGear,
                turboBoost: simulatedBoost,
                o2SensorVoltage: simulatedO2,
                gForceX: simulatedGForceX,
                gForceY: simulatedGForceY,
                gForceZ: 1.0
            }
        }));

        updateEngineSound(simulatedRpm);
        
        // Manage state
        const nextSubStep = subStep + 1;
        if (nextSubStep >= steps) {
            const nextIdx = (ptIdx + 1) % points.length;
            setCurrentPointIdx(nextIdx);
            
            // Loop route logic or stop
            const currentPercent = Math.floor((nextIdx / points.length) * 100);
            setProgressPercent(currentPercent);
            
            animationFrameId.current = requestAnimationFrame(() => runSimulationLoop(nextIdx, 0));
        } else {
            animationFrameId.current = requestAnimationFrame(() => runSimulationLoop(ptIdx, nextSubStep));
        }
    };

    // Toggle nitrous
    const toggleNitrous = () => {
        if (!n2oActive && n2oReserve <= 0) {
            playSynthBeep(150, 0.4);
            return;
        }
        
        if (!n2oActive) {
            setN2oActive(true);
            playSynthBeep(900, 0.2);
            // Continuous nitrous drain interval
            const drain = setInterval(() => {
                setN2oReserve(prev => {
                    if (prev <= 2) {
                        clearInterval(drain);
                        setN2oActive(false);
                        return 0;
                    }
                    return prev - 2;
                });
            }, 100);
        } else {
            setN2oActive(false);
        }
    };

    return (
        <div id="legion-navigator-page" className="w-full h-full min-h-0 bg-[#03030c] text-white flex flex-col font-sans overflow-y-auto pb-10">
            {/* Header HUD Bar */}
            <div className="shrink-0 p-4 border-b border-white/5 bg-gradient-to-r from-[#00F0FF]/10 via-transparent to-[#FF003C]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Compass className="w-5 h-5 text-brand-cyan animate-spin-slow" />
                    <div>
                        <h1 className="text-sm font-display font-black tracking-widest italic uppercase">Legion Tactical Navigator</h1>
                        <p className="text-[8px] font-mono text-gray-500 uppercase">Need For Speed Underground II Legacy Interface // Hamilton - Lake Karapiro Sector</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSoundEnabled(!soundEnabled)} 
                        className={`p-2 rounded-lg border ${soundEnabled ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan' : 'bg-black/40 border-white/10 text-gray-400'} transition-all`}
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    <div className="bg-black/60 border border-white/10 px-3 py-1.5 rounded flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10B981]"></span>
                        <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">OBD_UDS_STREAM_LIVE</span>
                    </div>
                </div>
            </div>

            {/* Immersive Bento Layout */}
            <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0">
                {/* Left Side: District & Route Selectors */}
                <div className="xl:col-span-4 flex flex-col gap-6 min-h-0">
                    {/* District Selector Panel */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 relative overflow-hidden backdrop-blur-xl">
                        <div className="absolute top-0 left-0 w-2 h-full bg-brand-cyan"></div>
                        <h3 className="text-[10px] font-mono text-brand-cyan uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" /> SELECT LEGION SECTOR
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {LEGION_DISTRICTS.map((district) => (
                                <button
                                    key={district.id}
                                    onClick={() => {
                                        setSelectedDistrict(district);
                                        selectRoute(district.routes[0]);
                                        playSynthBeep(500, 0.08);
                                    }}
                                    className={`text-left p-3 rounded-xl border transition-all relative ${
                                        selectedDistrict.id === district.id 
                                            ? 'bg-white/5 border-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' 
                                            : 'bg-black/30 border-white/5 hover:border-white/15'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div 
                                                className="w-2 h-2 rounded-full" 
                                                style={{ backgroundColor: district.accentHex, boxShadow: `0 0 10px ${district.accentHex}` }}
                                            />
                                            <span className="text-[11px] font-display font-black tracking-wider uppercase italic">
                                                {district.name}
                                            </span>
                                        </div>
                                        <span className="text-[8px] font-mono text-gray-500 uppercase">CT_LINK: {district.controller}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Route Info & Setup */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 relative overflow-hidden flex-1 flex flex-col justify-between backdrop-blur-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-radial-gradient from-brand-purple/5 to-transparent pointer-events-none"></div>
                        
                        <div>
                            <h3 className="text-[10px] font-mono text-brand-purple uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
                                <Navigation className="w-3.5 h-3.5" /> ACTIVE SECTOR ROUTES
                            </h3>

                            <div className="space-y-3">
                                {selectedDistrict.routes.map((route) => (
                                    <button
                                        key={route.id}
                                        onClick={() => {
                                            selectRoute(route);
                                            playSynthBeep(600, 0.08);
                                        }}
                                        className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 relative ${
                                            selectedRoute.id === route.id
                                                ? 'bg-brand-purple/10 border-brand-purple/40 shadow-[0_0_15px_rgba(188,19,254,0.15)]'
                                                : 'bg-black/20 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-bold uppercase tracking-wide text-white group-hover:text-brand-purple">
                                                {route.name}
                                            </span>
                                            <span className={`text-[8px] px-2 py-0.5 rounded font-bold font-mono border ${
                                                route.difficulty === 'EASY' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                                                route.difficulty === 'MEDIUM' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                                                route.difficulty === 'HARD' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                                                'border-purple-500/30 text-purple-400 bg-purple-500/5'
                                            }`}>
                                                {route.difficulty}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-mono text-gray-400">
                                            <span>DISTANCE: {route.distanceKm} KM</span>
                                            <span>BEST: {route.bestTime}</span>
                                        </div>
                                        <p className="text-[9px] text-gray-500 leading-relaxed italic border-t border-white/5 pt-2 mt-1">
                                            {route.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Pocket PC SMS Terminal */}
                        <div className="mt-6 bg-[#04040d] border border-white/5 p-3 rounded-xl relative">
                            <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1.5">
                                <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 text-brand-red" /> SMS INBOX // RX_ONLINE
                                </span>
                                <div className="w-1.5 h-1.5 bg-brand-red rounded-full animate-ping"></div>
                            </div>
                            <div className="text-[9px] font-mono text-gray-300 leading-relaxed max-h-16 overflow-y-auto">
                                {currentSms}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Live Path Trace Wireframe Map HUD */}
                <div className="xl:col-span-5 flex flex-col gap-6 min-h-0">
                    <div className="bg-black/60 border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden relative shadow-2xl">
                        {/* Map HUD Frame - Rachel's dashboard spec */}
                        <div className="p-3 border-b border-white/5 bg-[#04040d] flex justify-between items-center z-10">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-brand-cyan tracking-widest uppercase font-bold">GRID LINK STATUS: ACTIVE</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setViewMode('VECTOR')}
                                    className={`px-3 py-1 rounded text-[8px] font-mono font-bold uppercase transition-all ${
                                        viewMode === 'VECTOR' ? 'bg-brand-cyan text-black' : 'bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Neon Grid
                                </button>
                                <button
                                    onClick={() => setViewMode('SATELLITE')}
                                    className={`px-3 py-1 rounded text-[8px] font-mono font-bold uppercase transition-all ${
                                        viewMode === 'SATELLITE' ? 'bg-brand-cyan text-black' : 'bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Satellite
                                </button>
                            </div>
                        </div>

                        {/* Active Map Field */}
                        <div className="flex-1 relative bg-black/40 overflow-hidden">
                            {viewMode === 'SATELLITE' ? (
                                <Map lat={carPos.lat} lon={carPos.lng} />
                            ) : (
                                <div className="w-full h-full relative bg-[#020208] flex items-center justify-center p-4">
                                    {/* Neon grid scanlines & circles */}
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.03)_10%,transparent_70%)] pointer-events-none"></div>
                                    <div className="absolute inset-0 pointer-events-none opacity-5" 
                                         style={{ 
                                             backgroundImage: 'linear-gradient(#00F0FF 1px, transparent 1px), linear-gradient(90deg, #00F0FF 1px, transparent 1px)',
                                             backgroundSize: '20px 20px'
                                         }}></div>

                                    {/* SVG Wireframe Engine */}
                                    <svg viewBox="175.52 -37.91 0.05 0.03" className="w-full h-full rotate-x-6 scale-95 preserve-3d">
                                        {/* Grid Circle Compass helper */}
                                        <circle cx="175.5458" cy="-37.8931" r="0.015" fill="none" stroke="rgba(0, 240, 255, 0.05)" strokeWidth="0.0001" />
                                        <circle cx="175.5458" cy="-37.8931" r="0.03" fill="none" stroke="rgba(0, 240, 255, 0.03)" strokeWidth="0.0001" />

                                        {/* All District Boundaries (Abstract layout loops) */}
                                        {LEGION_DISTRICTS.map((dist) => (
                                            <g key={dist.id}>
                                                {dist.routes.map((rt) => (
                                                    <polyline
                                                        key={rt.id}
                                                        points={rt.points.map(p => `${p.lng},${-p.lat}`).join(' ')}
                                                        fill="none"
                                                        stroke="rgba(255, 255, 255, 0.08)"
                                                        strokeWidth="0.0004"
                                                        strokeDasharray="0.0005, 0.0005"
                                                    />
                                                ))}
                                            </g>
                                        ))}

                                        {/* Active Selected Route Glowing Underlay */}
                                        <polyline
                                            points={selectedRoute.points.map(p => `${p.lng},${-p.lat}`).join(' ')}
                                            fill="none"
                                            stroke={selectedDistrict.accentHex}
                                            strokeWidth="0.0009"
                                            className="opacity-20 blur-[1px]"
                                        />
                                        <polyline
                                            points={selectedRoute.points.map(p => `${p.lng},${-p.lat}`).join(' ')}
                                            fill="none"
                                            stroke={selectedDistrict.accentHex}
                                            strokeWidth="0.0005"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        {/* Start Marker */}
                                        <circle
                                            cx={selectedRoute.points[0].lng}
                                            cy={-selectedRoute.points[0].lat}
                                            r="0.0006"
                                            fill="none"
                                            stroke="#10B981"
                                            strokeWidth="0.0002"
                                        />
                                        <circle
                                            cx={selectedRoute.points[0].lng}
                                            cy={-selectedRoute.points[0].lat}
                                            r="0.0003"
                                            fill="#10B981"
                                        />

                                        {/* Car Dot Arrow Marker */}
                                        <g transform={`translate(${carPos.lng}, ${-carPos.lat}) rotate(${-bearing})`}>
                                            <polygon 
                                                points="0,-0.0009 0.0006,0.0009 -0.0006,0.0009" 
                                                fill={selectedDistrict.accentHex}
                                                stroke="#FFFFFF"
                                                strokeWidth="0.0001"
                                                className="drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]"
                                            />
                                            <circle cx="0" cy="0" r="0.0003" fill="#FFFFFF" />
                                        </g>
                                    </svg>
                                    
                                    {/* Floating Stats Compass Overlay */}
                                    <div className="absolute top-4 left-4 bg-black/80 border border-white/10 px-3 py-2 rounded-xl font-mono text-[9px] text-brand-cyan">
                                        <span className="block text-gray-500 uppercase tracking-widest text-[7px] mb-1">Vector Alignment</span>
                                        BEARING: {bearing.toFixed(1)}° <br />
                                        GPS LAT: {carPos.lat.toFixed(6)} <br />
                                        GPS LNG: {carPos.lng.toFixed(6)}
                                    </div>
                                    
                                    {/* Directional Reticle */}
                                    <div className="absolute bottom-4 right-4 bg-black/80 border border-white/10 p-3 rounded-2xl flex items-center gap-3">
                                        <div className="relative w-8 h-8 flex items-center justify-center">
                                            <Compass className="w-6 h-6 text-brand-purple animate-spin-slow" />
                                            <div className="absolute inset-0 border border-brand-purple/20 rounded-full"></div>
                                        </div>
                                        <div>
                                            <span className="text-[7px] text-gray-500 uppercase block font-bold">Waikato Vector</span>
                                            <span className="text-xs font-bold text-white font-mono">SECT_74</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Active Drift Alert Event Banner */}
                            {driftDisplay.active && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 border-y-2 border-brand-cyan px-10 py-4 flex flex-col items-center gap-1 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,240,255,0.2)] animate-pulse z-50">
                                    <span className="text-[8px] font-mono text-brand-cyan tracking-[0.3em] font-black uppercase">Telemetry Action alert</span>
                                    <span className="text-sm font-display font-black text-white italic tracking-widest uppercase">
                                        {driftDisplay.text}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Interactive Playback Control Panel */}
                        <div className="p-4 bg-[#050512] border-t border-white/10 flex flex-col gap-3">
                            <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-brand-cyan" /> LAP PROGRESS</span>
                                <span>{progressPercent}% COMPLETE</span>
                            </div>
                            
                            {/* Neon progress track */}
                            <div className="w-full h-1.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={toggleRouteTrace}
                                    className={`flex-1 py-3 px-6 rounded-xl font-display font-black text-xs uppercase italic tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                                        isRunning 
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                                            : 'bg-brand-cyan text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                                    }`}
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                                    {isRunning ? 'HALT TRACE' : 'EXECUTE LAP PATHTRACE'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Gaming Dashboard Components */}
                <div className="xl:col-span-3 flex flex-col gap-6 min-h-0">
                    {/* Bespoke NFS Underground Nitrous Oxide HUD */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 relative overflow-hidden backdrop-blur-xl flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[10px] font-mono text-brand-cyan uppercase tracking-widest font-bold flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5" /> N2O NITROUS OXIDE
                                </h3>
                                <span className="text-[10px] font-mono font-bold text-brand-cyan">{n2oReserve}%</span>
                            </div>

                            {/* Circular gauge mock using flex arcs */}
                            <div className="relative w-36 h-36 mx-auto mb-4 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
                                <div 
                                    className="absolute inset-0 rounded-full border-4 border-brand-cyan border-t-transparent transition-all duration-300"
                                    style={{ 
                                        transform: `rotate(${(n2oReserve / 100) * 270}deg)`,
                                        borderColor: n2oReserve < 30 ? '#FF003C' : '#00F0FF'
                                    }}
                                ></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-3xl font-display font-black text-white italic tracking-tighter">N2O</span>
                                    <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">SYS_ARMED</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handlePurgeN2O}
                                disabled={n2oReserve <= 10}
                                className="flex-1 py-2 px-3 bg-white/5 border border-white/10 hover:border-brand-cyan/40 rounded-xl text-[9px] font-mono font-bold text-white uppercase tracking-widest hover:text-brand-cyan transition-all"
                            >
                                PURGE N2O
                            </button>
                            <button
                                onClick={toggleNitrous}
                                disabled={n2oReserve <= 0}
                                className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${
                                    n2oActive 
                                        ? 'bg-brand-red text-white shadow-[0_0_15px_rgba(255,0,60,0.4)]' 
                                        : 'bg-brand-cyan text-black hover:scale-[1.02]'
                                }`}
                            >
                                {n2oActive ? 'N2O ACTIVE' : 'INJECT N2O'}
                            </button>
                        </div>
                    </div>

                    {/* Drift Accumulator & Score Meter */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 relative overflow-hidden backdrop-blur-xl flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-amber-500" /> DRIFT COMP_GRID
                                </h3>
                                <span className="text-[10px] font-mono font-bold text-amber-400">MULTIPLIER</span>
                            </div>

                            <div className="flex flex-col items-center py-4 bg-black/60 rounded-xl border border-white/5 relative">
                                <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mb-1">SCORE TOTAL</span>
                                <span className="text-4xl font-display font-black text-amber-400 italic tracking-tighter">
                                    {driftScore.toLocaleString()}
                                </span>
                                
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-lg font-display font-black text-white italic">
                                        x{driftMultiplier.toFixed(1)}
                                    </span>
                                    <div className="w-16 h-2 bg-gray-900 border border-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-amber-500 transition-all duration-300"
                                            style={{ width: `${(driftMultiplier / 5.0) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setDriftScore(0);
                                setDriftMultiplier(1.0);
                                playSynthBeep(330, 0.1);
                            }}
                            className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[9px] font-mono text-gray-400 uppercase tracking-widest transition-all"
                        >
                            RESET DRIFT SCORE
                        </button>
                    </div>

                    {/* AI Route Grounding Advisor */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 relative overflow-hidden backdrop-blur-xl flex-1 flex flex-col justify-between">
                        <div>
                            <h3 className="text-[10px] font-mono text-brand-cyan uppercase tracking-widest mb-3 font-bold flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-brand-cyan" /> CO-PILOT ADVISOR
                            </h3>
                            <textarea
                                value={advisorQuery}
                                onChange={(e) => setAdvisorQuery(e.target.value)}
                                placeholder="Request route analysis or specific spot tips around Lake Karapiro..."
                                className="w-full bg-black/60 border border-white/10 p-2.5 rounded-xl text-[10px] font-mono text-white placeholder:text-gray-700 h-20 focus:outline-none focus:border-brand-cyan/50 resize-none"
                            />
                        </div>

                        <div className="mt-4 flex flex-col gap-2">
                            <button
                                onClick={triggerAiRouteAnalysis}
                                disabled={isAiAnalyzing}
                                className="w-full py-2 bg-brand-cyan text-black rounded-xl font-mono font-black text-[9px] uppercase tracking-widest shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:scale-[1.01] transition-all disabled:opacity-40"
                            >
                                {isAiAnalyzing ? 'ANALYZING TRACK...' : 'QUERY AI TACTICAL ADVICE'}
                            </button>

                            {aiReport && (
                                <div className="mt-3 bg-black/80 border border-brand-cyan/20 p-2.5 rounded-xl max-h-40 overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-between items-center mb-1 border-b border-white/5 pb-1">
                                        <span className="text-[7px] font-mono text-brand-cyan uppercase">AI BRIEFING RESPONSE</span>
                                        <button onClick={() => setAiReport(null)} className="text-[8px] text-gray-500">HIDE</button>
                                    </div>
                                    <p className="text-[9px] font-mono text-gray-300 leading-relaxed italic">
                                        {aiReport.text}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegionNav;
