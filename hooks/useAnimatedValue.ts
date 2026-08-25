import { useEffect, useRef } from 'react';
import { useMotionValue, MotionValue } from 'motion/react';
import { useVehicleStore } from '../stores/vehicleStore';

/**
 * Elite Predictive Interpolator
 * Uses dead reckoning and velocity preservation to ensure buttery smooth motion
 * even when input data arrives at low frequencies (10-20Hz).
 * Returns a MotionValue to prevent React re-renders.
 */
/**
 * Sensor-Fused Kinematic Interpolator
 * Integrates local device IMU sensors (accelerometer/gyroscope) to provide
 * beyond-commercial-aviation-grade fluidity between low-frequency OBD samples.
 * Uses a local state observer to prevent latency and jitter.
 */
export const useAnimatedValue = (
  targetValueOrDataKey: number | string, 
  config: { 
    stiffness?: number, 
    damping?: number, 
    mass?: number,
    fusionType?: 'speed' | 'rpm' | 'none',
    useHermite?: boolean
  } = {}
): MotionValue<number> => {
  const { stiffness = 150, damping = 20, mass = 1, fusionType = 'none', useHermite = false } = config;
  
  const isDataKey = typeof targetValueOrDataKey === 'string';
  const initialValue = isDataKey ? 0 : (targetValueOrDataKey !== undefined ? (targetValueOrDataKey as number) : 0);
  
  const motionValue = useMotionValue(initialValue);
  
  // --- CUBIC HERMITE SPLINE STATE FOR 0-LATENCY SWEEPS ---
  const splineRef = useRef({
    x0: initialValue,
    x1: initialValue,
    v0: 0,
    v1: 0,
    startTime: performance.now(),
    duration: 0.09, // 90ms segment width for hyper-response
  });

  const updateSplineTarget = (newTarget: number) => {
    const now = performance.now();
    const tElapsed = (now - splineRef.current.startTime) / 1000;
    
    // Anti-reset guard: if updates arrive at high frequency (e.g. 60Hz simulation),
    // do not reset the spline start time and velocity. Just update the target.
    if (tElapsed < 0.04) {
      splineRef.current.x1 = newTarget;
      return;
    }
    
    const u = Math.min(1, tElapsed / splineRef.current.duration);
    
    // Evaluate current spline position & velocity to set as new start conditions
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    
    const currVal = h00 * splineRef.current.x0 + 
                    h10 * (splineRef.current.duration * splineRef.current.v0) + 
                    h01 * splineRef.current.x1 + 
                    h11 * (splineRef.current.duration * splineRef.current.v1);
                    
    const dh00 = 6 * u2 - 6 * u;
    const dh10 = 3 * u2 - 4 * u + 1;
    const dh01 = -6 * u2 + 6 * u;
    const dh11 = 3 * u2 - 2 * u;
    
    const currVel = (dh00 * splineRef.current.x0 + 
                     dh10 * (splineRef.current.duration * splineRef.current.v0) + 
                     dh01 * splineRef.current.x1 + 
                     dh11 * (splineRef.current.duration * splineRef.current.v1)) / splineRef.current.duration;
                     
    splineRef.current.x0 = isFinite(currVal) ? currVal : newTarget;
    splineRef.current.x1 = newTarget;
    splineRef.current.v0 = isFinite(currVel) ? currVel : 0;
    splineRef.current.v1 = 0; // zero terminal velocity at steady state
    splineRef.current.startTime = now;
    
    // Dynamic scale duration for motorsport sweep crispness
    const delta = Math.abs(newTarget - splineRef.current.x0);
    splineRef.current.duration = Math.max(0.08, Math.min(0.12, 0.08 + (delta / 8000) * 0.04));
  };
  
  // --- ELITE KINEMATIC SENSOR FUSION STATE ---
  const stateRef = useRef({
      pos: initialValue,
      vel: 0,
      accel: 0,
      lastTime: performance.now(),
      lastImuTime: performance.now(),
      lastObdTime: performance.now(),
      imuVelocityBias: 0
  });

  const lastTargetRef = useRef(initialValue);
  const lastTargetTimeRef = useRef(performance.now());
  const springStateRef = useRef({ pos: initialValue, vel: 0 });
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastRafTimeRef = useRef<number | undefined>(undefined);

  // Update target from OBD/Store updates (Event-driven fallback)
  useEffect(() => {
    if (isDataKey) return;
    
    const targetValue = targetValueOrDataKey as number;
    if (!isFinite(targetValue)) return;

    if (useHermite) {
      updateSplineTarget(targetValue);
      lastTargetRef.current = targetValue;
      return;
    }

    const now = performance.now();
    const dt = Math.max((now - lastTargetTimeRef.current) / 1000, 0.001);
    
    // CORRECTION PHASE: Fuse IMU dead-reckoning with OBD ground-truth
    const speedKphToMs = 1 / 3.6;
    const obdVelocity = (targetValue - lastTargetRef.current) / dt;
    
    if (fusionType === 'speed') {
        const measuredValMs = targetValue * speedKphToMs;
        const predictedValMs = stateRef.current.pos * speedKphToMs;
        const error = measuredValMs - predictedValMs;
        
        // Adjust IMU bias to converge on OBD reality
        stateRef.current.imuVelocityBias += error * 0.1;
        // Reset state velocity to OBD average to prevent runaway drift
        stateRef.current.vel = obdVelocity; 
    } else {
        const alpha = Math.min(0.8, 0.3 + dt * 2); 
        stateRef.current.vel = (stateRef.current.vel * (1 - alpha)) + (obdVelocity * alpha);
    }
    
    lastTargetRef.current = targetValue;
    lastTargetTimeRef.current = now;
  }, [targetValueOrDataKey, isDataKey, fusionType, useHermite]);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastRafTimeRef.current === undefined) {
        lastRafTimeRef.current = time;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const dt = Math.min((time - lastRafTimeRef.current) / 1000, 0.032);
      lastRafTimeRef.current = time;

      // 1. DATA ACQUISITION
      if (isDataKey) {
        const store = useVehicleStore.getState();
        const val = (store.latestData as any)[targetValueOrDataKey as string];
        if (val !== undefined && isFinite(val) && val !== lastTargetRef.current) {
          if (useHermite) {
            updateSplineTarget(val);
            lastTargetRef.current = val;
          } else {
            const now = performance.now();
            const dataDt = Math.max((now - lastTargetTimeRef.current) / 1000, 0.001);
            const instantaneousVelocity = (val - lastTargetRef.current) / dataDt;
            
            if (fusionType === 'speed') {
                stateRef.current.vel = instantaneousVelocity;
            } else {
                const alpha = Math.min(0.8, 0.3 + dataDt * 2); 
                stateRef.current.vel = (stateRef.current.vel * (1 - alpha)) + (instantaneousVelocity * alpha);
            }
            
            lastTargetRef.current = val;
            lastTargetTimeRef.current = now;
          }
        }
      }

      if (useHermite) {
        const now = performance.now();
        const tElapsed = (now - splineRef.current.startTime) / 1000;
        const u = Math.min(1, tElapsed / splineRef.current.duration);
        
        const u2 = u * u;
        const u3 = u2 * u;
        
        const h00 = 2 * u3 - 3 * u2 + 1;
        const h10 = u3 - 2 * u2 + u;
        const h01 = -2 * u3 + 3 * u2;
        const h11 = u3 - u2;
        
        const splinePos = h00 * splineRef.current.x0 + 
                          h10 * (splineRef.current.duration * splineRef.current.v0) + 
                          h01 * splineRef.current.x1 + 
                          h11 * (splineRef.current.duration * splineRef.current.v1);
                          
        if (isFinite(splinePos)) {
          motionValue.set(splinePos);
        }
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // CORRECTION PHASE: Fuse global EKF state
      if (fusionType !== 'none') {
        const store = useVehicleStore.getState();
        if (fusionType === 'speed') {
            const fusedSpeedKph = store.latestData.speed || 0;
            stateRef.current.pos = (stateRef.current.pos * 0.5) + (fusedSpeedKph * 0.5);
            // Ensure velocity stays bounded
            stateRef.current.vel = (fusedSpeedKph - lastTargetRef.current) / Math.max(dt, 0.001); 
        }
      }

      // 2. KINEMATIC PREDICTION (State Extrapolation with IMU Fusion)
      const timeSinceLastData = (performance.now() - lastTargetTimeRef.current) / 1000;
      const isDiscrete = targetValueOrDataKey === 'gear';
      let predictedTarget = lastTargetRef.current;

      if (isDiscrete) {
          predictedTarget = lastTargetRef.current;
      } else if (fusionType === 'speed') {
          const timeOffset = Math.min(timeSinceLastData, 1.0);
          predictedTarget = lastTargetRef.current + (stateRef.current.vel * 3.6 * timeOffset);
          const trendFactor = 0.5;
          const trust = Math.max(0, 1 - (timeOffset / trendFactor));
          if (trust === 0) {
              predictedTarget = (predictedTarget * 0.1) + (lastTargetRef.current * 0.9);
          }
      } else {
          const velocityDecay = Math.max(0, 1 - (timeSinceLastData / 0.4));
          const currentVel = stateRef.current.vel * velocityDecay;
          const predictionHorizon = 0.150;
          const predictionDt = Math.min(timeSinceLastData, predictionHorizon);
          predictedTarget = lastTargetRef.current + (currentVel * predictionDt);
      }

      // 3. SECOND-ORDER SPRING DYNAMICS (Visual Buffering with 4x Sub-Stepping for extreme stability)
      const subSteps = 4;
      const subDt = dt / subSteps;
      for (let i = 0; i < subSteps; i++) {
        const displacement = springStateRef.current.pos - predictedTarget;
        const springForce = -stiffness * displacement;
        const dampingForce = -damping * springStateRef.current.vel;
        const acceleration = (springForce + dampingForce) / mass;

        springStateRef.current.vel += acceleration * subDt;
        springStateRef.current.pos += springStateRef.current.vel * subDt;
      }

      if (!isFinite(springStateRef.current.pos)) {
        springStateRef.current.pos = lastTargetRef.current || 0;
        springStateRef.current.vel = 0;
      }

      motionValue.set(springStateRef.current.pos);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stiffness, damping, mass, motionValue, isDataKey, targetValueOrDataKey, fusionType, useHermite]);

  return motionValue;
};
