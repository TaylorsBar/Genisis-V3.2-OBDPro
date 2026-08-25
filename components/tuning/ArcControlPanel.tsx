import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Zap, 
  Flame, 
  Sliders, 
  Cpu, 
  ShieldCheck, 
  Radio, 
  RefreshCw, 
  Activity, 
  Gauge, 
  BarChart2, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  Sparkles, 
  Layers 
} from "lucide-react";
import { ARC_PLATFORMS, ArcPatchEngine, FlatFootShiftConfig, BurnoutModeConfig, RaceRomMapConfig } from "../../services/ArcPatchEngine";
import { UdsOverrideService, UDS_OVERRIDE_CATALOG } from "../../services/UdsOverrideService";

const arcEngine = new ArcPatchEngine();
const udsOverrideService = new UdsOverrideService();

export const ArcControlPanel: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof ARC_PLATFORMS>("VQ37VHR");
  const [activeTab, setActiveTab] = useState<"uds_overrides" | "arc_features" | "maf_scaler" | "ram_editor">("uds_overrides");

  // UDS 0x2E State
  const [overrides, setOverrides] = useState(udsOverrideService.getActiveOverrides());
  const [lastCommandLog, setLastCommandLog] = useState<string[]>([]);
  const [isSendingUds, setIsSendingUds] = useState(false);

  // FFS & Burnout State
  const [ffsConfig, setFfsConfig] = useState<FlatFootShiftConfig>({
    enabled: true,
    minRpmTrigger: 4500,
    maxClutchDisengageMs: 180,
    cutType: "IGNITION_CUT",
    retardDegrees: 15
  });

  const [burnoutConfig, setBurnoutConfig] = useState<BurnoutModeConfig>({
    enabled: true,
    maxRearRpmCap: 4000,
    frontBrakeHoldPercent: 60,
    durationTimeoutSec: 10
  });

  const [mapConfig, setMapConfig] = useState<RaceRomMapConfig>({
    activeMapSlot: 1,
    map1Name: "98 Octane High Performance",
    map2Name: "E85 FlexFuel Race",
    map3Name: "Valet / 95 Octane Eco",
    map4Name: "Track Anti-Lag / Flame",
    flexFuelEnabled: true,
    ethanolBlendPercent: 70,
    rollingLaunchSpeedKph: 60,
    rollingLaunchTargetBoostBar: 1.3
  });

  // Patch Generation State
  const [patchStatus, setPatchStatus] = useState<{ status: "idle" | "success" | "error"; message: string; byteCount?: number }>({ status: "idle", message: "" });

  // Live RAM Editor State
  const [ramAddress, setRamAddress] = useState("38001000");
  const [ramHexData, setRamHexData] = useState("12345678");
  const [ramStatus, setRamStatus] = useState<string | null>(null);

  // MAF Scaler State
  const [mafResult, setMafResult] = useState<{ averageTrimCorrection: number; sampleCount: number; newAirflowTable: number[] } | null>(null);

  const handleUdsOverrideChange = async (paramKey: keyof typeof UDS_OVERRIDE_CATALOG, value: number) => {
    setIsSendingUds(true);
    try {
      const res = await udsOverrideService.writeParameterOverride(paramKey, value);
      setOverrides(udsOverrideService.getActiveOverrides());
      setLastCommandLog(prev => [
        `[${new Date().toLocaleTimeString()}] SENT 0x2E -> ${res.rawCommandSent} (${paramKey} = ${value})`,
        ...prev.slice(0, 7)
      ]);
    } catch (err: any) {
      setLastCommandLog(prev => [
        `[${new Date().toLocaleTimeString()}] ERROR -> ${err.message}`,
        ...prev.slice(0, 7)
      ]);
    } finally {
      setIsSendingUds(false);
    }
  };

  const handleGenerateRaceRomPatch = () => {
    try {
      const patch = arcEngine.generateRaceRomSubroutine(selectedPlatform, ffsConfig, burnoutConfig, mapConfig);
      setPatchStatus({
        status: "success",
        message: `Successfully compiled RaceROM custom subroutine for ${ARC_PLATFORMS[selectedPlatform].name} (${patch.length} bytes ready).`,
        byteCount: patch.length
      });
    } catch (err: any) {
      setPatchStatus({
        status: "error",
        message: err.message
      });
    }
  };

  const handleLiveRamWrite = async () => {
    try {
      const addr = parseInt(ramAddress.replace(/^0x/i, ""), 16);
      if (isNaN(addr)) throw new Error("Invalid hex RAM address format.");

      const cleanHex = ramHexData.replace(/\s+/g, "");
      if (cleanHex.length % 2 !== 0) throw new Error("Hex data must contain an even number of characters.");

      const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const res = await udsOverrideService.writeMemoryByAddress(addr, bytes);

      setRamStatus(`SUCCESS: Wrote ${res.bytesWritten} bytes to ${res.hexAddress} via UDS 0x3D (${res.rawCommandSent})`);
    } catch (err: any) {
      setRamStatus(`ERROR: ${err.message}`);
    }
  };

  const handleRunMafScaler = () => {
    const defaultVoltageTable = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];
    const defaultAirflowTable = [12.0, 25.0, 48.0, 85.0, 140.0, 220.0, 320.0, 450.0];

    const sampleLog = [
      { mafVoltage: 2.01, stftPercent: 4.8, ltftPercent: 2.2, engineRpm: 3100, engineLoad: 60 },
      { mafVoltage: 2.52, stftPercent: -5.0, ltftPercent: -3.0, engineRpm: 4200, engineLoad: 90 },
      { mafVoltage: 3.49, stftPercent: -8.0, ltftPercent: -2.5, engineRpm: 5200, engineLoad: 115 }
    ];

    const res = arcEngine.calculateMafAutoScaling(defaultVoltageTable, defaultAirflowTable, sampleLog);
    setMafResult(res);
  };

  const platform = ARC_PLATFORMS[selectedPlatform];

  return (
    <div className="w-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider">
              ARC v4.2 PRO
            </span>
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded text-xs font-mono">
              Web Bluetooth UDS 0x2E
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Advanced Race Controls (ARC) & RaceROM Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Inject custom ROM subroutines & live RAM parameter overrides without external desktop dongles.
          </p>
        </div>

        {/* Platform Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
          <Cpu className="w-4 h-4 text-amber-400 ml-2" />
          <select 
            value={selectedPlatform} 
            onChange={(e) => setSelectedPlatform(e.target.value as keyof typeof ARC_PLATFORMS)}
            className="bg-transparent text-xs sm:text-sm font-medium text-slate-200 focus:outline-none cursor-pointer pr-2"
          >
            {Object.keys(ARC_PLATFORMS).map(key => (
              <option key={key} value={key} className="bg-slate-900 text-slate-200">
                {ARC_PLATFORMS[key].name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Microcontroller Platform Specs Badge */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 rounded-lg p-3 border border-slate-800/80 text-xs font-mono">
        <div>
          <span className="text-slate-500 block">MCU Microcontroller</span>
          <span className="text-cyan-400 font-medium">{platform.mcuArchitecture}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Flash Size</span>
          <span className="text-slate-200 font-medium">{platform.flashSizeKb} KB</span>
        </div>
        <div>
          <span className="text-slate-500 block">Vector Offset</span>
          <span className="text-amber-400 font-medium">0x{platform.baseRomVectorOffset.toString(16).toUpperCase()}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Supported ARC Features</span>
          <span className="text-emerald-400 font-medium">{platform.supportedFeatures.length} Active Modules</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("uds_overrides")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === "uds_overrides" 
              ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20" 
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Radio className="w-4 h-4" />
          UDS 0x2E Parameter Overrides
        </button>

        <button
          onClick={() => setActiveTab("arc_features")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === "arc_features" 
              ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20" 
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Zap className="w-4 h-4" />
          RaceROM Subroutines (FFS / Burnout)
        </button>

        <button
          onClick={() => setActiveTab("ram_editor")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === "ram_editor" 
              ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20" 
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          Live ECU RAM Editor (0x3D)
        </button>

        <button
          onClick={() => setActiveTab("maf_scaler")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === "maf_scaler" 
              ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20" 
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          MAF Auto-Scaler
        </button>
      </div>

      {/* TAB 1: UDS 0x2E PARAMETER OVERRIDES */}
      {activeTab === "uds_overrides" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Map Slot Override */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">DID 0xF101</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Live Map Switch</span>
              </div>
              <h4 className="text-sm font-semibold text-white">4-Way RaceROM Map Slot</h4>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[1, 2, 3, 4].map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleUdsOverrideChange("MAP_SWITCH", slot)}
                    className={`py-2 text-xs font-bold font-mono rounded border transition-all ${
                      overrides["MAP_SWITCH"] === slot
                        ? "bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/30"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    Slot {slot}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                {overrides["MAP_SWITCH"] === 1 && "Active: 98 Octane High Performance"}
                {overrides["MAP_SWITCH"] === 2 && "Active: E85 FlexFuel Race Trim"}
                {overrides["MAP_SWITCH"] === 3 && "Active: Valet / Eco Trim"}
                {overrides["MAP_SWITCH"] === 4 && "Active: Track Anti-Lag / Flame"}
              </p>
            </div>

            {/* Launch Control RPM */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">DID 0xF102</span>
                <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                  {overrides["LAUNCH_CONTROL_RPM"]} RPM
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">2-Step Launch Control RPM Target</h4>
              <input
                type="range"
                min="2500"
                max="6500"
                step="50"
                value={overrides["LAUNCH_CONTROL_RPM"]}
                onChange={(e) => handleUdsOverrideChange("LAUNCH_CONTROL_RPM", parseInt(e.target.value))}
                className="w-full accent-amber-500 bg-slate-950 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>2500 RPM</span>
                <span>6500 RPM</span>
              </div>
            </div>

            {/* Ethanol Trim Offset */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">DID 0xF103</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                  {overrides["ETHANOL_TRIM_OFFSET"] > 0 ? `+${overrides["ETHANOL_TRIM_OFFSET"]}%` : `${overrides["ETHANOL_TRIM_OFFSET"]}%`}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">FlexFuel Ethanol Trim Offset</h4>
              <input
                type="range"
                min="-25"
                max="25"
                step="1"
                value={overrides["ETHANOL_TRIM_OFFSET"]}
                onChange={(e) => handleUdsOverrideChange("ETHANOL_TRIM_OFFSET", parseInt(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-950 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>-25% (Lean)</span>
                <span>+25% (Rich)</span>
              </div>
            </div>

            {/* Flat-Foot Shift Cut Duration */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">DID 0xF104</span>
                <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold">
                  {overrides["FFS_CUT_DURATION"]} ms
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">Flat-Foot Shift Cut Time Window</h4>
              <input
                type="range"
                min="40"
                max="300"
                step="5"
                value={overrides["FFS_CUT_DURATION"]}
                onChange={(e) => handleUdsOverrideChange("FFS_CUT_DURATION", parseInt(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-950 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>40 ms (Aggressive)</span>
                <span>300 ms (Safe)</span>
              </div>
            </div>

            {/* Rolling Launch Target Boost */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">DID 0xF105</span>
                <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-mono font-bold">
                  {overrides["ROLLING_LAUNCH_BOOST"]} bar
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">Rolling Launch Target Boost</h4>
              <input
                type="range"
                min="0.2"
                max="2.2"
                step="0.05"
                value={overrides["ROLLING_LAUNCH_BOOST"]}
                onChange={(e) => handleUdsOverrideChange("ROLLING_LAUNCH_BOOST", parseFloat(e.target.value))}
                className="w-full accent-rose-500 bg-slate-950 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>0.2 bar</span>
                <span>2.2 bar</span>
              </div>
            </div>

            {/* Burble Aggressiveness */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">DID 0xF107</span>
                <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono font-bold">
                  Level {overrides["BURBLE_LEVEL"]}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">Exhaust Burble / Flame Level</h4>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={overrides["BURBLE_LEVEL"]}
                onChange={(e) => handleUdsOverrideChange("BURBLE_LEVEL", parseInt(e.target.value))}
                className="w-full accent-purple-500 bg-slate-950 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Off (Stock)</span>
                <span>Level 5 (Track Pop)</span>
              </div>
            </div>
          </div>

          {/* Real-time UDS Transmission Console Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                Web Bluetooth ISO-TP Transmission Monitor
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                UDS 0x2E Active
              </span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {lastCommandLog.length === 0 ? (
                <span className="text-slate-600 italic">Adjust any slider above to stream real-time UDS Mode 0x2E parameter overrides over Bluetooth...</span>
              ) : (
                lastCommandLog.map((log, i) => (
                  <div key={i} className="text-slate-300">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RACEROM SUBROUTINES */}
      {activeTab === "arc_features" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flat Foot Shift Configurator */}
            <div className="bg-slate-900 rounded-lg p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Flat-Foot Shifting (FFS)
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={ffsConfig.enabled} 
                    onChange={(e) => setFfsConfig({ ...ffsConfig, enabled: e.target.checked })} 
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Minimum Trigger RPM ({ffsConfig.minRpmTrigger} RPM)</label>
                  <input 
                    type="range" min="3000" max="7500" step="100" 
                    value={ffsConfig.minRpmTrigger} 
                    onChange={(e) => setFfsConfig({ ...ffsConfig, minRpmTrigger: parseInt(e.target.value) })}
                    className="w-full accent-amber-500 bg-slate-950 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Shift Torque Cut Strategy</label>
                  <select 
                    value={ffsConfig.cutType} 
                    onChange={(e) => setFfsConfig({ ...ffsConfig, cutType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                  >
                    <option value="IGNITION_CUT">Ignition Cut (Instant Boost Maintenance)</option>
                    <option value="FUEL_CUT">Fuel Cut (Conservative)</option>
                    <option value="RETARD_ONLY">Ignition Retard Only (-15°)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Burnout Mode Configurator */}
            <div className="bg-slate-900 rounded-lg p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-400" />
                  Burnout Mode & Line Lock
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={burnoutConfig.enabled} 
                    onChange={(e) => setBurnoutConfig({ ...burnoutConfig, enabled: e.target.checked })} 
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                </label>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Rear Wheel Speed RPM Cap ({burnoutConfig.maxRearRpmCap} RPM)</label>
                  <input 
                    type="range" min="3000" max="6000" step="100" 
                    value={burnoutConfig.maxRearRpmCap} 
                    onChange={(e) => setBurnoutConfig({ ...burnoutConfig, maxRearRpmCap: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 bg-slate-950 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Front Brake Solenoid Hold ({burnoutConfig.frontBrakeHoldPercent}%)</label>
                  <input 
                    type="range" min="30" max="90" step="5" 
                    value={burnoutConfig.frontBrakeHoldPercent} 
                    onChange={(e) => setBurnoutConfig({ ...burnoutConfig, frontBrakeHoldPercent: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 bg-slate-950 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button: Compile RaceROM Subroutine */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Generate RaceROM Custom Subroutine Patch</h4>
              <p className="text-xs text-slate-400">Compiles custom hook vectors into 0x{platform.baseRomVectorOffset.toString(16).toUpperCase()} vector space for {platform.name}.</p>
            </div>
            <button
              onClick={handleGenerateRaceRomPatch}
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Compile Subroutine Patch
            </button>
          </div>

          {patchStatus.status !== "idle" && (
            <div className={`p-4 rounded-lg border text-xs font-mono flex items-start gap-3 ${
              patchStatus.status === "success" 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}>
              {patchStatus.status === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />}
              <div>
                <span className="font-bold block mb-0.5">{patchStatus.status === "success" ? "Subroutine Compiled" : "Compilation Error"}</span>
                {patchStatus.message}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE ECU RAM EDITOR */}
      {activeTab === "ram_editor" && (
        <div className="bg-slate-900 rounded-lg p-5 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Activity className="w-5 h-5" />
            Live ECU RAM Direct Memory Overrides (UDS Service 0x3D)
          </div>
          <p className="text-xs text-slate-400">
            Modifies volatile RAM parameters directly in real time without flashing EEPROM memory. Safe & zero write-cycle wear.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2">
            <div>
              <label className="text-slate-400 block mb-1">Target RAM Hex Address</label>
              <input
                type="text"
                value={ramAddress}
                onChange={(e) => setRamAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-amber-400 font-bold"
                placeholder="38001000"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Hex Payload Bytes</label>
              <input
                type="text"
                value={ramHexData}
                onChange={(e) => setRamHexData(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-cyan-400 font-bold"
                placeholder="12 34 56 78"
              />
            </div>
          </div>

          <button
            onClick={handleLiveRamWrite}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Execute Live RAM Memory Write (UDS 0x3D)
          </button>

          {ramStatus && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-slate-300">
              {ramStatus}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MAF AUTO-SCALER */}
      {activeTab === "maf_scaler" && (
        <div className="bg-slate-900 rounded-lg p-5 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <BarChart2 className="w-5 h-5" />
            MAF Table Closed-Loop Auto-Scaling Engine
          </div>
          <p className="text-xs text-slate-400">
            Analyzes logged STFT & LTFT fuel trim data to fit multiplier curve corrections for aftermarket cold air intakes.
          </p>

          <button
            onClick={handleRunMafScaler}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Analyze Logged OBD Telemetry & Rescale Curve
          </button>

          {mafResult && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Analyzed Samples:</span>
                <span className="text-cyan-400 font-bold">{mafResult.sampleCount} OBD Data Points</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Mean Trim Shift Correction:</span>
                <span className="text-amber-400 font-bold">{mafResult.averageTrimCorrection}%</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Rescaled MAF Airflow Vector (g/s):</span>
                <div className="p-2 bg-slate-900 rounded text-emerald-400 overflow-x-auto text-[11px]">
                  [{mafResult.newAirflowTable.join(", ")}]
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
