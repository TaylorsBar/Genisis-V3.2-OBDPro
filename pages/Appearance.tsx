import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppearanceContext, Theme, ColorPalette, SurfaceMaterial, LEDMode } from '../contexts/AppearanceContext';
import { 
    Smartphone, Download, ShieldCheck, Binary, Cpu, Compass, RefreshCw, 
    Layers, AppWindow, Wifi, AlertCircle, Copy, Check, EyeOff, Gauge, Zap
} from 'lucide-react';
import { useVehicleStore } from '../stores/vehicleStore';
import { useUIStore } from '../stores/uiStore';

const themes: { id: Theme; name: string; description: string }[] = [
    { id: 'rally', name: 'World Rally', description: 'High-contrast, functional display for intense conditions.' },
    { id: 'modern', name: 'Modern Performance', description: 'Sleek, futuristic interface with radial data readouts.' },
    { id: 'classic', name: 'E-Tuner Pro', description: 'Professional tuner interface with a red-on-black aesthetic.' },
    { id: 'haltech', name: 'Haltech Pro', description: 'Emulates the popular Haltech digital dash.' },
    { id: 'minimalist', name: 'Apexi Suite', description: 'JDM Tuner aesthetic featuring Power FC Pro styling and custom boost gauges.' },
    { id: 'pro-tuner', name: 'Pro Tuner', description: 'A sleek, professional racing display.' },
    { id: 'elite', name: 'Elite Tuner', description: 'Carbon-fiber focused motorsport telemetry and diagnostics suite.' },
    { id: 'motec-pro', name: 'MoTeC-Cosworth Elite', description: 'Elite motorsport engineering workspace with mathematical channels and 2D scatter analysis.' },
    { id: 'carbon-purple', name: 'Carbon Purple Series', description: 'Meticulously engineered, carbon-fiber focused calibration theme featuring dynamic fusion gauges.' },
    { id: 'nismo', name: 'Nismo Fairlady Z', description: 'Authentic 2024 Fairlady Z Nismo 12.3" digital cluster with triple pod binnacle and F1 shift lights.' },
];

const palettes: { id: ColorPalette; name: string; color: string }[] = [
    { id: 'cyan', name: 'Hyper Cyan', color: '#00F0FF' },
    { id: 'red', name: 'Race Red', color: '#FF3333' },
    { id: 'green', name: 'Matrix Green', color: '#33FF33' },
    { id: 'purple', name: 'Neon Purple', color: '#CC00FF' },
    { id: 'amber', name: 'Warning Amber', color: '#FFCC00' },
];

const materials: { id: SurfaceMaterial; name: string; description: string; previewClass: string }[] = [
    { id: 'glass', name: 'Aero Glass', description: 'Standard translucent glass look.', previewClass: 'bg-white/10 backdrop-blur-md' },
    { id: 'carbon', name: 'Carbon Fiber', description: 'Dark, woven texture overlay.', previewClass: 'bg-black/80 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)),linear-gradient(45deg,rgba(255,255,255,0.05)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05))] bg-[length:10px_10px]' },
    { id: 'brushed-metal', name: 'Brushed Metal', description: 'Industrial steel finish.', previewClass: 'bg-gradient-to-br from-gray-700 to-gray-800' },
    { id: 'matte', name: 'Stealth Matte', description: 'Solid, non-reflective dark grey.', previewClass: 'bg-[#1a1a1a]' },
];

const ledColors = [
    { name: 'Cyan', hex: '#00FFFF' },
    { name: 'Blue', hex: '#007FFF' },
    { name: 'Purple', hex: '#8A2BE2' },
    { name: 'Pink', hex: '#FF00FF' },
    { name: 'Red', hex: '#FF0000' },
    { name: 'Orange', hex: '#FFA500' },
    { name: 'Green', hex: '#00FF00' },
    { name: 'White', hex: '#FFFFFF' },
];

const ledModes: { id: LEDMode, name: string }[] = [
    { id: 'solid', name: 'Solid' },
    { id: 'pulse', name: 'Pulse' },
    { id: 'music', name: 'Music Sync' },
];

