# CartelWorx Elite Pro ASI ZIP 6 — migration ledger

Audit date: 2026-09-01

Archive: `cartelworx-elite-pro-asi (6).zip`

SHA-256: `14c84a6e486aa396b3b23cbe29c3623856b2a499b12583e5b0161eee412d424c`

## Decision

The archive is a donor snapshot, not a release candidate. Its safe UI and validation ideas may be migrated selectively. Generated Android assets, compiled coverage, patch scripts, speculative ECU algorithms, live write/flash paths and simulated evidence must not be merged into the commercial runtime.

The commercial release profile remains read-only. Calibration, UDS security access and flashing require a separate repository, identity, authorization boundary and bench-validation program.

## Evidence inventory

| Evidence | Result | Interpretation |
|---|---:|---|
| Archive files | 433 | Includes source, generated mobile assets, coverage, logs and bytecode |
| TypeScript/TSX/Python/JS source | ~67,887 lines | Large prototype surface; size is not production evidence |
| TypeScript check | Passed | Static typing is internally consistent |
| Frontend tests | 42 passed, 12 skipped | Core algorithms have useful unit coverage; Firestore coverage is environment-dependent |
| Backend tests | 24 passed, 1 skipped | Safety/integrity arithmetic is test-backed; HTTP API test did not execute |
| Production build | Passed with warnings | Functional build, but not performance- or hardware-certified |
| Client bundle | ~3.43 MB minified / ~902 KB gzip | Requires route/module splitting |
| ONNX WebAssembly payload | ~25 MB | Must not remain in the default startup/cache path |

## Differential result

Against the verified local branch, 357 common files are byte-identical and 28 common files differ. Most archive-only content is generated Android output, workflows, dependency locks or bytecode—not new product source.

### Extract now

| Candidate | Value | Action |
|---|---|---|
| Restored app status/navigation shell | Prevents every route being treated as fullscreen and restores hardware status access | Migrated with an always-available menu handle in HUD/immersive mode |
| Explicit simulator provenance | Prevents demo telemetry being labeled as fused EKF evidence | Corrected in `vehicleStore` |
| Fail-closed telemetry compatibility boundary | Prevents a legacy numeric field from becoming AI evidence without per-channel provenance | Added as `TrackCoachEvidenceAdapter` with tests |
| Adversarial numeric validation concepts | Rejects NaN, infinity and malformed calibration data | Retain as research test vectors; do not connect to customer flashing |
| CI intent | Provides a starting checklist | Replace, do not copy: current workflow ignores lint failures and targets the wrong branches |

### Research-only quarantine

| Area | Reason |
|---|---|
| Python J2534/ISO-TP flash backend | Hardware path is unvalidated and conflicts with Android-first ELM/STN product strategy |
| UDS `0x27`, `0x2E`, `0x34`, `0x36`, `0x37` and reset flows | Security/write authority belongs outside the commercial read-only deployment |
| Seed/key known-answer tests | Some results prove only implementation consistency, not OEM compatibility or authorization |
| HyperScout memory reads | Requires an authorized bench ECU, verified address map, anti-lockout policy and golden captures |
| Tuning/flash UI | Presents control authority the release must not expose |
| Hedera UI claims | Must be backed by a real tamper-evident log and verifiable receipts before product claims |

### Reject from migration

- Generated Android `assets/public` build products.
- Coverage HTML, `.pyc`, debug logs and patch/fix scripts.
- The Firebase preview workflow with placeholder project identifiers.
- CI steps that use `npm run lint || true`.
- Any default or fallback secret for a flash manager.
- Synthetic/default pressure, temperature, vision or ECU-memory values presented as measured.
- Automatic ECU actions, DTC clearing, map writes or arbitrary raw commands in the customer runtime.

## Newly confirmed defects

