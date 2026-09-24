# CareSmart: Transparent & Paperless Hospital Management System

**CareSmart** is a complete, production-ready, paperless hospital management system engineered specifically for real hospitals in India. It guarantees end-to-end transparency, mathematical tamper-proofing via cryptographic hash chaining, strict role-based access control, zero-leakage integer-paise billing, and full technical compliance with India's **Digital Personal Data Protection (DPDP) Act 2023**.

---

## 🏛️ Project Architecture & Rules

CareSmart is organized into three strictly isolated applications governed by an npm workspace:

```
caresmart/
  ├── database/   # @caresmart/database: PostgreSQL 16 schema, migrations, seed, SQL triggers, backup/restore
  ├── backend/    # @caresmart/backend: Express, TypeScript, Zod, Argon2id, JWT, AES-256-GCM, OpenAPI, Jobs
  ├── frontend/   # @caresmart/frontend: React 18, Vite, Tailwind CSS, TanStack Query, i18next (EN, TE, HI), PWA
  ├── docs/       # Comprehensive architectural, operational, security, and user documentation
  ├── e2e/        # Playwright end-to-end integration test suites
  └── loadtest/   # k6 load testing scripts (100 concurrent VUs)
```

### Core Architectural Rules:
1. **Three Isolated Apps:** `frontend/`, `backend/`, and `database/` never mix code.
2. **REST API Interface Only:** `frontend/` communicates with `backend/` strictly over `/api/v1`.
3. **Workspace Database Package:** `backend/` accesses PostgreSQL solely through `@caresmart/database`.
4. **Integer Paise Financials:** All monetary amounts are stored as integer paise (1 INR = 100 paise) to prevent floating-point rounding errors.
5. **Asia/Kolkata Display:** All timestamps stored in UTC and rendered in `Asia/Kolkata` (IST).
6. **Deny-by-Default Central RBAC:** All clinical, financial, and administrative operations are enforced server-side.
7. **Append-Only Immutable Audit Log:** Enforced by PostgreSQL triggers and SHA-256 hash chains.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ and npm 10+
- PostgreSQL 16+ running locally or in Docker
- Redis 7+ running locally or in Docker

### Step 1: Install Dependencies
```bash
# In the root repository directory:
npm install
```

### Step 2: Configure Environment Variables
Copy the template files in each workspace:
```bash
cp .env.example .env
cp database/.env.example database/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 3: Initialize Database & Demo Seed Data
```bash
# Generate Prisma Client & Run Migrations
npm run db:generate --workspace=@caresmart/database
npm run db:push --workspace=@caresmart/database

# Seed 3 doctors, 20 patients, appointments, admissions, pharmacy batches & 30-day analytics
npm run seed:demo --workspace=@caresmart/database
```

### Step 4: Run Tests
```bash
# Database package tests
npm test --workspace=@caresmart/database

# Backend RBAC, Billing, FEFO, Concurrency, and Audit Chain tests
npm test --workspace=@caresmart/backend

# Frontend UI kit and i18n completeness tests
npm test --workspace=@caresmart/frontend
```

### Step 5: Start Development Servers
Run the full stack concurrently:
```bash
# Start all three apps simultaneously:
npm run dev

# Or start individually in separate terminals:
# 1. Backend API (runs on http://localhost:4000)
npm run dev --workspace=@caresmart/backend

# 2. Frontend Web App & PWA (runs on http://localhost:5173)
npm run dev --workspace=@caresmart/frontend
```

---

## 🐳 Docker Production Stack

To deploy the entire production stack with Caddy HTTPS reverse proxy, PostgreSQL, Redis, backend, and frontend:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🔑 Demo Login Credentials

All demo accounts use the standard password: `Password123!`

| Role | Email ID | Access Permissions |
|------|----------|-------------------|
| **ADMINISTRATOR** | `admin@caresmart.in` | Full hospital administration, staff management, audit verification |
| **DOCTOR** | `doctor@caresmart.in` | OPD consult queue, clinical notes, e-prescriptions, diagnostic orders |
| **NURSE** | `nurse@caresmart.in` | Triage vitals entry, abnormal flags, inpatient MAR chart |
| **PHARMACIST** | `pharmacy@caresmart.in` | Prescription queue, FEFO batch dispensing, inventory stock |
| **LAB TECHNICIAN** | `lab@caresmart.in` | Phlebotomy sample barcoding, pathology results, panic alerts |
| **RADIOLOGIST** | `radiologist@caresmart.in`| Medical image review, source notices, certified study signing |
| **RECEPTIONIST / CASHIER** | `reception@caresmart.in` | Patient registry, appointment tokens, itemized billing desk |
| **MANAGER** | `manager@caresmart.in` | Read-only aggregate hospital analytics (no patient-level PHI) |
| **PATIENT (Mobile OTP)** | Phone: `9848012345` | OTP: Any 6-digit code (e.g. `123456`) in development/demo mode |

---

## 📖 Detailed Documentation

- [Deployment Guide](file:///d:/smartcare/docs/DEPLOYMENT.md)
- [Operations Runbook](file:///d:/smartcare/docs/OPERATIONS.md)
- [Security Review & Threat Model](file:///d:/smartcare/docs/SECURITY_REVIEW.md)
- [Disaster Recovery & Backup Procedures](file:///d:/smartcare/docs/DISASTER_RECOVERY.md)
- [Data Protection & DPDP Act 2023 Mapping](file:///d:/smartcare/docs/DATA_PROTECTION.md)
- [Go-Live Verification Checklist](file:///d:/smartcare/docs/GO_LIVE_CHECKLIST.md)
- [Pilot Rollout Plan](file:///d:/smartcare/docs/PILOT_PLAN.md)
- [Performance & Scalability Benchmark Report](file:///d:/smartcare/docs/PERFORMANCE.md)
- [User Guides by Role (Doctor, Nurse, Pharmacist, Lab, Reception, Patient)](file:///d:/smartcare/docs/USER_GUIDES/DOCTOR_GUIDE.md)
