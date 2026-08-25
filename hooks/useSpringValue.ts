
import { useRef, useEffect } from 'react';

interface SpringConfig {
    stiffness: number;
    damping: number;
    mass: number;
}

const DEFAULT_CONFIG: SpringConfig = {
    stiffness: 80,
    damping: 22,
    mass: 1.2
};

/**
 * Hook that manages a value using "Elite Predictive Spring" physics.
 * Uses dead reckoning (velocity prediction) to interpolate between low-frequency data points (10-20Hz)
 * while maintaining 60fps+ visual fidelity.
 */
export const useSpringValue = (targetValue: number, config = DEFAULT_CONFIG) => {
    const initialValue = targetValue !== undefined ? targetValue : 0;
    const valueRef = useRef(initialValue);
    const velocityRef = useRef(0);
    
    // Predictive State
    const lastTargetRef = useRef(initialValue);
    const lastTargetTimeRef = useRef(performance.now());
    const inputVelocityRef = useRef(0);
    
    const targetRef = useRef(initialValue);
    const lastTimeRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    // Update target and calculate input velocity for dead reckoning
    useEffect(() => {
        const now = performance.now();
        const dt = Math.max((now - lastTargetTimeRef.current) / 1000, 0.001);
        
        if (isFinite(targetValue)) {
            // Calculate instantaneous velocity of the incoming data stream
            const instantaneousVelocity = (targetValue - lastTargetRef.current) / dt;
            
            // Apply a predictive filter to smooth the incoming velocity
            const smoothingFactor = 0.6;
            inputVelocityRef.current = (inputVelocityRef.current * (1 - smoothingFactor)) + (instantaneousVelocity * smoothingFactor);
            
            // Clamp to realistic vehicle dynamics
            inputVelocityRef.current = Math.max(-30000, Math.min(30000, inputVelocityRef.current));
            
            lastTargetRef.current = targetValue;
            lastTargetTimeRef.current = now;
            targetRef.current = targetValue;
        }
    }, [targetValue]);

    // Store config in a ref
    const configRef = useRef(config);
    useEffect(() => {
        configRef.current = config;
    }, [config.stiffness, config.damping, config.mass]);

    useEffect(() => {
        const loop = (time: number) => {
            if (lastTimeRef.current === null) {
                lastTimeRef.current = time;
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1); 
            lastTimeRef.current = time;

            // --- AVIATION-GRADE PREDICTIVE INTERPOLATION ---
            const timeSinceLastData = (performance.now() - lastTargetTimeRef.current) / 1000;
            
            // If data stops arriving (e.g., disconnected or at rest), decay the input velocity to zero
            if (timeSinceLastData > 0.15) {
                inputVelocityRef.current *= 0.9;
            }

            const predictionHorizon = 0.15;
            const predictionDt = Math.min(timeSinceLastData, predictionHorizon);
            
            const predictedTarget = lastTargetRef.current + (inputVelocityRef.current * predictionDt);

            // --- SPRING PHYSICS & SUB-STEPPED NUMERICAL INTEGRATION ---
            const currentConfig = configRef.current;
            const subSteps = 4;
            const subDt = dt / subSteps;

            for (let step = 0; step < subSteps; step++) {
                const springForce = -currentConfig.stiffness * (valueRef.current - predictedTarget);
                const dampingForce = -currentConfig.damping * velocityRef.current;
                const acceleration = (springForce + dampingForce) / currentConfig.mass;

                // Numerical Integration (Euler-Cromer)
                velocityRef.current += acceleration * subDt;
                
                // Clamp velocity to prevent "explosions"
                velocityRef.current = Math.max(-50000, Math.min(50000, velocityRef.current));
                
                valueRef.current += velocityRef.current * subDt;
            }

            // Final safety check for value and velocity
            if (!isFinite(valueRef.current)) {
                console.error("useSpringValue NaN detected!", {
                    targetValue,
                    lastTarget: lastTargetRef.current,
                    velocity: velocityRef.current,
                    inputVelocity: inputVelocityRef.current,
                    predictedTarget,
                    dt,
                    time,
                    lastTime: lastTimeRef.current
                });
                valueRef.current = lastTargetRef.current || 0;
                velocityRef.current = 0;
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []); 

    return valueRef;
};
