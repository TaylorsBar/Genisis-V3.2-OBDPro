import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Zap, 
  Flame, 
  Cpu, 
  Sliders, 
  BarChart2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Binary,
  Gauge
} from "lucide-react";
import { ARC_PLATFORMS, ArcPatchEngine, FlatFootShiftConfig, BurnoutModeConfig, RaceRomMapConfig } from "../../services/ArcPatchEngine";

const arcEngine = new ArcPatchEngine();

export const PowertrainPatches: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof ARC_PLATFORMS>("VQ37VHR");
  
  // Flat-Foot Shift State
  const [ffsConfig, setFfsConfig] = useState<FlatFootShiftConfig>({
    enabled: true,
    minRpmTrigger: 4600,
    maxClutchDisengageMs: 180,
    cutType: "IGNITION_CUT",
    retardDegrees: 15
  });

  // Burnout Mode State
  const [burnoutConfig, setBurnoutConfig] = useState<BurnoutModeConfig>({
    enabled: true,
    maxRearRpmCap: 4000,
    frontBrakeHoldPercent: 65,
    durationTimeoutSec: 10
  });

  // RaceROM Map Switch State
  const [mapConfig, setMapConfig] = useState<RaceRomMapConfig>({
    activeMapSlot: 1,
    map1Name: "98 Octane High Output",
    map2Name: "E85 FlexFuel Performance",
    map3Name: "Valet / 95 Eco",
    map4Name: "Track Anti-Lag / Flame",
    flexFuelEnabled: true,
    ethanolBlendPercent: 75,
    rollingLaunchSpeedKph: 60,
    rollingLaunchTargetBoostBar: 1.35
  });

  // Patch Status
  const [patchResult, setPatchResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    bytesHex?: string;
    patchLength?: number;
  }>({ status: "idle", message: "" });

  // MAF Scaling State
  const [mafVoltageInput, setMafVoltageInput] = useState("1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5");
  const [mafAirflowInput, setMafAirflowInput] = useState("12.0, 25.0, 48.0, 85.0, 140.0, 220.0, 320.0, 450.0");
  const [mafResult, setMafResult] = useState<{
    newAirflowTable: number[];
    averageTrimCorrection: number;
    sampleCount: number;
  } | null>(null);

  const platform = ARC_PLATFORMS[selectedPlatform];

  const handleCompilePatch = () => {
    try {
      const patchBytes = arcEngine.generateRaceRomSubroutine(selectedPlatform, ffsConfig, burnoutConfig, mapConfig);
      
      let hexString = "";
      for (let i = 0; i < Math.min(32, patchBytes.length); i++) {
        hexString += patchBytes[i].toString(16).padStart(2, "0").toUpperCase() + " ";
      }
      hexString += "...";

      setPatchResult({
        status: "success",
        message: `Compiled RaceROM custom subroutine for ${platform.name} (${patchBytes.length} bytes injected at offset 0x${platform.baseRomVectorOffset.toString(16).toUpperCase()}).`,
        bytesHex: hexString,
        patchLength: patchBytes.length
      });
    } catch (err: any) {
      setPatchResult({
        status: "error",
        message: err.message || "Failed to compile custom ROM patch."
      });
    }
  };

  const handleCalculateMafScaling = () => {
    try {
      const volts = mafVoltageInput.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      const flows = mafAirflowInput.split(",").map(f => parseFloat(f.trim())).filter(f => !isNaN(f));

      if (volts.length !== flows.length) {
        throw new Error("MAF Voltage and Airflow arrays must have the exact same number of elements.");
      }

      // Simulated STFT & LTFT telemetry points
      const sampleLogs = [
        { mafVoltage: 2.01, stftPercent: 5.2, ltftPercent: 2.8, engineRpm: 3100, engineLoad: 60 },
        { mafVoltage: 2.51, stftPercent: -4.5, ltftPercent: -3.0, engineRpm: 4200, engineLoad: 92 },
        { mafVoltage: 3.49, stftPercent: -7.8, ltftPercent: -2.2, engineRpm: 5300, engineLoad: 118 },
        { mafVoltage: 3.98, stftPercent: 3.5, ltftPercent: 1.5, engineRpm: 6100, engineLoad: 140 }
      ];

      const result = arcEngine.calculateMafAutoScaling(volts, flows, sampleLogs);
      setMafResult(result);
    } catch (err: any) {
      alert(`MAF Scaling Error: ${err.message}`);
    }
  };

  return (
    <div id="powertrain-patches-root" className="w-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div id="powertrain-patches-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider">
              POWERTRAIN PATCHES v4.2
            </span>
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded text-xs font-mono">
              Nissan VQ & VR Custom ROM Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Microcontroller Custom ROM Patch Injector
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Direct bytecode subroutine compilation for VQ35DE, VQ37VHR, and VR30DDTT engine control units.
          </p>
        </div>

        {/* Microcontroller Selector */}
        <div id="mcu-selector-container" className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2">
          <Cpu className="w-4 h-4 text-amber-400 ml-1" />
          <select 
            id="mcu-platform-select"
            value={selectedPlatform} 
            onChange={(e) => setSelectedPlatform(e.target.value as keyof typeof ARC_PLATFORMS)}
            className="bg-transparent text-xs sm:text-sm font-medium text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="VQ35DE" className="bg-slate-900 text-slate-200">Nissan VQ35DE (350Z / G35)</option>
            <option value="VQ37VHR" className="bg-slate-900 text-slate-200">Nissan/Infiniti VQ37VHR (370Z / G37)</option>
            <option value="VR30DDTT" className="bg-slate-900 text-slate-200">Infiniti VR30DDTT (Q50 / Q60 Red Sport)</option>
            <option value="FA20_SUBARU" className="bg-slate-900 text-slate-200">Subaru FA20DIT (WRX / BRZ)</option>
            <option value="B58_BMW" className="bg-slate-900 text-slate-200">BMW / Supra B58 (Bosch MG1)</option>
          </select>
        </div>
      </div>

      {/* Target Microcontroller Hardware Specs */}
      <div id="mcu-hardware-specs" className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 rounded-lg p-3 border border-slate-800 text-xs font-mono">
        <div>
          <span className="text-slate-500 block">MCU Architecture</span>
          <span className="text-cyan-400 font-semibold">{platform.mcuArchitecture}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Flash Size</span>
          <span className="text-slate-200 font-semibold">{platform.flashSizeKb} KB</span>
        </div>
        <div>
          <span className="text-slate-500 block">Vector Offset</span>
          <span className="text-amber-400 font-semibold">0x{platform.baseRomVectorOffset.toString(16).toUpperCase()}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Patch Features</span>
          <span className="text-emerald-400 font-semibold">{platform.supportedFeatures.join(", ")}</span>
        </div>
      </div>

      {/* Grid: Flat-Foot Shift & Burnout Mode */}
      <div id="patches-feature-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flat Foot Shifting */}
        <div id="ffs-card" className="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Flat-Foot Shifting Subroutine (FFS)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                id="ffs-toggle-checkbox"
                type="checkbox" 
                checked={ffsConfig.enabled} 
                onChange={(e) => setFfsConfig({ ...ffsConfig, enabled: e.target.checked })} 
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Trigger RPM Threshold</span>
                <span className="text-amber-400 font-bold">{ffsConfig.minRpmTrigger} RPM</span>
              </div>
              <input 
                id="ffs-rpm-slider"
                type="range" min="3000" max="7500" step="100" 
                value={ffsConfig.minRpmTrigger} 
                onChange={(e) => setFfsConfig({ ...ffsConfig, minRpmTrigger: parseInt(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-950 rounded cursor-pointer"
              />
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Torque Reduction Strategy</span>
              <select 
                id="ffs-cut-strategy"
                value={ffsConfig.cutType} 
                onChange={(e) => setFfsConfig({ ...ffsConfig, cutType: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              >
                <option value="IGNITION_CUT">Ignition Cut (Instant Boost Retention)</option>
                <option value="FUEL_CUT">Fuel Cut (Lean Exhaust Cut)</option>
                <option value="RETARD_ONLY">Ignition Timing Retard (-15°)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Ignition Retard Amount</span>
                <span className="text-cyan-400 font-bold">{ffsConfig.retardDegrees}° Deg</span>
              </div>
              <input 
                id="ffs-retard-slider"
                type="range" min="0" max="30" step="1" 
                value={ffsConfig.retardDegrees} 
                onChange={(e) => setFfsConfig({ ...ffsConfig, retardDegrees: parseInt(e.target.value) })}
                className="w-full accent-cyan-500 bg-slate-950 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Burnout Mode Logic */}
        <div id="burnout-card" className="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Burnout Mode & Line Lock Logic
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                id="burnout-toggle-checkbox"
                type="checkbox" 
                checked={burnoutConfig.enabled} 
                onChange={(e) => setBurnoutConfig({ ...burnoutConfig, enabled: e.target.checked })} 
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Rear Wheel RPM Cap</span>
                <span className="text-rose-400 font-bold">{burnoutConfig.maxRearRpmCap} RPM</span>
              </div>
              <input 
                id="burnout-rpm-slider"
                type="range" min="3000" max="6000" step="100" 
                value={burnoutConfig.maxRearRpmCap} 
                onChange={(e) => setBurnoutConfig({ ...burnoutConfig, maxRearRpmCap: parseInt(e.target.value) })}
                className="w-full accent-rose-500 bg-slate-950 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Front Brake Pressure Solenoid Hold</span>
                <span className="text-amber-400 font-bold">{burnoutConfig.frontBrakeHoldPercent}%</span>
              </div>
              <input 
                id="burnout-brake-slider"
                type="range" min="30" max="90" step="5" 
                value={burnoutConfig.frontBrakeHoldPercent} 
                onChange={(e) => setBurnoutConfig({ ...burnoutConfig, frontBrakeHoldPercent: parseInt(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-950 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Safety Cut Timeout Window</span>
                <span className="text-slate-200 font-bold">{burnoutConfig.durationTimeoutSec} Sec</span>
              </div>
              <input 
                id="burnout-timeout-slider"
                type="range" min="3" max="25" step="1" 
                value={burnoutConfig.durationTimeoutSec} 
                onChange={(e) => setBurnoutConfig({ ...burnoutConfig, durationTimeoutSec: parseInt(e.target.value) })}
                className="w-full accent-slate-500 bg-slate-950 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subroutine Bytecode Generator Action */}
      <div id="compile-bytecode-box" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Binary className="w-4 h-4 text-amber-400" />
            Compile Custom ROM Subroutine Bytecode
          </h4>
          <p className="text-xs text-slate-400">
            Assembles binary hook routines and attaches vectors to {platform.name}.
          </p>
        </div>

        <button
          id="compile-patch-btn"
          onClick={handleCompilePatch}
          className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Compile & Inject Subroutine
        </button>
      </div>

      {/* Patch Bytecode Result Output */}
      {patchResult.status !== "idle" && (
        <div 
          id="patch-result-output"
          className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
            patchResult.status === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {patchResult.status === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <span>{patchResult.status === "success" ? "Subroutine Bytecode Injected Successfully" : "Compilation Error"}</span>
          </div>
          <p>{patchResult.message}</p>
          {patchResult.bytesHex && (
            <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300 text-[11px] overflow-x-auto">
              Header & Hook Bytes: <span className="text-amber-400 font-bold">{patchResult.bytesHex}</span>
            </div>
          )}
        </div>
      )}

      {/* MAF Table Auto-Scaling Tool */}
      <div id="maf-auto-scaler-card" className="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            Automated MAF Table Closed-Loop Auto-Scaler
          </h3>
          <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2.5 py-0.5 rounded font-mono">
            STFT + LTFT Closed Loop
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Rescales MAF voltage vs airflow (g/s) transfer functions automatically using logged fuel trims.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">Current MAF Voltage Bins (V)</label>
            <input 
              id="maf-volts-input"
              type="text" 
              value={mafVoltageInput} 
              onChange={(e) => setMafVoltageInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-cyan-300"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Current Airflow Vector (g/s)</label>
            <input 
              id="maf-airflow-input"
              type="text" 
              value={mafAirflowInput} 
              onChange={(e) => setMafAirflowInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-amber-300"
            />
          </div>
        </div>

        <button
          id="run-maf-scale-btn"
          onClick={handleCalculateMafScaling}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Calculate Rescaled MAF Curve from Telemetry
        </button>

        {mafResult && (
          <div id="maf-result-box" className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Processed Telemetry Sample Count:</span>
              <span className="text-cyan-400 font-bold">{mafResult.sampleCount} Points</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Average Fuel Trim Shift:</span>
              <span className="text-amber-400 font-bold">{mafResult.averageTrimCorrection}%</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Rescaled Airflow Transfer Function (g/s):</span>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-emerald-400 overflow-x-auto text-[11px]">
                [{mafResult.newAirflowTable.join(", ")}]
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
