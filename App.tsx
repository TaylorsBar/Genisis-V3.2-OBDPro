
import React, { useEffect, useState, useContext, useRef } from 'react';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import AnimatedRoutes from './pages/AnimatedRoutes';
import SystemStatusBar from './components/SystemStatusBar';
import MobileNavBar from './components/MobileNavBar';
import DigitalTapeRpm from './components/tachometers/DigitalTapeRpm';
import { AppearanceProvider, AppearanceContext } from './contexts/AppearanceContext';
import { useVehicleStore } from './stores/vehicleStore';
import { useAIStore } from './stores/aiStore';
import { useUIStore } from './stores/uiStore';
import { useGamepad } from './hooks/useGamepad';
import { useGestures } from './hooks/useGestures';
import { KarapiroLogo } from './components/KarapiroLogo';
import SideMenu from './components/SideMenu';
import GlobalAssistant from './components/GlobalAssistant';
import SubsystemOverrides from './components/SubsystemOverrides';
import { SystemEngineerConsole } from './components/diagnostics/SystemEngineerConsole';
import { TelemetryOverlay } from './components/dashboard/TelemetryOverlay';
import { GlobalToastNotification } from './components/GlobalToastNotification';
import { HPTunersDiagnosticTool } from './components/diagnostics/HPTunersDiagnosticTool';
import { APIProvider } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const HAS_VALID_MAPS_KEY = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

