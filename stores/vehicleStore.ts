
import { create } from 'zustand';
import { SensorDataPoint, ObdConnectionState, DynoRun, DynoPoint, DiagnosticCode, EmissionsReadiness } from '../types';
import { ObdService } from '../services/ObdService';
import { GenesisEKFUltimate } from '../services/GenesisEKFUltimate';
import { VisualOdometryResult } from '../services/VisionGroundTruth';

// --- Constants ---
const UPDATE_INTERVAL_MS = 50; // 20Hz Update Loop for Physics/UI
const MAX_DATA_POINTS = 200;
const RPM_IDLE = 800;
const RPM_MAX = 8000;
const SPEED_MAX = 280;
const GEAR_RATIOS = [0, 3.6, 2.1, 1.4, 1.0, 0.8, 0.6];
const DEFAULT_LAT = -37.88;
const DEFAULT_LON = 175.55;

// --- Helper Functions ---
const generateInitialData = (): SensorDataPoint[] => {
  const data: SensorDataPoint[] = [];
  const now = Date.now();
  for (let i = MAX_DATA_POINTS; i > 0; i--) {
    data.push({
      time: now - i * UPDATE_INTERVAL_MS,
      rpm: RPM_IDLE,
      speed: 0,
      gear: 1,
      fuelUsed: 19.4,
      inletAirTemp: 25.0,
      batteryVoltage: 12.7,
      engineTemp: 90.0,
      fuelTemp: 20.0,
      turboBoost: -0.8,
      fuelPressure: 3.5,
      oilPressure: 1.5,
      shortTermFuelTrim: 0,
      longTermFuelTrim: 1.5,
      o2SensorVoltage: 0.45,
      engineLoad: 15,
      distance: 0,
      gForceX: 0,
      gForceY: 0,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LON,
      source: 'sim',
      maf: 3.5,
      timingAdvance: 10,
      throttlePos: 15,
      fuelLevel: 75,
      barometricPressure: 101.3,
      ambientTemp: 22,
      fuelRailPressure: 3500,
      lambda: 1.0,
      wheelSpeedFL: 0,
      wheelSpeedFR: 0,
      wheelSpeedRL: 0,
      wheelSpeedRR: 0
    });
  }
  return data;
};

// Generate a default 16x16 VE Table
const generateBaseMap = (): number[][] => {
    const map: number[][] = [];
    for (let loadIdx = 0; loadIdx < 16; loadIdx++) {
        const row: number[] = [];
        const load = loadIdx * (100/15);
        for (let rpmIdx = 0; rpmIdx < 16; rpmIdx++) {
            const rpm = rpmIdx * (8000/15);
            const rpmNorm = rpm / 8000;
            const loadNorm = load / 100;
            let ve = 40 + (loadNorm * 20); 
            ve += Math.sin(rpmNorm * Math.PI) * 40; 
            ve += (Math.random() * 2 - 1); 
            row.push(Math.max(0, Math.min(120, ve)));
        }
        map.push(row);
    }
    return map;
};

// --- Module-Level State (Physics & Services) ---
enum SimState { IDLE, ACCELERATING, CRUISING, BRAKING, CORNERING }
let currentSimState = SimState.IDLE;
let simStateTimeout = 0;
let lastUpdateTime = Date.now();

// Singletons
const ekf = new GenesisEKFUltimate();
let obdService: ObdService | null = null;
let simulationInterval: any = null;
let gpsWatchId: number | null = null;
let gpsLatest: { speed: number | null, accuracy: number, latitude: number, longitude: number } | null = null;

// Real-time OBD Data Cache
let isObdPolling = false;
let obdCache = {
    rpm: 0,
    speed: 0,
    coolant: 0,
    intake: 0,
    load: 0,
    map: 0, // kPa
    voltage: 0,
    maf: 0,
    timing: 0,
    throttle: 0,
    fuelLevel: 0,
    baro: 0,
    ambient: 0,
    fuelRail: 0,
    lambda: 0,
    wheels: { fl: 0, fr: 0, rl: 0, rr: 0 },
    lastUpdate: 0
};