const Appearance: React.FC = () => {
    const navigate = useNavigate();
    const { 
        theme, setTheme, 
        colorPalette, setColorPalette, 
        surfaceMaterial, setSurfaceMaterial,
        ledSettings, setLedSettings 
    } = useContext(AppearanceContext);

    const handleThemeSelect = (selectedTheme: Theme) => {
        setTheme(selectedTheme);
        const themeObj = themes.find(t => t.id === selectedTheme);
        useUIStore.getState().showToast(
            `Theme updated to ${themeObj?.name || selectedTheme}. Returning to Cockpit...`, 
            'info', 
            2500
        );
        setTimeout(() => {
            navigate('/');
        }, 250);
    };

    const adaptiveDashboardMode = useVehicleStore(state => state.adaptiveDashboardMode);
    const setAdaptiveDashboardMode = useVehicleStore(state => state.setAdaptiveDashboardMode);
    const isHighStress = useVehicleStore(state => state.isHighStress);

    // native & install states
    const [installEvent, setInstallEvent] = useState<any>(null);
    const [standaloneMode, setStandaloneMode] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // native device sensors
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [gForce, setGForce] = useState({ x: 0, y: 0, z: 0 });
    const [compassHeading, setCompassHeading] = useState(0);

    const bashCommands = [
        "npm install @capacitor/core @capacitor/cli @capacitor/android",
        "npx cap init \"Genesis OS\" \"com.karapiro.genesisos\" --web-dir=dist",
        "npm run build",
        "npx cap add android",
        "npx cap open android"
    ];

    useEffect(() => {
        // Capture PWA install trigger
        const handleInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallEvent(e);
        };
        window.addEventListener('beforeinstallprompt', handleInstallPrompt);

        // Detect Standalone Browser Launch (i.e. running inside APK wrapper or full screen standalone)
        const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                                 (window.navigator as any).standalone === true;
        setStandaloneMode(checkStandalone);

        // Real-time physical device geolocation detection
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoordinates({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                (err) => console.log('Geolocation requires user confirmation'),
                { enableHighAccuracy: true }
            );
        }

        // Physical Accel/Gyro trigger
        const handleMotion = (event: DeviceMotionEvent) => {
            if (event.accelerationIncludingGravity) {
                setGForce({
                    x: Number((event.accelerationIncludingGravity.x || 0).toFixed(2)),
                    y: Number((event.accelerationIncludingGravity.y || 0).toFixed(2)),
                    z: Number((event.accelerationIncludingGravity.z || 0).toFixed(2))
                });
            }
        };

        const handleOrientation = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null) {
                setCompassHeading(Math.round(event.alpha));
            }
        };

        window.addEventListener('devicemotion', handleMotion);
        window.addEventListener('deviceorientation', handleOrientation);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
            window.removeEventListener('devicemotion', handleMotion);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, []);

    const triggerNativeInstall = async () => {
        if (installEvent) {
            installEvent.prompt();
            const { outcome } = await installEvent.userChoice;
            console.log(`User installation decision: ${outcome}`);
            setInstallEvent(null);
        } else {
            // High fidelity fallback instructions / simulator if custom browser doesn't expose it
            useUIStore.getState().showToast(
                "To install Genesis OS as a native Android App: 1. Open Chrome on Android. 2. Tap 'Add to Home screen'. 3. Genesis installs in Standalone full-screen mode with native hardware permissions!", 
                "info", 
                7000
            );
        }
    };

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="space-y-8 pt-4 pb-12">
            {/* Theme Card */}
            <div className="glass-panel p-6 rounded-lg">
                <h2 id="theme-configuration-title" className="text-lg font-semibold border-b border-white/10 pb-2 mb-6 font-display text-brand-cyan">Dashboard Theme</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {themes.map(t => (
                        <div
                            key={t.id}
                            onClick={() => handleThemeSelect(t.id)}
                            className={`p-4 rounded-lg cursor-pointer border-2 transition-all group ${theme === t.id ? 'border-brand-cyan bg-brand-cyan/10 shadow-[0_0_15px_var(--brand-glow)]' : 'border-base-700 hover:border-white/30 hover:bg-white/5'}`}
                        >
                            <h3 className={`font-bold transition-colors ${theme === t.id ? 'text-brand-cyan' : 'text-white'}`}>{t.name}</h3>
                            <p className="text-sm text-gray-400 mt-1 group-hover:text-gray-300">{t.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Color Palette Card */}
            <div className="glass-panel p-6 rounded-lg">
                <h2 id="palette-configuration-title" className="text-lg font-semibold border-b border-white/10 pb-2 mb-6 font-display text-brand-cyan">Interface Color Palette</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {palettes.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setColorPalette(p.id)}
                            className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${colorPalette === p.id ? 'border-white scale-105 shadow-lg bg-white/5' : 'border-transparent hover:bg-white/5'}`}
                        >
                            <div 
                                className="w-12 h-12 rounded-full shadow-lg" 
                                style={{ backgroundColor: p.color, boxShadow: `0 0 15px ${p.color}80` }}
                            ></div>
                            <span className={`text-sm font-bold ${colorPalette === p.id ? 'text-white' : 'text-gray-400'}`}>{p.name}</span>
                            {colorPalette === p.id && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white shadow-[0_0_5px_white]"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Panel Material Card */}
            <div className="glass-panel p-6 rounded-lg">
                <h2 id="material-configuration-title" className="text-lg font-semibold border-b border-white/10 pb-2 mb-6 font-display text-brand-cyan">Panel Material</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {materials.map(m => (
                        <div
                            key={m.id}
                            onClick={() => setSurfaceMaterial(m.id)}
                            className={`cursor-pointer group flex flex-col items-center`}
                        >
                            <div className={`w-full aspect-video rounded-lg border-2 mb-3 relative overflow-hidden transition-all ${surfaceMaterial === m.id ? 'border-brand-cyan shadow-[0_0_15px_var(--brand-glow)]' : 'border-gray-700 group-hover:border-white/30'}`}>
                                <div className={`absolute inset-0 ${m.previewClass}`}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-1/2 h-1 bg-brand-cyan/50 rounded-full"></div>
                                </div>
                            </div>
                            <h3 className={`font-bold ${surfaceMaterial === m.id ? 'text-brand-cyan' : 'text-gray-300'}`}>{m.name}</h3>
                            <p className="text-xs text-gray-500 text-center mt-1">{m.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Interior Ambient Lights */}
            <div className="glass-panel p-6 rounded-lg">
                <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-6">
                    <h2 id="interior-lighting-title" className="text-lg font-semibold font-display text-brand-cyan">Interior Ambient Lighting</h2>
                     <div className="flex items-center">
                        <span className={`mr-3 text-sm font-medium ${ledSettings.isOn ? 'text-white' : 'text-gray-500'}`}>
                            {ledSettings.isOn ? 'On' : 'Off'}
                        </span>
                        <button
                            onClick={() => setLedSettings({ isOn: !ledSettings.isOn })}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${ledSettings.isOn ? 'bg-brand-cyan' : 'bg-base-700'}`}
                            role="switch"
                            aria-checked={ledSettings.isOn}
                        >
                            <span
                                aria-hidden="true"
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${ledSettings.isOn ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>
                
                <div className={`space-y-6 ${!ledSettings.isOn ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <h3 className="text-md font-semibold text-gray-300 mb-3">LED Color</h3>
                        <div className="flex flex-wrap gap-4">
                            {ledColors.map(c => (
                                <button
                                    key={c.hex}
                                    onClick={() => setLedSettings({ color: c.hex })}
                                    className={`w-10 h-10 rounded-full border-2 transition-all ${ledSettings.color === c.hex ? 'border-white scale-110 shadow-[0_0_10px_white]' : 'border-transparent'}`}
                                    style={{ backgroundColor: c.hex }}
                                    aria-label={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="brightness" className="block text-md font-semibold text-gray-300 mb-2">Brightness</label>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range"
                                id="brightness"
                                name="brightness"
                                min="0"
                                max="100"
                                value={ledSettings.brightness}
                                onChange={e => setLedSettings({ brightness: parseInt(e.target.value) })}
                                className="w-full h-2 bg-base-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                            />
                            <span className="font-mono text-lg w-12 text-right text-brand-cyan">{ledSettings.brightness}%</span>
                        </div>
                    </div>
                    
                     <div>
                        <h3 className="text-md font-semibold text-gray-300 mb-3">Lighting Mode</h3>
                        <div className="flex gap-4">
                            {ledModes.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setLedSettings({ mode: m.id })}
                                    className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors border ${ledSettings.mode === m.id ? 'bg-brand-cyan text-black border-brand-cyan' : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'}`}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Adaptive Dashboard Control */}
            <div className="glass-panel p-6 rounded-lg relative overflow-hidden border border-brand-cyan/15">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-6">
                    <div className="flex items-center gap-3">
                        <Gauge className="w-5 h-5 text-brand-cyan" />
                        <h2 id="adaptive-dashboard-title" className="text-lg font-semibold font-display text-brand-cyan">Adaptive Dashboard Mode</h2>
                    </div>
                    <div className="flex items-center">
                        <span className={`mr-3 text-sm font-medium ${adaptiveDashboardMode ? 'text-white' : 'text-gray-500'}`}>
                            {adaptiveDashboardMode ? 'Active' : 'Disabled'}
                        </span>
                        <button
                            onClick={() => setAdaptiveDashboardMode(!adaptiveDashboardMode)}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${adaptiveDashboardMode ? 'bg-brand-cyan' : 'bg-base-700'}`}
                            role="switch"
                            aria-checked={adaptiveDashboardMode}
                        >
                            <span
                                aria-hidden="true"
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${adaptiveDashboardMode ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-8 space-y-4">
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Adaptive Dashboard Mode monitors real-time vehicle kinematics, engine parameters, and lateral G-forces. When high-stress driving or track conditions are detected, it automatically simplifies the active dashboard interface, hiding secondary diagnostics, and pruning unnecessary visual elements to prioritize physical telemetry updates.
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs font-mono">
                            <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-gray-400">RPM ≥ 6000</span>
                            <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-gray-400">Throttle ≥ 85%</span>
                            <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-gray-400">Speed ≥ 130 km/h</span>
                            <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-gray-400">Lateral Force ≥ 1.0G</span>
                        </div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-xl p-4 min-h-[120px]">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">CONDUIT STATE</span>
                        {adaptiveDashboardMode ? (
                            isHighStress ? (
                                <div className="flex flex-col items-center animate-pulse text-center">
                                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] mb-2">
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <span className="text-red-500 font-bold text-xs font-mono uppercase tracking-wider">HIGH STRESS CALIBRATION</span>
                                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5">Interface elements minimized</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                                        <Check className="w-6 h-6" />
                                    </div>
                                    <span className="text-emerald-400 font-bold text-xs font-mono uppercase tracking-wider">MONITORING NORMAL</span>
                                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5">Full graphics active</span>
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col items-center text-center opacity-40">
                                <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mb-2">
                                    <EyeOff className="w-6 h-6" />
                                </div>
                                <span className="text-zinc-400 font-bold text-xs font-mono uppercase tracking-wider">MODE DISABLED</span>
                                <span className="text-[10px] text-zinc-500 font-mono mt-0.5">Interface remains static</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Android Native Installer Center & PWA Diagnostics */}
            <div className="glass-panel p-6 rounded-lg relative overflow-hidden border border-emerald-500/15">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-white/10 pb-4 mb-6 gap-4">
                    <div>
                        <h2 id="android-mobile-installer-title" className="text-lg font-semibold font-display text-emerald-400 flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-emerald-400" />
                            Genesis OS Android Native Uplink
                        </h2>
                        <p className="text-xs text-white/50 mt-1 font-sans">
                            Enable standalone application mode with extreme physical telemetry linking and raw device CPU metrics.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold ${
                            standaloneMode 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        }`}>
                            <Wifi className="w-3.5 h-3.5" />
                            {standaloneMode ? 'NATIVE CONTAINER UPLINK ACTIVE' : 'RUNNING IN SANDBOX'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Direct Launcher Installer and Hardware Checks */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3.5">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <AppWindow className="w-4 h-4 text-emerald-400" />
                                Instant Android Installer
                            </h3>
                            <p className="text-xs text-white/60 leading-relaxed">
                                Install Genesis OS directly to your Android device with instant hardware acceleration, local offline databases, and offline-mode compatibility.
                            </p>

                            <button
                                onClick={triggerNativeInstall}
                                className="w-full py-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all group duration-300 shadow-[0_0_20px_rgba(16,185,129,0.1)] active:scale-95"
                            >
                                <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                                INSTALL NATIVE APK ONBOARD
                            </button>
                        </div>

                        {/* Physical Device Mobile Sensor Pipeline */}
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Compass className="w-4 h-4 text-brand-cyan" />
                                Live System Telemetry Conduit
                            </h3>
                            <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono leading-none">
                                <div className="p-2.5 bg-white/5 border border-white/5 rounded">
                                    <span className="text-zinc-500 block uppercase text-[8px] mb-1">G-Force (Vector)</span>
                                    <span className="text-emerald-400 font-bold font-mono">
                                        X: {gForce.x} | Y: {gForce.y}
                                    </span>
                                </div>
                                <div className="p-2.5 bg-white/5 border border-white/5 rounded">
                                    <span className="text-zinc-500 block uppercase text-[8px] mb-1">Compass Direction</span>
                                    <span className="text-emerald-400 font-bold font-mono">{compassHeading}° N</span>
                                </div>
                            </div>

                            <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-1.5 justify-center font-mono">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                Live WebGPU Kalman State Filtering enabled
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Dynamic Capacitor Command Console */}
                    <div className="lg:col-span-7 bg-[#050505] border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Binary className="w-4 h-4 text-emerald-400" />
                                    Capacitor Native CLI Compiler
                                </h3>
                                <span className="text-[9px] font-mono text-zinc-500 uppercase border border-white/5 px-2 py-0.5 rounded">
                                    Full APK Build
                                </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-normal">
                                Want to compile a full Standalone signed Android Binary APK manually? Run these commands right inside your project workspace folder:
                            </p>
                        </div>

                        {/* Terminal code display */}
                        <div className="bg-[#0c0c0c] border border-white/5 rounded-lg overflow-hidden font-mono text-[10px]">
                            <div className="flex items-center justify-between bg-white/5 px-3 py-1.5 border-b border-white/5 text-zinc-400">
                                <span>TERMINAL_REVERSE_ENGINEER_SHELL</span>
                                <span className="text-emerald-400 font-bold">bash</span>
                            </div>
                            <div className="p-3 text-emerald-400 space-y-2.5 overflow-x-auto select-all leading-normal">
                                {bashCommands.map((cmd, i) => (
                                    <div key={i} className="flex items-start justify-between gap-4 py-1.5 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded group transition-all">
                                        <div className="flex gap-2.5 items-center">
                                            <span className="text-zinc-600 font-bold flex-shrink-0 select-none">{i + 1}</span>
                                            <span className="text-zinc-300 font-mono font-medium">{cmd}</span>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(cmd, i)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-emerald-400 transition-all"
                                            title="Copy Command"
                                        >
                                            {copiedIndex === i ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-emerald-950/15 border border-emerald-500/10 p-3 rounded-lg flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-zinc-400 leading-normal">
                                <strong className="text-emerald-400">Pro-Tip for Racing Engineers:</strong> Standalone Android installation automatically grants the browser direct, ultra-high-frequency access to Bluetooth OBD-II transmitters and direct serial CAN USB dongles. Perfect for high frequency cart logging!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Appearance;
