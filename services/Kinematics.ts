
/**
 * Kinematics Logic for Derived State Estimation
 */
export interface GearboxConfig {
    ratios: number[];
    finalDrive: number;
    tireCircumference: number; // Meters
}

export const DEFAULT_GEARBOX: GearboxConfig = {
    // Jatco 7-speed (JR710E/JR711E) as found in Infiniti G25/G37/370Z
    // [N, 1, 2, 3, 4, 5, 6, 7]
    ratios: [0, 4.923, 3.193, 2.042, 1.411, 1.000, 0.862, 0.771], 
    finalDrive: 3.357, // Standard G25/G37 final drive
    tireCircumference: 2.13 // 245/40R19 standard circumference
};

export class KinematicsEngine {
    /**
     * Dynamic Bicycle Model Observer
     * Estimates lateral velocity and slip angle based on vehicle parameters.
     */
    public static estimateLateralDynamics(
        speedMs: number, 
        yawRate: number, 
        steerAngleRad: number,
        dt: number,
        prevLatVel: number = 0
    ): { lateralVelocity: number, slipAngleDeg: number } {
        if (speedMs < 1.0) return { lateralVelocity: 0, slipAngleDeg: 0 };

        // Vehicle Parameters (Generic Performance Sedan)
        const mass = 1500; // kg
        const lf = 1.2; // m (distance to front axle)
        const lr = 1.4; // m (distance to rear axle)
        const Cf = 80000; // N/rad (front cornering stiffness)
        const Cr = 120000; // N/rad (rear cornering stiffness)
        const Iz = 2500; // kg*m^2 (yaw inertia)

        // 1. Calculate tire slip angles
        const alphaF = steerAngleRad - (prevLatVel + lf * yawRate) / speedMs;
        const alphaR = (lr * yawRate - prevLatVel) / speedMs;

        // 2. Calculate lateral forces (linear region)
        const FyF = Cf * alphaF;
        const FyR = Cr * alphaR;

        // 3. Calculate lateral acceleration
        // a_lat = (FyF + FyR) / mass - speedMs * yawRate
        const latAcc = (FyF + FyR) / mass - speedMs * yawRate;

        // 4. Integrate lateral velocity
        const lateralVelocity = prevLatVel + latAcc * dt;

        // 5. Calculate body slip angle
        const slipAngleRad = Math.atan2(lateralVelocity, speedMs);

        return {
            lateralVelocity,
            slipAngleDeg: slipAngleRad * (180 / Math.PI)
        };
    }

    /**
     * Derives Engine RPM from Vehicle Speed (km/h)
     */
    public static calculateRpm(speedKph: number, gear: number, config: GearboxConfig = DEFAULT_GEARBOX): number {
        if (gear === 0 || speedKph < 0.5) return 850; // Idle fallback
        
        const ratio = config.ratios[gear];
        if (!ratio) return 850;

        // Speed in m/min
        const metersPerMin = (speedKph * 1000) / 60;
        
        // Wheel RPM
        const wheelRpm = metersPerMin / config.tireCircumference;
        
        // Engine RPM
        const engineRpm = wheelRpm * ratio * config.finalDrive;
        
        return Math.max(850, engineRpm);
    }

    /**
     * Estimates current gear based on RPM/Speed ratio (Clutch-out detection)
     * Includes Hysteresis to prevent "hunting" between gears on the limit.
     */
    private static lastEstimatedGear = 1;
    private static gearConfidence = 0;

