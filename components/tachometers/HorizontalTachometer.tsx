import React from 'react';
import { motion, useTransform } from 'motion/react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface HorizontalTachometerProps {
  rpm: number;
}

const RPM_MAX = 8000;
const REDLINE_START = 6500;
const NUM_SEGMENTS = 80;

const HorizontalTachometer: React.FC<HorizontalTachometerProps> = React.memo(({ rpm }) => {
  const animatedRpm = useAnimatedValue(rpm);
  
  const rpmForDisplay = useTransform(animatedRpm, (v: number) => Math.floor(v));
  const activeSegments = useTransform(animatedRpm, (v: number) => Math.round((v / RPM_MAX) * NUM_SEGMENTS));
  const textRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const unsubscribe = rpmForDisplay.on("change", (latest) => {
      if (textRef.current) textRef.current.textContent = latest.toString();
    });
    return () => unsubscribe();
  }, [rpmForDisplay]);

  const segments = Array.from({ length: NUM_SEGMENTS }, (_, i) => {
    const segmentRpm = (i + 1) * (RPM_MAX / NUM_SEGMENTS);
    const isRedline = segmentRpm > REDLINE_START;
    
    // We use a custom transform for each segment to avoid re-rendering the whole list
    const opacity = useTransform(activeSegments, (active: number) => i < active ? 1 : 0.2);
    
    let colorClass = 'bg-[var(--theme-accent-primary)]';
    if (segmentRpm > REDLINE_START) {
        colorClass = 'bg-[var(--theme-accent-red)] shadow-[0_0_6px_var(--theme-accent-red)]';
    } else if (segmentRpm > 4500) {
        colorClass = 'bg-[var(--theme-accent-secondary)]';
    }

    return (
      <motion.div 
        key={i} 
        style={{ opacity }}
        className={`h-10 flex-1 transition-colors duration-75 ${colorClass}`} 
      />
    );
  });

  return (
    <div className="w-full flex flex-col items-center gap-2">
        <div className="flex justify-between w-full px-2 text-sm font-mono text-gray-400">
            <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8k</span>
        </div>
        <div className="w-full flex gap-[2px] p-1 bg-black/50 border-2 border-gray-800/50 rounded-md">
            {segments}
        </div>
        <div className="mt-2 text-5xl font-display text-white">
            <span ref={textRef}>{rpmForDisplay.get()}</span> <span className="text-xl text-gray-400">RPM</span>
        </div>
    </div>
  );
});


export default HorizontalTachometer;