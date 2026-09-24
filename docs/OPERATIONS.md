# CareSmart Daily Operations Runbook

This guide contains operational workflows for hospital IT administrators, system engineers, and shift operators managing CareSmart.

---

## 1. Daily Health Checks & Monitoring

Execute each morning prior to OPD opening hours (07:30 IST):

1. **System Health Endpoints:**
   - `/api/v1/health`: Checks process uptime, memory usage, and basic server responsiveness.
   - `/api/v1/ready`: Verifies active connection pool to PostgreSQL and Redis.
2. **Audit Hash Chain Integrity:**
   - Visit Admin Dashboard (`/admin`) -> Click **"Verify Audit Chain"**.
   - Ensure response indicates unbroken SHA-256 links.
3. **Background Job Execution:**
   - Check `JobRun` table or alerts for failed night runs:
     - `daily_bed_charge`: Inpatient room tariffs computed at 00:01 IST.
     - `low_stock_alerts`: Pharmacy replenishment notices.
     - `daily_snapshot`: Aggregated footfall and financial metrics.

---

## 2. Managing Staff Accounts & Access Roles

### Creating a New Staff Member:
1. Navigate to `/admin` -> **Staff & Access Roles** -> Click **"+ Add Staff Member"**.
2. Enter staff name, official email, phone number, and assign one or more primary roles:
   - `RECEPTIONIST`: Patient registration, OPD appointment booking, cashier counter.
   - `DOCTOR`: Clinical notes, e-prescriptions, diagnostic test ordering.
   - `NURSE`: Triage vitals entry, IPD medication administration (MAR).
   - `PHARMACIST`: FEFO dispensing, medicine batch inventory.
   - `LAB_TECH`: Phlebotomy sample barcoding, pathology results.
   - `RADIOLOGIST`: Image review, diagnostic study signing.
   - `ADMIN`: Staff management, hospital configuration, system audits.
   - `MANAGER`: Read-only aggregate statistics (never individual patient records).

### Deactivating Staff / Incident Response:
1. When staff leaves or in the event of compromised credentials, click **"Deactivate"** in `/admin`.
2. This immediately terminates all active JWT sessions across devices and sets `isActive: false`.
3. *Protection Rule:* The last active Administrator cannot be deactivated.

---

## 3. Cashier Shift Reconciliation Procedure

At the conclusion of each cashier shift:
1. Cashier opens `/billing` -> Clicks **"Cashier Shift & Float"**.
2. System displays:
   - Shift opening float amount (e.g. ₹5,000.00).
   - Total cash payments collected during shift.
   - Expected physical cash in drawer.
3. Cashier enters physical cash counted.
4. If there is a discrepancy > ₹100.00, cashier must provide an explanation, and an `AdminAlert` is triggered.
5. Click **"Reconcile & Close Shift"**.

---

## 4. Emergency Break-Glass Clinical Access

In severe medical emergencies (e.g., unconscious trauma patient brought to Casualty):
1. Attending Doctor selects patient record marked "Restricted".
2. Doctor clicks **"Emergency Break-Glass Access"**.
3. Doctor must input mandatory emergency rationale (e.g., *Unconscious trauma patient with acute intracranial bleed*).
4. System immediately unlocks the record, logs an `EMERGENCY_BREAK_GLASS` audit event, sends an SMS alert to the patient's registered mobile, and dispatches an alert to the Medical Superintendent.

---

## 5. Log Rotation and Backup Verification
- Backups are generated daily at 02:00 IST via `/database/scripts/backup.sh`.
- Retention schedule: Daily (14 days), Weekly (8 weeks), Monthly (12 months).
- Every Sunday, the automated verification script `verify-restore.sh` tests restoration into a temporary sandbox database.