    public static estimateGear(speedKph: number, rpm: number, config: GearboxConfig = DEFAULT_GEARBOX): number {
        // Neutral Detection: If we are stationary or RPM is disproportionate to speed (clutch in/neutral)
        if (speedKph < 2) return 0; // Neutral at stop
        
        const metersPerMin = (speedKph * 1000) / 60;
        const wheelRpm = metersPerMin / config.tireCircumference;
        if (wheelRpm < 1) return 0;

        const currentTotalRatio = rpm / wheelRpm;
        
        // Neutral/Clutch Check: If RPM is near idle but we have speed, or if ratio is out of bounds
        const lowestRatio = config.ratios[config.ratios.length - 1] * config.finalDrive * 0.7;
        const highestRatio = config.ratios[1] * config.finalDrive * 1.3;
        
        if (currentTotalRatio < lowestRatio || currentTotalRatio > highestRatio) {
            // Probably in neutral or clutch depressed
            if (rpm < 1200) return 0;
        }

        let bestGear = 1;
        let minError = Infinity;

        for (let i = 1; i < config.ratios.length; i++) {
            const expectedRatio = config.ratios[i] * config.finalDrive;
            // Apply stronger bias towards current gear to prevent flickering (Elite Hysteresis)
            const bias = (i === this.lastEstimatedGear) ? 0.75 : 1.0;
            const error = Math.abs(currentTotalRatio - expectedRatio) * bias;
            
            if (error < minError) {
                minError = error;
                bestGear = i;
            }
        }

        // Confidence filtering: require more consistent samples before shifting (10 samples @ 60Hz = 166ms)
        if (bestGear !== this.lastEstimatedGear) {
            this.gearConfidence++;
            if (this.gearConfidence > 10) {
                this.lastEstimatedGear = bestGear;
                this.gearConfidence = 0;
            }
        } else {
            this.gearConfidence = Math.max(0, this.gearConfidence - 1);
        }

        return this.lastEstimatedGear;
    }

    /**
     * Calculates SAE J1349 Correction Factor
     * Based on ambient conditions to normalize power readings.
     */
    public static calculateCorrectionFactor(ambientTempC: number, pressureHpa: number, humidity: number = 0): number {
        // SAE J1349 standard conditions: 25°C, 990 hPa (dry pressure)
        const standardTempK = 298.15;
        const currentTempK = ambientTempC + 273.15;
        const p_ratio = 990 / pressureHpa;
        const t_ratio = currentTempK / standardTempK;
        
        // Simple approximation of SAE correction
        const cf = 1.18 * (p_ratio * Math.sqrt(t_ratio)) - 0.18;
        return Math.max(0.8, Math.min(1.2, cf));
    }

    /**
     * Estimates wheel horsepower based on acceleration and mass.
     */
    public static estimateHorsepower(
        speedKph: number, 
        accelG: number, 
        weightKg: number, 
        correctionFactor: number = 1.0,
        drivetrainLoss: number = 0 // e.g. 0.15 for 15% loss
    ): { whp: number, crankHp: number } {
        if (speedKph < 5 || accelG <= 0) return { whp: 0, crankHp: 0 };
        const speedMs = speedKph / 3.6;
        const accelMs2 = accelG * 9.81;
        
        // F = m * a
        const accelForce = weightKg * accelMs2;
        
        // Aero drag approximation (1/2 * rho * Cd * A * v^2)
        const aeroDragForce = 0.5 * 1.225 * 0.3 * 2.2 * Math.pow(speedMs, 2);
        
        // Rolling resistance (m * g * Crr)
        const rollingForce = weightKg * 9.81 * 0.015;
        
        const totalForce = accelForce + aeroDragForce + rollingForce;
        const powerWatts = totalForce * speedMs;
        const whpRaw = powerWatts / 745.7; // 1 HP = 745.7 W
        
        const whpCorrected = whpRaw * correctionFactor;
        const crankHp = whpCorrected / (1 - drivetrainLoss);
        
        return { 
            whp: whpCorrected, 
            crankHp 
        };
    }

    /**
     * Estimates engine torque based on horsepower and RPM.
     */
    public static estimateTorque(hp: number, rpm: number): number {
        if (rpm < 500) return 0;
        // Torque = (HP * 5252) / RPM (Lbs-Ft)
        const torqueLbsFt = (hp * 5252) / rpm;
        const torqueNm = torqueLbsFt * 1.3558179483;
        return torqueNm;
    }
}
