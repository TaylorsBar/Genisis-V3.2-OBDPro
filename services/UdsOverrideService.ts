import { ObdService } from "./ObdService";
import { commercialControlDenial } from './CommercialReleasePolicy';

export interface UdsOverrideParameter {
  didHex: string; // e.g. "F101"
  name: string;
  description: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  dataBytes: number;
  encode: (val: number) => Uint8Array;
  decode: (bytes: Uint8Array) => number;
}

export const UDS_OVERRIDE_CATALOG: Record<string, UdsOverrideParameter> = {
  MAP_SWITCH: {
    didHex: "F101",
    name: "Live Map Slot Selection",
    description: "4-Way RaceROM Map Selection (1: 98 Octane, 2: E85 FlexFuel, 3: Valet/Eco, 4: Track/Flame)",
    currentValue: 1,
    minValue: 1,
    maxValue: 4,
    unit: "Slot",
    dataBytes: 1,
    encode: (val) => new Uint8Array([Math.min(4, Math.max(1, Math.round(val)))]),
    decode: (bytes) => bytes[0] || 1
  },
  LAUNCH_CONTROL_RPM: {
    didHex: "F102",
    name: "Launch Control RPM Target",
    description: "2-Step Launch Control RPM Hold Target",
    currentValue: 3500,
    minValue: 2500,
    maxValue: 6500,
    unit: "RPM",
    dataBytes: 2,
    encode: (val) => {
      const rpm = Math.min(6500, Math.max(2500, Math.round(val)));
      return new Uint8Array([(rpm >> 8) & 0xFF, rpm & 0xFF]);
    },
    decode: (bytes) => (bytes[0] << 8) | bytes[1]
  },
  ETHANOL_TRIM_OFFSET: {
    didHex: "F103",
    name: "FlexFuel Ethanol Trim Offset",
    description: "Direct Ethanol Fuel Trim Compensation Offset",
    currentValue: 0,
    minValue: -25,
    maxValue: 25,
    unit: "%",
    dataBytes: 1,
    encode: (val) => {
      const clamped = Math.min(25, Math.max(-25, Math.round(val)));
      return new Uint8Array([clamped + 128]); // 128 offset binary encoding
    },
    decode: (bytes) => (bytes[0] || 128) - 128
  },
  FFS_CUT_DURATION: {
    didHex: "F104",
    name: "Flat-Foot Shift Cut Duration",
    description: "Ignition / Fuel Cut Time window during manual gear shift",
    currentValue: 120,
    minValue: 40,
    maxValue: 300,
    unit: "ms",
    dataBytes: 2,
    encode: (val) => {
      const ms = Math.min(300, Math.max(40, Math.round(val)));
      return new Uint8Array([(ms >> 8) & 0xFF, ms & 0xFF]);
    },
    decode: (bytes) => (bytes[0] << 8) | bytes[1]
  },
  ROLLING_LAUNCH_BOOST: {
    didHex: "F105",
    name: "Rolling Launch Target Boost",
    description: "Target Manifold Pressure during Rolling Launch hold",
    currentValue: 1.2,
    minValue: 0.2,
    maxValue: 2.2,
    unit: "bar",
    dataBytes: 2,
    encode: (val) => {
      const bar100 = Math.min(220, Math.max(20, Math.round(val * 100)));
      return new Uint8Array([(bar100 >> 8) & 0xFF, bar100 & 0xFF]);
    },
    decode: (bytes) => ((bytes[0] << 8) | bytes[1]) / 100
  },
  BURBLE_LEVEL: {
    didHex: "F107",
    name: "Exhaust Burble / Flame Aggressiveness",
    description: "Overrun ignition retard & fuel overrun intensity level",
    currentValue: 2,
    minValue: 0,
    maxValue: 5,
    unit: "Level",
    dataBytes: 1,
    encode: (val) => new Uint8Array([Math.min(5, Math.max(0, Math.round(val)))]),
    decode: (bytes) => bytes[0] || 0
  }
};

