import React, { useEffect, useState } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { ObdConnectionState } from '../../types';
import { motion, useTransform } from 'motion/react';

import { Activity, Cpu, Settings } from 'lucide-react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

const ConnectedDataLine: React.FC<{ 
    label: string; 
    dataKey: string; 
    unit: string; 
    max: number; 
    fixed: number;
    color: string;
    barColor: string;
}> = React.memo(({ label, dataKey, unit, max, fixed, color, barColor }) => {
    const valMotion = useAnimatedValue(dataKey);
    const obdState = useVehicleStore(s => s.obdState);
    const [displayVal, setDisplayVal] = useState('---');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        return valMotion.on("change", (v) => {
            const isConnected = obdState === ObdConnectionState.Connected;
            if (!isConnected) {
                setDisplayVal('---');
                setProgress(0);
            } else {
                setDisplayVal(v !== undefined && v !== null ? v.toFixed(fixed) : '---');
                setProgress(Math.min(100, Math.max(0, ((v || 0) / max) * 100)));
            }
        });
    }, [valMotion, fixed, max, obdState]);

    return (
        <div className={`flex flex-col gap-1 transition-opacity duration-300 ${obdState !== ObdConnectionState.Connected ? 'opacity-40' : ''}`}>
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-tighter">
                    {label}
                </span>
                <div className="flex items-baseline gap-1">
                    <span className="text-sm font-display font-black text-white tracking-tighter">
                        {displayVal}
                    </span>
                    <span className={`text-[9px] font-mono ${color} uppercase opacity-80`}>
                        {obdState === ObdConnectionState.Connected ? unit : '...'}
                    </span>
                </div>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    className={`h-full ${barColor}`}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
            </div>
        </div>
    );
});

export const ComprehensiveDataDisplay: React.FC = () => {
    const categories = [
        {
            title: 'Engine & Fuel',
            icon: <Activity className="w-4 h-4 text-brand-cyan" />,
            color: 'text-brand-cyan',
            bg: 'bg-brand-cyan/10',
            bar: 'bg-brand-cyan/40',
            items: [
                { label: 'VVT Intake', dataKey: 'vvtIntakeAngle', unit: '°', max: 50, fixed: 1 },
                { label: 'VVT Exhaust', dataKey: 'vvtExhaustAngle', unit: '°', max: 50, fixed: 1 },
                { label: 'Inj Pulse', dataKey: 'injectorPulseWidth', unit: 'ms', max: 20, fixed: 2 },
                { label: 'Fuel Pump', dataKey: 'fuelPumpDutyCycle', unit: '%', max: 100, fixed: 0 },
                { label: 'Target Idle', dataKey: 'targetIdleRpm', unit: 'RPM', max: 1500, fixed: 0 },
            ]
        },
        {
            title: 'ECU & Boost',
            icon: <Cpu className="w-4 h-4 text-purple-400" />,
            color: 'text-purple-400',
            bg: 'bg-purple-400/10',
            bar: 'bg-purple-400/40',
            items: [
                { label: 'Wastegate', dataKey: 'wastegateDutyCycle', unit: '%', max: 100, fixed: 0 },
                { label: 'Accel Pedal', dataKey: 'acceleratorPedalPos', unit: '%', max: 100, fixed: 0 },
                { label: 'Throttle', dataKey: 'throttlePos', unit: '%', max: 100, fixed: 0 },
                { label: 'Engine Load', dataKey: 'engineLoad', unit: '%', max: 100, fixed: 0 },
                { label: 'Timing Adv', dataKey: 'timingAdvance', unit: '°', max: 50, fixed: 1 },
            ]
        },
        {
            title: 'Drivetrain',
            icon: <Settings className="w-4 h-4 text-orange-400" />,
            color: 'text-orange-400',
            bg: 'bg-orange-400/10',
            bar: 'bg-orange-400/40',
            items: [
                { label: 'TC Slip', dataKey: 'torqueConverterSlip', unit: 'RPM', max: 1000, fixed: 0 },
                { label: 'Line Press', dataKey: 'linePressure', unit: 'PSI', max: 250, fixed: 0 },
                { label: 'AWD Split', dataKey: 'awdTorqueSplit', unit: '% F', max: 50, fixed: 0 },
                { label: 'Steering', dataKey: 'steeringAngle', unit: '°', max: 360, fixed: 0 },
                { label: 'Yaw Rate', dataKey: 'yawRate', unit: '°/s', max: 100, fixed: 1 },
            ]
        },
        {
            title: 'H-Performance',
            icon: <Activity className="w-4 h-4 text-brand-yellow" />,
            color: 'text-brand-yellow',
            bg: 'bg-brand-yellow/10',
            bar: 'bg-brand-yellow/40',
            items: [
                { label: 'VVEL Position', dataKey: 'vvelPosition', unit: '%', max: 100, fixed: 1 },
                { label: 'Oil Temp', dataKey: 'engineOilTemp', unit: '°C', max: 150, fixed: 0 },
                { label: 'MAF Bank 1', dataKey: 'mafB1', unit: 'g/s', max: 500, fixed: 1 },
                { label: 'MAF Bank 2', dataKey: 'mafB2', unit: 'g/s', max: 500, fixed: 1 },
                { label: 'Battery', dataKey: 'batteryVoltage', unit: 'V', max: 16, fixed: 1 },
            ]
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            {categories.map((category, idx) => (
                <div key={idx} className="glass-panel p-4 rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {category.icon}
                            <h3 className="text-[0.7rem] font-display font-bold uppercase tracking-[0.2em] text-gray-400">{category.title}</h3>
                        </div>
                        <div className={`px-2 py-0.5 ${category.bg} rounded text-[9px] font-mono ${category.color} uppercase tracking-widest`}>
                            Live
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {category.items.map((item, i) => (
                            <ConnectedDataLine 
                                key={i}
                                label={item.label}
                                dataKey={item.dataKey}
                                unit={item.unit}
                                max={item.max}
                                fixed={item.fixed}
                                color={category.color}
                                barColor={category.bar}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
