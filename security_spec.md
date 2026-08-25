# Security Specification & Payload-First TDD (Phase 0)

This document outlines the security architecture and validation tests designed to protect the Karapiro Cartel Speed Shop's telemetry database.

## 1. Core Data Invariants

1. **User Ownership (Identity Integrity)**:
   - A user can only read and write to documents located under their specific `/users/{userId}/` subtree.
   - Any attempt to write or read data under another user's subtree is blocked.
   
2. **Strict Document Schema & Bounds (State Integrity)**:
   - Documents under `profiles` must contain valid fields.
   - Every write/update operation on profiles, logs, and dynoRuns must include a verified timestamp and a valid ID matching its path parameter.
   - Timestamps must correspond to the server time of the request (`request.time`).
   
3. **No Unauthenticated Access**:
   - Access is restricted only to verified, logged-in user sessions. Anonymous sessions are blocked from persistent writes unless explicitly elevated.
   - User email verification state must be checked where applicable.

4. **Immortal Fields**:
   - Fields such as `id` and `createdAt` must be strictly immutable after creation.
   - The user cannot set `role` or escalate their administrative status locally.

---

## 2. The "Dirty Dozen" Payloads

The following malicious payloads must be blocked and return `PERMISSION_DENIED`:

### Pill I: Identity Spoofing (Attacking User ID ownership)
- **Payload 01: Profile Poisoning (Cross-Tenant Write)**
  - Attempting to write a custom tuning map into `users/victim_user_123/profiles/my_profile` as `attacker_user_456`.
- **Payload 02: Impersonated Log Upload**
  - Attempting to submit vehicle telemetry logs to `users/victim_user_123/logs/log_999` with `request.auth.uid = attacker_user_456`.

### Pill II: State Shortcutting & Escalation (Attacking Field Integrity)
- **Payload 03: Administrative Privilege Escalation**
  - Attempting to insert a custom admin record under `/admins/attacker_user_456`.
- **Payload 04: Profile Creation with Shadow Fields**
  - Creating a profile document containing un-whitelisted, unauthorized system fields (e.g., `{ "id": "p1", "name": "Map", "isAdmin": true, "super_override": "ACTIVE" }`).

### Pill III: Resource & Rate Poisoning (Denial of Wallet / Buffer Attacks)
- **Payload 05: Document ID Buffer Overflow**
  - Attempting to create a profile with a 2,000-character string containing malicious payload shell characters as the document ID: `users/my_user/profiles/[2KB junk string]`.
- **Payload 06: Out of Bounds Value Poisoning**
  - Attempting to set `boostTarget` to a massive number (`1e20` bar) or negative value, causing physical simulation rendering or math engine calculation crashes.

### Pill IV: Temporal Inconsistency (Timestamp Spoofing)
- **Payload 07: Backdated Telemetry Logging**
  - Attempting to insert or modify `createdAt` to a historical epoch time rather than `request.time` (Server Timestamp).
- **Payload 08: Future-dated System Audits**
  - Attempting to submit system logs with a future timestamp to mask chronological order.

### Pill V: Immutable Field Updates (Immutability Violations)
- **Payload 09: Profile Key Override**
  - Modifying an existing tuning profile's `createdAt` or `id` field via a client update operation.
- **Payload 10: Log Sequence Tampering**
  - Changing the `startTime` or modifying values in a historically committed telemetry log.

### Pill VI: Email Verification Spoofing (Unverified Actions)
- **Payload 11: Write with Unverified Email Address**
  - Attempting to update ECU safety-overrides or flash tables with `request.auth.token.email_verified == false`.

### Pill VII: Blanket Query Scraping (No Query Trust)
- **Payload 12: Broad List Scraping Query**
  - Attempting to run a list query on all system profiles or logs without filtering by `userId = request.auth.uid`.

---

## 3. Test Runner Design

Below is the blueprint for `/tests/firestore.rules.test.ts` to execute automated validation against these payloads:

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("Karapiro Cartel Speed Shop - Firestore Rules", () => {
    let testEnv: any;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "cartelworx",
            firestore: {
                host: "localhost",
                port: 8080
            }
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    it("should prevent cross-tenant writes (Payload 01)", async () => {
        const aliceDb = testEnv.authenticatedContext("alice").firestore();
        const badWrite = aliceDb.doc("users/bob/profiles/profile_1").set({
            id: "profile_1",
            name: "Malicious Map",
            createdAt: Date.now()
        });
        await assertFails(badWrite);
    });

    it("should prevent profile creation with shadow fields (Payload 04)", async () => {
        const aliceDb = testEnv.authenticatedContext("alice", { email_verified: true }).firestore();
        const badWrite = aliceDb.doc("users/alice/profiles/p1").set({
            id: "p1",
            name: "Map 1",
            createdAt: Date.now(),
            isAdmin: true,
            super_override: "ACTIVE"
        });
        await assertFails(badWrite);
    });

    it("should prevent profile creation with invalid document IDs (Payload 05)", async () => {
        const aliceDb = testEnv.authenticatedContext("alice").firestore();
        const longId = "a".repeat(1000);
        const badWrite = aliceDb.doc(`users/alice/profiles/${longId}`).set({
            id: longId,
            name: "Corrupted ID Map",
            createdAt: Date.now()
        });
        await assertFails(badWrite);
    });
});
```
