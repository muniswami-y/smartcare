# CareSmart Hospital Go-Live Verification Checklist

Complete and sign off all items prior to opening the system to live hospital patients.

---

## Phase 1: Security & Secrets Hardening
- [ ] **No Default Passwords:** Verified that initial default passwords for all staff accounts have been changed.
- [ ] **Secret Strength:** Verified `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FIELD_ENCRYPTION_KEY`, and `PHONE_HASH_KEY` are cryptographically random 256-bit values.
- [ ] **Demo Data Cleared:** Verified production database contains ONLY `seed.production.ts` data (no fictitious demo patients, prescriptions, or test bills).
- [ ] **Firewall Ports:** Ports 5432 (Postgres) and 6379 (Redis) are blocked from external ingress.
- [ ] **SSL / TLS Certificate:** Caddy or external load balancer has valid HTTPS certificate with A+ Qualys SSL rating.
- [ ] **Security Headers:** Strict-Transport-Security, X-Frame-Options, Content-Security-Policy headers active.

---

## Phase 2: Clinical & Pharmacy Readiness
- [ ] **Doctor Schedules:** Consultation timings, room allocations, and leave blocks configured for all consultants.
- [ ] **Pharmacy Inventory Initial Count:** Physical stock count reconciled against batch expiry dates in the software.
- [ ] **Schedule H Doctor Registration:** Doctor MCI/SMC registration numbers verified for controlled drug audit.
- [ ] **Pathology Catalog & Ranges:** Biological reference ranges (adult male, female, pediatric) validated by Senior Pathologist.
- [ ] **Critical Panic-Value Thresholds:** SMS and alert routing confirmed for abnormal lab findings.

---

## Phase 3: Financial & Cashier Setup
- [ ] **Tariff Schedule Sign-off:** Public price list matched with hospital board approved tariff card.
- [ ] **Razorpay Live Activation:** API keys switched from test mode to live KYC-verified merchant keys.
- [ ] **Opening Cash Float:** Physical drawer float defined for morning and evening cashier shifts.
- [ ] **Concession Approval Limits:** Maximum discount percentage without superintendent sign-off set in system settings.

---

## Phase 4: Hardware & Infrastructure
- [ ] **Barcode Printers & Scanners:** Tested at phlebotomy and pharmacy counters.
- [ ] **Receipt & Document Printers:** Thermal receipt and A4 prescription printers tested for format alignment.
- [ ] **Backup Power (UPS):** Server room, cashier desk, and nursing stations on dedicated online UPS with >30 min runtime.
- [ ] **Network Redundancy:** Secondary 4G/5G failover router configured for internet continuity.
