# CareSmart Data Protection & DPDP Act 2023 Technical Mapping

*Notice: This document provides a technical description of software architectural controls and does not constitute formal legal counsel.*

---

## 1. Compliance with Digital Personal Data Protection (DPDP) Act 2023

CareSmart is engineered from the ground up to satisfy the technical mandates of India's DPDP Act 2023 and the National Health Authority (NHA) ABDM standards.

### Summary of Data Principal Rights & Technical Realization:

| DPDP Section | Principal Right | CareSmart Technical Implementation |
|--------------|-----------------|-----------------------------------|
| **Section 6** | Notice & Informed Consent | Multilingual consent prompts in English, Telugu, and Hindi before diagnostic data sharing or insurance processing. |
| **Section 11** | Right to Information about Personal Data | "Who Accessed My Medical Records" feature provides a plain-language audit trail of every staff view, timestamp, and purpose. |
| **Section 12** | Right to Correction and Erasure | Patient can submit data correction requests via portal. Erasure requests trigger an administrative review workflow (retaining mandatory clinical records as required by Indian Medical Council regulations). |
| **Section 13** | Right to Grievance Redressal | In-app grievance submission with tracking token and escalation to the Data Protection Officer (DPO). |
| **Section 9** | Processing of Children's Data | Minor accounts require verified guardian link in `FamilyGroup` with relationship validation. |

---

## 2. Emergency Break-Glass Technical Protocol

Under Section 7 (Certain Legitimate Uses for Medical Emergencies):
- Clinicians can bypass consent restrictions during life-threatening emergencies.
- The software enforces mandatory clinical justification entry.
- Immediate SMS notification is dispatched to the patient's registered mobile number.
- High-priority `AdminAlert` is routed to the Data Protection Officer and Medical Superintendent.

---

## 3. Data Minimization & Retention

1. **Storage Limitation:** Non-clinical ephemeral sessions expire in 7 days.
2. **Statutory Retention:** Clinical consultation notes, inpatient charts, and signed diagnostic reports are preserved for 3 years (OPD) and 5 years (IPD) in compliance with National Medical Commission guidelines.
3. **Data Portability:** Patients can trigger a one-click download of their complete electronic health record in open JSON/ZIP format via an encrypted, expiring link.
