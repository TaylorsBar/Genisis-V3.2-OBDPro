import React from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { motion, useTransform } from 'motion/react';
import HaltechGauge from '../components/tachometers/HaltechGauge';

const DigitalReadout: React.FC<{ label: string; value: any; unit: string; fixed?: number }> = ({ label, value, unit, fixed = 1 }) => {
    const displayValue = useTransform(value, (v: number) => v.toFixed(fixed));
    const textRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const unsubscribe = displayValue.on("change", (latest) => {
            if (textRef.current) textRef.current.textContent = latest;
        });
        return () => unsubscribe();
    }, [displayValue]);
    
    return (
        <div className="bg-[var(--theme-haltech-dark-gray)] p-2 rounded-md text-center border border-[var(--theme-haltech-light-gray)]">
            <div className="text-sm font-sans text-[var(--theme-text-secondary)] uppercase">{label}</div>
            <div ref={textRef} className="font-mono text-3xl font-bold text-white tracking-wider">{displayValue.get()}</div>
            <div className="text-xs text-[var(--theme-text-secondary)]">{unit}</div>
        </div>
    );
};

const LiveTuning: React.FC = () => {
    const [latestData, setLatestData] = React.useState<any>({
        rpm: 0, speed: 0, turboBoost: 0, oilPressure: 0, fuelPressure: 0, engineTemp: 0, inletAirTemp: 0, batteryVoltage: 0
    });

    React.useEffect(() => {
        let rafId: number;
        let frameCount = 0;
        const loop = () => {
            frameCount++;
            if (frameCount % 3 === 0) { // 20Hz update rate
                const state = useVehicleStore.getState();
                setLatestData(state.latestData);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);
    
    // Animated values for smoother display
    const oilPressure = useAnimatedValue(latestData.oilPressure);
    const fuelPressure = useAnimatedValue(latestData.fuelPressure);
    const engineTemp = useAnimatedValue(latestData.engineTemp);
    const inletAirTemp = useAnimatedValue(latestData.inletAirTemp);
    const batteryVoltage = useAnimatedValue(latestData.batteryVoltage);

    return (
        <div className="flex flex-col h-full w-full bg-[var(--theme-bg)] p-4 gap-4 theme-background items-center justify-center">
            <div className="w-full max-w-7xl flex items-center justify-center gap-4">
                <HaltechGauge
                    value={latestData.turboBoost}
                    min={-1}
                    max={2}
                    redlineStart={1.5}
                    label="MAP"
                    unit="bar"
                    size="small"
                />
                <HaltechGauge
                    value={latestData.rpm}
                    min={0}
                    max={8000}
                    redlineStart={7000}
                    label="RPM"
                    size="large"
                />
                <HaltechGauge
                    value={latestData.speed}
                    min={0}
                    max={240}
                    redlineStart={200}
                    label="SPEED"
                    unit="km/h"
                    size="small"
                />
            </div>
            <div className="w-full max-w-7xl grid grid-cols-5 gap-4 mt-4">
                <DigitalReadout label="Oil Pressure" value={oilPressure} unit="bar" fixed={1} />
                <DigitalReadout label="Fuel Pressure" value={fuelPressure} unit="bar" fixed={1} />
                <DigitalReadout label="Coolant Temp" value={engineTemp} unit="°C" fixed={0} />
                <DigitalReadout label="Air Temp" value={inletAirTemp} unit="°C" fixed={0} />
                <DigitalReadout label="Battery" value={batteryVoltage} unit="V" fixed={1} />
            </div>
        </div>
    );
};

export default LiveTuning;