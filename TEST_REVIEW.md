# Genisis V3.2 OBD Pro test review

The current suite contains **54 tests across 8 files**. The deterministic engine and service coverage is healthy: **42 tests pass** and **12 tests are skipped because the Firestore rules suite cannot complete its `beforeAll` setup**.

The failure is environmental, not a demonstrated rules failure. `tests/firestore.rules.test.ts` calls `initializeTestEnvironment` with the Firestore emulator fixed to `127.0.0.1:8081`. No emulator is listening there in the normal test command, so the setup receives `ECONNREFUSED`. Vitest then reports the 12 cases in that suite as skipped because their shared environment was never created. The remaining seven test files pass.

The skipped cases cover identity spoofing, tenant isolation, privilege escalation, shadow fields, oversized IDs, tuning-value poisoning, temporal consistency, immutable fields, email verification, and the valid-profile path. They should be run under a Firestore emulator before release. The “valid profile creation” case currently does not assert `assertSucceeds`, so it is not meaningful positive coverage yet and should be tightened in a follow-up.

Recommended verification command after starting a Firestore emulator on port 8081:

```sh
npm test -- --runInBand
```

The suite also has one integration dependency rather than a product assertion: the emulator-backed rules test. It should be treated as **blocked by missing local infrastructure**, not as a green security result.
