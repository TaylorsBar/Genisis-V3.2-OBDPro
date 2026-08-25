import { ChecksumService, EcuType } from "./ChecksumService";

export interface ArcPlatformConfig {
  platformId: 'VQ35DE' | 'VQ37VHR' | 'VR30DDTT' | 'FA20_SUBARU' | 'B58_BMW';
  name: string;
  mcuArchitecture: string;
  flashSizeKb: number;
  baseRomVectorOffset: number;
  supportedFeatures: Array<'FFS' | 'BURNOUT' | 'MAF_SCALING' | 'MAP_SWITCH' | 'FLEXFUEL' | 'ROLLING_LAUNCH'>;
}

export const ARC_PLATFORMS: Record<string, ArcPlatformConfig> = {
  VQ35DE: {
    platformId: 'VQ35DE',
    name: 'Nissan VQ35DE (350Z / G35)',
    mcuArchitecture: 'Renesas SH7058 (SuperH)',
    flashSizeKb: 1024,
    baseRomVectorOffset: 0x00000400,
    supportedFeatures: ['FFS', 'BURNOUT', 'MAF_SCALING', 'MAP_SWITCH']
  },
  VQ37VHR: {
    platformId: 'VQ37VHR',
    name: 'Nissan/Infiniti VQ37VHR (370Z / G37 / Q60)',
    mcuArchitecture: 'Renesas SH72531 / SH7059',
    flashSizeKb: 1536,
    baseRomVectorOffset: 0x00000800,
    supportedFeatures: ['FFS', 'BURNOUT', 'MAF_SCALING', 'MAP_SWITCH', 'FLEXFUEL', 'ROLLING_LAUNCH']
  },
  VR30DDTT: {
    platformId: 'VR30DDTT',
    name: 'Infiniti VR30DDTT (Q50 / Q60 Red Sport)',
    mcuArchitecture: 'Infineon TriCore TC297',
    flashSizeKb: 4096,
    baseRomVectorOffset: 0x00001000,
    supportedFeatures: ['FFS', 'BURNOUT', 'MAF_SCALING', 'MAP_SWITCH', 'FLEXFUEL', 'ROLLING_LAUNCH']
  },
  FA20_SUBARU: {
    platformId: 'FA20_SUBARU',
    name: 'Subaru FA20DIT / FA20D (BRZ / WRX)',
    mcuArchitecture: 'Renesas SH72543',
    flashSizeKb: 2048,
    baseRomVectorOffset: 0x00000800,
    supportedFeatures: ['FFS', 'MAF_SCALING', 'MAP_SWITCH', 'FLEXFUEL', 'ROLLING_LAUNCH']
  },
  B58_BMW: {
    platformId: 'B58_BMW',
    name: 'BMW / Toyota Supra B58 (DME Bosch MG1)',
    mcuArchitecture: 'TriCore TC298TP',
    flashSizeKb: 8192,
    baseRomVectorOffset: 0x00002000,
    supportedFeatures: ['FFS', 'BURNOUT', 'MAF_SCALING', 'MAP_SWITCH', 'FLEXFUEL', 'ROLLING_LAUNCH']
  }
};

export interface FlatFootShiftConfig {
  enabled: boolean;
  minRpmTrigger: number; // e.g. 4500 RPM
  maxClutchDisengageMs: number; // e.g. 200 ms
  cutType: 'IGNITION_CUT' | 'FUEL_CUT' | 'RETARD_ONLY';
  retardDegrees: number; // e.g. 15 degrees
}

export interface BurnoutModeConfig {
  enabled: boolean;
  maxRearRpmCap: number; // e.g. 4000 RPM
  frontBrakeHoldPercent: number; // e.g. 60%
  durationTimeoutSec: number; // e.g. 10 sec safety timeout
}

export interface RaceRomMapConfig {
  activeMapSlot: 1 | 2 | 3 | 4;
  map1Name: string; // e.g., "98 Octane Street"
  map2Name: string; // e.g., "E85 FlexFuel"
  map3Name: string; // e.g., "Valet / 95 Octane"
  map4Name: string; // e.g., "Anti-Lag / Track"
  flexFuelEnabled: boolean;
  ethanolBlendPercent: number; // 0 to 100%
  rollingLaunchSpeedKph: number; // e.g. 60 km/h
  rollingLaunchTargetBoostBar: number; // e.g. 1.2 bar
}

export interface MafLogDataPoint {
  mafVoltage: number; // e.g. 1.2V to 4.9V
  stftPercent: number; // Short term fuel trim (-25% to +25%)
  ltftPercent: number; // Long term fuel trim (-25% to +25%)
  engineRpm: number;
  engineLoad: number;
}