// Approved volatile RAM address blocks for safe Live ECU RAM Editing
const SAFE_RAM_RANGES = [
  { start: 0x38000000, end: 0x3800FFFF, name: "Renesas SH72531 High-Speed RAM" },
  { start: 0x80000000, end: 0x8003FFFF, name: "TriCore TC297 LMU RAM" },
  { start: 0x20000000, end: 0x2001FFFF, name: "SRAM Live Calibration Table Space" }
];

export class UdsOverrideService {
  private activeOverrides: Record<string, number> = {
    MAP_SWITCH: 1,
    LAUNCH_CONTROL_RPM: 3500,
    ETHANOL_TRIM_OFFSET: 0,
    FFS_CUT_DURATION: 120,
    ROLLING_LAUNCH_BOOST: 1.2,
    BURBLE_LEVEL: 2
  };

  /**
   * Overrides a UDS parameter by identifier (Service 0x2E - WriteDataByIdentifier).
   * Executes over Web Bluetooth / ELM327.
   */
  public async writeParameterOverride(
    paramKey: keyof typeof UDS_OVERRIDE_CATALOG,
    value: number,
    obdService?: ObdService
  ): Promise<{ success: boolean; transmitted: false; rawCommandSent: string; valueApplied: number; message: string }> {
    const param = UDS_OVERRIDE_CATALOG[paramKey];
    if (!param) {
      throw new Error(`Unknown UDS parameter key: ${paramKey}`);
    }

    if (value < param.minValue || value > param.maxValue) {
      throw new Error(`Value ${value} is out of bounds for ${param.name} (${param.minValue} - ${param.maxValue} ${param.unit}).`);
    }

    const payloadBytes = param.encode(value);
    let hexPayload = "";
    for (let b of payloadBytes) {
      hexPayload += b.toString(16).padStart(2, "0").toUpperCase();
    }

    // UDS Service 0x2E Command: "2E" + DID + Data
    const rawCommand = `2E${param.didHex}${hexPayload}`;

    if (obdService) {
      throw new Error(commercialControlDenial('UDS parameter transmission'));
    }

    this.activeOverrides[paramKey] = value;

    return {
      success: true,
      transmitted: false,
      rawCommandSent: rawCommand,
      valueApplied: value,
      message: `Staged UDS 0x2E payload for [${param.name}] -> ${value} ${param.unit}. No vehicle command was sent. (Hex Payload: ${rawCommand})`
    };
  }

  /**
   * Live ECU RAM Editing (UDS Service 0x3D - WriteMemoryByAddress).
   * Modifies volatile RAM directly for zero-latency parameter updates without flashing EEPROM.
   */
  public async writeMemoryByAddress(
    address: number,
    data: Uint8Array,
    obdService?: ObdService
  ): Promise<{ success: boolean; transmitted: false; hexAddress: string; bytesWritten: number; rawCommandSent: string }> {
    // Fail Closed Safety Guard: Validate address range
    const isAddressSafe = SAFE_RAM_RANGES.some(range => address >= range.start && address + data.length <= range.end);
    if (!isAddressSafe) {
      throw new Error(`[RAM Protection Violation] Target address 0x${address.toString(16).toUpperCase()} is outside approved volatile calibration RAM boundaries! Operation blocked.`);
    }

    const hexAddress = address.toString(16).padStart(8, "0").toUpperCase();
    let hexData = "";
    for (let b of data) {
      hexData += b.toString(16).padStart(2, "0").toUpperCase();
    }

    // UDS 0x3D Frame: 3D [AddressAndLengthFormat] [AddressBytes] [LengthBytes] [Data]
    // 0x34 format = 4-byte address, 2-byte length
    const lenHex = data.length.toString(16).padStart(4, "0").toUpperCase();
    const rawCommand = `3D34${hexAddress}${lenHex}${hexData}`;

    if (obdService) {
      throw new Error(commercialControlDenial('UDS memory-write transmission'));
    }

    return {
      success: true,
      transmitted: false,
      hexAddress: `0x${hexAddress}`,
      bytesWritten: data.length,
      rawCommandSent: rawCommand
    };
  }

  public getActiveOverrides(): Record<string, number> {
    return { ...this.activeOverrides };
  }
}

export const udsOverrideService = new UdsOverrideService();
