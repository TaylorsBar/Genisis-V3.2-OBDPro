
import React, { useRef, useEffect } from 'react';
import { useSpringValue } from '../../../hooks/useSpringValue';

interface BarMeterProps {
  label: string;
  value: number;
  target: number;
}

const BarMeter: React.FC<BarMeterProps> = ({ label, value, target }) => {
    const animatedValueRef = useSpringValue(value, { stiffness: 100, damping: 20, mass: 1 });
    const barRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        let raf: number;
        const loop = () => {
            const val = animatedValueRef.current;
            const percentage = Math.min(100, (val / (target * 1.5)) * 100);
            
            if (barRef.current) {
                barRef.current.style.width = `${percentage}%`;
            }
            if (textRef.current) {
                textRef.current.innerText = val.toFixed(1);
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [target]);

    return (
        <div className="w-full">
            <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-semibold text-gray-300">{label}</span>
                <div className="flex gap-4 font-mono text-lg">
                    <span ref={textRef}>0.0</span>
                    <span className="text-gray-500">{target.toFixed(1)}</span>
                </div>
            </div>
            <div className="w-full h-8 bg-black border border-gray-700 p-1">
                <div 
                    ref={barRef}
                    className="h-full bg-[var(--theme-accent-primary)]" 
                    style={{ width: '0%' }}
                ></div>
            </div>
        </div>
    );
};

export default BarMeter;
