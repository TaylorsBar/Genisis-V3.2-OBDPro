
import React from 'react';
import HelpTooltip from '../HelpTooltip';

interface TuningSliderProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  tooltipTitle?: string;
  helpContent?: string;
}

const TuningSlider: React.FC<TuningSliderProps> = ({ 
  label, unit, value, min, max, step, onChange, tooltipTitle, helpContent 
}) => {
    const percentage = ((value - min) / (max - min)) * 100;
    
    return (
        <div>
            <div className="flex justify-between items-baseline mb-2">
                <span className="flex items-center gap-1.5">
                    <label className="text-md font-semibold text-gray-300">{label}</label>
                    {helpContent && <HelpTooltip title={tooltipTitle || label} content={helpContent} position="top" />}
                </span>
                <span className="font-mono text-lg text-white bg-base-800 px-2 py-1 rounded-md">
                    {value.toFixed(step < 1 ? 1 : 0)} {unit}
                </span>
            </div>
            <div className="relative h-8 flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={e => onChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-base-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                    style={{ backgroundSize: `${percentage}% 100%` }}
                />
            </div>
        </div>
    );
};

export default TuningSlider;
