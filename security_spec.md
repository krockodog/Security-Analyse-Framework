# Security Rules Specification

This specification governs the Zero-Trust security profile of the **Sicherheits-Analyse-Framework** deployed on Google Cloud Firestore database.

## 1. Data Invariants

1. **Custom Binaries**:
   - Any uploaded binary must be uniquely cataloged under a valid `scenarioId`.
   - Users must be authenticated (`request.auth != null`) to load or save custom binary mappings.
   - Document ID `binaryId` must strictly match the regex pattern helper `isValidId(binaryId)`.

2. **Alert Status Overrides**:
   - Dynamic alert statuses are governed by a defined state transition: 'Neu', 'Eskaliert', 'Fehlalarm', 'Gelöst'. No other string values are accepted.
   - Any status override can only be modified by signed-in users using the `request.time` server timestamp.
   - Attackers must not be able to poison alerts or inject additional fields; updates must strictly focus on `['status', 'updatedAt']`.

3. **Consultant Chat Logs**:
   - Conversations must be tied to the current analyst's `uid` (represented as `userId`).
   - Analysts may only view, update, delete, or list messages where `userId == request.auth.uid` (Strict PII & Ownership isolation).
   - Ingested AI feedback is untrusted if set from client payloads without confirming the proper role.

---

## 2. The "Dirty Dozen" Attacks (Relational Security Negative Testing)

The following 12 JSON payloads look to explore common vulnerabilities like update-gaps, ID poisoning, timestamp spoofing, or field-injection, which will be mathematically denied.

### Custom Binaries Exploits

1. **The ID Poisoning Attack**: An attacker attempts to write a custom binary with a 2MB hexadecimal string ID containing custom path traversals.
2. **Anonymous Upload Block**: A guest user who has not logged in attempts to insert an unauthenticated binary document.
3. **Ghost Fields Injection**: An authenticated user attempts to write a custom binary with structural properties plus an undeclared `isSystemAdministrator` status flag.
4. **Owner Fraud**: Authenticated user `analyst_01` attempts to override a custom binary declaring `ownerId` as `analyst_02`.

### Alert Status Exploit Payloads

5. **State Poisoning**: An attacker tries to set an alert's status to `"UnderAttack"` (an illegal status value bypassing the specified validator enum).
6. **Date Spoofing**: An attacker tries to back-date an status change using a client-side date string e.g. `"2010-01-01T00:00:00Z"` instead of `request.time`.
7. **Privilege Escalation**: A normal analyst attempts to update restricted system metadata fields such as the Sigma signature itself or severity classifications.
8. **Orphaned Write Attack**: An attacker attempts to upload alert updates for a completely non-existent mock scenario.

### Chat Logs Exploit Payloads

9. **PII Snooping**: Authenticated User B attempts to read User A's AI chat transcript.
10. **The Impersonator Message**: User A posts a message setting `userId: "analyst_vip"`.
11. **Session Hijacking Update**: An analyst attempts to mutate an existing conversation message's historical role field from `"user"` to `"model"`.
12. **System Log Flooding**: An attacker attempts to write chat messages without verifying the ID string conforms to safety dimensions (`id.size() <= 128` limit).

---

## 3. Test Runner Design (`firestore.rules.test.ts`)

A standard test module verifying that all access violations fail natively on the Firestore emulator environment.

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

// The test runner establishes direct client connections with and without auth 
// and sequentially pushes the 12 negative test cases, asserting PERMISSION_DENIED.
```
