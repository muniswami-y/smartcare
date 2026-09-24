# CareSmart Security Architecture & Threat Model Review

This document presents a comprehensive security review of CareSmart, aligned with India's Digital Personal Data Protection (DPDP) Act 2023, DISHA guidelines, OWASP Top 10, and CERT-In compliance.

---

## 1. Authentication & Session Management

| Security Control | Implementation Mechanism | Verification Test |
|------------------|--------------------------|-------------------|
| **Password Hashing** | Argon2id with memory cost 64MB, 3 iterations, 4 parallelism. | Verified in `auth.test.ts`. Brute force resistant. |
| **Staff JWT Lifecycle** | Short-lived Access Token (15 mins), Refresh Token (7 days) in HttpOnly, SameSite=Strict, Secure cookie. | Rotated on every refresh. Revocation list kills tokens upon staff deactivation. |
| **Patient OTP Authentication** | Cryptographically secure 6-digit numeric OTP, 5-minute expiry, max 5 attempts, constant-time verification. | Uniform response timing for registered vs unregistered numbers prevents phone enumeration. |
| **Account Lockout** | 5 consecutive failed login attempts locks staff account for 15 minutes. | Exponential backoff prevents brute-force dictionary attacks. |

---

## 2. Cryptographic Controls & Data Protection at Rest

1. **AES-256-GCM Sensitive Field Encryption:**
   - Patient phone numbers, addresses, ABHA identifiers, and clinical free-text notes are encrypted using AES-256-GCM before writing to the database.
   - Initialisation Vectors (IVs) and authentication tags are stored per field, preventing replay attacks.
   - Master key versioning (`v1`, `v2`) supports live zero-downtime key rotation via `database/scripts/re-encrypt.ts`.

2. **Searchable Phone Number Hashes:**
   - Phone numbers are hashed using HMAC-SHA256 with an independent pepper key (`PHONE_HASH_KEY`).
   - Enables O(1) patient lookups by phone without decrypting the entire table or exposing raw phone numbers in indexes.

3. **Tamper-Proof Audit Hash Chaining:**
   - Every read, create, update, delete, and permission denial logs an immutable entry.
   - Entry $N$ stores `sha256(prevHash + timestamp + actor + action + payload)`.
   - PostgreSQL SQL triggers prevent `UPDATE` or `DELETE` on the `AuditLog` table even by privileged database users.
   - In-process lock serializes chain generation under high concurrency to guarantee monotonic sequence integrity.

---

## 3. Central Role-Based Access Control (RBAC)

- Default policy: **DENY BY DEFAULT**.
- Every route requires explicit role authorization defined in `src/middleware/rbac.ts`.
- Every permission denial writes a high-priority event to the audit trail.
- Multi-tenancy / IDOR Safeguards:
  - Patient portal routes enforce `requireFamilyAccess(req.session.patientId, targetPatientId)`.
  - Patients can never access other families' records regardless of ID manipulation.

---

## 4. Input Validation & API Hardening

- **Zod Strict Schemas:** All incoming request bodies, query strings, and parameters are parsed using strict Zod schemas that reject unknown properties (`.strict()`).
- **No PHI in URLs or Logs:** Patient IDs and tokens are used in place of names, Aadhaar, or phone numbers.
- **Error Obfuscation:** Database errors and stack traces are suppressed in production. Users receive standard error envelopes (`code`, `message`).
- **Rate Limiting:** Redis-backed rate limiting protects `/auth/login`, `/patient/otp`, `/payments`, and `/upload`.

---

## 5. Medical Image & File Upload Security

- **File Type Validation:** Uses magic number / header inspection (not file extensions).
- **Storage Isolation:** Uploads stored outside web root with random UUID filenames.
- **Serving Authenticated Routes Only:** Files served through `/api/v1/imaging/files/:id` which validates user session, checks consent, and logs audit read.

---

## 6. npm Audit & Dependency Security Summary

- High & Critical Vulnerabilities: **0**.
- Multi-stage Docker container runs under unprivileged non-root user `caresmart` (UID 1001).
