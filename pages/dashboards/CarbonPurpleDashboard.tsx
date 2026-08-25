import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { useTelemetryField } from "../../hooks/useVehicleData";
import { useVehicleStore } from "../../stores/vehicleStore";
import { useAIStore } from "../../stores/aiStore";
import GForceMeter from "../../components/widgets/GForceMeter";
import FusionGauge from "../../components/dashboard/gauges/FusionGauge";
import { SensorDataPoint, ObdConnectionState } from "../../types";
import { motion } from "motion/react";
import { Brain, Download } from "lucide-react";
import { useRaceSession } from "../../hooks/useRaceSession";

// --- Isolated Connected Components for 60Hz Rendering Performance ---

const ConnectedAICommentary: React.FC = memo(() => {
  const messages = useAIStore((state) => state.messages);
  const latestModelMsg = [...messages]
    .reverse()
    .find((m) => m.role === "model");

  return (
    <div className="w-full p-4 bg-[#110c1f]/75 border border-[#BC13FE]/30 rounded-2xl flex items-start gap-3 backdrop-blur-md relative overflow-hidden shadow-[0_0_15px_rgba(188,19,254,0.04)]">
      <TechCornerAccents />
      <div className="p-2 bg-brand-purple/20 rounded-xl text-[#BC13FE] shrink-0 animate-pulse">
        <Brain className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-black text-[#BC13FE] tracking-wider uppercase">
            KC - AI Co-Pilot
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            Live Feedback
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-300 leading-relaxed max-h-[100px] overflow-y-auto no-scrollbar">
          {latestModelMsg
            ? latestModelMsg.text
            : "Awaiting vehicle diagnostics... Synchronizing telemetry data channels."}
        </p>
      </div>
    </div>
  );
});

const ConnectedNeuralLoad: React.FC = memo(() => {
  const rlTraining = useVehicleStore((state) => state.rlTraining);
  const load = (rlTraining?.epsilon || 0) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Neural Exploration Epsilon
        </span>
        <span className="text-lg font-black text-brand-purple font-mono tracking-tighter text-[#BC13FE]">
          {load.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/[0.03] p-[1px]">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-purple to-pink-500 rounded-full bg-[#BC13FE]"
          initial={{ width: 0 }}
          animate={{ width: `${load}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 15 }}
        />
      </div>
    </div>
  );
});

const ConnectedGForceMeter: React.FC<{
  size: number;
  canvasStyle?: React.CSSProperties;
}> = memo(({ size, canvasStyle }) => {
  const x = useTelemetryField("gForceX", 16);
  const y = useTelemetryField("gForceY", 16);
  return (
    <GForceMeter
      x={x}
      y={y}
      size={size}
      transparent={true}
      canvasStyle={canvasStyle}
    />
  );
});

const ConnectedGForceWidget: React.FC<{
  containerStyle?: React.CSSProperties;
  canvasStyle?: React.CSSProperties;
}> = memo(({ containerStyle, canvasStyle }) => {
  return (
    <div className="p-4 bg-black/45 border border-white/[0.03] rounded-2xl flex flex-col gap-3 hover:border-[#BC13FE]/25 transition-all duration-300 shadow-[0_0_20px_rgba(188,19,254,0.03)] relative overflow-hidden focus:outline-none">
      <TechCornerAccents />
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
        G-Force Vector Monitor
      </span>
      <div
        className="bg-zinc-950/75 rounded-xl border border-white/[0.02] py-4 flex items-center justify-center relative overflow-hidden"
        style={containerStyle}
      >
        <ConnectedGForceMeter size={130} canvasStyle={canvasStyle} />
      </div>
    </div>
  );
});

const ConnectedStatBox: React.FC<{
  field: keyof SensorDataPoint;
  label: string;
  unit: string;
  colorClass: string;
  toFixed?: number;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}> = memo(
  ({ field, label, unit, colorClass, toFixed = 1, style, labelStyle }) => {
    const val = useTelemetryField(field, 32);
    const actualVal = Number(val) || 0;

    return (
      <div
        className="p-4 bg-black/40 border border-white/[0.03] rounded-2xl flex flex-col justify-between h-[100px] hover:border-brand-purple/30 hover:bg-black/60 transition-all duration-300 relative group overflow-hidden"
        style={style}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#BC13FE]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="flex justify-between items-start z-10">
          <span
            className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none"
            style={labelStyle}
          >
            {label}
          </span>
          <span className="text-[10px] font-black text-zinc-600 font-mono tracking-wider uppercase">
            {unit}
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-2 z-10">
          <span
            className={`text-3xl font-black font-display tracking-tighter ${colorClass}`}
          >
            {actualVal.toFixed(toFixed)}
          </span>
        </div>
      </div>
    );
  },
);

const ConnectedSystemStatus: React.FC = memo(() => {
  const obdState = useVehicleStore((state) => state.obdState);
  const ekfStats = useVehicleStore((state) => state.ekfStats);

  const isConnected = obdState === ObdConnectionState.Connected;
  const isLinking = obdState === ObdConnectionState.Connecting;

  return (
    <div className="flex items-center gap-4 py-2 px-4 rounded-full bg-black/40 border border-white/5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_currentColor] ${isConnected ? "bg-green-500" : isLinking ? "bg-yellow-500" : "bg-red-500"}`}
          style={{
            backgroundColor: isConnected
              ? "#10B981"
              : isLinking
                ? "#F59E0B"
                : "#EF4444",
          }}
        />
        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          {isConnected
            ? "CAN SYNCED"
            : isLinking
              ? "LINKING ECU..."
              : "ECU OFFLINE"}
        </span>
      </div>
      <div className="h-3 w-px bg-white/10" />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-sans font-extrabold text-zinc-500 uppercase tracking-wider">
          Quality
        </span>
        <span className="text-[10px] font-mono text-white tracking-widest font-black leading-none bg-[#BC13FE]/25 px-2 py-0.5 rounded border border-[#BC13FE]/25">
          {(ekfStats?.dataQualityScore || 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
});

const TechCornerAccents: React.FC = () => (
  <>
    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#BC13FE]/50 pointer-events-none" />
    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#BC13FE]/50 pointer-events-none" />
    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#BC13FE]/50 pointer-events-none" />
    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#BC13FE]/50 pointer-events-none" />
  </>
);

const ConnectedOdometer: React.FC<{ style?: React.CSSProperties }> = memo(({ style }) => {
  // Odometer reading visually matching screenshot layout
  const valString = "001000";

  return (
    <div className="p-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-black/80 bg-blend-overlay border border-[#BC13FE]/20 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-[0_0_15px_rgba(188,19,254,0.05)]" style={style}>
      <TechCornerAccents />
      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center leading-none">
        ODOMETER
      </span>
      <div className="flex justify-center items-center mt-1">
        <div className="flex bg-[#050505] border-[3px] border-[#1a1a1a] rounded p-0.5 shadow-inner gap-px transform perspective-1000">
          {valString.split("").map((digit, i) => (
            <div 
              key={i} 
              className={`w-7 h-10 flex items-center justify-center text-xl font-black font-mono rounded-[1px] border border-[#222] shadow-inner ${
                i === 5 
                  ? 'bg-zinc-200 text-black border-zinc-400' 
                  : 'bg-gradient-to-b from-zinc-900 via-black to-zinc-900 text-white'
              }`}
              style={{
                 textShadow: i === 5 ? "none" : "0 2px 2px rgba(0,0,0,0.8)",
                 boxShadow: "inset 0 4px 6px -2px rgba(0,0,0,0.8)"
              }}
            >
              {digit}
            </div>
          ))}
        </div>
      </div>
      <div className="text-center mt-0.5">
        <span className="text-[9px] font-mono font-bold text-[#BC13FE]/80 uppercase">
          KILOMETERS
        </span>
      </div>
    </div>
  );
});

const ConnectedPerformanceTimer: React.FC<{ style?: React.CSSProperties }> =
  memo(({ style }) => {
    const { isRecording, toggleRecording } = useRaceSession();
    const [activeTab, setActiveTab] = useState<"STAND" | "ROLL" | "LOGGER">(
      "STAND",
    );

    // Core Simulation states
    const simIntervalRef = useRef<any>(null);
    const [dragStateSim, setDragStateSim] = useState<string>("idle");
    const [dragTimerSim, setDragTimerSim] = useState<number>(0);
    const [rollStateSim, setRollStateSim] = useState<string>("idle");
    const [rollTimerSim, setRollTimerSim] = useState<number>(0);
    const [activeRollTarget, setActiveRollTarget] =
      useState<string>("60 → 160");

    const [completedDragReport, setCompletedDragReport] = useState<{
      reaction: string;
      sixtyFoot: string;
      zeroToSixty: string;
      quarterMile: string;
      trapSpeed: string;
    } | null>(null);

    const [completedRollReport, setCompletedRollReport] = useState<{
      interval: string;
      time: string;
      maxBoost: string;
      peakG: string;
      drsDragReduction: string;
    } | null>(null);

    // Logging list state
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [logFiles, setLogFiles] = useState([
      {
        id: "log1",
        name: "kc_telemetry_drag_100hz.csv",
        size: "3.4 MB",
        type: "Drag Run",
        time: "14:23:05",
      },
      {
        id: "log2",
        name: "kc_awd_slip_corr_val.csv",
        size: "1.8 MB",
        type: "Calibration",
        time: "15:10:42",
      },
      {
        id: "log3",
        name: "kc_roll_racing_60_160.csv",
        size: "2.1 MB",
        type: "Roll Race",
        time: "16:05:11",
      },
      {
        id: "log4",
        name: "kc_active_aero_dynamic.csv",
        size: "4.7 MB",
        type: "Chassis Log",
        time: "16:32:00",
      },
    ]);

    const handleDownloadFakeLog = (fileName: string) => {
      setIsDownloading(fileName);
      setTimeout(() => {
        setIsDownloading(null);
        const csvContent =
          "data:text/csv;charset=utf-8,Timestamp_s,EngineSpeed_RPM,VehicleSpeed_KPH,EngagedGear,BoostPressure_BAR,LongGForce,LatGForce,AeroAngle_Deg,Throttle_Pct,TireSlip_Pct\n" +
          Array.from({ length: 60 }, (_, idx) => {
            const time = (idx * 0.1).toFixed(1);
            const isRoll = fileName.includes("roll");
            const isDrag = fileName.includes("drag");

            let speedVal = 0;
            let rpmVal = 0;
            let gearVal = 0;

            if (isRoll) {
              speedVal = 60 + idx * 1.8;
              rpmVal = Math.floor(3200 + (((speedVal - 60) * 35) % 4500));
              gearVal = speedVal < 100 ? 2 : 3;
            } else if (isDrag) {
              speedVal = Math.min(240, idx * 4.2);
              rpmVal = Math.floor(1000 + ((speedVal * 28) % 7000));
              gearVal = speedVal < 70 ? 1 : speedVal < 130 ? 2 : 3;
            } else {
              speedVal = 120 + Math.sin(idx * 0.2) * 15;
              rpmVal = Math.floor(4500 + Math.cos(idx * 0.2) * 800);
              gearVal = 4;
            }

            const boostVal = (0.5 + Math.sin(idx * 0.15) * 1.7).toFixed(2);
            const longG = (
              isDrag && idx < 15 ? 1.8 - idx * 0.08 : 0.82 - idx * 0.01
            ).toFixed(2);
            const latG = (Math.sin(idx * 0.2) * 0.35).toFixed(2);
            const aeroAngle = (15 + (speedVal / 250) * 35).toFixed(1);
            const throttle = idx < 45 ? 100 : 40;
            const slipVal = (
              idx < 8 && isDrag ? 0.45 - idx * 0.05 : 0.02
            ).toFixed(2);

            return `${time},${rpmVal},${speedVal.toFixed(1)},${gearVal},${boostVal},${longG},${latG},${aeroAngle},${throttle},${slipVal}`;
          }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 1200);
    };

    const cleanupSim = () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };

    useEffect(() => {
      return () => cleanupSim();
    }, []);

    const triggerSimulatedTelemetry = (mode: "DRAG" | "ROLL") => {
      cleanupSim();

      const currentStoreData = useVehicleStore.getState().latestData;
      const baselineData = { ...currentStoreData };

      let step = 0;

      if (mode === "DRAG") {
        setDragStateSim("prestage");
        setCompletedDragReport(null);
        setDragTimerSim(0);

        simIntervalRef.current = setInterval(() => {
          step++;
          let nextRpm = 800;
          let nextSpeed = 0;
          let nextGear = 0;
          let nextBoost = 0;
          let nextGForceX = 0;
          let nextSlip = 0.02;

          if (step < 10) {
            setDragStateSim("prestage");
            nextRpm = 1100 + Math.random() * 40;
            nextSpeed = 0;
          } else if (step < 20) {
            setDragStateSim("stage");
            nextRpm = 4200 + Math.sin(step * 1.5) * 45; // launch armed
            nextBoost = 1.1;
            nextSpeed = 0;
          } else if (step < 24) {
            setDragStateSim("amber1");
            nextRpm = 4500 + Math.sin(step * 2.0) * 30;
            nextBoost = 1.5;
          } else if (step < 28) {
            setDragStateSim("amber2");
            nextRpm = 4500 + Math.sin(step * 2.0) * 30;
            nextBoost = 1.7;
          } else if (step < 32) {
            setDragStateSim("amber3");
            nextRpm = 4500 + Math.cos(step * 2.0) * 25;
            nextBoost = 1.85;
          } else if (step === 32) {
            setDragStateSim("green");
            nextRpm = 4600;
            nextBoost = 2.0;
            if (!isRecording) toggleRecording();
          } else {
            setDragStateSim("running");
            const runTime = (step - 32) * 0.1;
            setDragTimerSim(runTime);

            nextGForceX = Math.max(0.15, 1.85 - runTime * 0.22);
            nextSpeed = Math.min(262, nextGForceX * 9.81 * runTime * 3.6);

            if (nextSpeed < 75) {
              nextGear = 1;
              nextRpm = 4200 + (nextSpeed / 75) * 3800;
              nextSlip = Math.max(0.04, 0.55 / (runTime + 0.5));
            } else if (nextSpeed < 135) {
              nextGear = 2;
              nextRpm = 4400 + ((nextSpeed - 75) / 60) * 3300;
              nextSlip = 0.08;
            } else if (nextSpeed < 195) {
              nextGear = 3;
              nextRpm = 4700 + ((nextSpeed - 135) / 60) * 3100;
              nextSlip = 0.02;
            } else {
              nextGear = 4;
              nextRpm = 4900 + ((nextSpeed - 195) / 70) * 2900;
              nextSlip = 0.01;
            }
            nextBoost = 2.22 + Math.sin(step * 0.5) * 0.04;
          }

          useVehicleStore.setState({
            latestData: {
              ...useVehicleStore.getState().latestData,
              rpm: nextRpm,
              speed: nextSpeed,
              gear: nextGear,
              turboBoost: nextBoost,
              gForceX: nextGForceX,
              gForceY: nextGForceX > 0 ? (Math.random() - 0.5) * 0.06 : 0,
            },
            mlInsights: {
              fusedSpeed: nextSpeed,
              slipProbability: nextSlip,
              driverScore: 98,
              anomalies: { o2: false, knock: false },
            },
          });

          if (nextSpeed >= 250 || step >= 100) {
            clearInterval(simIntervalRef.current);
            setDragStateSim("finished");
            setCompletedDragReport({
              reaction: (0.11 + Math.random() * 0.05).toFixed(3) + "s",
              sixtyFoot: (1.55 + Math.random() * 0.1).toFixed(2) + "s",
              zeroToSixty: (2.58 + Math.random() * 0.1).toFixed(2) + "s",
              quarterMile: (9.28 + Math.random() * 0.18).toFixed(2) + "s",
              trapSpeed: (249.2 + Math.random() * 4).toFixed(1) + " km/h",
            });

            const uniqueId = "log_drag_" + Date.now();
            setLogFiles((prev) => [
              {
                id: uniqueId,
                name: `kc_drag_${(9.28 + Math.random() * 0.18).toFixed(2)}s_log.csv`,
                size: "2.4 MB",
                type: "Drag Run",
                time: new Date().toTimeString().slice(0, 8),
              },
              ...prev,
            ]);

            if (isRecording) toggleRecording();

            setTimeout(() => {
              useVehicleStore.setState({ latestData: baselineData });
            }, 4000);
          }
        }, 100);
      } else {
        // ROLL Mode
        setRollStateSim("armed");
        setCompletedRollReport(null);
        setRollTimerSim(0);

        const [targetMin, targetMax] = activeRollTarget
          .split(" → ")
          .map(Number);

        simIntervalRef.current = setInterval(() => {
          step++;
          let nextRpm = 3000;
          let nextSpeed = targetMin;
          let nextGear = 2;
          let nextBoost = 0.5;
          let nextGForceX = 0;
          let nextSlip = 0.01;

          if (step < 12) {
            setRollStateSim("holding");
            nextSpeed = targetMin + Math.sin(step * 0.6) * 1.8;
            nextRpm = 3100 + Math.sin(step * 0.6) * 80;
          } else if (step < 15) {
            setRollStateSim("amber1");
            nextSpeed = targetMin;
            nextRpm = 3200;
          } else if (step < 18) {
            setRollStateSim("amber2");
            nextSpeed = targetMin;
            nextRpm = 3200;
          } else if (step < 21) {
            setRollStateSim("amber3");
            nextSpeed = targetMin;
            nextRpm = 3200;
          } else if (step === 21) {
            setRollStateSim("green");
            nextRpm = 3500;
            nextBoost = 1.6;
            if (!isRecording) toggleRecording();
          } else {
            setRollStateSim("accelerating");
            const runTime = (step - 21) * 0.1;
            setRollTimerSim(runTime);

            nextGForceX = Math.max(0.15, 1.45 - runTime * 0.15);
            nextSpeed = targetMin + nextGForceX * 9.81 * runTime * 3.6;

            if (nextSpeed < 100) {
              nextGear = 2;
              nextRpm = 3000 + ((nextSpeed - targetMin) / 40) * 4400;
              nextSlip = 0.09;
            } else if (nextSpeed < 150) {
              nextGear = 3;
              nextRpm = 4400 + ((nextSpeed - 100) / 50) * 3200;
              nextSlip = 0.03;
            } else {
              nextGear = 4;
              nextRpm = 4600 + ((nextSpeed - 150) / 60) * 2800;
              nextSlip = 0.01;
            }
            nextBoost = 2.45 + Math.sin(step * 0.4) * 0.03;
          }

          useVehicleStore.setState({
            latestData: {
              ...useVehicleStore.getState().latestData,
              rpm: nextRpm,
              speed: nextSpeed,
              gear: nextGear,
              turboBoost: nextBoost,
              gForceX: nextGForceX,
              steeringAngle: Math.cos(step * 0.45) * 1.5,
            },
            mlInsights: {
              fusedSpeed: nextSpeed,
              slipProbability: nextSlip,
              driverScore: 99,
              anomalies: { o2: false, knock: false },
            },
          });

          if (nextSpeed >= targetMax || step >= 80) {
            clearInterval(simIntervalRef.current);
            setRollStateSim("finished");
            const finalTime = (step - 21) * 0.1;
            setCompletedRollReport({
              interval: `${activeRollTarget} KM/H`,
              time: finalTime.toFixed(2) + "s",
              maxBoost: (2.42 + Math.random() * 0.05).toFixed(2) + " BAR",
              peakG: (1.35 + Math.random() * 0.05).toFixed(2) + "G",
              drsDragReduction: "96.4% efficiency",
            });

            const uniqueId = "log_roll_" + Date.now();
            setLogFiles((prev) => [
              {
                id: uniqueId,
                name: `kc_roll_${targetMin}_${targetMax}_${finalTime.toFixed(2)}s.csv`,
                size: "1.9 MB",
                type: "Roll Race",
                time: new Date().toTimeString().slice(0, 8),
              },
              ...prev,
            ]);

            if (isRecording) toggleRecording();

            setTimeout(() => {
              useVehicleStore.setState({ latestData: baselineData });
            }, 4000);
          }
        }, 100);
      }
    };

    return (
      <div
        className="w-full bg-[#07060a]/85 border border-[#BC13FE]/20 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group hover:border-[#BC13FE]/45 transition-all duration-300 shadow-[0_0_25px_rgba(188,19,254,0.06)]"
        style={style}
      >
        <TechCornerAccents />

        {/* Header Title & Dynamic Flag Selector */}
        <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
          <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">
            CHASSIS PERF CONSOLE
          </span>
          <span className="text-[9px] font-mono text-[#BC13FE] font-black uppercase tracking-wider bg-[#BC13FE]/10 px-2 py-0.5 rounded border border-[#BC13FE]/25">
            {activeTab === "STAND"
              ? "STANDING TREE"
              : activeTab === "ROLL"
                ? "ROLL COUPLER"
                : "100Hz SD STREAM"}
          </span>
        </div>

        {/* Tactical Grid Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-black/60 p-1 rounded-xl border border-white/[0.03]">
          {(["STAND", "ROLL", "LOGGER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                cleanupSim();
              }}
              className={`py-1.5 rounded-lg text-[9px] font-mono tracking-wider font-extrabold transition-all uppercase ${
                activeTab === tab
                  ? "bg-[#BC13FE]/25 text-[#ebd7ff] border border-[#BC13FE]/40 shadow-[0_0_12px_rgba(188,19,254,0.2)]"
                  : "text-zinc-500 hover:text-zinc-350 hover:bg-white/[0.01]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: STANDING DRAG TREE */}
        {activeTab === "STAND" && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">
                NHRA STANDING STRIP
              </span>
              <span className="text-lg font-mono font-black text-white">
                {dragStateSim === "running"
                  ? `${dragTimerSim.toFixed(2)}s`
                  : "0.00s"}
              </span>
            </div>

            {/* NHRA Progressive Christmas Tree */}
            <div className="flex justify-center items-center gap-2 py-2 px-3 bg-black/55 rounded-xl border border-white/[0.03]">
              {/* Staged indicators */}
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border font-mono text-[8px] font-black ${
                  dragStateSim === "prestage" ||
                  dragStateSim === "stage" ||
                  dragStateSim === "amber1" ||
                  dragStateSim === "amber2" ||
                  dragStateSim === "amber3" ||
                  dragStateSim === "green" ||
                  dragStateSim === "running" ||
                  dragStateSim === "finished"
                    ? "bg-purple-500 border-purple-400 text-white shadow-[0_0_8px_#a855f7]"
                    : "bg-zinc-900 border-zinc-700 text-zinc-500"
                }`}
              >
                P
              </div>

              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border font-mono text-[8px] font-black ${
                  dragStateSim === "stage" ||
                  dragStateSim === "amber1" ||
                  dragStateSim === "amber2" ||
                  dragStateSim === "amber3" ||
                  dragStateSim === "green" ||
                  dragStateSim === "running" ||
                  dragStateSim === "finished"
                    ? "bg-purple-500 border-purple-400 text-white shadow-[0_0_8px_#a855f7]"
                    : "bg-zinc-900 border-zinc-700 text-zinc-500"
                }`}
              >
                S
              </div>

              <div className="h-4 w-px bg-white/10" />

              {/* Ambers */}
              <div
                className={`w-3.5 h-3.5 rounded-full border ${
                  dragStateSim === "amber1" ||
                  dragStateSim === "amber2" ||
                  dragStateSim === "amber3" ||
                  dragStateSim === "green" ||
                  dragStateSim === "running" ||
                  dragStateSim === "finished"
                    ? "bg-amber-400 border-amber-300 shadow-[0_0_10px_#facc15]"
                    : "bg-zinc-900 border-zinc-700"
                }`}
              />
              <div
                className={`w-3.5 h-3.5 rounded-full border ${
                  dragStateSim === "amber2" ||
                  dragStateSim === "amber3" ||
                  dragStateSim === "green" ||
                  dragStateSim === "running" ||
                  dragStateSim === "finished"
                    ? "bg-amber-400 border-amber-300 shadow-[0_0_10px_#facc15]"
                    : "bg-zinc-900 border-zinc-700"
                }`}
              />
              <div
                className={`w-3.5 h-3.5 rounded-full border ${
                  dragStateSim === "amber3" ||
                  dragStateSim === "green" ||
                  dragStateSim === "running" ||
                  dragStateSim === "finished"
                    ? "bg-amber-400 border-amber-300 shadow-[0_0_10px_#facc15]"
                    : "bg-zinc-900 border-zinc-700"
                }`}
              />

              <div className="h-4 w-px bg-white/10" />

              {/* Green */}
              <div
                className={`w-3.5 h-3.5 rounded-full border ${
                  dragStateSim === "green" ||
                  dragStateSim === "running" ||
                  dragStateSim === "finished"
                    ? "bg-emerald-500 border-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse"
                    : "bg-zinc-900 border-zinc-750"
                }`}
              />
            </div>

            {/* Results table if simulation completed */}
            {completedDragReport && (
              <div className="bg-black/60 p-2.5 rounded-xl border border-[#BC13FE]/20 text-[9px] font-mono text-zinc-400 flex flex-col gap-1.5 transform-gpu transition-all duration-300 animate-fadeIn">
                <div className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span className="font-extrabold text-[#BC13FE]">
                    STANDING RUN COMPLETED:
                  </span>
                  <span className="font-black text-emerald-400">VALID</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex justify-between">
                    <span>REACTION:</span>
                    <span className="text-white font-bold">
                      {completedDragReport.reaction}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>60FT CLAW:</span>
                    <span className="text-white font-bold">
                      {completedDragReport.sixtyFoot}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>0-60 MPH:</span>
                    <span className="text-pink-400 font-extrabold">
                      {completedDragReport.zeroToSixty}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>1/4 MILE:</span>
                    <span className="text-[#BC13FE] font-black">
                      {completedDragReport.quarterMile}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between border-t border-white/[0.04] pt-1 mt-0.5">
                  <span>TRAP SPEED:</span>
                  <span className="text-white font-black">
                    {completedDragReport.trapSpeed}
                  </span>
                </div>
              </div>
            )}

            {/* Simulation Triggers Custom Grid button layout */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerSimulatedTelemetry("DRAG")}
                disabled={
                  dragStateSim !== "idle" && dragStateSim !== "finished"
                }
                style={{
                  borderStyle: "inset",
                  borderRadius: "8px",
                  borderWidth: "3.0929px",
                }}
                className="py-2.5 px-2 bg-gradient-to-r from-[#BC13FE]/20 to-pink-500/10 border border-[#BC13FE]/45 text-[#ebd7ff] hover:from-[#BC13FE]/35 hover:to-pink-500/20 rounded-lg text-[9px] font-mono font-black tracking-wider transition-all shadow-[0_0_12px_rgba(188,19,254,0.12)] active:scale-95 disabled:opacity-40"
              >
                {dragStateSim === "idle" || dragStateSim === "finished"
                  ? "ENGAGE DRAG"
                  : "LAUNCH STATE..."}
              </button>
              <button
                onClick={() => {
                  cleanupSim();
                  setDragStateSim("idle");
                  setCompletedDragReport(null);
                  setDragTimerSim(0);
                }}
                className="py-2.5 px-2 bg-zinc-950/70 hover:bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-lg text-[9px] font-mono font-black tracking-wider transition-all"
              >
                RESET
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ROLL RACING COUNTDOWN */}
        {activeTab === "ROLL" && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">
                COUPLED ACCEL INTERVAL
              </span>
              <span className="text-lg font-mono font-black text-white">
                {rollStateSim === "accelerating"
                  ? `${rollTimerSim.toFixed(2)}s`
                  : "0.00s"}
              </span>
            </div>

            {/* Speed Selection */}
            <div className="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.03]">
              {["60 → 160", "80 → 180", "100 → 200"].map((target) => (
                <button
                  key={target}
                  disabled={
                    rollStateSim !== "idle" && rollStateSim !== "finished"
                  }
                  onClick={() => setActiveRollTarget(target)}
                  className={`py-1 rounded text-[8.5px] font-mono font-black tracking-tight transition-all text-center ${
                    activeRollTarget === target
                      ? "bg-[#BC13FE]/20 text-[#ebd7ff] border border-[#BC13FE]/35 shadow-inner"
                      : "text-zinc-500 hover:text-zinc-350 bg-transparent"
                  }`}
                >
                  {target}
                </button>
              ))}
            </div>

            {/* Interactive state descriptor line */}
            <div className="h-8 px-3 bg-black/60 rounded-xl border border-white/[0.02] flex items-center justify-between text-[9px] font-mono text-zinc-400">
              <span>COUPLER STATE:</span>
              <span
                className={`font-black tracking-wider ${
                  rollStateSim === "holding"
                    ? "text-amber-400 animate-pulse"
                    : rollStateSim === "amber1" ||
                        rollStateSim === "amber2" ||
                        rollStateSim === "amber3"
                      ? "text-amber-300"
                      : rollStateSim === "green"
                        ? "text-emerald-500 animate-bounce"
                        : rollStateSim === "accelerating"
                          ? "text-pink-400 animate-pulse"
                          : rollStateSim === "finished"
                            ? "text-purple-400 font-extrabold"
                            : "text-zinc-650"
                }`}
              >
                {rollStateSim === "idle" && "ARM TO TRIGGER"}
                {rollStateSim === "holding" && "HOLD STEADY AT 60 KPH..."}
                {rollStateSim === "amber1" && "LIGHT 3"}
                {rollStateSim === "amber2" && "LIGHT 2"}
                {rollStateSim === "amber3" && "LIGHT 1"}
                {rollStateSim === "green" && "GO! FULL THROTTLE!"}
                {rollStateSim === "accelerating" && "ACCELERATING RANGE..."}
                {rollStateSim === "finished" && "COUPLER COMPLETED"}
              </span>
            </div>

            {/* Roll racing completed report detail */}
            {completedRollReport && (
              <div className="bg-black/60 p-2.5 rounded-xl border border-[#BC13FE]/20 text-[9px] font-mono text-zinc-400 flex flex-col gap-1.5 animate-fadeIn">
                <div className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span className="font-extrabold text-[#BC13FE]">
                    ROLL INTERVAL METRICS:
                  </span>
                  <span className="text-white font-bold">
                    {completedRollReport.interval}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex justify-between">
                    <span>PULL TIME:</span>
                    <span className="text-emerald-400 font-extrabold">
                      {completedRollReport.time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MAX BOOST:</span>
                    <span className="text-white font-semibold">
                      {completedRollReport.maxBoost}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>PEAK LOAD:</span>
                    <span className="text-pink-400 font-semibold">
                      {completedRollReport.peakG}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>AERO DRS:</span>
                    <span className="text-[#BC13FE] font-semibold">
                      {completedRollReport.drsDragReduction}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Triggers */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerSimulatedTelemetry("ROLL")}
                disabled={
                  rollStateSim !== "idle" && rollStateSim !== "finished"
                }
                className="py-2.5 px-2 bg-gradient-to-r from-[#BC13FE]/20 to-pink-500/10 border border-[#BC13FE]/45 text-[#ebd7ff] hover:from-[#BC13FE]/35 hover:to-pink-500/20 rounded-lg text-[9px] font-mono font-black tracking-wider transition-all shadow-[0_0_12px_rgba(188,19,254,0.12)] disabled:opacity-40"
              >
                {rollStateSim === "idle" || rollStateSim === "finished"
                  ? "ARM ROLL RACE"
                  : "RUNNING..."}
              </button>
              <button
                onClick={() => {
                  cleanupSim();
                  setRollStateSim("idle");
                  setCompletedRollReport(null);
                  setRollTimerSim(0);
                }}
                className="py-2.5 px-2 bg-zinc-950/70 hover:bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-lg text-[9px] font-mono font-black tracking-wider transition-all"
              >
                RESET
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: OBD TELEMETRY LOGGER */}
        {activeTab === "LOGGER" && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">
                HIGH-SPEED OBD BUS LOGGER
              </span>
              <span className="text-[8.5px] font-mono font-black text-rose-500 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                100Hz CALIBRATION BUS
              </span>
            </div>

            {/* Logger Diagnostics detail pool */}
            <div className="grid grid-cols-2 gap-2 bg-black/60 p-2.5 rounded-xl border border-white/[0.03] text-[9px] font-mono text-zinc-400">
              <div className="flex flex-col">
                <span>DMA Link:</span>
                <span className="text-white font-extrabold">
                  COUPLED_AWD_05
                </span>
              </div>
              <div className="flex flex-col">
                <span>Avg Latency:</span>
                <span className="text-emerald-400 font-extrabold">0.14 ms</span>
              </div>
              <div className="flex flex-col mt-1">
                <span>Bus Status:</span>
                <span className="text-white font-semibold">1,024 Hz Ticks</span>
              </div>
              <div className="flex flex-col mt-1">
                <span>Buffer Pool:</span>
                <span className="text-[#BC13FE] font-bold">128K samples</span>
              </div>
            </div>

            {/* Captured CSV list */}
            <div className="max-h-24 overflow-y-auto pr-0.5 flex flex-col gap-1.5 scrollbar-thin">
              {logFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-black/55 p-2 rounded-lg border border-white/[0.02] flex justify-between items-center text-[9px] font-mono group hover:border-[#BC13FE]/30 transition-all"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-200 font-bold truncate max-w-[130px]">
                      {file.name}
                    </span>
                    <span className="text-zinc-500 text-[8px] uppercase">
                      {file.type} • {file.time}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDownloadFakeLog(file.name)}
                    disabled={isDownloading !== null}
                    className="px-2 py-1 bg-[#BC13FE]/10 hover:bg-[#BC13FE]/25 hover:text-white border border-[#BC13FE]/30 text-[#ecd2ff] rounded font-bold text-[8px] flex items-center gap-1 transition-all shrink-0"
                  >
                    {isDownloading === file.name ? (
                      <span className="w-2.5 h-2.5 border border-[#BC13FE] border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <Download className="w-2.5 h-2.5 text-[#BC13FE]" />
                    )}
                    {file.size}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  });

const ConnectedNeuralMap: React.FC = memo(() => {
  const latestData = useVehicleStore((state) => state.latestData);
  const mlInsights = useVehicleStore((state) => state.mlInsights);

  const speed = latestData.speed || 0;
  const isMoving = speed > 5;

  // Kinematic values for dynamic SVG bending and twisting
  const yaw = latestData.yawRate || 0;
  const steering = latestData.steeringAngle || 0;
  const slip = mlInsights?.slipProbability || 0;
  const lonG = latestData.gForceX || 0;
  const latG = latestData.gForceY || 0;

  // Fast oscillation loop for tire slippage visual vibration / tremor
  const time = Date.now() / 150;
  const jitter = slip > 0.35 ? Math.sin(time) * (slip * 6) : 0;

  // Dynamic coordinate math warp based on real vehicle kinematic forces
  const startY = 50 + latG * 14 + jitter;
  const controlX = 50 + steering * 0.45;
  const controlY = 25 - yaw * 25 - lonG * 8;
  const midX = 100 + steering * 0.12;
  const midY = 50 - latG * 8 + jitter;
  const endX = 190;
  const endY = 50 - latG * 14;

  const pathD = `M 10 ${startY} Q ${controlX} ${controlY}, ${midX} ${midY} T ${endX} ${endY}`;

  return (
    <div className="p-5 bg-black/40 border border-white/[0.03] rounded-2xl flex flex-col gap-4 hover:border-[#BC13FE]/25 transition-all duration-300 relative overflow-hidden">
      <TechCornerAccents />
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          AWD Kinematics Spline
        </span>
        <span className="text-[9px] font-mono text-emerald-500 tracking-wider font-bold">
          3D_SOLVER_OK
        </span>
      </div>
      <div className="h-32 bg-zinc-950/75 rounded-xl border border-white/[0.02] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

        {/* Simulated 3D Wave Grid */}
        <svg
          className="w-full h-full absolute inset-0 z-0 p-2"
          viewBox="0 0 200 100"
        >
          <defs>
            <linearGradient id="purpleSpline" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#BC13FE" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#BC13FE" stopOpacity="1" />
              <stop offset="100%" stopColor="#e879f9" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <motion.path
            d={pathD}
            fill="none"
            stroke="url(#purpleSpline)"
            strokeWidth="3.5"
            animate={
              isMoving
                ? {
                    strokeWidth: [3, 4, 3],
                  }
                : {}
            }
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </svg>
        <div className="text-center z-10 flex flex-col items-center gap-1">
          <span className="text-[10px] font-black text-brand-purple uppercase tracking-widest text-[#BC13FE]">
            Active Kinematics Link
          </span>
          <span className="text-[9px] font-mono text-zinc-500 uppercase">
            EKF STATE RESOLVED
          </span>
        </div>
      </div>

      {/* Live Telemetry Kinematics Statistics */}
      <div className="grid grid-cols-2 gap-2 mt-1 pt-3 border-t border-white/[0.04] font-mono text-[9px] text-zinc-500">
        <div className="flex justify-between">
          <span>YAW:</span>
          <span className="text-white font-semibold">
            {yaw.toFixed(3)} rad/s
          </span>
        </div>
        <div className="flex justify-between">
          <span>STEER:</span>
          <span className="text-white font-semibold">
            {steering.toFixed(1)}°
          </span>
        </div>
        <div className="flex justify-between">
          <span>SLIP PROB:</span>
          <span
            className={`${slip > 0.35 ? "text-red-400 font-bold" : "text-zinc-450"}`}
          >
            {(slip * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>LAT/LON G:</span>
          <span className="text-white font-semibold">
            {latG.toFixed(2)}G / {lonG.toFixed(2)}G
          </span>
        </div>
      </div>
    </div>
  );
});

const ConnectedActiveAero: React.FC = memo(
  () => {
    const latestData = useVehicleStore((state) => state.latestData);

    const speed = latestData.speed || 0;
    const throttle = latestData.throttlePos || 0;
    const latG = latestData.gForceY || 0;
    const lonG = latestData.gForceX || 0;
    const isBraking = lonG < -0.15 && speed > 15;

    // Calculations for aerodynamic downforce and angles
    // Flap angles respond to braking (air brake mode) or speed (downforce mode)
    const baseFlapAngle = Math.min(45, Math.max(5, (speed / 300) * 35));
    const activeFlapAngle = isBraking
      ? 65
      : throttle > 70
        ? baseFlapAngle - 10
        : baseFlapAngle; // DRS vs standard downforce vs airbrake

    // Left/right aero distribution based on cornering lateral G
    const leftAeroForce = Math.max(0, 100 * (0.5 - latG * 0.3));
    const rightAeroForce = Math.max(0, 100 * (0.5 + latG * 0.3));

    // Spline downforce metric
    const calculatedDownforce = Math.min(
      1250,
      Math.floor(speed * speed * 0.012 + (isBraking ? 150 : 0)),
    );

    return (
      <div
        className="w-full mt-2 p-4 bg-black/45 border border-white/[0.03] rounded-2xl flex flex-col gap-3 hover:border-[#BC13FE]/20 transition-all duration-300 shadow-[0_0_20px_rgba(188,19,254,0.03)] focus:outline-none"
        
      >
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
            Chassis Active Aero Spline
          </span>
          <span className="text-[9px] font-mono text-[#BC13FE] font-bold">
            {isBraking
              ? "AIR-BRAKE DEPLOYED"
              : throttle > 70
                ? "DRS ACTIVE (LOW DRAG)"
                : "DOWNFORCE ON"}
          </span>
        </div>

        <div className="h-28 bg-zinc-950/75 rounded-xl border border-white/[0.02] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#151515_1px,transparent_1px)] [background-size:12px_12px] opacity-45" />

          {/* Visualizer SVG */}
          <svg
            className="w-full h-full max-w-[340px] absolute inset-0 z-0 p-1"
            viewBox="0 0 320 100"
          >
            <defs>
              <linearGradient id="aeroGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#BC13FE" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#e879f9" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient
                id="solidPurple"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#BC13FE" />
                <stop offset="100%" stopColor="#bd53f9" />
              </linearGradient>
            </defs>

            {/* Ambient aerodynamic flow lines (particles) */}
            {speed > 10 && (
              <g opacity="0.3">
                <motion.path
                  d="M 10,20 L 70,20 L 100,50 L 290,50"
                  fill="none"
                  stroke="#BC13FE"
                  strokeWidth="1"
                  strokeDasharray="5,15"
                  animate={{ strokeDashoffset: [0, -40] }}
                  transition={{
                    duration: 1.5 - speed / 350,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <motion.path
                  d="M 5,35 L 85,35 L 120,60 L 295,60"
                  fill="none"
                  stroke="#bd53f9"
                  strokeWidth="1.5"
                  strokeDasharray="8,20"
                  animate={{ strokeDashoffset: [0, -60] }}
                  transition={{
                    duration: 1.2 - speed / 350,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <motion.path
                  d="M 15,55 L 90,55 L 115,70 L 300,70"
                  fill="none"
                  stroke="#f472b6"
                  strokeWidth="0.8"
                  strokeDasharray="4,12"
                  animate={{ strokeDashoffset: [0, -30] }}
                  transition={{
                    duration: 1.8 - speed / 350,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </g>
            )}

            {/* 1. Base Plate / Diffuser Splitter - Animated at the bottom */}
            <g transform={`translate(0, ${latG * 3})`}>
              <polygon
                points="30,78 290,78 275,86 15,86"
                fill="#0b0b0b"
                stroke="#BC13FE"
                strokeWidth="1.5"
                opacity="0.85"
                className="transition-all duration-300"
              />
              {/* Glow effect on the plate */}
              <line
                x1="20"
                y1="78"
                x2="285"
                y2="78"
                stroke="#ef4444"
                strokeWidth="1"
                opacity={isBraking ? 0.9 : 0.2}
              />
            </g>

            {/* 2. Three Slanted Wing Flaps matching the design shape drawn precisely */}
            {/* Left Hand Flight Flap */}
            <g transform={`translate(0, ${-latG * 5})`}>
              <motion.polygon
                points="50,30 85,30 65,70 30,70"
                fill="url(#aeroGlow)"
                stroke="url(#solidPurple)"
                strokeWidth="1.5"
                animate={{
                  skewX: -activeFlapAngle / 8,
                  scaleY: 1 + lonG * 0.1,
                }}
                className="transition-transform duration-200"
              />
            </g>

            {/* Core Central Flight Flap */}
            <g transform={`translate(0, ${lonG * 3})`}>
              <motion.polygon
                points="125,30 185,30 155,70 95,70"
                fill="url(#aeroGlow)"
                stroke="url(#solidPurple)"
                strokeWidth="1.5"
                animate={{
                  skewX: -activeFlapAngle / 6,
                  scaleY: 1 + Math.abs(latG) * 0.08,
                }}
                className="transition-transform duration-200"
              />
            </g>

            {/* Right Hand Flight Flap */}
            <g transform={`translate(0, ${latG * 5})`}>
              <motion.polygon
                points="225,30 260,30 240,70 205,70"
                fill="url(#aeroGlow)"
                stroke="url(#solidPurple)"
                strokeWidth="1.5"
                animate={{
                  skewX: -activeFlapAngle / 8,
                  scaleY: 1 - lonG * 0.1,
                }}
                className="transition-transform duration-200"
              />
            </g>
          </svg>

          <div className="absolute right-4 bottom-2.5 flex flex-col items-end pointer-events-none">
            <span className="text-[14px] font-black font-mono text-white leading-none">
              {calculatedDownforce}{" "}
              <span className="text-[9px] text-zinc-500 font-bold">KG</span>
            </span>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
              NET DOWNFORCE
            </span>
          </div>

          <div className="absolute left-4 bottom-2.5 flex flex-col items-start pointer-events-none">
            <span className="text-[12px] font-black font-mono text-[#BC13FE] leading-none">
              {activeFlapAngle.toFixed(1)}°
            </span>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
              AERO ATTACK ANGLE
            </span>
          </div>
        </div>

        {/* Split Force channels */}
        <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-zinc-500 border-t border-white/[0.04] pt-2">
          <div className="flex justify-between">
            <span>LEFT FOIL LOAD:</span>
            <span className="font-bold text-zinc-300">
              {leftAeroForce.toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>RIGHT FOIL LOAD:</span>
            <span className="font-bold text-zinc-300">
              {rightAeroForce.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    );
  },
);

import { useUIStore } from "../../stores/uiStore";


const ConnectedAmbientGlow = memo(() => {
  const rpm = useVehicleStore((state) => state.latestData?.rpm || 0);
  const isRedline = rpm >= 6500;
  const isNearRedline = rpm >= 6000;
  const glowColor = isRedline
    ? "rgba(239, 68, 68, 0.35)"
    : isNearRedline
      ? "rgba(219, 39, 119, 0.2)"
      : "rgba(188, 19, 254, 0.08)";
      
  return (
    <div
      className="absolute inset-0 pointer-events-none transition-colors duration-500 ease-out z-0"
      style={{
        background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 80%)`
      }}
    />
  );
});

const CarbonPurpleDashboard: React.FC = () => {
  const latestData = useVehicleStore((state) => state.latestData);
  const rpm = latestData?.rpm || 0;
  const isRedline = rpm >= 6500;
  const isNearRedline = rpm >= 6000;
  const glowColor = isRedline
    ? "rgba(239, 68, 68, 0.35)"
    : isNearRedline
      ? "rgba(219, 39, 119, 0.2)"
      : "rgba(188, 19, 254, 0.08)";

  const isCalibrating = useVehicleStore((state) => state.isCalibrating);
  const calibrationProgress = useVehicleStore(
    (state) => state.calibrationProgress,
  );
  const calibrationStatus = useVehicleStore((state) => state.calibrationStatus);
  const calibrateSensors = useVehicleStore((state) => state.calibrateSensors);
  const isHighStress = useVehicleStore((state) => state.isHighStress);
  

  

  const handleCalibrate = () => {
    calibrateSensors();
  };

  return (
    <div 
      className="w-full h-full bg-[#0a080c] text-white flex flex-col font-sans overflow-hidden select-none relative"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(188, 78, 253, 0.12) 0%, transparent 70%),
          linear-gradient(rgba(18, 16, 20, 0.85) 1px, transparent 1px),
          linear-gradient(90deg, rgba(18, 16, 20, 0.85) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px'
      }}
    >
      {/* Ambient Background Glows */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-500 ease-out z-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 80%)`
        }}
      />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#BC13FE]/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#BC13FE]/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Top Toolbar matching JDM Tactical Dash design */}
      <header className="h-16 px-6 bg-[#0a080c]/60 border-b-2 border-[#bc4efd] backdrop-blur-md flex items-center justify-between relative z-20 shrink-0">
        <div className="flex items-end">
          <div className="font-technical font-black tracking-tight text-white leading-none text-xl sm:text-2xl md:text-3xl lg:text-4xl">
            KARAPIRO<span className="text-[#bc4efd]">CARTEL</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-technical font-bold text-[#bc4efd] text-[10px] sm:text-xs tracking-wider">
            ECU ACTIVE // CALIBRATION: SPORT+
          </div>
          <div className="text-[8px] sm:text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5 flex items-center justify-end gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#bc4efd] inline-block rounded-full animate-pulse shadow-[0_0_8px_#bc4efd]"></span>
            System Rev 8.00.4
          </div>
        </div>
      </header>

      {/* Main Grid View - 3 perfectly balanced symmetrical columns on desktop */}
      <main className="flex-1 p-2 sm:p-4 flex flex-col relative z-10 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          
          {/* COLUMN 1: LEFT SIDEBAR (Analytics, Core Control & Performance Log) */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5 justify-start pt-2 overflow-y-auto no-scrollbar order-2 lg:order-1">
            {!isHighStress ? (
              <>
                <ConnectedAICommentary />
                <div className="p-5 bg-black/45 border border-white/[0.03] rounded-2xl flex flex-col gap-3 relative overflow-hidden shadow-[0_0_20px_rgba(188,19,254,0.03)]">
                  <TechCornerAccents />
                  <ConnectedNeuralLoad />
                </div>
                <ConnectedNeuralMap />
                <ConnectedPerformanceTimer />
              </>
            ) : (
              <div className="p-5 bg-red-950/10 border border-red-500/20 rounded-2xl flex flex-col gap-3.5 relative overflow-hidden shadow-[0_0_25px_rgba(239,68,68,0.04)] animate-pulse">
                <TechCornerAccents />
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase font-mono tracking-widest">
                  <span className="w-2.5 h-2.5 bg-red-500 inline-block rounded-full shadow-[0_0_8px_#ef4444] animate-ping"></span>
                  ADAPTIVE PERFORMANCE CONDUIT ACTIVE
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Secondary visual channels pruned. CPU / GPU cycles consolidated. Core EKF sensor fusion and tachometer sweeps synchronized.
                </p>
                <div className="border-t border-white/[0.04] pt-3 mt-1">
                  <ConnectedPerformanceTimer />
                </div>
              </div>
            )}
          </aside>

          {/* COLUMN 2: CENTER HERO (Centralized & Visually Enlarged Main RPM Gauge) */}
          <section className="col-span-12 lg:col-span-6 flex flex-col justify-center items-center gap-4 pt-2 order-1 lg:order-2">
            <div className="flex-1 flex flex-col items-center justify-center relative w-full min-h-[380px] xl:min-h-[520px] py-2">
              
              {/* Giant pulsing ambient glow behind tachometer */}
              <div 
                className="absolute w-[360px] h-[360px] xl:w-[540px] xl:h-[540px] rounded-full filter blur-[85px] animate-pulse pointer-events-none transition-colors duration-500"
                style={{
                  background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`
                }}
              />

              {/* Enlarged tachometer with rotating cybernetic bezels */}
              <div className="w-full max-w-[400px] xl:max-w-[560px] relative p-2 transition-transform duration-500 hover:scale-[1.02]">
                
                {/* Rotating HUD ticks bezel */}
                <div
                  className="absolute inset-[-12px] border border-white/[0.02] rounded-full overflow-hidden"
                  style={{ pointerEvents: "auto" }}
                >
                  <svg
                    className="w-full h-full cursor-pointer"
                    onDoubleClick={handleCalibrate}
                    style={{ pointerEvents: "auto" }}
                  >
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      fill="transparent"
                      stroke="rgba(188, 19, 254, 0.08)"
                      strokeWidth="1"
                      strokeDasharray="6 6"
                    />
                  </svg>
                </div>
                
                {/* Tech frame accents */}
                <div className="absolute inset-[-6px] border border-[#BC13FE]/10 rounded-full pointer-events-none" />
                <div className="absolute inset-[-18px] border-t-2 border-r border-[#BC13FE]/30 rounded-full pointer-events-none animate-[spin_12s_linear_infinite]" />
                <div className="absolute inset-[-18px] border-b-2 border-l border-pink-500/20 rounded-full pointer-events-none animate-[spin_20s_linear_infinite_reverse]" />

                <FusionGauge
                  dataKeyMain="rpm"
                  maxMain={8000}
                  redline={6500}
                  mainLabel="Engine speed"
                  mainUnit="X1000 RPM"
                  dataKeyDigital1="speed"
                  digital1Label="SPEED km/h"
                  dataKeyDigital2="gear"
                  digital2Label="GEAR"
                  tickDivider={1000}
                  numMajorTicks={9}
                  size="100%"
                  glowColor="#BC13FE"
                  showShiftLight={true}
                  shiftPoint={6200}
                  interactiveShiftLight={true}
                  labelSize="12px"
                  showProgressiveShiftLight={true}
                  largeCenterGear={true}
                  svgStyle={{
                    width: "100%",
                    height: "auto",
                    fontSize: "16px",
                  }}
                  innerCircleStyle={{
                    marginLeft: "-5px",
                    marginRight: "0px",
                    paddingBottom: "0px",
                    paddingRight: "0px",
                    paddingTop: "0px",
                    borderStyle: "inset",
                    borderWidth: "7px",
                    borderRadius: "30px",
                    borderColor: "#eb0b14",
                  }}
                  speedBoxRectStyle={{
                    height: "45px",
                    paddingBottom: "2px",
                    paddingTop: "-1px",
                    paddingLeft: "0px",
                    marginRight: "-1px",
                    marginBottom: "-20px",
                    width: "100px",
                    lineHeight: "23px",
                    fontSize: "5px",
                    marginLeft: "2px",
                    borderWidth: "6px",
                    borderStyle: "inset",
                    borderRadius: "7px",
                    borderColor: "#f00303",
                  }}
                  largeGearOuterRectStyle={{
                    marginBottom: "1px",
                    marginRight: "-13px",
                    paddingBottom: "15px",
                    paddingRight: "4px",
                    marginTop: "0px",
                    paddingLeft: "1px",
                    paddingTop: "2px",
                    height: "87px",
                    lineHeight: "51px",
                    fontSize: "23px",
                    fontStyle: "italic",
                    borderStyle: "inset",
                    borderWidth: "4px",
                  }}
                  mainLabelStyle={{
                    fontSize: "-1px",
                    fontStyle: "italic",
                    lineHeight: "18px",
                    paddingLeft: "0px",
                    paddingTop: "0px",
                  }}
                  mainUnitStyle={{
                    lineHeight: "1px",
                    fontStyle: "italic",
                    marginLeft: "0px",
                    marginRight: "0px",
                    paddingBottom: "-2px",
                    paddingRight: "-6px",
                    fontSize: "-1px",
                    fontWeight: "normal",
                    textDecorationLine: "underline",
                    marginTop: "-7px",
                    marginBottom: "-4px",
                  }}
                  gearTextStyle={{
                    fontStyle: "normal",
                    fontSize: "71px",
                    fontWeight: "bold",
                    lineHeight: "50px",
                    textDecorationLine: "none",
                    marginTop: "20px",
                    marginBottom: "15px",
                    paddingTop: "12px",
                    paddingBottom: "26px",
                  }}
                  speedBoxLabelStyle={{
                    fontSize: "9px",
                    fontStyle: "normal",
                  }}
                />
              </div>
            </div>

            {/* Downforce active aero system centered below the tachometer */}
            <div className="w-full max-w-[400px] xl:max-w-[560px]">
              <ConnectedActiveAero />
            </div>
          </section>

          {/* COLUMN 3: RIGHT SIDEBAR (Diagnostics, Engine Vital Sign Gauges & Vector plotter) */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5 justify-start pt-2 overflow-y-auto no-scrollbar order-3 lg:order-3">
            {!isHighStress ? (
              <>
                {/* High-Fidelity Mini Boost Gauge Card */}
                <div 
                  className="p-4 bg-black/45 border border-white/[0.03] rounded-2xl flex flex-col gap-3 relative overflow-hidden shadow-[0_0_20px_rgba(188,19,254,0.03)] hover:border-[#BC13FE]/20 transition-all duration-300"
                  style={{
                    height: "253.653px",
                    paddingLeft: "16px",
                    paddingTop: "0px",
                    paddingBottom: "16px",
                    marginTop: "0px"
                  }}
                >
                  <TechCornerAccents />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                      Manifold Boost
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">
                      SOLENOID ACTIVE
                    </span>
                  </div>
                  <div 
                    className="flex justify-center items-center py-1"
                    style={{
                      height: "204.985px",
                      marginTop: "-51px"
                    }}
                  >
                    <div className="w-full max-w-[210px] xl:max-w-[240px]">
                      <FusionGauge
                        dataKeyMain="turboBoost"
                        maxMain={2.5}
                        redline={2.0}
                        mainLabel="Boost"
                        mainUnit="BAR"
                        dataKeyDigital1="turboBoost"
                        digital1Label="Boost"
                        tickDivider={1}
                        numMajorTicks={6}
                        size="100%"
                        glowColor="#BC13FE"
                        showShiftLight={true}
                        shiftPoint={2.2}
                        showBrandLogo="none"
                        svgStyle={{ height: "174.996px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Visually Refined Unified 2x2 Grid of Vital StatBoxes */}
                <div className="grid grid-cols-2 gap-4">
                  <ConnectedStatBox
                    field="engineTemp"
                    label="Coolant Temp"
                    unit="°C"
                    colorClass="text-white font-mono"
                    toFixed={0}
                  />
                  <ConnectedStatBox
                    field="engineOilTemp"
                    label="Oil Temp"
                    unit="°C"
                    colorClass="text-pink-400 font-mono"
                    toFixed={0}
                  />
                  <ConnectedStatBox
                    field="oilPressure"
                    label="Oil Press"
                    unit="BAR"
                    colorClass="text-brand-purple font-mono text-[#BC13FE]"
                    toFixed={1}
                  />
                  <ConnectedStatBox
                    field="batteryVoltage"
                    label="Battery"
                    unit="V"
                    colorClass="text-zinc-300 font-mono"
                    toFixed={1}
                  />
                </div>

                {/* Physical Telemetry Plots */}
                <ConnectedGForceWidget />
                <ConnectedOdometer />
              </>
            ) : (
              <>
                {/* Visually Refined Unified 2x2 Grid of Vital StatBoxes */}
                <div className="grid grid-cols-2 gap-4">
                  <ConnectedStatBox
                    field="engineTemp"
                    label="Coolant Temp"
                    unit="°C"
                    colorClass="text-white font-mono"
                    toFixed={0}
                  />
                  <ConnectedStatBox
                    field="engineOilTemp"
                    label="Oil Temp"
                    unit="°C"
                    colorClass="text-pink-400 font-mono"
                    toFixed={0}
                  />
                  <ConnectedStatBox
                    field="oilPressure"
                    label="Oil Press"
                    unit="BAR"
                    colorClass="text-brand-purple font-mono text-[#BC13FE]"
                    toFixed={1}
                  />
                  <ConnectedStatBox
                    field="batteryVoltage"
                    label="Battery"
                    unit="V"
                    colorClass="text-zinc-300 font-mono"
                    toFixed={1}
                  />
                </div>

                {/* Simplified, High contrast racing vitals overview */}
                <div className="p-4 bg-red-950/10 border border-red-500/10 rounded-2xl flex flex-col gap-2.5 relative overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.02)]">
                  <TechCornerAccents />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">
                    CRITICAL WARNING SYSTEM
                  </span>
                  <div className="flex justify-between items-center text-[11px] font-mono border-b border-white/[0.04] py-1.5">
                    <span className="text-zinc-500 font-bold">EGT LIMIT:</span>
                    <span className="text-emerald-400 font-bold">820°C (NOMINAL)</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono border-b border-white/[0.04] py-1.5">
                    <span className="text-zinc-500 font-bold">KNOCK STATE:</span>
                    <span className="text-emerald-400 font-bold">0 SAMPLES (SAFE)</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-zinc-500 font-bold">LAMBDA DETECT:</span>
                    <span className="text-[#BC13FE] font-bold font-black">0.86 λ (TARGET)</span>
                  </div>
                </div>
                <ConnectedOdometer />
              </>
            )}
          </aside>
        </div>
      </main>

      <footer className="border-t border-white/[0.08] px-6 py-4 flex flex-col sm:flex-row justify-between items-center text-[9px] tracking-widest text-zinc-500 font-mono gap-2 shrink-0 bg-[#0a080c]/80 backdrop-blur-md relative z-20">
        <span>GENESIS_OS // NODE_044 // STABLE_STATE</span>
        <span>37°55'27.1"S 175°32'44.9"E</span>
        <span>© 2026 KARAPIRO CARTEL PERFORMANCE</span>
      </footer>

      {/* Neural Recalibration Full HUD Overlay Overlay */}
      {isCalibrating && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col justify-center items-center z-50">
          <div className="w-[380px] bg-zinc-950 border border-[#BC13FE]/40 p-6 rounded-2xl relative shadow-[0_0_50px_rgba(188,19,254,0.15)] flex flex-col gap-4">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#BC13FE] pointer-events-none" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#BC13FE] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#BC13FE] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#BC13FE] pointer-events-none" />

            <div className="flex gap-3 items-center text-[#BC13FE]">
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-[12px] font-black tracking-widest uppercase">
                NEURAL KINEMATIC RECALIBRATION
              </span>
            </div>
            <p className="text-zinc-400 text-xs font-mono">
              {calibrationStatus}
            </p>

            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className="bg-gradient-to-r from-[#BC13FE] to-pink-500 h-full transition-all duration-300"
                style={{ width: `${calibrationProgress}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-right text-zinc-500 font-extrabold uppercase">
              progress: {calibrationProgress.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarbonPurpleDashboard;
