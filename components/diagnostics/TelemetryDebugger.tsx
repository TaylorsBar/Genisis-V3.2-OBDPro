import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
    Cpu, 
    Activity, 
    ShieldAlert, 
    Zap, 
    Database, 
    Compass, 
    Gauge, 
    AlertCircle, 
    Grid,
    Info,
    RefreshCw
} from 'lucide-react';
import { useVehicleStore } from '../../stores/vehicleStore';

interface EkfStateSnapshot {
    x: number[];
    P: number[];
    residuals: Record<string, number>;
    timestamp: number;
}

const STATE_LABELS = [
    { name: 'Position X', unit: 'm', desc: 'Relative East position filter state' },
    { name: 'Position Y', unit: 'm', desc: 'Relative North position filter state' },
    { name: 'Position Z', unit: 'm', desc: 'Altitude state' },
    { name: 'Velocity X', unit: 'm/s', desc: 'Longitudinal velocity' },
    { name: 'Velocity Y', unit: 'm/s', desc: 'Lateral velocity (slip indicator)' },
    { name: 'Velocity Z', unit: 'm/s', desc: 'Vertical velocity state' },
    { name: 'Accel Bias X', unit: 'm/s²', desc: 'Accelerometer X-axis temperature bias' },
    { name: 'Accel Bias Y', unit: 'm/s²', desc: 'Accelerometer Y-axis temperature bias' },
    { name: 'Accel Bias Z', unit: 'm/s²', desc: 'Accelerometer Z-axis gravity alignment bias' },
    { name: 'Yaw', unit: 'rad', desc: 'Heading orientation angle' },
    { name: 'Yaw Rate', unit: 'rad/s', desc: 'Angular rotation velocity' },
    { name: 'Pitch', unit: 'rad', desc: 'Chassis pitch / dive-squat angle' },
    { name: 'Roll', unit: 'rad', desc: 'Chassis body roll / lateral lean angle' }
];