const s = (val: any, fallback = 0): number => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed)) return parsed;
    return fallback;
};

interface TuningState {
    veTable: number[][];
    ignitionTable: number[][];
    boostTarget: number;
    globalFuelTrim: number;
}

interface DynoState {
    isRunning: boolean;
    currentRunData: DynoPoint[];
    runs: DynoRun[];
}

interface VehicleStoreState {
  data: SensorDataPoint[];
  latestData: SensorDataPoint;
  hasActiveFault: boolean;
  obdState: ObdConnectionState;
  ekfStats: {
    visionConfidence: number;
    gpsActive: boolean;
    fusionUncertainty: number;
  };
  
  dtcs: DiagnosticCode[];
  readiness: EmissionsReadiness | null;
  isScanning: boolean;
  
  tuning: TuningState;
  dyno: DynoState;

  startSimulation: () => void;
  stopSimulation: () => void;
  connectObd: () => Promise<void>;
  disconnectObd: () => void;
  
  scanVehicle: () => Promise<void>;
  clearVehicleFaults: () => Promise<void>;
  
  processVisionFrame: (imageData: ImageData) => VisualOdometryResult;
  updateMapCell: (table: 've' | 'ign', row: number, col: number, value: number) => void;
  smoothMap: (table: 've' | 'ign') => void;
  startDynoRun: () => void;
  stopDynoRun: () => void;
  toggleDynoRunVisibility: (id: string) => void;
  deleteDynoRun: (id: string) => void;
}