1. `vehicleStore` assigned every non-OBD frame the `fused_ekf` source, including the full track simulator and stationary fake-idle generator. This could contaminate coaching, exports and certification.
2. The old live-coach widget infers braking pressure from brake temperature and periodically sends aggregate history without per-channel freshness/provenance.
3. Live OBD fields reuse earlier/default values when a PID is missing, but do not retain individual channel timestamps. Aggregate `live_obd` status is therefore insufficient for AI evidence.
4. The app exposes multiple write surfaces: calibration flash, UDS DID writes, KESS parameter writes, raw UDS commands, launch/boost controls and DTC clearing.
5. The Python flash API falls back to a development secret and can initiate work without the deployment separation required for a commercial read-only product.
6. The archive's CI allows TypeScript failures, does not exercise the active development branch and does not require the frontend test suite.
7. Compiled Android assets duplicate stale web bundles and make source/build provenance ambiguous.

## Engineering sequence

### P0 — evidence and authority

1. Replace aggregate telemetry provenance with per-channel metadata: source timestamp, receive timestamp, quality, status and derivation.
2. Feed the hardened ten-minute coach memory only through the explicit evidence adapter.
3. Disable legacy cloud coaching that consumes unqualified history.
4. Remove customer routing and service access to ECU write, security-access, active-test and DTC-clear functions.
5. Move all calibration research to a separate non-deployable package/repository.

Exit: a simulated or stale value cannot reach AI, export, anomaly or certification lanes; the shipping server has no vehicle-write endpoint.

### P1 — Android/OBD vertical slice

1. Implement one BLE transport abstraction for Capacitor Android and compatible browsers.
2. Support separate RX/TX characteristics, notification buffering, ELM line framing and reconnect state.
3. Timestamp every decoded PID independently and publish capability/freshness diagnostics.
4. Add deterministic replay fixtures for RPM, speed, throttle, coolant, voltage and link loss.
5. Verify against the intended `OBDII` BLE-GATT adapter while stationary, then on a controlled closed course.

Exit: replay-golden tests pass and a real device capture demonstrates stable read-only telemetry with no synthetic fallback.

### P2 — multimodal co-pilot

1. Connect the existing ephemeral-token Gemini Live client to authenticated sessions.
2. Start microphone/camera capture only from a deliberate stationary user gesture.
3. Keep screen interaction suppressed while moving; voice remains advisory-only.
4. Stream only fresh, qualified telemetry and explicit uncertain vision evidence.
5. Prove bounded ten-minute memory, interruption, resource cleanup, reconnect and token expiry.

Exit: an instrumented track replay shows the complete provenance chain from measurement to spoken observation, with unavailable signals stated honestly.

### P3 — fusion, kinematics and prediction

1. Move IMU/GNSS/OBD sampling out of React render cadence into timestamped producers.
2. Add mount calibration, gravity removal, orientation normalization and sensor health.
3. Keep innovation gating and Joseph covariance updates in the fusion core.
4. Permit kinematic RPM only after a measured gear ratio is confirmed; expose derivation and expiry.
5. Bound predictor horizons so smoothing cannot hide stale or disconnected inputs.

Exit: walking trace, vehicle replay and bench OBD tests meet defined accuracy/error budgets.

### P4 — commercial hardening

1. Replace the current workflow with required typecheck, test, build, secret scan and dependency audit jobs.
2. Add route-level code splitting and remove ONNX from the default PWA cache.
3. Establish SBOM, signed builds, release provenance, crash/health telemetry and rollback.
4. Run privacy, retention, threat-model and automotive counsel reviews.
5. Complete Android device-matrix, soak, thermal, offline, reconnect and HIL validation.

Exit: signed release candidate, reproducible build, zero open P0 defects and explicit hardware evidence dossier.

## Immediate implementation checkpoint

- Safe archive hash and inventory recorded.
- Navigation/status-bar fix migrated.
- Simulator-to-EKF provenance leak corrected.
- Per-channel evidence adapter and rejection tests added.
- Hardened Gemini Live boundary and ten-minute memory preserved from the previous checkpoint.
- No archive flash, write, seed/key or generated Android runtime was migrated.
