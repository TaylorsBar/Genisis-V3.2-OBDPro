import { describe, it, expect } from "vitest";
import { ArcPatchEngine, ARC_PLATFORMS, FlatFootShiftConfig, BurnoutModeConfig, RaceRomMapConfig, MafLogDataPoint } from "../services/ArcPatchEngine";

describe("ARC (Advanced Race Controls) & Custom Subroutine Patch Engine", () => {
  const arcEngine = new ArcPatchEngine();

  it("generates valid RaceROM patch bytes for VQ37VHR", () => {
    const ffs: FlatFootShiftConfig = {
      enabled: true,
      minRpmTrigger: 4800,
      maxClutchDisengageMs: 180,
      cutType: "IGNITION_CUT",
      retardDegrees: 15
    };

    const burnout: BurnoutModeConfig = {
      enabled: true,
      maxRearRpmCap: 4200,
      frontBrakeHoldPercent: 65,
      durationTimeoutSec: 12
    };

    const mapConfig: RaceRomMapConfig = {
      activeMapSlot: 2,
      map1Name: "98 Octane Street",
      map2Name: "E85 FlexFuel Performance",
      map3Name: "Valet 95 Octane",
      map4Name: "Track Anti-Lag",
      flexFuelEnabled: true,
      ethanolBlendPercent: 75,
      rollingLaunchSpeedKph: 55,
      rollingLaunchTargetBoostBar: 1.35
    };

    const patchBytes = arcEngine.generateRaceRomSubroutine("VQ37VHR", ffs, burnout, mapConfig);

    expect(patchBytes).toBeInstanceOf(Uint8Array);
    expect(patchBytes.length).toBe(132);

    // Verify "ARC\x01" header
    expect(patchBytes[0]).toBe(0x41); // 'A'
    expect(patchBytes[1]).toBe(0x52); // 'R'
    expect(patchBytes[2]).toBe(0x43); // 'C'
    expect(patchBytes[3]).toBe(0x01);

    // Platform ID VQ37VHR -> 0x02
    expect(patchBytes[4]).toBe(0x02);

    // FFS Enabled -> 0x01
    expect(patchBytes[5]).toBe(0x01);
    // RPM 4800 -> 0x12C0 -> byte[6]=0x12, byte[7]=0xC0
    expect(patchBytes[6]).toBe(0x12);
    expect(patchBytes[7]).toBe(0xC0);

    // RaceROM Map slot -> 2
    expect(patchBytes[14]).toBe(2);
    // Ethanol blend % -> 75
    expect(patchBytes[16]).toBe(75);
  });

  it("throws safety error on out-of-range FFS RPM trigger", () => {
    const ffs: FlatFootShiftConfig = {
      enabled: true,
      minRpmTrigger: 1500, // Invalid (too low)
      maxClutchDisengageMs: 200,
      cutType: "FUEL_CUT",
      retardDegrees: 10
    };

    const burnout: BurnoutModeConfig = {
      enabled: false,
      maxRearRpmCap: 3000,
      frontBrakeHoldPercent: 50,
      durationTimeoutSec: 10
    };

    const mapConfig: RaceRomMapConfig = {
      activeMapSlot: 1,
      map1Name: "Street",
      map2Name: "",
      map3Name: "",
      map4Name: "",
      flexFuelEnabled: false,
      ethanolBlendPercent: 0,
      rollingLaunchSpeedKph: 50,
      rollingLaunchTargetBoostBar: 1.0
    };

    expect(() => {
      arcEngine.generateRaceRomSubroutine("VR30DDTT", ffs, burnout, mapConfig);
    }).toThrow("Flat-Foot Shift trigger RPM must be between 2500 and 8000 RPM.");
  });

  it("calculates accurate MAF auto-scaling corrections from logged telemetry data", () => {
    const currentVoltageTable = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];
    const currentAirflowTable = [12.0, 25.0, 48.0, 85.0, 140.0, 220.0, 320.0, 450.0];

    const loggedData: MafLogDataPoint[] = [
      { mafVoltage: 2.01, stftPercent: 5.0, ltftPercent: 3.0, engineRpm: 3000, engineLoad: 60 },
      { mafVoltage: 2.02, stftPercent: 4.5, ltftPercent: 3.5, engineRpm: 3100, engineLoad: 62 },
      { mafVoltage: 1.99, stftPercent: 6.0, ltftPercent: 2.0, engineRpm: 2950, engineLoad: 58 },
      { mafVoltage: 3.48, stftPercent: -8.0, ltftPercent: -2.0, engineRpm: 5000, engineLoad: 110 },
      { mafVoltage: 3.51, stftPercent: -7.0, ltftPercent: -3.0, engineRpm: 5100, engineLoad: 115 },
      { mafVoltage: 3.50, stftPercent: -9.0, ltftPercent: -1.0, engineRpm: 5050, engineLoad: 112 }
    ];

    const result = arcEngine.calculateMafAutoScaling(currentVoltageTable, currentAirflowTable, loggedData);

    expect(result.sampleCount).toBe(6);
    expect(result.newAirflowTable.length).toBe(8);

    // Index 2 (2.0V) had ~+8% total trim -> airflow should scale UP from 48.0
    expect(result.newAirflowTable[2]).toBeGreaterThan(48.0);

    // Index 5 (3.5V) had ~-10% total trim -> airflow should scale DOWN from 220.0
    expect(result.newAirflowTable[5]).toBeLessThan(220.0);
  });
});
