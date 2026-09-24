# CareSmart Pharmacist Quick Reference Guide

This guide covers real-time prescription dispensing and FEFO inventory management.

---

## 1. Incoming Prescriptions Queue
1. Log in and open **Pharmacy**.
2. Prescriptions finalized by doctors appear automatically in the **Incoming Prescriptions** tab (refreshed in real time).
3. Click on a prescription to view the prescribed drugs, dosages, and doctor notes.

---

## 2. FEFO Dispensing Workflow
1. Click **Dispense (FEFO Pick)** on the target prescription.
2. The system sorts available batches by **First Expired, First Out (FEFO)**:
   - Batches with the nearest valid expiry date are picked first.
   - Expired batches are automatically blocked from selection.
3. Enter the quantity dispensed.
4. For Schedule H / controlled substances, verify and record the prescribing Doctor's Registration Number.
5. Click **Confirm & Dispense**:
   - Stock is decremented in an atomic transaction.
   - An immutable stock movement ledger entry is logged.
   - The pending charge is added to the patient's billing invoice.

---

## 3. Receiving New Inventory Batches
1. Click **+ Receive Stock** in the top right corner.
2. Input medicine generic/brand name, manufacturer batch number, expiry date, unit quantity, and retail price.
3. Click **Log Into Stock Ledger**.
