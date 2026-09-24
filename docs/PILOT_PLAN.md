# CareSmart Hospital Pilot Implementation Plan

A phased, low-risk 4-week rollout strategy for onboarding a real hospital in India to paperless operations.

---

## 1. Pilot Rollout Timeline

```
Week 1: Parallel Run (General Medicine OPD)
  ├── 1 Senior Doctor + 1 Receptionist Counter
  ├── Physical paper prescriptions written alongside CareSmart entry
  └── Daily evening debrief with Medical Superintendent

Week 2: Pharmacy & Billing Integration
  ├── Electronic prescriptions routed live to in-house Pharmacy
  ├── Cashier collects OPD consultation fees through CareSmart
  └── Patient receives SMS token links

Week 3: Laboratory & Inpatient (IPD) Onboarding
  ├── Phlebotomy sample collection and automated pathology reporting
  ├── Ward 1 (Male Medical Ward) bed board activation
  └── Nursing vitals and medication administration recording (MAR)

Week 4: Hospital-Wide Cutover & Patient Portal Launch
  ├── All departments transition to primary digital entry
  ├── Patient Portal launched via SMS OTP links
  └── Paper forms transition to emergency backup status only
```

---

## 2. Paper Fallback & Redundancy Protocol

During the first 90 days of live operation:
1. **Physical Pre-printed Prescription Pads:** Kept in all consultation suites with barcode stickers.
2. **Offline Receipt Books:** Kept at Cashier counters in a locked safe for use only during prolonged network failures.
3. **Daily Ingestion Protocol:** Any paper receipts or emergency paper notes used during an outage must be backfilled and audited into CareSmart within 4 hours of system restoration.

---

## 3. Human Expert Reviews & Sign-offs Required Before Full Rollout

1. **Independent Cybersecurity Audit:** External penetration testing firm review of RBAC, rate-limiting, and cryptographic hash chain.
2. **Clinical Safety Review:** Hospital Clinical Committee review of drug interaction rules, pediatric dosage formulas, and allergy cross-reactivity warnings.
3. **Discharge & Death Flow Verification:** Hospital Legal Counsel and Senior Medical Officers review of death reporting, morgue dispatch, and medico-legal case (MLC) flags.
4. **Legal Review of Consent & Privacy Language:** Advocate / Legal team review of DPDP Act patient consent disclosures in English, Telugu, and Hindi.
