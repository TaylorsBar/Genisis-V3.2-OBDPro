import React, { useState, useEffect } from 'react';
import { Compass, Flag, Timer, Zap, Shield, RotateCcw, Play, Pause, Award } from 'lucide-react';

interface NismoTrackTelemetryProps {
  gForceX: number; // Lateral G (-2.0 to +2.0)
  gForceY: number; // Longitudinal G (-2.0 to +2.0)
  speedMph: number;
  rpm: number;
  isLaunchControlActive: boolean;
  onToggleLaunchControl: () => void;
  unitSystem?: 'imperial' | 'metric';
}

export const NismoTrackTelemetry: React.FC<NismoTrackTelemetryProps> = ({
  gForceX = 0,
  gForceY = 0,
  speedMph = 0,
  rpm = 0,
  isLaunchControlActive = false,
  onToggleLaunchControl,
  unitSystem = 'imperial'
}) => {
  const isMetric = unitSystem === 'metric';

  // Peak G-Force tracking
  const [peakLatG, setPeakLatG] = useState(0);
  const [peakLongG, setPeakLongG] = useState(0);

  // Lap Timer State
  const [isLapActive, setIsLapActive] = useState(false);
  const [lapTimeMs, setLapTimeMs] = useState(0);
  const [bestLapMs, setBestLapMs] = useState<number | null>(104250); // 1:44.250 reference
  const [lastLapMs, setLastLapMs] = useState<number | null>(105120);
  const [currentSector, setCurrentSector] = useState(1);
  const [sectorTimes, setSectorTimes] = useState<[number, number, number]>([31200, 42100, 30950]);

  // Acceleration Timer (0-60 MPH / 0-100 KM/H)
  const [accelTimerState, setAccelTimerState] = useState<'IDLE' | 'ARMED' | 'RUNNING' | 'FINISHED'>('IDLE');
  const [accelTimeMs, setAccelTimeMs] = useState(0);
  const [bestAccelMs, setBestAccelMs] = useState(3850); // 3.85s 0-60mph baseline

  // Update Peak Gs
  useEffect(() => {
    if (Math.abs(gForceX) > peakLatG) setPeakLatG(Math.abs(gForceX));
    if (Math.abs(gForceY) > peakLongG) setPeakLongG(Math.abs(gForceY));
  }, [gForceX, gForceY]);

  // Lap Timer Interval
  useEffect(() => {
    let interval: any = null;
    if (isLapActive) {
      interval = setInterval(() => {
        setLapTimeMs(prev => prev + 50);
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isLapActive]);

  // Acceleration Timer Logic
  useEffect(() => {
    let interval: any = null;
    const targetSpeed = isMetric ? 62.1371 : 60; // 100km/h vs 60mph

    if (accelTimerState === 'ARMED' && speedMph > 2) {
      setAccelTimerState('RUNNING');
      setAccelTimeMs(0);
    } else if (accelTimerState === 'RUNNING') {
      if (speedMph >= targetSpeed) {
        setAccelTimerState('FINISHED');
        if (bestAccelMs === null || accelTimeMs < bestAccelMs) {
          setBestAccelMs(accelTimeMs);
        }
      } else {
        interval = setInterval(() => {
          setAccelTimeMs(prev => prev + 20);
        }, 20);
      }
    }

    return () => clearInterval(interval);
  }, [accelTimerState, speedMph, isMetric, accelTimeMs, bestAccelMs]);

  // Format Milliseconds into mm:ss.ms
  const formatLapTime = (ms: number | null) => {
    if (ms === null) return '--:--.---';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const milli = Math.floor((ms % 1000) / 10);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${milli.toString().padStart(2, '0')}`;
  };

  // Format Accel Time into s.ms
  const formatAccelTime = (ms: number) => {
    const sec = (ms / 1000).toFixed(2);
    return `${sec}s`;
  };

  // Sector split trigger
  const handleSectorSplit = () => {
    if (!isLapActive) return;
    if (currentSector === 1) {
      setSectorTimes([lapTimeMs, 0, 0]);
      setCurrentSector(2);
    } else if (currentSector === 2) {
      setSectorTimes(prev => [prev[0], lapTimeMs - prev[0], 0]);
      setCurrentSector(3);
    } else {
      const s3Time = lapTimeMs - (sectorTimes[0] + sectorTimes[1]);
      setSectorTimes(prev => [prev[0], prev[1], s3Time]);
      setLastLapMs(lapTimeMs);
      if (bestLapMs === null || lapTimeMs < bestLapMs) {
        setBestLapMs(lapTimeMs);
      }
      setLapTimeMs(0);
      setCurrentSector(1);
    }
  };

  return (
    <div className="w-full bg-[#08080a] rounded-xl sm:rounded-3xl p-2 sm:p-4 border border-red-900/60 shadow-[0_0_40px_rgba(0,0,0,0.9)] text-white">
      
      {/* Top Motorsport Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_#dc2626]"></div>
          <div>
            <h2 className="text-lg sm:text-xl font-display font-black tracking-widest uppercase">
              NISMO <span className="text-red-500">DYNAMIC TRACK TELEMETRY</span>
            </h2>
            <p className="text-xs font-mono text-gray-400">VR30DDTT HIGH-G VECTORING & RACE DATA LOGGING</p>
          </div>
        </div>

        {/* Launch Control Trigger Button */}
        <button
          onClick={onToggleLaunchControl}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all duration-300 border ${
            isLaunchControlActive
              ? 'bg-red-600 border-red-400 text-white shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse'
              : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-red-600 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          {isLaunchControlActive ? 'LAUNCH CONTROL ACTIVE (3,500 RPM)' : 'ENGAGE LAUNCH CONTROL'}
        </button>
      </div>

      {/* Grid Layout: G-Force Vector | Acceleration Timer | Lap Timer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        
        {/* ================= PANEL 1: LIVE G-FORCE VECTORING ================= */}
        <div className="bg-black/80 rounded-2xl p-5 border border-gray-800 flex flex-col items-center relative overflow-hidden">
          <div className="w-full flex justify-between items-center mb-2">
            <span className="text-xs font-display font-black text-gray-300 uppercase tracking-widest">
              G-FORCE VECTOR METER
            </span>
            <button
              onClick={() => { setPeakLatG(0); setPeakLongG(0); }}
              className="text-gray-500 hover:text-red-400 p-1 text-xs font-mono"
              title="Reset Peak Gs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* G-Circle Canvas */}
          <div className="relative w-44 h-44 my-2 rounded-full border border-red-900/40 bg-[#0d0d10] flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
            
            {/* Concentric G Rings (0.5G, 1.0G, 1.5G) */}
            <div className="absolute inset-4 rounded-full border border-gray-800 pointer-events-none"></div>
            <div className="absolute inset-10 rounded-full border border-gray-800/80 pointer-events-none"></div>
            <div className="absolute inset-16 rounded-full border border-gray-800/50 pointer-events-none"></div>

            {/* Crosshairs */}
            <div className="absolute inset-x-0 h-px bg-gray-800 pointer-events-none"></div>
            <div className="absolute inset-y-0 w-px bg-gray-800 pointer-events-none"></div>

            {/* Live Moving Friction Ball */}
            <div
              className="absolute w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-[0_0_15px_#ef4444] transition-all duration-75 pointer-events-none"
              style={{
                transform: `translate(${Math.max(-70, Math.min(70, gForceX * 45))}px, ${Math.max(-70, Math.min(70, -gForceY * 45))}px)`
              }}
            ></div>
          </div>

          {/* Readout stats */}
          <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-800 text-center font-mono">
            <div className="bg-gray-900/80 p-2 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase block">LATERAL G</span>
              <span className="text-sm font-bold text-white">{gForceX >= 0 ? `+${gForceX.toFixed(2)}` : gForceX.toFixed(2)} G</span>
              <span className="text-[9px] text-red-500 block">PEAK: {peakLatG.toFixed(2)}G</span>
            </div>
            <div className="bg-gray-900/80 p-2 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase block">ACCEL / BRAKE</span>
              <span className="text-sm font-bold text-white">{gForceY >= 0 ? `+${gForceY.toFixed(2)}` : gForceY.toFixed(2)} G</span>
              <span className="text-[9px] text-red-500 block">PEAK: {peakLongG.toFixed(2)}G</span>
            </div>
          </div>
        </div>


        {/* ================= PANEL 2: 0-60 / 0-100 PERF TIMER ================= */}
        <div className="bg-black/80 rounded-2xl p-5 border border-gray-800 flex flex-col justify-between relative">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-display font-black text-gray-300 uppercase tracking-widest">
                ACCELERATION TIMER ({isMetric ? '0-100 KM/H' : '0-60 MPH'})
              </span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>

            {/* Timer Readout */}
            <div className="bg-[#0c0c0f] p-4 rounded-xl border border-gray-800 text-center my-2">
              <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-wider">
                {formatAccelTime(accelTimeMs)}
              </span>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                {accelTimerState === 'IDLE' && 'PRESS ARM TO START TIMER'}
                {accelTimerState === 'ARMED' && 'AWAITING LAUNCH DETECT (SPEED > 0)'}
                {accelTimerState === 'RUNNING' && 'TIMING ACCELERATION RUN...'}
                {accelTimerState === 'FINISHED' && 'RUN COMPLETE!'}
              </div>
            </div>

            {/* Best Run & AWD Torque Split */}
            <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">BEST RECORD</span>
                <span className="font-bold text-amber-400">{formatAccelTime(bestAccelMs)}</span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">AWD SPLIT (F:R)</span>
                <span className="font-bold text-red-400">30:70 NISMO</span>
              </div>
            </div>
          </div>

          {/* Action Control Button */}
          <div className="flex gap-2 mt-4">
            {accelTimerState === 'IDLE' || accelTimerState === 'FINISHED' ? (
              <button
                onClick={() => { setAccelTimerState('ARMED'); setAccelTimeMs(0); }}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-black text-xs uppercase tracking-wider transition shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              >
                ARM ACCEL TIMER
              </button>
            ) : (
              <button
                onClick={() => setAccelTimerState('IDLE')}
                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-display font-black text-xs uppercase tracking-wider transition"
              >
                CANCEL / RESET
              </button>
            )}
          </div>
        </div>


        {/* ================= PANEL 3: GPS TRACK LAP TIMER ================= */}
        <div className="bg-black/80 rounded-2xl p-5 border border-gray-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-display font-black text-gray-300 uppercase tracking-widest">
                GPS LAP TELEMETRY
              </span>
              <Flag className="w-4 h-4 text-red-500" />
            </div>

            {/* Current Active Lap Clock */}
            <div className="bg-[#0c0c0f] p-4 rounded-xl border border-gray-800 text-center my-2">
              <span className="text-3xl sm:text-4xl font-mono font-black text-red-500 tracking-wider">
                {formatLapTime(lapTimeMs)}
              </span>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mt-1">
                CURRENT LAP (SECTOR {currentSector})
              </span>
            </div>

            {/* Sector Split Times Table */}
            <div className="grid grid-cols-3 gap-1.5 my-3 text-center font-mono text-[11px]">
              <div className="bg-gray-900/80 p-1.5 rounded-md border border-gray-800">
                <span className="text-[9px] text-gray-500 block">SEC 1</span>
                <span className="font-bold text-gray-200">{sectorTimes[0] ? (sectorTimes[0] / 1000).toFixed(2) : '--'}s</span>
              </div>
              <div className="bg-gray-900/80 p-1.5 rounded-md border border-gray-800">
                <span className="text-[9px] text-gray-500 block">SEC 2</span>
                <span className="font-bold text-gray-200">{sectorTimes[1] ? (sectorTimes[1] / 1000).toFixed(2) : '--'}s</span>
              </div>
              <div className="bg-gray-900/80 p-1.5 rounded-md border border-gray-800">
                <span className="text-[9px] text-gray-500 block">SEC 3</span>
                <span className="font-bold text-gray-200">{sectorTimes[2] ? (sectorTimes[2] / 1000).toFixed(2) : '--'}s</span>
              </div>
            </div>

            {/* Best Lap & Delta */}
            <div className="flex justify-between text-xs font-mono px-1 text-gray-400">
              <span>BEST: <strong className="text-amber-400">{formatLapTime(bestLapMs)}</strong></span>
              <span>LAST: <strong className="text-white">{formatLapTime(lastLapMs)}</strong></span>
            </div>
          </div>

          {/* Lap Timer Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setIsLapActive(!isLapActive)}
              className={`flex-1 py-2 rounded-xl font-display font-black text-xs uppercase tracking-wider transition ${
                isLapActive
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isLapActive ? 'PAUSE LAP' : 'START LAP'}
            </button>
            <button
              onClick={handleSectorSplit}
              disabled={!isLapActive}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-display font-black text-xs uppercase tracking-wider transition"
            >
              SPLIT
            </button>
            <button
              onClick={() => { setIsLapActive(false); setLapTimeMs(0); setCurrentSector(1); }}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs"
              title="Reset Lap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NismoTrackTelemetry;
