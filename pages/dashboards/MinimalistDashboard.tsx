import React, { useMemo } from 'react';
import { useVehicleData } from '../../hooks/useVehicleData';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useVehicleStore } from '../../stores/vehicleStore';
import { ObdConnectionState } from '../../types';

/** Arc progress ring — digital racedash primary instrument */
const ArcInstrument: React.FC<{
  value: number;
  max: number;
  label: string;
  unit: string;
  accent?: string;
  warnAt?: number;
  size?: number;
  decimals?: number;
}> = ({ value, max, label, unit, accent = '#00F0FF', warnAt, size = 160, decimals = 0 }) => {
  const animated = useAnimatedValue(value);
  const radius = 58;
  const c = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(animated, max));
  const ratio = max > 0 ? clamped / max : 0;
  const offset = c * (1 - ratio * 0.75); // 270° sweep
  const critical = warnAt != null && animated >= warnAt;
  const stroke = critical ? '#FF003C' : accent;

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size + 28 }}>
      <svg width={size} height={size} viewBox="0 0 140 140" className="overflow-visible">
        <defs>
          <filter id="dash-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke="#1a1a1a" strokeWidth="6"
          strokeDasharray={`${c * 0.75} ${c}`}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
        />
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke={stroke} strokeWidth="6"
          strokeDasharray={`${c * 0.75} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
          filter="url(#dash-glow)"
          style={{ transition: 'stroke-dashoffset 80ms linear' }}
        />
        <text x="70" y="66" textAnchor="middle" className="fill-white" style={{ fontSize: size > 140 ? 28 : 22, fontWeight: 300, fontFamily: 'Inter, system-ui, sans-serif' }}>
          {decimals > 0 ? animated.toFixed(decimals) : Math.round(animated)}
        </text>
        <text x="70" y="86" textAnchor="middle" fill="#6b7280" style={{ fontSize: 10, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>
          {unit}
        </text>
      </svg>
      <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium -mt-1">{label}</span>
    </div>
  );
};

const ChannelBar: React.FC<{
  label: string;
  value: number;
  max: number;
  unit: string;
  accent?: string;
  decimals?: number;
}> = ({ label, value, max, unit, accent = '#00F0FF', decimals = 0 }) => {
  const animated = useAnimatedValue(value);
  const pct = max > 0 ? Math.min(100, Math.max(0, (animated / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</span>
        <span className="font-mono text-sm text-white tabular-nums">
          {decimals > 0 ? animated.toFixed(decimals) : Math.round(animated)}
          <span className="text-gray-600 text-[10px] ml-1">{unit}</span>
        </span>
      </div>
      <div className="h-1 w-full bg-[#151515] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: accent,
            boxShadow: `0 0 8px ${accent}66`,
            transition: 'width 80ms linear',
          }}
        />
      </div>
    </div>
  );
};

const StatusChip: React.FC<{ live: boolean; source?: string }> = ({ live, source }) => (
  <div className="flex items-center gap-2">
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'}`}
    />
    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
      {live ? `LIVE · ${source || 'OBD'}` : 'SIMULATION'}
    </span>
  </div>
);

/**
 * Genesis Digital Racedash — Minimalist EV layout
 * Rebuild: real telemetry channels, arc instruments, power/regen strip,
 * source-aware status. No hardcoded demo range/efficiency.
 */
