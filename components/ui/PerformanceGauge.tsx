import React from 'react';
import { motion } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface PerformanceGaugeProps {
    value: number;
    max: number;
    label: string;
    unit: string;
    color?: string;
    size?: number;
    type?: 'circular' | 'linear' | 'semi-circular';
    showValue?: boolean;
    showLabel?: boolean;
    showUnit?: boolean;
    className?: string;
    icon?: React.ComponentType<{ className?: string }>;
}

export const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({
    value,
    max,
    label,
    unit,
    color = 'text-brand-cyan',
    size = 180,
    type = 'circular',
    showValue = true,
    showLabel = true,
    showUnit = true,
    className = '',
    icon: Icon
}) => {
    const animatedValue = useAnimatedValue(value);
    const [currentVal, setCurrentVal] = React.useState(value);

    React.useEffect(() => {
        setCurrentVal(animatedValue.get());
        return animatedValue.on("change", (v) => {
            setCurrentVal(v);
        });
    }, [animatedValue]);

    const progress = Math.min(1, Math.max(0, currentVal / max));

    if (type === 'linear') {
        return (
            <div className={`flex flex-col gap-1.5 ${className}`}>
                <div className="flex justify-between items-baseline">
                    {showLabel && <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>}
                    <div className="flex items-baseline gap-1">
                        {showValue && <span className="text-sm font-mono font-bold text-white">{currentVal.toFixed(1)}</span>}
                        {showUnit && <span className="text-[10px] text-zinc-600 font-mono">{unit}</span>}
                    </div>
                </div>
                <div className="h-2 bg-zinc-900/50 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                        className={`h-full ${color.startsWith('text-') ? color.replace('text-', 'bg-') : color}`}
                        style={{ width: `${progress * 100}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    />
                </div>
            </div>
        );
    }

    if (type === 'semi-circular') {
        const radius = size / 2 - 10;
        const circumference = Math.PI * radius;
        const offset = circumference - (progress * circumference);

        return (
            <div className={`relative flex flex-col items-center justify-center ${className}`} style={{ width: size, height: size / 2 + 20 }}>
                <svg className="w-full h-full -rotate-180" viewBox={`0 0 ${size} ${size / 2 + 10}`}>
                    <path
                        d={`M 10,${size / 2} A ${radius},${radius} 0 0,1 ${size - 10},${size / 2}`}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-zinc-900"
                        strokeLinecap="round"
                    />
                    <path
                        d={`M 10,${size / 2} A ${radius},${radius} 0 0,1 ${size - 10},${size / 2}`}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className={color}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
                    />
                </svg>
                <div className="absolute bottom-0 flex flex-col items-center">
                    {showValue && <span className="text-2xl font-bold font-mono tracking-tighter text-white">{currentVal.toFixed(0)}</span>}
                    <div className="flex items-baseline gap-1">
                        {showLabel && <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>}
                        {showUnit && <span className="text-[8px] text-zinc-600 font-mono">{unit}</span>}
                    </div>
                </div>
            </div>
        );
    }

    // Default: Circular
    const radius = size / 2 - 12;
    const circumference = 2 * Math.PI * radius;
    const arcLength = 0.75; // 270 degree gauge
    const offset = circumference - (progress * arcLength * circumference);

    return (
        <div className={`relative flex flex-col items-center justify-center group ${className}`} style={{ width: size, height: size }}>
            <svg className="w-full h-full -rotate-[225deg]">
                {/* Background Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className="text-zinc-900/50"
                    strokeDasharray={`${circumference * arcLength} ${circumference}`}
                    strokeLinecap="round"
                />
                {/* Progress Track Glow - Simplified */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className={`${color} opacity-10`}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
                {/* Progress Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className={color}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ 
                        transition: 'stroke-dashoffset 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: 'drop-shadow(0 0 8px currentColor)'
                    }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
                {Icon && <Icon className={`w-6 h-6 mb-1 ${color} opacity-90`} />}
                {showValue && <span className="text-4xl font-black font-mono tracking-tightest text-white">{currentVal.toFixed(0)}</span>}
                {showLabel && <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest-xl mt-1">{label}</span>}
                {showUnit && <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{unit}</span>}
            </div>
        </div>
    );
};

export default PerformanceGauge;
