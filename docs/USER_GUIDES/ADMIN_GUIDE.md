# CareSmart Administrator Quick Reference Guide

This guide covers hospital system configuration, staff management, audit verification, and KPI monitoring.

---

## 1. System Health & Operational KPIs
1. Log in with Administrator credentials and open **Admin**.
2. **Hospital KPIs:**
   - Real-time OPD footfall, bed occupancy percentage, net collections, and lab turnaround time (TAT).
   - Interactive 30-day footfall and revenue charts.

---

## 2. Staff Lifecycle & Zero-Trust RBAC
1. Click **Staff & Access Roles** to inspect active personnel.
2. To onboard staff:
   - Click **+ Add Staff Member**.
   - Input name, hospital email, phone, and role.
   - Staff receive an Argon2id-hashed temporary password with forced change on first login.
3. To deactivate staff:
   - Click **Deactivate**. All active sessions are terminated immediately.
   - *Protection:* The last active administrator cannot be deactivated.

---

## 3. Cryptographic Audit Chain Verification
1. Click **🛡️ Verify Audit Chain**.
2. The server recalculates SHA-256 links from the genesis block through all historical transactions.
3. If valid, the system returns: *"✓ Cryptographic Hash Chain is 100% UNBROKEN and Validated. No tampering detected!"*
4. Any broken link triggers an immediate security alert.