const MinimalistDashboard: React.FC = () => {
  const { latestData } = useVehicleData();
  const obdState = useVehicleStore((s) => s.obdState);
  const d = latestData;

  const isLive =
    obdState === ObdConnectionState.Connected && d.source === 'live_obd';

  const batterySoc = useMemo(() => Math.min(100, Math.max(0, d.fuelLevel)), [d.fuelLevel]);
  const motorKw = useMemo(() => {
    return Math.max(0, (d.engineLoad / 100) * d.batteryVoltage * 4.2);
  }, [d.engineLoad, d.batteryVoltage]);
  const regenKw = useMemo(() => {
    if (d.throttlePos < 5 && d.gForceY < -0.05) return Math.min(40, Math.abs(d.gForceY) * 80);
    return 0;
  }, [d.throttlePos, d.gForceY]);
  const efficiencyProxy = useMemo(() => {
    if (d.speed < 1) return 0;
    return Math.min(100, Math.max(0, 100 - d.engineLoad * 0.6));
  }, [d.speed, d.engineLoad]);

  const speed = useAnimatedValue(d.speed);
  const gear = d.gear;

  return (
    <div className="w-full h-full min-h-0 bg-[#050505] text-white flex flex-col overflow-hidden select-none">
      <header className="flex-shrink-0 px-4 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[11px] font-mono tracking-[0.35em] text-[#00F0FF]">GENESIS</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Digital Racedash · EV</div>
          </div>
          <StatusChip live={isLive} source={d.source} />
        </div>
        <div className="flex items-end gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase tracking-widest text-gray-600">Gear</div>
            <div className="font-mono text-2xl text-white tabular-nums">{gear || 'N'}</div>
          </div>
          <div className="text-right">
            <div className="font-light tabular-nums leading-none" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}>
              {Math.round(speed)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 mt-1">km/h</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 px-4 py-6 min-h-0">
        <ArcInstrument value={d.rpm} max={8000} label="Motor RPM" unit="RPM" accent="#00F0FF" warnAt={6500} size={180} />
        <ArcInstrument value={batterySoc} max={100} label="State of Charge" unit="%" accent="#4ade80" size={200} />
        <ArcInstrument value={motorKw} max={120} label="Drive Power" unit="kW" accent="#60a5fa" decimals={1} size={180} />
      </main>

      <section className="flex-shrink-0 px-4 md:px-8 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">Drive / Regen</div>
            <div className="relative h-3 rounded-full bg-[#151515] overflow-hidden flex">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/20 z-10" />
              <div
                className="h-full bg-[#FF003C]/80 ml-auto"
                style={{ width: `${Math.min(50, (motorKw / 120) * 50)}%`, transition: 'width 80ms linear' }}
              />
              <div
                className="h-full bg-emerald-400/80"
                style={{ width: `${Math.min(50, (regenKw / 40) * 50)}%`, transition: 'width 80ms linear' }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono text-gray-500">
              <span>DRIVE {motorKw.toFixed(1)} kW</span>
              <span>REGEN {regenKw.toFixed(1)} kW</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-4 grid grid-cols-2 gap-4">
            <ChannelBar label="Pack Voltage" value={d.batteryVoltage} max={16} unit="V" accent="#fbbf24" decimals={1} />
            <ChannelBar label="Motor Temp" value={d.engineTemp} max={120} unit="°C" accent="#f97316" />
            <ChannelBar label="Efficiency" value={efficiencyProxy} max={100} unit="idx" accent="#a78bfa" />
            <ChannelBar label="Throttle" value={d.throttlePos} max={100} unit="%" accent="#00F0FF" />
          </div>
        </div>
      </section>

      <footer className="flex-shrink-0 border-t border-white/5 px-4 md:px-8 py-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-w-6xl mx-auto w-full">
        <ChannelBar label="Oil P" value={d.oilPressure} max={8} unit="bar" decimals={1} accent="#94a3b8" />
        <ChannelBar label="Boost" value={Math.max(0, d.turboBoost)} max={2.5} unit="bar" decimals={2} accent="#22d3ee" />
        <ChannelBar label="IAT" value={d.inletAirTemp} max={80} unit="°C" accent="#38bdf8" />
        <ChannelBar label="Lambda" value={d.lambda} max={1.5} unit="λ" decimals={2} accent="#e879f9" />
        <ChannelBar label="Load" value={d.engineLoad} max={100} unit="%" accent="#f472b6" />
        <ChannelBar label="G-Lat" value={Math.abs(d.gForceX)} max={1.5} unit="g" decimals={2} accent="#facc15" />
      </footer>
    </div>
  );
};

export default MinimalistDashboard;