// --- Weighted OBD Polling Loop ---
const startObdPolling = async () => {
    isObdPolling = true;
    let loopCount = 0;

    while (isObdPolling && obdService) {
        try {
            // Priority 1: High Frequency (Every Loop)
            // These are critical for the gauge cluster fluidity
            const rpmRaw = await obdService.runCommand("010C");
            const speedRaw = await obdService.runCommand("010D");
            const throttleRaw = await obdService.runCommand("0111"); 
            const mapRaw = await obdService.runCommand("010B"); 

            if (rpmRaw) obdCache.rpm = s(obdService.parseRpm(rpmRaw));
            if (speedRaw) obdCache.speed = s(obdService.parseSpeed(speedRaw));
            if (throttleRaw) obdCache.throttle = s(obdService.parseThrottlePos(throttleRaw));
            if (mapRaw) obdCache.map = s(obdService.parseMap(mapRaw));

            // Priority 2: Medium Frequency (Every 5 Loops ~ 500-1000ms)
            if (loopCount % 5 === 0) {
                const tempRaw = await obdService.runCommand("0105");
                if (tempRaw) obdCache.coolant = s(obdService.parseCoolant(tempRaw));
                
                const loadRaw = await obdService.runCommand("0104");
                if (loadRaw) obdCache.load = s(obdService.parseLoad(loadRaw));

                const lambdaRaw = await obdService.runCommand("0144");
                if (lambdaRaw) obdCache.lambda = s(obdService.parseLambda(lambdaRaw));

                // Wheel Speeds (Generic PID 2104 placeholder for CAN ABS data)
                const wheelRaw = await obdService.runCommand("2104");
                if (wheelRaw) {
                    const wheels = obdService.parseWheelSpeeds(wheelRaw);
                    if (wheels) obdCache.wheels = wheels;
                }
            }

            // Priority 3: Low Frequency (Every 15 Loops ~ 2-3s)
            if (loopCount % 15 === 0) {
                const voltRaw = await obdService.runCommand("AT RV");
                if (voltRaw) obdCache.voltage = s(obdService.parseVoltage(voltRaw));

                const intakeRaw = await obdService.runCommand("010F");
                if (intakeRaw) obdCache.intake = s(obdService.parseIntakeTemp(intakeRaw));
                
                const fuelLvlRaw = await obdService.runCommand("012F");
                if (fuelLvlRaw) obdCache.fuelLevel = s(obdService.parseFuelLevel(fuelLvlRaw));
                
                const baroRaw = await obdService.runCommand("0133");
                if (baroRaw) obdCache.baro = s(obdService.parseBarometricPressure(baroRaw));
                
                const railRaw = await obdService.runCommand("0123");
                if (railRaw) obdCache.fuelRail = s(obdService.parseFuelRailPressure(railRaw));
                
                const timingRaw = await obdService.runCommand("010E");
                if (timingRaw) obdCache.timing = s(obdService.parseTimingAdvance(timingRaw));
                
                const mafRaw = await obdService.runCommand("0110");
                if (mafRaw) obdCache.maf = s(obdService.parseMaf(mafRaw));
                
                const ambRaw = await obdService.runCommand("0146");
                if (ambRaw) obdCache.ambient = s(obdService.parseAmbientTemp(ambRaw));
            }

            obdCache.lastUpdate = Date.now();
            loopCount++;
            if (loopCount > 1000) loopCount = 0;

            // Wait 50ms to let the bus breathe. This is critical for cheaper ELM327 clones.
            await new Promise(r => setTimeout(r, 50));

        } catch (e) {
            console.warn("OBD Poll Error", e);
            // If error, back off significantly to allow recovery
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};

let lastVisionUpdate = 0;

export const useVehicleStore = create<VehicleStoreState>((set, get) => ({
  data: generateInitialData(),
  latestData: generateInitialData()[generateInitialData().length - 1],
  hasActiveFault: false,
  obdState: ObdConnectionState.Disconnected,
  ekfStats: { visionConfidence: 0, gpsActive: false, fusionUncertainty: 0 },
  
  dtcs: [],
  readiness: null,
  isScanning: false,

  tuning: {
      veTable: generateBaseMap(),
      ignitionTable: generateBaseMap(), 
      boostTarget: 18.0,
      globalFuelTrim: 0,
  },
  
  dyno: {
      isRunning: false,
      currentRunData: [],
      runs: [],
  },

  processVisionFrame: (imageData: ImageData) => {
      const now = Date.now();
      let dt = (now - lastVisionUpdate) / 1000;
      if (dt <= 0 || dt > 1.0) dt = 0.05; 
      lastVisionUpdate = now;

      const result = ekf.processCameraFrame(imageData, dt);
      
      set(state => ({
          ekfStats: { ...state.ekfStats, visionConfidence: result.confidence }
      }));

      return result;
  },

  updateMapCell: (table, row, col, value) => {
      set(state => {
          const newMap = table === 've' ? [...state.tuning.veTable] : [...state.tuning.ignitionTable];
          newMap[row] = [...newMap[row]]; 
          newMap[row][col] = s(value);
          return {
              tuning: {
                  ...state.tuning,
                  [table === 've' ? 'veTable' : 'ignitionTable']: newMap
              }
          };
      });
  },

  smoothMap: (table) => {
      set(state => {
           const map = table === 've' ? state.tuning.veTable : state.tuning.ignitionTable;
           const newMap = map.map((row, r) => row.map((val, c) => {
               let sum = val;
               let count = 1;
               if (r>0) { sum += map[r-1][c]; count++; }
               if (r<15) { sum += map[r+1][c]; count++; }
               if (c>0) { sum += map[r][c-1]; count++; }
               if (c<15) { sum += map[r][c+1]; count++; }
               return sum / count;
           }));
           return {
               tuning: {
                   ...state.tuning,
                   [table === 've' ? 'veTable' : 'ignitionTable']: newMap
               }
           }
      });
  },
  
  startDynoRun: () => {
      set(state => ({
          dyno: { ...state.dyno, isRunning: true, currentRunData: [] }
      }));
  },
  
  stopDynoRun: () => {
      set(state => {
          if (!state.dyno.isRunning) return state;
          
          const newRun: DynoRun = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              name: `Run ${state.dyno.runs.length + 1}`,
              data: state.dyno.currentRunData,
              peakPower: Math.max(...state.dyno.currentRunData.map(p => p.power), 0),
              peakTorque: Math.max(...state.dyno.currentRunData.map(p => p.torque), 0),
              color: `hsl(${Math.random() * 360}, 70%, 50%)`,
              isVisible: true
          };
          
          return {
              dyno: {
                  ...state.dyno,
                  isRunning: false,
                  runs: [...state.dyno.runs, newRun],
                  currentRunData: []
              }
          };
      });
  },
  
  toggleDynoRunVisibility: (id) => {
      set(state => ({
          dyno: {
              ...state.dyno,
              runs: state.dyno.runs.map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r)
          }
      }));
  },
  
  deleteDynoRun: (id) => {
      set(state => ({
          dyno: {
              ...state.dyno,
              runs: state.dyno.runs.filter(r => r.id !== id)
          }
      }));
  },

  connectObd: async () => {
    if (!obdService) {
      obdService = new ObdService((status) => {
          set({ obdState: status });
          if (status === ObdConnectionState.Disconnected) {
              isObdPolling = false;
          }
      });
    }
    await obdService.connect();
    startObdPolling();
  },

  disconnectObd: () => {
    isObdPolling = false;
    obdService?.disconnect();
  },
  
  scanVehicle: async () => {
      const state = get();
      
      // If offline, use simulation data for demo purposes
      if (!obdService || state.obdState !== ObdConnectionState.Connected) {
          set({ isScanning: true });
          await new Promise(resolve => setTimeout(resolve, 2000));
          set({
              dtcs: [
                  { code: 'P0300', description: 'Random/Multiple Cylinder Misfire Detected', status: 'Confirmed', timestamp: Date.now() },
                  { code: 'P0171', description: 'System Too Lean (Bank 1)', status: 'Pending', timestamp: Date.now() }
              ],
              readiness: {
                  misfire: true, fuelSystem: true, components: true,
                  catalyst: false, evap: false, o2Sensor: true, egr: true
              },
              isScanning: false
          });
          return;
      }

      set({ isScanning: true });
      
      // CRITICAL: Stop the high-frequency polling loop before starting diagnostics
      isObdPolling = false;
      // Allow loop to gracefully exit (200ms safety buffer)
      await new Promise(r => setTimeout(r, 200));

      try {
          const dtcs = await obdService.getDiagnosticTroubleCodes();
          const readiness = await obdService.getEmissionsReadiness();
          
          set({ 
              dtcs, 
              readiness, 
              hasActiveFault: dtcs.length > 0 
          });
      } catch (e) {
          console.error("Scan failed", e);
      } finally {
          set({ isScanning: false });
          // Restart the telemetry loop
          startObdPolling();
      }
  },

  clearVehicleFaults: async () => {
      const state = get();
      if (!obdService || state.obdState !== ObdConnectionState.Connected) return;
      
      isObdPolling = false;
      await new Promise(r => setTimeout(r, 200));
      
      try {
          await obdService.clearDTCs();
          set({ dtcs: [], hasActiveFault: false });
      } catch (e) {
          console.error("Clear faults failed", e);
      } finally {
          startObdPolling();
      }
  },

  startSimulation: () => {
    if (simulationInterval) return;

    if ('geolocation' in navigator && !gpsWatchId) {
      try {
        gpsWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            gpsLatest = {
              speed: s(pos.coords.speed), // m/s
              accuracy: s(pos.coords.accuracy),
              latitude: s(pos.coords.latitude),
              longitude: s(pos.coords.longitude)
            };
          },
          (err) => { if (err.code === 1) console.warn("GPS Permission Denied"); },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
      } catch (e) { console.warn("Geolocation API access failed:", e); }
    }

    simulationInterval = setInterval(() => {
      const state = get();
      const now = Date.now();
      let deltaTimeSeconds = (now - lastUpdateTime) / 1000.0;
      if (deltaTimeSeconds <= 0 || isNaN(deltaTimeSeconds)) deltaTimeSeconds = 0.001; 
      lastUpdateTime = now;
      const prev = state.latestData;
      
      // Live Mode Check: If data is less than 3 seconds old, use it
      const isObdFresh = state.obdState === ObdConnectionState.Connected && (now - obdCache.lastUpdate < 3000);
      let newPointSource: 'sim' | 'live_obd' = isObdFresh ? 'live_obd' : 'sim';

      let rpm = s(prev.rpm);
      let gear = s(prev.gear);
      
      if (state.dyno.isRunning) {
          gear = 4;
          const sweepRate = 1000; 
          rpm += sweepRate * deltaTimeSeconds;
          
          if (rpm >= RPM_MAX) {
              state.stopDynoRun();
              rpm = 2000; 
          } else {
              const rpmNorm = rpm / 7000;
              const torqueCurve = (Math.sin(rpmNorm * Math.PI) + 0.5) * 300; 
              const boostFactor = 1 + (Math.max(0, prev.turboBoost) * 0.5);
              const currentTorque = s(torqueCurve * boostFactor * (0.95 + Math.random()*0.1)); 
              
              const currentPowerHP = s((currentTorque * 0.737 * rpm) / 5252);

              const dynoPoint: DynoPoint = {
                  rpm: s(rpm),
                  torque: s(currentTorque),
                  power: s(currentPowerHP),
                  afr: s(12.5 - (rpm/8000)), 
                  boost: s(prev.turboBoost)
              };
              state.dyno.currentRunData.push(dynoPoint);
          }
      } else if (!isObdFresh) {
          // Simulation Physics (Unchanged)
          if (now > simStateTimeout) {
            const rand = Math.random();
            switch (currentSimState) {
              case SimState.IDLE:
                currentSimState = SimState.ACCELERATING;
                simStateTimeout = now + (5000 + Math.random() * 5000);
                break;
              case SimState.ACCELERATING:
                currentSimState = rand > 0.4 ? SimState.CRUISING : (rand > 0.2 ? SimState.BRAKING : SimState.CORNERING);
                simStateTimeout = now + (8000 + Math.random() * 10000);
                break;
              case SimState.CRUISING:
                currentSimState = rand > 0.6 ? SimState.ACCELERATING : (rand > 0.3 ? SimState.BRAKING : SimState.CORNERING);
                simStateTimeout = now + (5000 + Math.random() * 8000);
                break;
              case SimState.BRAKING:
                currentSimState = rand > 0.5 ? SimState.CORNERING : SimState.ACCELERATING;
                simStateTimeout = now + (3000 + Math.random() * 3000);
                break;
              case SimState.CORNERING:
                currentSimState = SimState.ACCELERATING;
                simStateTimeout = now + (4000 + Math.random() * 4000);
                break;
            }
          }

          switch (currentSimState) {
            case SimState.IDLE:
              rpm += (RPM_IDLE - rpm) * 0.1;
              if (prev.speed < 5) gear = 1;
              break;
            case SimState.ACCELERATING:
              if (rpm > 4500 && gear < 6) { gear++; rpm *= 0.6; }
              rpm += (RPM_MAX / (gear * 15)) * (1 - rpm / RPM_MAX) + Math.random() * 50;
              break;
            case SimState.CRUISING:
              rpm += (2500 - rpm) * 0.05 + (Math.random() - 0.5) * 100;
              break;
            case SimState.BRAKING:
              if (rpm < 2000 && gear > 1) { gear--; rpm *= 1.2; }
              rpm *= 0.98;
              break;
            case SimState.CORNERING:
                rpm += (Math.random() - 0.5) * 50;
                break;
          }
          rpm = Math.max(RPM_IDLE, Math.min(rpm, RPM_MAX));
      } else {
          // LIVE MODE: Use Cache
          rpm = s(obdCache.rpm);
      }

      // --- EKF & Speed Fusion ---
      let inputSpeed = 0;
      let accelEst = 0; 
      
      // Feed EKF from OBD if available, or Sim if not
      if (isObdFresh) {
          inputSpeed = s(obdCache.speed); // km/h from OBD
          accelEst = (obdCache.speed - prev.speed) / deltaTimeSeconds / 3.6; 
          ekf.fuseObdSpeed(inputSpeed * 1000 / 3600); // Convert to m/s for EKF
      } else {
          // Simulation Speed
          const safeGear = gear > 0 ? gear : 1;
          const gearRatio = GEAR_RATIOS[Math.min(safeGear, GEAR_RATIOS.length-1)] || 1;
          const simSpeed = (rpm / (gearRatio * 300)) * (1 - (1 / safeGear)) * 10;
          inputSpeed = s(Math.max(0, Math.min(simSpeed, SPEED_MAX)));
          ekf.fuseObdSpeed(inputSpeed * 1000 / 3600);
      }
      
      if (!isFinite(accelEst)) accelEst = 0;

      // Feed EKF from GPS if available (for Position/Heading)
      if (gpsLatest?.speed !== null && gpsLatest?.speed !== undefined) {
        ekf.fuseGps(gpsLatest.speed, gpsLatest.accuracy);
      }

      // Simulated IMU (used for EKF Prediction step)
      let gx = (Math.random() - 0.5) * 0.1;
      let gy = accelEst / 9.81;
      if (currentSimState === SimState.CORNERING) gx = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5);
      
      const ax = s(gy * 9.81);
      const ay = s(gx * 9.81);
      const az = s(0 + (Math.random() - 0.5) * 0.2);

      const velocityMs = Math.max(1, prev.speed / 3.6);
      const r = s(ay / velocityMs);
      const q = s((gy - prev.gForceY) * 2.0); 
      const p = s((gx - prev.gForceX) * 1.5);

      ekf.predict([ax, ay, az], [p, q, r], deltaTimeSeconds);
      
      if (Date.now() - lastVisionUpdate > 500) {
          ekf.fuseVision(inputSpeed, deltaTimeSeconds);
      }

      const fusedSpeedMs = s(ekf.getEstimatedSpeed());
      const fusedSpeedKph = fusedSpeedMs * 3.6;
      const distanceThisFrame = fusedSpeedMs * deltaTimeSeconds;

      // --- Speed Selection Logic for UI ---
      // If we have fresh OBD data, use it directly for "Speedometer" to prevent filtering lag.
      // If OBD is missing, fallback to EKF (which fuses GPS + Vision + Sim).
      // If both are missing/bad, fallback to GPS directly if available.
      
      let finalDisplaySpeed = inputSpeed;
      if (!isObdFresh) {
          // Fallback priority: EKF > GPS > 0
          if (fusedSpeedKph > 1) finalDisplaySpeed = fusedSpeedKph;
          else if (gpsLatest?.speed) finalDisplaySpeed = gpsLatest.speed * 3.6;
      }

      // Lat/Lon Integration
      let currentLat = prev.latitude;
      let currentLon = prev.longitude;
      if (gpsLatest) {
          currentLat = gpsLatest.latitude;
          currentLon = gpsLatest.longitude;
      } else if (fusedSpeedKph > 0) {
          // Dead reckoning fallback
          const distKm = (fusedSpeedKph * (deltaTimeSeconds / 3600)); 
          const dLat = distKm / 111;
          const dLon = distKm / (111 * Math.cos(currentLat * (Math.PI / 180)));
          currentLat += dLat * 0.707;
          currentLon += dLon * 0.707;
      }

      const rpmIndex = Math.min(15, Math.floor(rpm / (8000/15)));
      let throttle = 15;
      if (currentSimState === SimState.ACCELERATING) throttle = 80;
      if (currentSimState === SimState.CRUISING) throttle = 30;
      if (state.dyno.isRunning) throttle = 100;

      const loadIndex = Math.min(15, Math.floor(throttle / (100/15)));
      const veValue = state.tuning.veTable[loadIndex][rpmIndex];
      const simulatedLoad = throttle; 

      const calcMaf = (rpm / RPM_MAX) * 250;
      const calcTiming = 10 + (rpm/RPM_MAX) * 35;
      const calcFuelRail = 3500 + (rpm/RPM_MAX) * 15000;
      const calcLambda = state.dyno.isRunning ? (12.5/14.7) : (0.95 + (Math.random() * 0.1));

      // Simulate Wheel Speeds
      let wheelFL = finalDisplaySpeed;
      let wheelFR = finalDisplaySpeed;
      let wheelRL = finalDisplaySpeed;
      let wheelRR = finalDisplaySpeed;

      if (!isObdFresh) {
          // Add slip/cornering simulation
          if (currentSimState === SimState.CORNERING) {
              // Assuming right turn: Left wheels faster
              const turnFactor = 1.05;
              wheelFL *= turnFactor;
              wheelRL *= turnFactor;
              wheelFR *= (1/turnFactor);
              wheelRR *= (1/turnFactor);
          } else if (currentSimState === SimState.ACCELERATING) {
              // Rear wheel slip (RWD)
              const slip = 1.02;
              wheelRL *= slip;
              wheelRR *= slip;
          }
      } else {
          // Live Data
          if (obdCache.wheels.fl > 0) {
              wheelFL = obdCache.wheels.fl;
              wheelFR = obdCache.wheels.fr;
              wheelRL = obdCache.wheels.rl;
              wheelRR = obdCache.wheels.rr;
          }
      }

      const newPoint: SensorDataPoint = {
        time: now,
        rpm: s(rpm),
        speed: s(finalDisplaySpeed),
        gear: s(gear),
        fuelUsed: s(prev.fuelUsed + (rpm / RPM_MAX) * (veValue/100) * 0.005), 
        inletAirTemp: isObdFresh ? s(obdCache.intake) : (25 + (finalDisplaySpeed / SPEED_MAX) * 20),
        batteryVoltage: isObdFresh && obdCache.voltage > 5 ? s(obdCache.voltage) : 13.8,
        engineTemp: isObdFresh ? s(obdCache.coolant) : (90 + (rpm / RPM_MAX) * 15),
        fuelTemp: 20 + (finalDisplaySpeed / SPEED_MAX) * 10,
        turboBoost: isObdFresh ? (obdCache.map - 100) / 100 : (-0.8 + (rpm / RPM_MAX) * (state.tuning.boostTarget/14.7) * (gear / 6)),
        fuelPressure: 3.5 + (rpm / RPM_MAX) * 2,
        oilPressure: 1.5 + (rpm / RPM_MAX) * 5.0,
        shortTermFuelTrim: 2.0 + (Math.random() - 0.5) * 4,
        longTermFuelTrim: prev.longTermFuelTrim,
        o2SensorVoltage: 0.1 + (0.5 + Math.sin(now / 500) * 0.4),
        engineLoad: isObdFresh ? s(obdCache.load) : simulatedLoad,
        distance: prev.distance + distanceThisFrame,
        gForceX: s(gx),
        gForceY: s(gy),
        latitude: s(currentLat),
        longitude: s(currentLon),
        source: newPointSource,
        
        maf: isObdFresh ? s(obdCache.maf) : calcMaf,
        timingAdvance: isObdFresh ? s(obdCache.timing) : calcTiming,
        throttlePos: isObdFresh ? s(obdCache.throttle) : simulatedLoad,
        fuelLevel: isObdFresh && obdCache.fuelLevel > 0 ? s(obdCache.fuelLevel) : Math.max(0, (prev.fuelLevel || 75) - 0.0005),
        barometricPressure: isObdFresh && obdCache.baro > 0 ? s(obdCache.baro) : 101.3,
        ambientTemp: isObdFresh && obdCache.ambient > 0 ? s(obdCache.ambient) : 22,
        fuelRailPressure: isObdFresh && obdCache.fuelRail > 0 ? s(obdCache.fuelRail) : calcFuelRail,
        lambda: isObdFresh && obdCache.lambda > 0 ? s(obdCache.lambda) : calcLambda,
        
        wheelSpeedFL: s(wheelFL),
        wheelSpeedFR: s(wheelFR),
        wheelSpeedRL: s(wheelRL),
        wheelSpeedRR: s(wheelRR)
      };

      const newData = [...state.data, newPoint];
      if (newData.length > MAX_DATA_POINTS) {
        newData.shift();
      }

      set(state => ({
        data: newData,
        latestData: newPoint,
        ekfStats: {
          ...state.ekfStats,
          gpsActive: gpsLatest !== null,
          fusionUncertainty: ekf.getUncertainty()
        },
        dyno: {
            ...state.dyno,
            currentRunData: state.dyno.isRunning ? [...state.dyno.currentRunData] : state.dyno.currentRunData
        }
      }));

    }, UPDATE_INTERVAL_MS);
  },

  stopSimulation: () => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    if (gpsWatchId && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
  }
}));