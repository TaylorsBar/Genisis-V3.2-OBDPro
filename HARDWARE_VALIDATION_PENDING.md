# Hardware Validation Pending Checklist

This document tracks all features and logic that currently pass in CI/simulation but **strictly require validation against physical vehicle hardware or a real bench-tested ECU** before being considered production-ready.

**DO NOT** conflate passing unit/integration tests with real-world hardware validation in any product copy or investor materials.

## 🛑 Critical Descoped Architectures
- **J2534 Pass-Thru (Windows-Only)**
  - *Status:* Explicitly Descoped
  - *Reasoning:* The platform is adopting a "Mobile-First A.I. Native architecture". As such, we have elected to proceed entirely with cross-platform Web Bluetooth (ELM327-class adapters) for the primary hardware communication layer. The Python-based J2534 pipeline in `/backend` (including `J2534Driver` and `WebSocketBridge`) remains stubbed out as a mock for legacy reference, but it will NOT be the production deployment path. 
  - *Action:* We do not have access to real J2534 hardware for validation. We have explicitly descoped this in writing to focus on the Web Bluetooth implementation.

## ⚠️ Features Awaiting Real ECU Validation

### Phase 3: Hardware Communication Layer
- [ ] **Web Bluetooth / ELM327 Connection Stability**
  - *Current Status:* Passing with mocked responses in `IsoTpElm327Adapter` / `ObdService`.
  - *Pending:* Must be tested against a physical BLE ELM327 dongle connected to a live CAN bus to verify real-world latencies, dropped packets, and AT command support.

### Phase 4: Hyper-Scout UDS Memory Reads
- [ ] **UDS 0x23 (Read Memory By Address) Live Execution**
  - *Current Status:* `parseUdsReadMemoryResponse` handles mocked 0x63 (positive) and 0x7F (negative) responses correctly in CI.
  - *Pending:* Needs to be executed against real ECUs to confirm that the requested memory regions are indeed accessible and that the `HyperScoutService` entropy/variance classifiers correctly identify live calibration tables from raw byte streams over the air.

### Phase 6: Data Integrity & Telemetry Capture
- [ ] **Real-world Telemetry Streaming Rates**
  - *Current Status:* Simulated telemetry falls back safely and labels exports as `simulated_fallback`.
  - *Pending:* Capture a real `live_capture` log from a vehicle driving dynamically (e.g., drag run or circuit lap) and verify that the Bluetooth bandwidth sustains the necessary Hz polling rate without buffer overflows.

