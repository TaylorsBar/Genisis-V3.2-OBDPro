import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { NismoDigitalCluster } from '../../components/dashboards/NismoDigitalCluster';
import { NismoTriplePodGauges } from '../../components/dashboards/NismoTriplePodGauges';
import { NismoTrackTelemetry } from '../../components/dashboards/NismoTrackTelemetry';
import { 
  Flame, Gauge, Zap, Activity, ShieldAlert, Cpu, Settings, RefreshCw, 
  Layers, ChevronRight, Sliders, Radio, AlertTriangle, PlayCircle
} from 'lucide-react';

type NismoDriveMode = 'STANDARD' | 'SPORT' | 'NISMO' | 'TRACK';
type ViewTab = 'ALL' | 'CLUSTER' | 'BINNACLE' | 'TELEMETRY';
type UnitSystem = 'imperial' | 'metric';

const NismoDashboard: React.FC = () => {
  // Access vehicle store telemetry
  const latestData = useVehicleStore(state => state.latestData);
  const scanVehicle = useVehicleStore(state => state.scanVehicle);
  const isScanning = useVehicleStore(state => state.isScanning);
  const hasActiveFault = useVehicleStore(state => state.hasActiveFault);
  const dtcs = useVehicleStore(state => state.dtcs || []);

  // Dashboard interactive state
  const [driveMode, setDriveMode] = useState<NismoDriveMode>('NISMO');
  const [activeTab, setActiveTab] = useState<ViewTab>('ALL');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial');
  const [isLaunchControlActive, setIsLaunchControlActive] = useState(false);
  const [activeMapProfile, setActiveMapProfile] = useState('VR30DDTT_NISMO_STAGE2');

  // Extract real-time values with realistic defaults
  const rpm = latestData?.rpm ?? 3400;
  const speed = latestData?.speed ?? 65;
  const gearVal = latestData?.gear ?? 4;
  const gearDisplay = gearVal === 0 ? 'N' : gearVal === -1 ? 'R' : `D${gearVal}`;
  const boostPsi = latestData?.turboBoost ?? 14.5;
  const batteryVolt = latestData?.batteryVoltage ?? 14.2;
  const waterTempF = latestData?.engineTemp ?? 195;
  const engOilTempF = latestData?.engineOilTemp ?? 212;
  const tmOilTempF = 192; // VR30DDTT Transmission oil temp estimate
  const diffOilTempF = 168; // Rear differential temp
  const fuelPercent = latestData?.fuelLevel ?? 80;
  const gForceX = latestData?.gForceX ?? 0.15;
  const gForceY = latestData?.gForceY ?? -0.05;

  // Calculate turbine speed (x10,000 RPM) based on boost spooling
  const turbineRpmK = Math.max(0, Math.min(240, ((boostPsi + 15) / 35) * 220));

  return (
    <div className="min-h-full w-full bg-[#030304] text-white flex flex-col font-sans selection:bg-red-600 selection:text-white">
      
      {/* ================= HEADER CONTROL BAR ================= */}
      <header className="shrink-0 bg-[#0a0a0d] p-3 sm:p-4 border-b border-gray-800 flex flex-col md:flex-row flex-wrap justify-between items-center gap-4">
        
        {/* Brand Title & Vehicle Platform Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-start">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-700 via-red-600 to-black p-0.5 flex items-center justify-center shadow-[0_0_15px_#dc2626] shrink-0">
            <div className="w-full h-full bg-black rounded-[10px] flex items-center justify-center">
              <span className="font-serif italic font-black text-red-500 text-xl transform -skew-x-12">Z</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-display font-black tracking-widest text-white uppercase">
                FAIRLADY Z <span className="text-red-600 font-extrabold">nis<span className="text-white">m</span>o</span>
              </h1>
              <span className="text-[10px] font-mono font-bold bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded uppercase">
                2024 MY // VR30DDTT
              </span>
            </div>
            <p className="text-xs font-mono text-gray-400">12.3-INCH DIGITAL COCKPIT & VR30 TWIN-TURBO TELEMETRY</p>
          </div>
        </div>

        {/* Center: Drive Mode Selector (STANDARD, SPORT, NISMO, TRACK) */}
        <div className="flex items-center bg-black/90 p-1 sm:p-1.5 rounded-xl border border-gray-800 shadow-inner w-full sm:w-auto justify-center overflow-x-auto">
          {(['STANDARD', 'SPORT', 'NISMO', 'TRACK'] as NismoDriveMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDriveMode(mode)}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-display font-black tracking-wider uppercase transition-all duration-200 shrink-0 ${
                driveMode === mode
                  ? mode === 'NISMO'
                    ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.8)]'
                    : mode === 'SPORT'
                    ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                    : 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right: View Tabs & Unit Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-center md:justify-end">
          
          {/* Unit Toggle */}
          <button
            onClick={() => setUnitSystem(prev => prev === 'imperial' ? 'metric' : 'imperial')}
            className="px-2 sm:px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 font-mono text-[10px] sm:text-xs text-gray-300 font-bold uppercase transition"
          >
            {unitSystem === 'imperial' ? 'Imperial' : 'Metric'}
          </button>

          {/* Quick ECU Scan Button */}
          <button
            onClick={() => scanVehicle()}
            disabled={isScanning}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-1.5 rounded-lg bg-red-950/80 border border-red-800/80 hover:bg-red-900 text-red-200 text-[10px] sm:text-xs font-mono font-bold uppercase transition shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'SCANNING...' : 'PIT SCAN'}
          </button>
        </div>

      </header>


      {/* ================= SECONDARY VIEW TAB STRIP ================= */}
      <div className="shrink-0 flex justify-between items-center gap-2 overflow-x-auto p-3 border-b border-gray-900 bg-[#060608]">
        <div className="flex gap-2">
          {(['ALL', 'CLUSTER', 'BINNACLE', 'TELEMETRY'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-display font-black tracking-widest uppercase transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-gray-900/60 border border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'ALL' && 'FULL NISMO COCKPIT'}
              {tab === 'CLUSTER' && '12.3" DIGITAL CLUSTER'}
              {tab === 'BINNACLE' && 'TRIPLE POD BINNACLE'}
              {tab === 'TELEMETRY' && 'TRACK TELEMETRY & G-FORCE'}
            </button>
          ))}
        </div>

        {/* Active ECU Map Banner */}
        <div className="hidden md:flex items-center gap-2 bg-black/80 px-3 py-1.5 rounded-xl border border-gray-800 text-xs font-mono">
          <Cpu className="w-4 h-4 text-red-500" />
          <span className="text-gray-400">ECU BASEMAP:</span>
          <select
            value={activeMapProfile}
            onChange={(e) => setActiveMapProfile(e.target.value)}
            className="bg-transparent text-white font-bold cursor-pointer focus:outline-none"
          >
            <option value="VR30DDTT_NISMO_STAGE2" className="bg-gray-900">VR30DDTT NISMO STAGE 2 (420 HP)</option>
            <option value="VR30DDTT_FACTORY_STOCK" className="bg-gray-900">VR30DDTT STOCK BASMAP (400 HP)</option>
            <option value="RACE_E85_TRACK_MAP" className="bg-gray-900">RACE E85 FLEX MAP (480 HP)</option>
          </select>
        </div>
      </div>


      {/* ================= MAIN DASHBOARD CONTENT PANELS ================= */}
      <main className="flex-1 overflow-y-auto flex flex-col gap-4 p-3 sm:p-4">
        
        {/* PANEL 1: TRIPLE POD AUXILIARY BINNACLE */}
        {(activeTab === 'ALL' || activeTab === 'BINNACLE') && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <NismoTriplePodGauges
              boostPsi={boostPsi}
              turbineSpeedRpm={turbineRpmK}
              voltmeter={batteryVolt}
              unitSystem={unitSystem}
              mode={driveMode === 'TRACK' ? 'NISMO' : driveMode}
            />
          </motion.section>
        )}


        {/* PANEL 2: 12.3-INCH DIGITAL INSTRUMENT CLUSTER */}
        {(activeTab === 'ALL' || activeTab === 'CLUSTER') && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                <span className="text-xs font-display font-black text-gray-300 uppercase tracking-widest">
                  12.3" DIGITAL GAUGES DISPLAY // SUPER GT SPEC
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">FAIRLADY Z NISMO COCKPIT MODE</span>
            </div>

            <NismoDigitalCluster
              rpm={rpm}
              speed={speed}
              gear={gearDisplay}
              boostPsi={boostPsi}
              engOilTempF={engOilTempF}
              tmOilTempF={tmOilTempF}
              waterTempF={waterTempF}
              diffOilTempF={diffOilTempF}
              fuelLevelPercent={fuelPercent}
              rangeMiles={380}
              odometerMiles={2480}
              unitSystem={unitSystem}
              driveMode={driveMode === 'TRACK' ? 'NISMO' : driveMode}
            />
          </motion.section>
        )}


        {/* PANEL 3: DYNAMIC TRACK TELEMETRY & G-FORCE VECTORING */}
        {(activeTab === 'ALL' || activeTab === 'TELEMETRY') && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <NismoTrackTelemetry
              gForceX={gForceX}
              gForceY={gForceY}
              speedMph={speed}
              rpm={rpm}
              isLaunchControlActive={isLaunchControlActive}
              onToggleLaunchControl={() => setIsLaunchControlActive(!isLaunchControlActive)}
              unitSystem={unitSystem}
            />
          </motion.section>
        )}

      </main>

      {/* ================= FOOTER DIAGNOSTICS STRIP ================= */}
      <footer className="shrink-0 p-3 border-t border-gray-900 bg-[#060608] flex flex-wrap justify-between items-center text-[10px] sm:text-xs font-mono text-gray-400 gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 ${hasActiveFault ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`} />
          <span>VEHICLE STATUS: <strong className={hasActiveFault ? 'text-red-400' : 'text-emerald-400'}>{hasActiveFault ? `${dtcs.length} ACTIVE DTCs DETECTED` : 'ALL SYSTEMS NOMINAL (0 FAULTS)'}</strong></span>
        </div>

        <div className="flex items-center gap-4 text-gray-400">
          <span>PLATFORM: VR30DDTT TWIN-TURBO V6</span>
          <span>•</span>
          <span>TRANSMISSION: 9-SPEED NISMO PADDLE SHIFT</span>
        </div>
      </footer>

    </div>
  );
};

export default React.memo(NismoDashboard);
