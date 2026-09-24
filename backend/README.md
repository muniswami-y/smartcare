# @caresmart/backend

CareSmart Core Backend API built with Node.js 20, Express, TypeScript, Zod, and PostgreSQL.

## Architecture
- **Authentication**: Argon2 password hashing, lockout after repeated failures, optional TOTP 2FA, JWT access tokens (15m) + HttpOnly refresh cookies, mobile OTP for patient portal (5 min single-use).
- **Central RBAC**: Strict deny-by-default applied to all routes in `src/middleware/rbac.ts`. Audit logging of all access denials.
- **Cryptographic Hash Chain**: Every action (view, create, update, delete, login, break-glass) records SHA-256 hash linked to prior entry.
- **Field Encryption**: AES-256-GCM encryption for patient phone, address, ABHA ID, and clinical text.
- **Modules**:
  - `auth`: Staff login, patient OTP, sessions
  - `patients`: Registry, deduplication, family groups, allergies, emergency merge
  - `appointments` & `queue`: Schedules, concurrency locking against double bookings, live OPD queues
  - `consultations` & `prescriptions`: Nurse vitals flags, doctor clinical notes, multi-factor prescription safety (allergies, duplicates, active drugs, interactions)
  - `pharmacy`: Real-time prescription arrival, FEFO batch selection across inventory, non-negative stock transactions, controlled drug validation
  - `lab` & `imaging`: Barcode sample collection, critical range alerts, radiologist reporting, study uploads (JPG/PNG/PDF/DICOM), consent share links
  - `billing`: Pending charges aggregation, draft bills, discount thresholds, overpayment prevention, Razorpay test mode, cashier shifts
  - `ipd`: Ward bed boards, atomic admissions & transfers, progress notes, inpatient orders, medication administration, discharge checklists
  - `portal` & `consent`: DPDP Act 2023 compliance, data isolation by family, access audit logs, break-glass protocols
  - `admin` & `analytics`: KPI dashboard matching source data, reports (CSV/PDF), background jobs, automated alerts

## Running Tests
```bash
npm test
```