export class ArcPatchEngine {
  /**
   * Generates custom RaceROM patch bytes to inject into target microcontroller firmware.
   */
  public generateRaceRomSubroutine(
    platformKey: keyof typeof ARC_PLATFORMS,
    ffs: FlatFootShiftConfig,
    burnout: BurnoutModeConfig,
    mapConfig: RaceRomMapConfig
  ): Uint8Array {
    const platform = ARC_PLATFORMS[platformKey];
    if (!platform) {
      throw new Error(`Unsupported ARC platform: ${platformKey}`);
    }

    // Safety validation
    if (ffs.enabled && (ffs.minRpmTrigger < 2500 || ffs.minRpmTrigger > 8000)) {
      throw new Error("Flat-Foot Shift trigger RPM must be between 2500 and 8000 RPM.");
    }
    if (burnout.enabled && (burnout.durationTimeoutSec < 1 || burnout.durationTimeoutSec > 30)) {
      throw new Error("Burnout safety timeout must be between 1 and 30 seconds.");
    }

    // Build subroutine binary header & payload
    // Header format: [0x41, 0x52, 0x43, 0x01] -> "ARC\x01"
    const header = new Uint8Array([0x41, 0x52, 0x43, 0x01]);
    const payloadLength = 128;
    const patchBuffer = new Uint8Array(header.length + payloadLength);
    patchBuffer.set(header, 0);

    // Encode platform ID byte
    patchBuffer[4] = platformKey === 'VQ35DE' ? 0x01 :
                     platformKey === 'VQ37VHR' ? 0x02 :
                     platformKey === 'VR30DDTT' ? 0x03 :
                     platformKey === 'FA20_SUBARU' ? 0x04 : 0x05;

    // Encode FFS settings
    patchBuffer[5] = ffs.enabled ? 0x01 : 0x00;
    patchBuffer[6] = (ffs.minRpmTrigger >> 8) & 0xFF;
    patchBuffer[7] = ffs.minRpmTrigger & 0xFF;
    patchBuffer[8] = ffs.cutType === 'IGNITION_CUT' ? 0x01 : ffs.cutType === 'FUEL_CUT' ? 0x02 : 0x03;
    patchBuffer[9] = Math.min(30, Math.max(0, ffs.retardDegrees));

    // Encode Burnout settings
    patchBuffer[10] = burnout.enabled ? 0x01 : 0x00;
    patchBuffer[11] = (burnout.maxRearRpmCap >> 8) & 0xFF;
    patchBuffer[12] = burnout.maxRearRpmCap & 0xFF;
    patchBuffer[13] = Math.min(100, Math.max(0, burnout.frontBrakeHoldPercent));

    // Encode RaceROM Map Switch & FlexFuel settings
    patchBuffer[14] = mapConfig.activeMapSlot;
    patchBuffer[15] = mapConfig.flexFuelEnabled ? 0x01 : 0x00;
    patchBuffer[16] = Math.min(100, Math.max(0, Math.round(mapConfig.ethanolBlendPercent)));
    patchBuffer[17] = Math.min(250, Math.max(0, Math.round(mapConfig.rollingLaunchSpeedKph)));
    patchBuffer[18] = Math.min(255, Math.max(0, Math.round(mapConfig.rollingLaunchTargetBoostBar * 100)));

    // Fill remaining subroutine code space with pseudo opcodes representing hook vectors
    for (let i = 19; i < patchBuffer.length; i++) {
      patchBuffer[i] = (i * 0x37) & 0xFF;
    }

    return patchBuffer;
  }

  /**
   * MAF Table Auto-Scaling Algorithm
   * Computes recommended multiplier corrections for 16-point or 32-point 2D MAF Voltage vs Airflow curve.
   */
  public calculateMafAutoScaling(
    currentVoltageTable: number[], // e.g. 64 voltage steps from 0.0V to 5.0V
    currentAirflowTable: number[], // g/s values
    loggedData: MafLogDataPoint[]
  ): { newAirflowTable: number[]; averageTrimCorrection: number; sampleCount: number } {
    if (currentVoltageTable.length !== currentAirflowTable.length) {
      throw new Error("Voltage and Airflow table length mismatch.");
    }
    if (!loggedData || loggedData.length === 0) {
      return {
        newAirflowTable: [...currentAirflowTable],
        averageTrimCorrection: 0,
        sampleCount: 0
      };
    }

    const bins: { sumTrim: number; count: number }[] = currentVoltageTable.map(() => ({ sumTrim: 0, count: 0 }));

    // Group trims by closest MAF voltage bin
    for (const point of loggedData) {
      // Total fuel trim offset
      const totalTrimPercent = point.stftPercent + point.ltftPercent;
      
      let closestIndex = 0;
      let minDiff = Math.abs(currentVoltageTable[0] - point.mafVoltage);

      for (let i = 1; i < currentVoltageTable.length; i++) {
        const diff = Math.abs(currentVoltageTable[i] - point.mafVoltage);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      bins[closestIndex].sumTrim += totalTrimPercent;
      bins[closestIndex].count += 1;
    }

    const newAirflowTable = [...currentAirflowTable];
    let totalCorrectionSum = 0;
    let correctedBinCount = 0;

    for (let i = 0; i < currentVoltageTable.length; i++) {
      if (bins[i].count >= 3) {
        const avgTrimPercent = bins[i].sumTrim / bins[i].count;
        // Damped correction factor (0.6 smoothing factor to prevent overshooting)
        const correctionFactor = 1 + (avgTrimPercent / 100) * 0.6;
        newAirflowTable[i] = Math.round(currentAirflowTable[i] * correctionFactor * 100) / 100;

        totalCorrectionSum += avgTrimPercent;
        correctedBinCount++;
      }
    }

    const averageTrimCorrection = correctedBinCount > 0 ? totalCorrectionSum / correctedBinCount : 0;

    return {
      newAirflowTable,
      averageTrimCorrection: Math.round(averageTrimCorrection * 100) / 100,
      sampleCount: loggedData.length
    };
  }
}

export const arcPatchEngine = new ArcPatchEngine();
