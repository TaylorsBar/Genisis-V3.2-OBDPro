import { describe, it, expect } from "vitest";
import { UdsOverrideService, UDS_OVERRIDE_CATALOG } from "../services/UdsOverrideService";

describe("UDS Mode 0x2E Parameter Overrides & Live ECU RAM Editing", () => {
  const udsService = new UdsOverrideService();

  it("encodes UDS Service 0x2E WriteDataByIdentifier command for Map Switch (DID F101)", async () => {
    const result = await udsService.writeParameterOverride("MAP_SWITCH", 3);

    expect(result.success).toBe(true);
    expect(result.transmitted).toBe(false);
    expect(result.rawCommandSent).toBe("2EF10103");
    expect(result.valueApplied).toBe(3);
  });

  it("encodes UDS Service 0x2E WriteDataByIdentifier command for Launch Control RPM (DID F102)", async () => {
    const result = await udsService.writeParameterOverride("LAUNCH_CONTROL_RPM", 4200);

    expect(result.success).toBe(true);
    expect(result.transmitted).toBe(false);
    // 4200 RPM -> Hex 1068
    expect(result.rawCommandSent).toBe("2EF1021068");
    expect(result.valueApplied).toBe(4200);
  });

  it("encodes UDS Service 0x2E for FlexFuel Ethanol Trim Offset (DID F103)", async () => {
    const result = await udsService.writeParameterOverride("ETHANOL_TRIM_OFFSET", 10);

    expect(result.success).toBe(true);
    expect(result.transmitted).toBe(false);
    // 10 + 128 = 138 -> Hex 8A
    expect(result.rawCommandSent).toBe("2EF1038A");
    expect(result.valueApplied).toBe(10);
  });

  it("prevents out-of-bounds parameter override values", async () => {
    await expect(async () => {
      await udsService.writeParameterOverride("LAUNCH_CONTROL_RPM", 9000);
    }).rejects.toThrow("Value 9000 is out of bounds for Launch Control RPM Target");
  });

  it("stages a UDS 0x3D payload for approved research RAM addresses without transmission", async () => {
    // 0x38001000 is within approved SH72531 RAM space
    const data = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const result = await udsService.writeMemoryByAddress(0x38001000, data);

    expect(result.success).toBe(true);
    expect(result.transmitted).toBe(false);
    expect(result.hexAddress).toBe("0x38001000");
    expect(result.bytesWritten).toBe(4);
    expect(result.rawCommandSent).toBe("3D3438001000000412345678");
  });

  it("refuses transmission even when a write-capable adapter is supplied", async () => {
    const adapter = { sendRawCommand: async () => "6E F1 01" } as any;
    await expect(
      udsService.writeParameterOverride("MAP_SWITCH", 2, adapter),
    ).rejects.toThrow("READ_ONLY vehicle authority");
  });

  it("blocks Live ECU RAM Editing if target address is outside approved boundaries", async () => {
    const data = new Uint8Array([0xFF, 0xFF]);
    // 0x00000010 is illegal kernel code / interrupt vector space
    await expect(async () => {
      await udsService.writeMemoryByAddress(0x00000010, data);
    }).rejects.toThrow("[RAM Protection Violation] Target address 0x10 is outside approved volatile calibration RAM boundaries!");
  });
});