// Redline Alarm - Memoized to prevent re-renders on every RPM tick if state hasn't crossed threshold
const GlobalRedlineAlarm = React.memo(() => {
  const rpm = useVehicleStore(state => state.latestData?.rpm);
  const shiftLightRpm = useVehicleStore(state => state.shiftLightRpm);
  
  // Guard values: must be valid numbers, engine must be actively revving (> 1000 RPM), and must exceed shift threshold.
  // This prevents uninitialized values or idle states from triggering a false positive flash.
  const isRpmLimitHit = typeof rpm === 'number' && 
                        typeof shiftLightRpm === 'number' && 
                        rpm > 1000 && 
                        shiftLightRpm > 1000 && 
                        rpm >= shiftLightRpm;

  if (!isRpmLimitHit) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes global-edge-flash {
            0% { opacity: 0.15; }
            100% { opacity: 1.0; }
        }
      `}} />
      <div 
          className="absolute inset-0 pointer-events-none z-[9999] border-8 border-red-600/95 shadow-[inset_0_0_80px_rgba(239,68,68,0.9)] animate-[global-edge-flash_0.1s_infinite_alternate-reverse]"
      />
    </>
  );
});

const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isImmersive, setIsImmersive } = useContext(AppearanceContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const { hpTunersVisible, setHpTunersVisible } = useUIStore();
  
  const startFusionLoop = useVehicleStore(state => state.startFusionLoop);
  const loadDatabases = useVehicleStore(state => state.loadDatabases);
  const cognitiveState = useVehicleStore(state => state.cognitiveState);
  const setContext = useAIStore(state => state.setContext);
  const { isConnected: gamepadConnected, gamepadName } = useGamepad();

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  const routeOrder = [
    '/',
    '/diagnostics',
    '/tuning',
    '/ai-engine',
    '/race-pack',
    '/logbook',
    '/security',
    '/accessories',
    '/appearance',
    '/ar-assistant',
    '/hedera',
    '/hud'
  ];

  const handleSwipeLeft = () => {
      const currentIndex = routeOrder.indexOf(location.pathname);
      if (currentIndex !== -1 && currentIndex < routeOrder.length - 1) {
          navigate(routeOrder[currentIndex + 1]);
      } else if (currentIndex === routeOrder.length - 1) {
          navigate(routeOrder[0]);
      }
  };

  const handleSwipeRight = () => {
      const currentIndex = routeOrder.indexOf(location.pathname);
      if (currentIndex !== -1 && currentIndex > 0) {
          navigate(routeOrder[currentIndex - 1]);
      } else if (currentIndex === 0) {
          navigate(routeOrder[routeOrder.length - 1]);
      }
  };

  const gestureEvents = useGestures({
      onLongPress: () => {
          if (location.pathname !== '/hud') {
              setIsImmersive(!isImmersive);
              toggleFullScreen();
          }
      },
      onSwipeLeft: handleSwipeLeft,
      onSwipeRight: handleSwipeRight,
      longPressDelay: 800,
      swipeThreshold: 120,
      edgeSwipeOnly: true,
      edgeThreshold: 45
  });

  useEffect(() => {
    startFusionLoop();
    loadDatabases();
  }, [startFusionLoop, loadDatabases]);


  useEffect(() => {
      const routeName = location.pathname === '/' ? 'Cockpit Dashboard' : 
                        location.pathname.replace('/', '').replace('-', ' ').toUpperCase();
      setContext(routeName);
  }, [location.pathname, setContext]);

  // Maximize edge-to-edge screen real estate
  const isFullScreenRoute = true; // Set all to fullscreen to avoid padding and page headers
  const mainPadding = 'p-0 pb-0';
  const showPageHeader = false;
  const globalDimmingClass = (cognitiveState?.uiRegulationActive && cognitiveState?.selectedTask === 'welding') ? 'brightness-50 saturate-75 backdrop-blur-sm transition-all duration-1000' : 'transition-all duration-500';

  return (
    <div 
        ref={containerRef}
        {...gestureEvents}
        className={`flex flex-col w-full h-full bg-surface-dark text-gray-200 overflow-hidden font-sans relative select-none ${globalDimmingClass}`} 
        style={{ 
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
    >
       {/* --- Global Visual Alarm: Screen-Edge Pulsing Glow on Redline Limit --- */}
       <GlobalRedlineAlarm />
       
       <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Header Logic */}
        {location.pathname !== '/hud' && !isFullScreenRoute && <SystemStatusBar />}
        
        {!isImmersive && location.pathname !== '/' && location.pathname !== '/race-pack' && location.pathname !== '/hud' && (
            <div className="w-full shrink-0 relative z-20 bg-black overflow-hidden border-b border-warning/10 border-white/5">
                <DigitalTapeRpm max={9000} redline={7500} className="w-full h-8 md:h-12 border-none opacity-90 shadow-md" />
            </div>
        )}
        
        <main className={`flex-1 flex flex-col overflow-hidden relative z-10 scroll-smooth no-scrollbar ${mainPadding}`}>
        {/* Global SVG Design Filters */}
        <svg className="absolute w-0 h-0 pointer-events-none opacity-0" aria-hidden="true">
            <defs>
                <filter id="elite-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="chromatic-aberration">
                    <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
                    <feOffset in="red" dx="1.5" dy="0" result="redP" />
                    <feOffset in="blue" dx="-1.5" dy="0" result="blueP" />
                    <feMerge>
                        <feMergeNode in="redP" />
                        <feMergeNode in="green" />
                        <feMergeNode in="blueP" />
                    </feMerge>
                </filter>
                <filter id="digital-noise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.05" />
                    </feComponentTransfer>
                </filter>
                <linearGradient id="elite-carbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a1a1a" />
                    <stop offset="50%" stopColor="#0a0a0a" />
                    <stop offset="100%" stopColor="#1a1a1a" />
                </linearGradient>
            </defs>
        </svg>

        {/* Consistent Page Header - Only for non-fullscreen content pages */}
        {showPageHeader && (
          <div className="flex-shrink-0 flex justify-between items-center mb-2 px-6 h-12 bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/[0.08]">
              <div 
                  className="flex items-center gap-2 sm:gap-4 truncate h-full"
                  style={{ borderRadius: '1px' }}
              >
                  <KarapiroLogo className="h-4 sm:h-5 w-auto text-white opacity-80 shrink-0" variant="monochrome" />
                  <h1 
                      className="text-[11px] sm:text-[13px] font-display font-medium text-white tracking-[0.25em] uppercase border-l border-white/20 pl-4 truncate"
                      
                  >
                      {location.pathname === '/' ? 'COCKPIT' : location.pathname.replace('/', '').replace(/-/g, ' ')}
                  </h1>
              </div>
              <div className="hidden lg:flex items-center gap-2">
                  <div className="h-[2px] w-12 bg-brand-cyan/50 rounded-full"></div>
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em]">Genesis Neural Link v5</span>
              </div>
          </div>
        )}
        <div className="flex-1 overflow-x-hidden overflow-y-auto w-full min-h-0">
            <AnimatedRoutes />
        </div>
        </main>
        
        <SideMenu />
        <GlobalAssistant />
        <SubsystemOverrides />
        <SystemEngineerConsole />
        <TelemetryOverlay />
        <GlobalToastNotification />
        {hpTunersVisible && <HPTunersDiagnosticTool onClose={() => setHpTunersVisible(false)} />}
        {/* Hide MobileNavBar on full screen routes to maximize screen space */}
        {!isFullScreenRoute && <MobileNavBar />}
      </div>
    </div>
  );
};

const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [awaitingInteraction, setAwaitingInteraction] = useState(false);
    const [bootLog, setBootLog] = useState<string[]>([]);
    const [bootTimestamp, setBootTimestamp] = useState('');
    const requestSensors = useVehicleStore(state => state.requestSensors);

    const logMessages = [
        "LOADING SIGHTS SENSOR HUB...",
        "CALIBRATING 12-STATE KALMAN FILTER...",
        "SYNCHRONIZING DIGITAL TWIN PHYSICS KERNEL...",
        "ESTABLISHING SECURE ECU UPLINK...",
        "VERIFYING NEURAL FABRIC INTEGRITY...",
        "SYSTEM READY FOR PILOT SYNCHRONIZATION."
    ];

    useEffect(() => {
        const now = new Date();
        const formatted = now.toTimeString().split(' ')[0]; // Returns "HH:MM:SS"
        setBootTimestamp(formatted);

        let logIndex = 0;
        const logTimer = setInterval(() => {
            if (logIndex < logMessages.length) {
                setBootLog(prev => [...prev, logMessages[logIndex]]);
                logIndex++;
            } else {
                clearInterval(logTimer);
            }
        }, 350);

        const timer = setInterval(() => {
            setProgress(old => {
                if (old >= 90) {
                    clearInterval(timer);
                    setAwaitingInteraction(true);
                    return 90;
                }
                const remaining = 90 - old;
                const increment = Math.max(0.5, remaining * 0.1);
                return Math.min(90, old + increment);
            });
        }, 25);

        return () => {
            clearInterval(timer);
            clearInterval(logTimer);
        };
    }, []);

    const handleStart = async () => {
        setAwaitingInteraction(false);
        
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`Error attempting to enable fullscreen: ${err.message}`);
            });
        }
        
        // Output clear status feedback during user interaction handshake
        setBootLog(prev => [...prev, "INITIATING PILOT HANDSHAKE..."]);
        setBootLog(prev => [
            ...prev, 
            navigator.geolocation ? "PROMPTING GPS & IMU HARDWARE PERMISSIONS..." : "INITIALIZING INTERFACE HARDWARE..."
        ]);
        
        // Wait for user to allow or deny permissions (or timeout)
        await requestSensors();
        
        setBootLog(prev => [...prev, "SENSORY CHANNELS ESTABLISHED."]);
        setBootLog(prev => [...prev, "NEURAL CO-PILOT ACCESS COMPLETE."]);
        
        // Animate the final 10% progress bar seamlessly
        let cur = 90;
        const progressTimer = setInterval(() => {
            cur += 2;
            if (cur >= 100) {
                setProgress(100);
                clearInterval(progressTimer);
                
                setTimeout(() => setIsFadingOut(true), 400);
                setTimeout(onComplete, 1200);
            } else {
                setProgress(cur);
            }
        }, 25);
    };

    return (
        <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-1000 ease-out ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#121212_0%,_#050505_100%)] pointer-events-none"></div>
            
            <div className="z-10 flex flex-col items-center w-full max-w-[450px] px-6 select-none">
                {/* Logo and Subtitle Section */}
                <div className="flex flex-col items-center w-full text-center mb-10">
                    <KarapiroLogo className="w-64 sm:w-72 h-auto text-white" variant="full" />
                    <div className="text-[10px] md:text-[11px] font-mono text-[#00F0FF] uppercase tracking-[0.5em] mt-7 font-bold select-none">
                        GENESIS OS V5.0
                    </div>
                </div>

                {/* Log Messages and Progress bar Section */}
                <div className="w-full flex flex-col gap-8">
                    {/* List of boot messages */}
                    <div className="flex flex-col gap-2 min-h-[110px] justify-start px-2">
                        {bootLog.map((log, i) => (
                            <div 
                                key={i} 
                                className="text-[9px] md:text-[10.5px] font-mono text-brand-cyan uppercase tracking-widest animate-in fade-in slide-in-from-left duration-300 flex items-center"
                            >
                                <span className="text-zinc-600 mr-3 select-none font-semibold">[{bootTimestamp}]</span>
                                <span className="font-medium tracking-wider">{log}</span>
                            </div>
                        ))}
                    </div>

                    {/* Progress Bar & Rate indicator */}
                    <div className="space-y-2.5 px-2">
                        {/* Razor thin flat progress bar */}
                        <div className="h-[1.5px] w-full bg-neutral-900 border-none relative overflow-hidden">
                            <div 
                                className="h-full bg-[#00F0FF] transition-all duration-75 ease-linear" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        {/* Below labels */}
                        <div className="flex justify-between items-center font-mono text-[9px] md:text-[10px] text-neutral-500 uppercase tracking-widest leading-none">
                            <span className="font-semibold select-none">SYNTHESIZING NEURAL FABRIC...</span>
                            <span className="tabular-nums font-semibold select-none">{progress.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                {/* Interaction Button at bottom */}
                <div className="mt-12 w-full flex justify-center">
                    <div className={`transition-all duration-700 ease-out ${awaitingInteraction ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                        <button 
                            onClick={handleStart} 
                            className="px-14 py-3.5 bg-brand-cyan hover:bg-[#00D9FF] text-black font-black uppercase tracking-[0.25em] text-xs transition-colors active:scale-[0.98] rounded-none border-none select-none cursor-pointer"
                            style={{
                                boxShadow: '0 0 25px rgba(0,240,255,0.25)',
                            }}
                        >
                            SYNCHRONIZE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const isReady = useVehicleStore(state => state.isReady);
  const setReady = useVehicleStore(state => state.setReady);

  return (
    <AppearanceProvider>
      {!isReady ? <BootSequence onComplete={() => setReady(true)} /> : (
        HAS_VALID_MAPS_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_KEY} version="weekly">
            <HashRouter>
              <MainLayout />
            </HashRouter>
          </APIProvider>
        ) : (
          <HashRouter>
            <MainLayout />
          </HashRouter>
        )
      )}
    </AppearanceProvider>
  );
};

export default App;