export const TelemetryDebugger: React.FC = () => {
    const getEkfState = useVehicleStore(state => state.getEkfState);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    const latestData = useVehicleStore(state => state.latestData);

    const [snapshot, setSnapshot] = useState<EkfStateSnapshot | null>(null);
    const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number; val: number } | null>(null);
    const [selectedStateIndex, setSelectedStateIndex] = useState<number | null>(null);
    const [residualHistory, setResidualHistory] = useState<Record<string, number[]>>({});

    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const updateLoop = () => {
            const data = getEkfState();
            const now = Date.now();
            setSnapshot({
                x: data.x,
                P: data.P,
                residuals: data.residuals,
                timestamp: now
            });

            setResidualHistory(prev => {
                const updated: Record<string, number[]> = { ...prev };
                Object.entries(data.residuals).forEach(([key, val]) => {
                    if (!updated[key]) updated[key] = [];
                    updated[key] = [...updated[key].slice(-30), val];
                });
                return updated;
            });

            rafRef.current = requestAnimationFrame(updateLoop);
        };

        rafRef.current = requestAnimationFrame(updateLoop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [getEkfState]);

    if (!snapshot) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-brand-cyan" />
                <p className="font-mono text-xs uppercase tracking-widest">Awaiting EKF State Convergence...</p>
            </div>
        );
    }

    const { x, P, residuals } = snapshot;

    // Helper to calculate color intensity for covariance matrix
    const getCovarianceColor = (val: number, isDiagonal: boolean) => {
        const absVal = Math.abs(val);
        if (isDiagonal) {
            // Variance (diagonal)
            if (absVal < 1e-4) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            if (absVal < 1e-2) return 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40';
            if (absVal < 0.1) return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
            return 'bg-red-500/30 text-red-400 border border-red-500/50';
        } else {
            // Correlation (off-diagonal)
            if (absVal < 1e-6) return 'bg-white/[0.02] text-white/20 border border-white/[0.05]';
            if (absVal < 1e-4) return 'bg-indigo-500/5 text-indigo-400/40 border border-indigo-500/10';
            if (absVal < 1e-2) return 'bg-indigo-500/15 text-indigo-400/70 border border-indigo-500/20';
            return 'bg-purple-500/25 text-purple-300 border border-purple-500/30';
        }
    };

    // Sensor Active states
    const sensorStates = [
        { name: 'IMU Accelerometer', active: Math.abs(latestData.gForceX || 0) > 0.001 || Math.abs(latestData.gForceY || 0) > 0.001, noise: 'Q_bias: 1e-8, Q_acc: 5e-5' },
        { name: 'IMU Gyroscope', active: Math.abs(latestData.yawRate || 0) > 0.001, noise: 'Q_gyro: 2e-3' },
        { name: 'GPS Receiver', active: ekfStats.gpsActive, noise: 'R_gps: ~0.1 - 2.0' },
        { name: 'OBD Core', active: latestData.speed > 0, noise: 'R_obd: 0.02' },
        { name: 'Vision Tracker', active: ekfStats.visionConfidence > 0.1, noise: `R_vision: ${(1 - ekfStats.visionConfidence).toFixed(2)}` }
    ];

    return (
        <div className="grid grid-cols-12 gap-6 pb-12 text-white">
            {/* Header statistics / active sensors */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-5 gap-4">
                {sensorStates.map((sensor, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-brand-cyan/5 to-transparent rounded-bl-full pointer-events-none" />
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-black uppercase text-gray-400 tracking-wider">{sensor.name}</span>
                            <div className={`w-2 h-2 rounded-full ${sensor.active ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500/50'}`} />
                        </div>
                        <div className="mt-3">
                            <div className="text-xs font-mono font-bold text-white/80">
                                {sensor.active ? 'FUSING ON BEHALF' : 'STBY / OFFLINE'}
                            </div>
                            <div className="text-[9px] font-mono text-gray-500 mt-1 uppercase tracking-wider">{sensor.noise}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Residual error (Innovation) Panel */}
            <div className="col-span-12 lg:col-span-6 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-5 h-5 text-brand-cyan" />
                            <div>
                                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Sensor Residual Errors (Innovations)</h3>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Y = Z - H(X) | MEASUREMENT ANOMALY DETECTORS</p>
                            </div>
                        </div>
                        <div className="px-2 py-1 bg-brand-cyan/10 border border-brand-cyan/20 rounded-md font-mono text-[9px] text-brand-cyan font-bold uppercase">
                            Chi-Square Threshold: 16.0
                        </div>
                    </div>

                    <div className="space-y-4">
                        {Object.keys(residuals).length === 0 ? (
                            <div className="py-12 text-center text-white/20 font-mono text-xs">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                No active residuals being generated.
                                <p className="text-[10px] text-gray-600 mt-1 uppercase">DRIVING IS REQUIRED TO AWAKEN KINEMATIC OBSERVERS</p>
                            </div>
                        ) : (
                            Object.entries(residuals).map(([key, val]) => {
                                const history = residualHistory[key] || [];
                                const maxAbs = Math.max(...history.map(Math.abs), 0.5);
                                const isOutlier = Math.abs(val) > 2.5;

                                return (
                                    <div key={key} className="bg-black/20 border border-white/5 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-white uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                {isOutlier && (
                                                    <span className="bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-[8px] font-black uppercase px-1.5 py-0.5 rounded animate-pulse">
                                                        High Innovation Residual
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`font-mono text-xs font-bold ${isOutlier ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {val > 0 ? '+' : ''}{val.toFixed(4)}
                                            </span>
                                        </div>

                                        {/* Sparkline & Visual Bar */}
                                        <div className="h-6 w-full flex items-center gap-2">
                                            <div className="flex-1 bg-white/5 rounded h-1.5 overflow-hidden relative">
                                                {/* Center reference line */}
                                                <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/20 z-10" />
                                                
                                                {/* Residual deflection bar */}
                                                <div 
                                                    className={`absolute h-full transition-all duration-75 ${isOutlier ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-brand-cyan'}`}
                                                    style={{
                                                        left: val < 0 ? `${50 - Math.min(50, (Math.abs(val) / maxAbs) * 50)}%` : '50%',
                                                        width: `${Math.min(50, (Math.abs(val) / maxAbs) * 50)}%`
                                                    }}
                                                />
                                            </div>
                                            
                                            {/* Micro Sparkline of History */}
                                            <div className="w-20 h-5 flex items-end gap-[1px]">
                                                {history.slice(-15).map((h, idx) => {
                                                    const hPercent = Math.min(100, (Math.abs(h) / maxAbs) * 100);
                                                    return (
                                                        <div 
                                                            key={idx} 
                                                            className={`flex-1 rounded-t-[1px] ${Math.abs(h) > 2.5 ? 'bg-red-400' : 'bg-brand-cyan/40'}`} 
                                                            style={{ height: `${Math.max(10, hPercent)}%` }} 
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* State Covariance Diagonal List */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        State Vector & Confidence Bounds (Variance Diagonal)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {STATE_LABELS.map((state, idx) => {
                            const value = x[idx];
                            // Standard deviation is the square root of the diagonal variance cell: P[idx * 13 + idx]
                            const variance = P[idx * 13 + idx];
                            const stdDev = Math.sqrt(Math.max(0, variance));
                            const isSelected = selectedStateIndex === idx;

                            return (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedStateIndex(isSelected ? null : idx)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                        isSelected 
                                            ? 'bg-brand-cyan/10 border-brand-cyan/40' 
                                            : 'bg-black/20 border-white/5 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-[10px] font-bold text-gray-400 uppercase">{state.name}</span>
                                        <span className="font-mono text-[9px] px-1.5 py-0.5 bg-white/5 text-gray-500 rounded font-black">x[{idx}]</span>
                                    </div>
                                    <div className="mt-2 flex items-baseline justify-between">
                                        <p className="text-lg font-mono font-black text-white">
                                            {value.toFixed(4)}
                                            <span className="text-xs text-gray-500 font-normal ml-1">{state.unit}</span>
                                        </p>
                                        <p className="text-[10px] font-mono text-brand-cyan font-bold" title="Confidence bound (Standard Deviation)">
                                            ±{stdDev.toFixed(4)}
                                        </p>
                                    </div>

                                    {isSelected && (
                                        <div className="mt-2 pt-2 border-t border-white/5">
                                            <p className="text-[9px] font-mono text-gray-400 leading-relaxed normal-case">{state.desc}</p>
                                            <p className="text-[9px] font-mono text-brand-purple mt-1 uppercase tracking-wider font-bold">
                                                Variance σ²: {variance.toExponential(3)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* State Covariance Heatmap (13x13 Matrix) */}
            <div className="col-span-12 lg:col-span-6 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Grid className="w-5 h-5 text-brand-purple" />
                                <div>
                                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">State Covariance Matrix (P)</h3>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">13x13 SYMMETRIC MUTUAL-CORRELATION TENSORS</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded bg-brand-cyan/20 border border-brand-cyan/40" />
                                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Diagonal</span>
                                <span className="w-2.5 h-2.5 rounded bg-indigo-500/15 border border-indigo-500/20" />
                                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Off-Diag</span>
                            </div>
                        </div>

                        {/* Interactive Matrix Grid */}
                        <div className="bg-black/30 border border-white/10 rounded-2xl p-4 overflow-x-auto">
                            <div className="min-w-[420px]">
                                {/* Columns Headers */}
                                <div className="grid grid-cols-14 gap-1 mb-1 text-center font-mono text-[7px] text-gray-500 uppercase tracking-widest">
                                    <div />
                                    {STATE_LABELS.map((_, c) => (
                                        <div key={c} className="font-bold">{c}</div>
                                    ))}
                                </div>

                                {/* Matrix Rows */}
                                {Array.from({ length: 13 }).map((_, r) => (
                                    <div key={r} className="grid grid-cols-14 gap-1 items-center">
                                        {/* Row Header */}
                                        <div className="font-mono text-[7px] text-gray-500 text-right pr-2 font-bold uppercase">{r}</div>
                                        
                                        {Array.from({ length: 13 }).map((__, c) => {
                                            const cellIndex = r * 13 + c;
                                            const val = P[cellIndex];
                                            const isDiagonal = r === c;
                                            const isHovered = hoveredCell?.r === r && hoveredCell?.c === c;

                                            return (
                                                <div
                                                    key={c}
                                                    onMouseEnter={() => setHoveredCell({ r, c, val })}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    onClick={() => {
                                                        setSelectedStateIndex(r);
                                                    }}
                                                    className={`aspect-square rounded transition-all duration-75 cursor-pointer flex items-center justify-center text-[6px] font-mono relative ${getCovarianceColor(val, isDiagonal)} ${
                                                        isHovered ? 'ring-2 ring-white scale-110 z-10 shadow-lg shadow-black/50' : ''
                                                    }`}
                                                >
                                                    {/* Optional: micro variance indicators */}
                                                    {isDiagonal && <div className="w-1 h-1 bg-white/40 rounded-full" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Interactive hover inspector */}
                    <div className="mt-6 p-4 bg-black/40 border border-white/5 rounded-xl min-h-[90px] flex items-center">
                        {hoveredCell ? (
                            <div className="w-full grid grid-cols-12 gap-4">
                                <div className="col-span-8 space-y-1">
                                    <p className="text-[10px] font-mono text-gray-400 uppercase font-bold">Correlation Coordinate</p>
                                    <p className="text-xs font-mono font-bold text-white uppercase">
                                        {STATE_LABELS[hoveredCell.r].name} <span className="text-brand-purple">↔</span> {STATE_LABELS[hoveredCell.c].name}
                                    </p>
                                    <p className="text-[9px] font-mono text-gray-500 uppercase leading-none">
                                        COV[x[{hoveredCell.r}], x[{hoveredCell.c}]] | {hoveredCell.r === hoveredCell.c ? 'STATE VARIANCE' : 'CROSS COVARIANCE'}
                                    </p>
                                </div>
                                <div className="col-span-4 text-right flex flex-col justify-center">
                                    <p className="text-[9px] font-mono text-gray-400 uppercase font-bold">Covariance Value</p>
                                    <p className="text-sm font-mono font-black text-brand-cyan">
                                        {hoveredCell.val.toExponential(4)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full flex items-center gap-3 text-white/30 font-mono text-xs">
                                <Info className="w-4 h-4 text-gray-500" />
                                <span>Hover over any cell in the 13x13 covariance matrix above to inspect state correlations in real-time.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mathematical context block */}
                <div className="bg-brand-purple/5 border border-brand-purple/20 rounded-2xl p-6">
                    <h4 className="text-xs font-mono font-bold text-brand-purple uppercase tracking-widest mb-2">Extended Kalman Filter (EKF) Model Reference</h4>
                    <p className="text-xs text-white/70 leading-relaxed">
                        The <strong>GenesisEKFUltimate</strong> filter executes 13-dimensional kinematic tracking at 100Hz. State propagation incorporates real-time chassis dynamics, accelerometer/gyroscope integration, GPS velocity corrections, and OBD CAN bus wheel speed fusion, dynamically recalibrating sensor alignment bias vectors under high-G loads.
                    </p>
                    <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                        <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                            <p className="text-[8px] font-mono text-gray-500 uppercase">State Dimensions</p>
                            <p className="text-base font-mono font-black text-white">13 States</p>
                        </div>
                        <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                            <p className="text-[8px] font-mono text-gray-500 uppercase">Covariance Cells</p>
                            <p className="text-base font-mono font-black text-white">169 Tensors</p>
                        </div>
                        <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                            <p className="text-[8px] font-mono text-gray-500 uppercase">Propagation rate</p>
                            <p className="text-base font-mono font-black text-brand-cyan">100 Hz</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
