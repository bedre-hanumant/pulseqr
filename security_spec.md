# PulseQR Firestore Security Specification

## 1. Data Invariants
1. **Identity Ownership**: A `qrcodes/{qrId}` document can only be created by an authenticated, email-verified user where `owner == request.auth.uid`, `qrId == documentId`, and `scanCount == 0`.
2. **PII Isolation**: `users/{userId}` and `contact_messages/{messageId}` contain PII (`email`). Neither can ever be read or listed by non-owner standard users. `qrcodes/{qrId}` contains zero owner PII so public redirect lookups (`get`) never leak personal data.
3. **Role Non-Escalation**: Standard users cannot self-assign `role: "admin"` on `users/{userId}` creation or modify `role`/`status` on update. Admin checks verify either the `admins/{uid}` document or the bootstrapped admin email with `request.auth.token.email_verified == true`.
4. **Atomic Scan Telemetry**: A `scans/{scanId}` event can only be created if the referenced `qrcodes/{qrId}` exists, is `status == "active"`, has `qrOwner == parent.owner`, and the same atomic batch increments `qrcodes/{qrId}.scanCount` by exactly `+1` (`getAfter`).
5. **Terminal State Locking**: Once a `qrcodes/{qrId}` reaches `status == "archived"`, standard owners can no longer edit or reactivate it (only admins can override).
6. **Temporal Integrity**: `createdAt`, `updatedAt`, and `timestamp` fields must strictly equal `request.time`.
7. **ID & Size Hardening**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (<= 128 chars) and every string has explicit `.size()` upper bounds matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on QR Create**: Creating `qrcodes/qr-spoof` with `owner: "victim-uid"` while authenticated as `"attacker-uid"`. -> `PERMISSION_DENIED`.
2. **Self-Assigned Admin Privilege Escalation**: Creating `users/attacker-uid` with `role: "admin"`. -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: Creating/updating `qrcodes/qr-1` with an extra undeclared ghost field `isPremiumOverride: true`. -> `PERMISSION_DENIED`.
4. **PII Cross-User Read**: Reading `users/victim-uid` as authenticated non-admin `"attacker-uid"`. -> `PERMISSION_DENIED`.
5. **Unscoped QR List Scraping**: Listing `/qrcodes` without `where("owner", "==", request.auth.uid)` as non-admin. -> `PERMISSION_DENIED`.
6. **Email Spoofing Admin Bypass**: Authenticating with admin email string while `email_verified: false` and attempting to list `/users`. -> `PERMISSION_DENIED`.
7. **Backdated Timestamp Forgery**: Creating `qrcodes/qr-time` with a client-forged `createdAt` instead of `serverTimestamp()`. -> `PERMISSION_DENIED`.
8. **Orphaned / Non-Atomic Scan Fabrication**: Creating `scans/scan-fake` without simultaneously incrementing `qrcodes/{qrId}.scanCount` by `+1` in the same batch. -> `PERMISSION_DENIED`.
9. **Scan Count Inflation Attack**: Updating `qrcodes/qr-1` with `scanCount: existing.scanCount + 500` instead of `+1`. -> `PERMISSION_DENIED`.
10. **Terminal Archived State Mutation**: Owner attempting to change `currentLink` on a QR code whose `status` is already `"archived"`. -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Updating allowed key `customColor` with a 50KB non-hex string or boolean. -> `PERMISSION_DENIED`.
12. **Path Variable ID Poisoning**: Creating `qrcodes/invalid$id!with*badchars` or a >64 char `qrId`. -> `PERMISSION_DENIED`.
