Phase 1 (P0 — safety-critical) — Real backend flash-safety gate

Current state: backend/app/services/physics.py, PhysicsKernel.validate_tuning() is a two-line stub that returns (True, "Safety Validated") for any input, unconditionally. This is the function that is actually in the path of writing a tune to a real ECU.

What already exists and works (build on this, don't reinvent it): services/ATEngine.ts's SafetyLayer.enforceConstraints() already implements and tests the real constraint logic: a 5° maximum cell-to-cell delta on ignition maps, a 950°C hard EGT ceiling, advisory zones below the hard ceiling, and knock-buffer violations. tests/SafetyLayer.test.ts covers 7 cases including boundary conditions.

Target:

 Port this logic (not just re-derive similar numbers — use the same constraint values and same categories of check) into the Python backend, so the code that actually gates a real flash enforces the same rules the frontend already promises.
 Fail closed on any malformed, missing, or out-of-declared-range field in the tune config — do not assume valid input.
 Extend test coverage beyond the 7 ported cases with property-based/fuzz testing (e.g. hypothesis in Python) against adversarial and malformed configs.
 Add structured, append-only logging of every validation decision (approved and denied), with timestamp, input hash, and reason. This becomes the seed of a real audit trail — see Phase 5.
 Wire this function into the actual flash pipeline in flash_manager.py in place of the current stub call, and add an integration test proving a known-bad tune (e.g. EGT limit violated) is rejected end-to-end, not just at the unit level.

Exit criteria: a tune that violates any constraint is provably rejected by an integration test that exercises the real flash pipeline, not just the isolated function.

Phase 2 (P0/P1) — Real security / integrity layer

Current state: backend/app/services/integrity.py — IntegrityManager.calculate_key() returns the hardcoded constant b"KEY" for any seed; calculate_global_hmac() returns the hardcoded constant b"HMAC" for any payload. No actual cryptographic computation happens anywhere in this file.

Target:

 Implement a real, pluggable UDS 0x27 seed/key algorithm registry, keyed by ECU family/variant (different manufacturers use different algorithms — this is genuine reverse-engineering work per family, not one generic formula; scope it per-variant as variants are added in Phase 4, and fail closed — refuse to proceed with an unknown variant rather than guessing).
 Implement real HMAC-SHA256 (or stronger) computed over the actual payload bytes, using a secret sourced from the Phase-0 secrets setup — never hardcoded.
 Unit tests with known-answer test vectors for each implemented algorithm, plus tests proving a tampered payload fails HMAC verification.

Exit criteria: for every ECU variant present in the database (Phase 4), a real seed/key exchange and payload HMAC can be demonstrated against test vectors; an unknown variant is explicitly refused, not silently approved.

Phase 3 (P1) — Hardware communication layer
🛑 DECISION POINT — ask the founder before writing code here

Two different, real hardware paths currently exist in this codebase and they are not the same thing:

backend/app/services/drivers/j2534_driver.py targets J2534 pass-thru devices (Windows-only, requires a physical device like a Tactrix Openport, ~$200-400 hardware cost per user) — currently an unimplemented stub (connect()'s body is a comment saying the implementation "would go here").
services/ObdService.ts targets Web Bluetooth ELM327-class adapters (cross-platform, cheap, ~$20-40 hardware) — and this one is already genuinely implemented: real AT command handling, connection management, protocol locking.

These serve different product strategies (a Windows desktop tool with expensive professional hardware, vs. a browser/mobile app with cheap consumer hardware). Confirm with the founder which is the actual intended production path — likely the ELM327/Web Bluetooth path, since it already works and matches the mobile-first framing elsewhere in the product — before investing further engineering in J2534.

Target (once decided):

 If J2534: real ctypes DLL binding, tested against a J2534 simulator/passthru emulator if no physical device is available in CI; if the founder does not have access to real J2534 hardware for validation, say so explicitly rather than marking this "done."
 Either way: replace the pass-only stub methods in backend/app/api/websocket.py (broadcast_progress, broadcast_error) with real progress/error broadcasting wired to the flash pipeline, with a test that simulates a flash and asserts the expected sequence of WebSocket messages.

Exit criteria: a chosen hardware path has a real, tested connection implementation; the other path is either explicitly descoped in writing or given equal treatment — no path is left half-stubbed and undocumented.

Phase 4 (P1/P2) — Hyper-Scout: real memory reads + honest database growth

Current state: ObdService.ts's readMemory() sends a real UDS "Read Memory By Address" (service 0x23) command over the wire, then discards whatever comes back and returns Math.random() bytes instead. The entropy math in EntropyAnalyzer.ts is correctly implemented but is currently being fed synthetic noise, not real ECU data. The hardcoded ECU database (cpp/GenesisExpandedDb.cpp) has 4 example variants.

Target:

 Fix readMemory() to parse and return the actual UDS positive/negative response bytes instead of discarding them. Add a test with a mocked UDS response proving the real bytes flow through to the entropy analyzer.
 Redesign GenesisExpandedDb as an extensible registry, not a hardcoded table. Each entry should carry a validation-status tag: e.g. bench_validated / derived_from_public_service_data / community_submitted_unverified.
 Do not backfill fake entries to hit any particular number. Start honest — ship with however many entries are genuinely present and correctly tagged. Growing this database is an ongoing data-collection process (real ECUs, real dumps), not something a coding agent can complete in a sprint. The deliverable here is the architecture and an honest current count, not a target number.

Exit criteria: readMemory() returns real data when connected to real (or realistically mocked) hardware; the database's reported count is computed from actual entries, each with a visible validation-status tag; no synthetic-data path can silently masquerade as a real scan result anywhere downstream (see Phase 6).

Phase 5 (P2) — Provenance / audit trail
🛑 DECISION POINT — ask the founder before writing code here

services/BlockchainLogger.ts is, by its own code comments, an explicit simulation: a fake transaction hash from Math.random(), a fake delay from setTimeout, no SDK or network call of any kind. Two real ways to close this gap, with real tradeoffs:

(a) Real Hedera Hashgraph integration via @hashgraph/sdk — genuinely achievable, but carries an ongoing per-transaction cost (even testnet has practical limits; mainnet costs real money per logged event at scale) and real integration/ops work.
(b) A simpler hash-chained local audit log — each record includes a hash of the previous record, independently verifiable by anyone without needing a live blockchain or ongoing per-transaction fees. This achieves the stated goal (tamper-evident history for warranty/resale claims) at a fraction of the engineering and ongoing cost, and can be built directly on top of the Phase-1 validation-decision log.

Recommend presenting both options with these tradeoffs to the founder rather than defaulting to (a) just because it was the original marketing claim.

Target (once decided): implement whichever is chosen, for real, with tests proving tamper-evidence (i.e. a test that alters a historical record and proves verification fails). Delete the Math.random() simulation entirely — nothing should keep silently faking this behind the scenes once a real implementation exists.

Phase 6 (P2) — Data integrity / real-vs-simulated labeling

Current state: synthetic fallback data is generated in multiple places (weather widget, entropy scanner demo mode) for legitimate reasons (nothing to show when no device is connected) — but nothing in the current export format distinguishes a real capture from a fallback one. This is exactly how a demo drag-strip export (drag_1_4_mile__21.07s.json, reviewed in the audit) ended up looking like it could be mistaken for a validated real-world run: 0% throttle for the entire recording, 8 channels permanently at zero, a decaying-not-accelerating speed profile.

Target:

 Every exported telemetry file (drag runs, roll races, entropy scans) must carry an explicit "source": "live_capture" | "simulated_fallback" field, set at the point of generation — not inferred after the fact.
 Any UI or export that displays telemetry should visibly label simulated data as such, not just in the raw JSON.

Exit criteria: it is no longer possible for a simulated export to be indistinguishable from a real one without inspecting the raw sensor values.

Phase 7 (P3) — Test & CI hardening
 Extend coverage beyond the current 3 test files to every module touched in Phases 1–6, with CI required to pass before merge (should already be true from Phase 0).
 Maintain a visible, separate checklist (e.g. HARDWARE_VALIDATION_PENDING.md) of everything that is only verified in simulation/mocked-hardware and still needs real bench or vehicle time. Do not let "tests pass in CI" get conflated with "verified against a real ECU" anywhere in product copy or investor materials.